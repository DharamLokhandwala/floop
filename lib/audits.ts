import { randomUUID } from "crypto";
import { prisma } from "./db";
import type { Pin, PinReply } from "@/types/audit";
import type { Audit as PrismaAudit } from "@prisma/client";
import { deletePinAudio, deletePinAudioForPins } from "./audio-blobs";
import {
  AuditPinConflictError,
  mutateJsonArrayWithRetry,
  type JsonArrayMutation,
} from "./json-array-cas";

export {
  AuditPinConflictError,
  isAuditPinConflictError,
} from "./json-array-cas";

/** Assign UUIDs to pins missing `id`; persist via getAuditById when changed. */
export function ensurePinIds(pins: Pin[]): { pins: Pin[]; changed: boolean } {
  let changed = false;
  const out = pins.map((p) => {
    if (p.id && typeof p.id === "string" && p.id.length > 0) return p;
    changed = true;
    return { ...p, id: randomUUID() };
  });
  return { pins: out, changed };
}

export type PinBucket = "pins" | "userPins";

export function findPinLocation(
  aiPins: Pin[],
  userPins: Pin[],
  pinId: string
): { bucket: PinBucket; index: number } | null {
  const aiIdx = aiPins.findIndex((p) => p.id === pinId);
  if (aiIdx >= 0) return { bucket: "pins", index: aiIdx };
  const uIdx = userPins.findIndex((p) => p.id === pinId);
  if (uIdx >= 0) return { bucket: "userPins", index: uIdx };
  return null;
}

type PinJsonColumn = "pinsJson" | "userPinsJson";

function parsePinArray(raw: string | null): Pin[] {
  const parsed = JSON.parse(raw ?? "[]") as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Stored pin data is not a JSON array");
  }
  return parsed as Pin[];
}

function columnForBucket(bucket: PinBucket): PinJsonColumn {
  return bucket === "pins" ? "pinsJson" : "userPinsJson";
}

async function readPinColumn(
  auditId: string,
  column: PinJsonColumn
): Promise<{ raw: string | null } | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { pinsJson: true, userPinsJson: true },
  });
  if (!audit) return null;
  return { raw: column === "pinsJson" ? audit.pinsJson : audit.userPinsJson };
}

async function compareAndSwapPinColumn(
  auditId: string,
  column: PinJsonColumn,
  expectedRaw: string | null,
  nextRaw: string
): Promise<boolean> {
  if (column === "pinsJson") {
    if (expectedRaw === null) return false;
    const updated = await prisma.audit.updateMany({
      where: { id: auditId, pinsJson: expectedRaw },
      data: { pinsJson: nextRaw },
    });
    return updated.count === 1;
  }

  const updated = await prisma.audit.updateMany({
    where: { id: auditId, userPinsJson: expectedRaw },
    data: { userPinsJson: nextRaw },
  });
  return updated.count === 1;
}

async function mutatePinColumn<Result>(
  auditId: string,
  column: PinJsonColumn,
  operation: string,
  mutate: (
    pins: Pin[],
    context: { attempt: number }
  ) => JsonArrayMutation<Pin, Result>,
  options?: {
    initialRaw?: string | null;
    beforeCompareAndSwap?: (result: Result) => Promise<void>;
  }
): Promise<Result> {
  return mutateJsonArrayWithRetry({
    operation,
    read: () => readPinColumn(auditId, column),
    compareAndSwap: (expectedRaw, nextRaw) =>
      compareAndSwapPinColumn(auditId, column, expectedRaw, nextRaw),
    mutate,
    ...(
      options && Object.prototype.hasOwnProperty.call(options, "initialRaw")
        ? { initialSnapshot: { raw: options.initialRaw ?? null } }
        : {}
    ),
    beforeCompareAndSwap: options?.beforeCompareAndSwap
      ? ({ result }) => options.beforeCompareAndSwap!(result)
      : undefined,
    onConflict: (attempt, maxAttempts) => {
      console.warn("[audit-pin-cas] Conditional update lost a race", {
        auditId,
        column,
        operation,
        attempt,
        maxAttempts,
      });
    },
  });
}

async function getPinBucket(
  auditId: string,
  pinId: string
): Promise<PinBucket | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { pinsJson: true, userPinsJson: true },
  });
  if (!audit) throw new Error("Audit not found");
  return findPinLocation(
    parsePinArray(audit.pinsJson),
    parsePinArray(audit.userPinsJson),
    pinId
  )?.bucket ?? null;
}

export async function appendPinReply(
  auditId: string,
  pinId: string,
  reply: PinReply
): Promise<void> {
  const bucket = await getPinBucket(auditId, pinId);
  if (!bucket) throw new Error("Pin not found");

  await mutatePinColumn(
    auditId,
    columnForBucket(bucket),
    "add pin reply",
    (pins) => {
      const index = pins.findIndex((pin) => pin.id === pinId);
      if (index < 0) {
        throw new AuditPinConflictError("Pin changed while adding a reply; please retry");
      }
      const existingReplies = pins[index].replies ?? [];
      if (existingReplies.some((candidate) => candidate.id === reply.id)) {
        return { kind: "noop", result: undefined };
      }
      const next = [...pins];
      next[index] = {
        ...next[index],
        replies: [...existingReplies, reply],
      };
      return { kind: "write", next, result: undefined };
    }
  );
}

export async function deletePinById(auditId: string, pinId: string): Promise<void> {
  const bucket = await getPinBucket(auditId, pinId);
  // Repeating a successful delete is an idempotent no-op.
  if (!bucket) return;

  await mutatePinColumn<Pin | null>(
    auditId,
    columnForBucket(bucket),
    "delete pin",
    (pins) => {
      const index = pins.findIndex((pin) => pin.id === pinId);
      if (index < 0) return { kind: "noop", result: null };
      return {
        kind: "write",
        next: pins.filter((_, candidateIndex) => candidateIndex !== index),
        result: pins[index],
      };
    },
    {
      // Preserve fix 5's ordering: Blob cleanup is awaited before the database
      // reference is removed. A lost CAS retries against the fresh pin array.
      beforeCompareAndSwap: async (pin) => {
        if (pin) await deletePinAudio(auditId, pin.audioUrl);
      },
    }
  );
}

export async function updatePinFeedback(
  auditId: string,
  pinId: string,
  newFeedback: string
): Promise<Pin> {
  const bucket = await getPinBucket(auditId, pinId);
  if (!bucket) throw new Error("Pin not found");

  return mutatePinColumn<Pin>(
    auditId,
    columnForBucket(bucket),
    "update pin feedback",
    (pins) => {
      const index = pins.findIndex((pin) => pin.id === pinId);
      if (index < 0) {
        throw new AuditPinConflictError("Pin changed while updating feedback; please retry");
      }
      if (pins[index].feedback === newFeedback) {
        return { kind: "noop", result: pins[index] };
      }
      const next = [...pins];
      next[index] = { ...next[index], feedback: newFeedback };
      return { kind: "write", next, result: next[index] };
    }
  );
}

export async function updatePinReply(
  auditId: string,
  pinId: string,
  replyId: string,
  newBody: string
): Promise<void> {
  const bucket = await getPinBucket(auditId, pinId);
  if (!bucket) throw new Error("Pin not found");

  await mutatePinColumn(
    auditId,
    columnForBucket(bucket),
    "update pin reply",
    (pins, context) => {
      const pinIndex = pins.findIndex((pin) => pin.id === pinId);
      if (pinIndex < 0) {
        throw new AuditPinConflictError("Pin changed while updating a reply; please retry");
      }
      const replies = [...(pins[pinIndex].replies ?? [])];
      const replyIndex = replies.findIndex((reply) => reply.id === replyId);
      if (replyIndex < 0) {
        if (context.attempt > 0) {
          throw new AuditPinConflictError("Reply changed concurrently; please retry");
        }
        throw new Error("Reply not found");
      }
      if (replies[replyIndex].body === newBody) {
        return { kind: "noop", result: undefined };
      }
      replies[replyIndex] = { ...replies[replyIndex], body: newBody };
      const next = [...pins];
      next[pinIndex] = { ...next[pinIndex], replies };
      return { kind: "write", next, result: undefined };
    }
  );
}

export async function deletePinReply(
  auditId: string,
  pinId: string,
  replyId: string
): Promise<void> {
  const bucket = await getPinBucket(auditId, pinId);
  if (!bucket) throw new Error("Pin not found");

  await mutatePinColumn(
    auditId,
    columnForBucket(bucket),
    "delete pin reply",
    (pins) => {
      const pinIndex = pins.findIndex((pin) => pin.id === pinId);
      if (pinIndex < 0) {
        throw new AuditPinConflictError("Pin changed while deleting a reply; please retry");
      }
      const replies = [...(pins[pinIndex].replies ?? [])];
      const replyIndex = replies.findIndex((reply) => reply.id === replyId);
      // Repeating a successful reply delete is an idempotent no-op.
      if (replyIndex < 0) return { kind: "noop", result: undefined };
      replies.splice(replyIndex, 1);
      const next = [...pins];
      next[pinIndex] = { ...next[pinIndex], replies };
      return { kind: "write", next, result: undefined };
    }
  );
}

/** Used when reading createdById/shareVisibility/mode so code works even if Prisma client types omit them (e.g. on Vercel). */
type AuditOwnerFields = { createdById?: string | null; shareVisibility?: string | null; mode?: string | null };

export type AuditWithPins = Omit<PrismaAudit, "pinsJson" | "userPinsJson"> & {
  pins: Pin[];
  userPins: Pin[];
  shareVisibility?: string | null;
  createdById?: string | null;
  mode?: string | null;
};

export interface CreateAuditInput {
  id: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  pins: Pin[];
  createdById?: string | null;
  /** "give_feedback" | "request_feedback"; default give_feedback */
  mode?: "give_feedback" | "request_feedback";
}

export async function createAudit(input: CreateAuditInput) {
  const audit = await prisma.audit.create({
    data: {
      id: input.id,
      url: input.url,
      goal: input.goal,
      screenshotUrl: input.screenshotUrl,
      pinsJson: JSON.stringify(input.pins),
      ...(input.createdById != null && input.createdById !== ""
        ? { creator: { connect: { id: input.createdById } } }
        : {}),
    },
  });
  if (input.mode === "request_feedback") {
    await prisma.$executeRaw`UPDATE Audit SET mode = 'request_feedback' WHERE id = ${input.id}`;
  }
  return audit;
}

async function ensurePinIdsInColumn(
  auditId: string,
  column: PinJsonColumn,
  initialRaw: string | null
): Promise<Pin[]> {
  return mutatePinColumn<Pin[]>(
    auditId,
    column,
    "backfill legacy pin IDs",
    (pins) => {
      const result = ensurePinIds(pins);
      return result.changed
        ? { kind: "write", next: result.pins, result: result.pins }
        : { kind: "noop", result: result.pins };
    },
    { initialRaw }
  );
}

export async function getAuditById(id: string): Promise<AuditWithPins | null> {
  const audit = await prisma.audit.findUnique({
    where: { id },
  });
  if (!audit) return null;

  const [modeRow] = await prisma.$queryRaw<[{ mode: string | null }]>`
    SELECT mode FROM Audit WHERE id = ${id}
  `;
  const mode = modeRow?.mode ?? "give_feedback";

  // Legacy pin IDs must remain stable across reads, so keep persisting them.
  // Each independent column is now conditionally updated and retried instead
  // of rewriting both columns from one stale snapshot.
  const [pins, userPins] = await Promise.all([
    ensurePinIdsInColumn(id, "pinsJson", audit.pinsJson),
    ensurePinIdsInColumn(id, "userPinsJson", audit.userPinsJson),
  ]);

  const { pinsJson, userPinsJson, ...rest } = audit;
  void pinsJson;
  void userPinsJson;
  return {
    ...rest,
    mode,
    pins,
    userPins,
  };
}

export type AddUserPinResult = {
  created: boolean;
  pin: Pin;
};

export async function addUserPin(
  auditId: string,
  pin: Pin
): Promise<AddUserPinResult> {
  if (!auditId || typeof auditId !== "string") {
    throw new Error("Invalid audit ID");
  }

  // Generate once, outside the retry loop. Callers that supply a stable ID get
  // idempotency across whole-request retries as well as internal CAS retries.
  const stablePin = pin.id ? pin : { ...pin, id: randomUUID() };

  return mutatePinColumn<AddUserPinResult>(
    auditId,
    "userPinsJson",
    "add user pin",
    (pins) => {
      const existing = pins.find((candidate) => candidate.id === stablePin.id);
      if (existing) {
        return {
          kind: "noop",
          result: { created: false, pin: existing },
        };
      }
      return {
        kind: "write",
        next: [...pins, stablePin],
        result: { created: true, pin: stablePin },
      };
    }
  );
}

export type AuditListItem = {
  id: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  createdAt: Date;
};

/** Requested audit with counts needed for the requested tab. */
export type RequestedAuditListItem = AuditListItem & {
  /** Total number of comments (user pins). */
  feedbackCount: number;
  /** Optional reviewer name captured when sharing the request link. */
  reviewerName?: string | null;
  /** Number of new comments since the owner last viewed the audit. */
  newCommentsCount: number;
};

export type SharedAuditListItem = AuditListItem & {
  /** Total number of comments (user pins). */
  feedbackCount: number;
  newCommentsCount: number;
  isOwner?: boolean;
  /** Name set in share modal (who you're flooping to). */
  reviewerName?: string | null;
};

export async function archiveAudit(id: string, userId: string) {
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) throw new Error("Audit not found");
  const createdById = (audit as AuditOwnerFields).createdById;
  if (createdById != null && createdById !== userId) {
    throw new Error("Only the owner can archive this audit");
  }
  await prisma.audit.update({
    where: { id },
    data: { archived: true },
  });
}

export async function unarchiveAudit(id: string, userId: string) {
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) throw new Error("Audit not found");
  const createdById = (audit as AuditOwnerFields).createdById;
  if (createdById != null && createdById !== userId) {
    throw new Error("Only the owner can restore this audit");
  }
  await prisma.audit.update({
    where: { id },
    data: { archived: false },
  });
}

export async function deleteAudit(id: string, userId: string) {
  let audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) throw new Error("Audit not found");
  if ((audit as AuditOwnerFields).createdById != null && audit.createdById !== userId) {
    throw new Error("Only the owner can delete this audit");
  }

  // Compare-and-delete prevents a pin submitted concurrently with audit
  // deletion from creating an audio object that was not in our cleanup set.
  // The add-pin route rolls its upload back if the audit disappears first.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const aiPins = JSON.parse(audit.pinsJson) as Pin[];
    const userPins = audit.userPinsJson ? (JSON.parse(audit.userPinsJson) as Pin[]) : [];
    // As with single-pin deletion, fail the operation if Blob cleanup still
    // fails after its bounded retries. This preserves a retryable DB reference.
    await deletePinAudioForPins(id, [...aiPins, ...userPins]);

    const deleted = await prisma.audit.deleteMany({
      where: {
        id,
        pinsJson: audit.pinsJson,
        userPinsJson: audit.userPinsJson,
      },
    });
    if (deleted.count === 1) return;

    const latest = await prisma.audit.findUnique({ where: { id } });
    if (!latest) return;
    if ((latest as AuditOwnerFields).createdById != null && latest.createdById !== userId) {
      throw new Error("Only the owner can delete this audit");
    }
    audit = latest;
  }

  throw new Error("Audit changed while being deleted; please retry");
}

export async function getAuditsCreatedByMe(userId: string): Promise<AuditListItem[]> {
  const audits = await prisma.audit.findMany({
    where: { createdById: userId, archived: false },
    orderBy: { createdAt: "desc" },
  });
  return audits.map((audit) => ({
    id: audit.id,
    url: audit.url,
    goal: audit.goal,
    screenshotUrl: audit.screenshotUrl,
    createdAt: audit.createdAt,
  }));
}

export async function getArchivedAuditsCreatedByMe(userId: string): Promise<AuditListItem[]> {
  const audits = await prisma.audit.findMany({
    where: { createdById: userId, archived: true },
    orderBy: { createdAt: "desc" },
  });
  return audits.map((audit) => ({
    id: audit.id,
    url: audit.url,
    goal: audit.goal,
    screenshotUrl: audit.screenshotUrl,
    createdAt: audit.createdAt,
  }));
}

export async function getAuditsSharedWithMe(userId: string): Promise<SharedAuditListItem[]> {
  const shares = await prisma.auditShare.findMany({
    where: { sharedWithUserId: userId },
    include: { audit: true },
    orderBy: { createdAt: "desc" },
  });
  return shares.map((s) => {
    const feedbackCount = s.audit.userPinsJson
      ? (JSON.parse(s.audit.userPinsJson) as unknown[]).length
      : 0;
    const newCommentsCount = Math.max(0, feedbackCount - s.lastSeenUserPinsCount);
    return {
      id: s.audit.id,
      url: s.audit.url,
      goal: s.audit.goal,
      screenshotUrl: s.audit.screenshotUrl,
      createdAt: s.audit.createdAt,
      feedbackCount,
      newCommentsCount,
      reviewerName: (s.audit as { reviewerName?: string | null }).reviewerName ?? null,
    };
  });
}

/** Update the shared audit’s “last seen” user-pins count so new comments can be computed for the viewer. */
export async function updateLastSeenForSharedAudit(
  auditId: string,
  sharedWithUserId: string,
  userPinsCount: number
) {
  await prisma.auditShare.updateMany({
    where: { auditId, sharedWithUserId },
    data: { lastSeenUserPinsCount: userPinsCount },
  });
}

/** Update the owner's \"last seen\" user-pins count so new comments can be computed for the requested tab. */
export async function updateOwnerLastSeenForAudit(
  auditId: string,
  ownerId: string,
  userPinsCount: number
) {
  await prisma.$executeRaw`
    UPDATE Audit SET ownerLastSeenUserPinsCount = ${userPinsCount}
    WHERE id = ${auditId} AND createdById = ${ownerId}
  `;
}

/** Set or update the reviewer name for a request-feedback audit (owned by the caller). */
export async function setReviewerName(
  auditId: string,
  ownerId: string,
  reviewerName: string
) {
  await prisma.$executeRaw`
    UPDATE Audit SET reviewerName = ${reviewerName}
    WHERE id = ${auditId} AND createdById = ${ownerId}
  `;
}

export async function getCreatedByMeCount(userId: string): Promise<number> {
  return prisma.audit.count({
    where: { createdById: userId, archived: false },
  });
}

export async function getSharedWithMeCount(userId: string): Promise<number> {
  return prisma.auditShare.count({
    where: { sharedWithUserId: userId },
  });
}

/** Floops requested: audits I created where I'm requesting feedback (mode request_feedback). */
export async function getAuditsRequestedByMe(userId: string): Promise<RequestedAuditListItem[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      url: string;
      goal: string;
      screenshotUrl: string;
      createdAt: Date;
      userPinsJson: string | null;
      reviewerName: string | null;
      ownerLastSeenUserPinsCount: number | null;
    }[]
  >`
    SELECT id, url, goal, screenshotUrl, createdAt, userPinsJson, reviewerName, ownerLastSeenUserPinsCount
    FROM Audit
    WHERE createdById = ${userId} AND archived = 0 AND mode = 'request_feedback'
    ORDER BY createdAt DESC
  `;
  return rows.map((r) => {
    let feedbackCount = 0;
    if (r.userPinsJson) {
      try {
        const arr = JSON.parse(r.userPinsJson) as unknown[];
        feedbackCount = Array.isArray(arr) ? arr.length : 0;
      } catch {
        feedbackCount = 0;
      }
    }
    const lastSeen = r.ownerLastSeenUserPinsCount ?? 0;
    const newCommentsCount = Math.max(0, feedbackCount - lastSeen);
    return {
      id: r.id,
      url: r.url,
      goal: r.goal,
      screenshotUrl: r.screenshotUrl,
      createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
      feedbackCount,
      reviewerName: r.reviewerName,
      newCommentsCount,
    };
  });
}

/** Floops given: audits I created with give_feedback + audits shared with me. */
export async function getAuditsGivenByMe(userId: string): Promise<SharedAuditListItem[]> {
  const [createdRows, sharedList] = await Promise.all([
    prisma.$queryRaw<
      { id: string; url: string; goal: string; screenshotUrl: string; createdAt: Date; userPinsJson: string | null; reviewerName: string | null }[]
    >`
      SELECT id, url, goal, screenshotUrl, createdAt, userPinsJson, reviewerName FROM Audit
      WHERE createdById = ${userId} AND archived = 0 AND (mode IS NULL OR mode != 'request_feedback')
      ORDER BY createdAt DESC
    `,
    getAuditsSharedWithMe(userId),
  ]);
  const createdGiven = createdRows.map((r) => {
    let feedbackCount = 0;
    if (r.userPinsJson) {
      try {
        const arr = JSON.parse(r.userPinsJson) as unknown[];
        feedbackCount = Array.isArray(arr) ? arr.length : 0;
      } catch {
        feedbackCount = 0;
      }
    }
    return {
      id: r.id,
      url: r.url,
      goal: r.goal,
      screenshotUrl: r.screenshotUrl,
      createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
      feedbackCount,
      reviewerName: r.reviewerName,
    };
  });
  const createdItems: SharedAuditListItem[] = createdGiven.map((a) => ({
    id: a.id,
    url: a.url,
    goal: a.goal,
    screenshotUrl: a.screenshotUrl,
    createdAt: a.createdAt,
    feedbackCount: a.feedbackCount,
    newCommentsCount: 0,
    isOwner: true,
    reviewerName: a.reviewerName,
  }));
  const seen = new Set(createdItems.map((a) => a.id));
  const merged = [...createdItems];
  for (const s of sharedList) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      merged.push({ ...s, isOwner: false });
    }
  }
  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return merged;
}

export async function getRequestedByMeCount(userId: string): Promise<number> {
  const result = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*) as count FROM Audit
    WHERE createdById = ${userId} AND archived = 0 AND mode = 'request_feedback'
  `;
  return Number(result[0]?.count ?? 0);
}

export async function getGivenByMeCount(userId: string): Promise<number> {
  const [createdRows, shared] = await Promise.all([
    prisma.$queryRaw<[{ id: string }]>`
      SELECT id FROM Audit
      WHERE createdById = ${userId} AND archived = 0 AND (mode IS NULL OR mode != 'request_feedback')
    `,
    prisma.auditShare.findMany({
      where: { sharedWithUserId: userId },
      select: { auditId: true },
    }),
  ]);
  const givenCreatedIds = createdRows.map((r) => r.id);
  return new Set([...givenCreatedIds, ...shared.map((r) => r.auditId)]).size;
}

export async function setShareVisibility(auditId: string, visibility: "public" | "private", userId: string) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) throw new Error("Audit not found");
  const createdById = (audit as AuditOwnerFields).createdById;
  if (createdById != null && createdById !== userId) {
    throw new Error("Only the owner can change share settings");
  }
  await prisma.audit.update({
    where: { id: auditId },
    data: { shareVisibility: visibility },
  });
}

export async function shareAuditWithEmail(auditId: string, email: string, sharedById: string) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) throw new Error("Audit not found");
  const createdById = (audit as AuditOwnerFields).createdById;
  if (createdById != null && createdById !== sharedById) {
    throw new Error("Only the owner can share this audit");
  }
  const normalizedEmail = email.trim().toLowerCase();
  const users = await prisma.user.findMany({ where: { email: { not: null } } });
  const sharedWith = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
  if (!sharedWith) {
    throw new Error("No account found with that email");
  }
  if (sharedWith.id === sharedById) {
    throw new Error("You cannot share with yourself");
  }
  await prisma.auditShare.upsert({
    where: {
      auditId_sharedWithUserId: { auditId, sharedWithUserId: sharedWith.id },
    },
    create: { auditId, sharedWithUserId: sharedWith.id, sharedById },
    update: {},
  });
  await prisma.audit.update({
    where: { id: auditId },
    data: { shareVisibility: "private" },
  });
}

export async function canViewAudit(auditId: string, userId: string | null): Promise<boolean> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      createdById: true,
      shareVisibility: true,
      mode: true,
    },
  });
  if (!audit) return false;
  if (!userId) {
    // Request-feedback links are the one deliberate anonymous product mode.
    // They are created public; making one private must revoke anonymous access.
    return audit.mode === "request_feedback" && audit.shareVisibility === "public";
  }
  if (audit.shareVisibility === "public") return true;
  if (!audit.createdById) return true; // legacy audits without owner: allow signed-in users
  if (audit.createdById === userId) return true;
  const share = await prisma.auditShare.findUnique({
    where: { auditId_sharedWithUserId: { auditId, sharedWithUserId: userId } },
  });
  return !!share;
}

/** When a signed-in user views a public audit they don't own, add it to their "Shared with me" so it appears on the dashboard. */
export async function addPublicAuditToSharedWithMe(auditId: string, userId: string) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  const row = audit as AuditOwnerFields | undefined;
  if (!audit || row?.shareVisibility !== "public" || row?.createdById === userId) return;
  if (!row?.createdById) return; // no owner to attribute share to
  await prisma.auditShare.upsert({
    where: { auditId_sharedWithUserId: { auditId, sharedWithUserId: userId } },
    create: { auditId, sharedWithUserId: userId, sharedById: row.createdById },
    update: {},
  });
}
