import { prisma } from "./db";
import type { Pin } from "@/types/audit";
import type { Audit as PrismaAudit } from "@prisma/client";

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

export async function getAuditById(id: string): Promise<AuditWithPins | null> {
  const audit = await prisma.audit.findUnique({
    where: { id },
  });
  if (!audit) return null;

  const [modeRow] = await prisma.$queryRaw<[{ mode: string | null }]>`
    SELECT mode FROM Audit WHERE id = ${id}
  `;
  const mode = modeRow?.mode ?? "give_feedback";

  const aiPins = JSON.parse(audit.pinsJson) as Pin[];
  const userPins = audit.userPinsJson
    ? (JSON.parse(audit.userPinsJson) as Pin[])
    : [];

  const { pinsJson, userPinsJson, ...rest } = audit;
  return {
    ...rest,
    mode,
    pins: aiPins,
    userPins,
  };
}

export async function addUserPin(auditId: string, pin: Pin) {
  if (!auditId || typeof auditId !== "string") {
    throw new Error("Invalid audit ID");
  }

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
  });
  
  if (!audit) {
    throw new Error(`Audit not found: ${auditId}`);
  }
  
  const existingUserPins = audit.userPinsJson 
    ? (JSON.parse(audit.userPinsJson) as Pin[])
    : [];
  
  const updatedUserPins = [...existingUserPins, pin];
  
  // Ensure where clause has the id
  const result = await prisma.audit.update({
    where: { 
      id: auditId 
    },
    data: {
      userPinsJson: JSON.stringify(updatedUserPins),
    },
  });
  
  return result;
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
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) throw new Error("Audit not found");
  const createdById = (audit as AuditOwnerFields).createdById;
  if (createdById != null && createdById !== userId) {
    throw new Error("Only the owner can delete this audit");
  }
  await prisma.audit.delete({
    where: { id },
  });
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
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) return false;
  if (!userId) return false; // require sign-in to view any shared feedback
  const row = audit as AuditOwnerFields;
  if (row.shareVisibility === "public") return true;
  if (!row.createdById) return true; // legacy audits without owner: allow all
  if (row.createdById === userId) return true;
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
