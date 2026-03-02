import { prisma } from "./db";
import type { Pin } from "@/types/audit";
import type { Audit as PrismaAudit } from "@prisma/client";

export type AuditWithPins = Omit<PrismaAudit, "pinsJson" | "userPinsJson"> & {
  pins: Pin[];
  userPins: Pin[];
  shareVisibility?: string | null;
  createdById?: string | null;
};

export interface CreateAuditInput {
  id: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  pins: Pin[];
  createdById?: string | null;
}

export async function createAudit(input: CreateAuditInput) {
  return prisma.audit.create({
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
}

export async function getAuditById(id: string): Promise<AuditWithPins | null> {
  const audit = await prisma.audit.findUnique({
    where: { id },
  });
  if (!audit) return null;

  const aiPins = JSON.parse(audit.pinsJson) as Pin[];
  const userPins = audit.userPinsJson
    ? (JSON.parse(audit.userPinsJson) as Pin[])
    : [];

  const { pinsJson, userPinsJson, ...rest } = audit;
  return {
    ...rest,
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

export type SharedAuditListItem = AuditListItem & { newCommentsCount: number };

export async function archiveAudit(id: string, userId: string) {
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) throw new Error("Audit not found");
  if (audit.createdById && audit.createdById !== userId) {
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
  if (audit.createdById && audit.createdById !== userId) {
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
  if (audit.createdById && audit.createdById !== userId) {
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
    const userPinsLength = s.audit.userPinsJson
      ? (JSON.parse(s.audit.userPinsJson) as unknown[]).length
      : 0;
    const newCommentsCount = Math.max(0, userPinsLength - s.lastSeenUserPinsCount);
    return {
      id: s.audit.id,
      url: s.audit.url,
      goal: s.audit.goal,
      screenshotUrl: s.audit.screenshotUrl,
      createdAt: s.audit.createdAt,
      newCommentsCount,
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

export async function setShareVisibility(auditId: string, visibility: "public" | "private", userId: string) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) throw new Error("Audit not found");
  if (audit.createdById && audit.createdById !== userId) {
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
  if (audit.createdById && audit.createdById !== sharedById) {
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
  if (audit.shareVisibility === "public") return true;
  if (!audit.createdById) return true; // legacy audits without owner: allow all
  if (audit.createdById === userId) return true;
  const share = await prisma.auditShare.findUnique({
    where: { auditId_sharedWithUserId: { auditId, sharedWithUserId: userId } },
  });
  return !!share;
}

/** When a signed-in user views a public audit they don't own, add it to their "Shared with me" so it appears on the dashboard. */
export async function addPublicAuditToSharedWithMe(auditId: string, userId: string) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit || audit.shareVisibility !== "public" || audit.createdById === userId) return;
  if (!audit.createdById) return; // no owner to attribute share to
  await prisma.auditShare.upsert({
    where: { auditId_sharedWithUserId: { auditId, sharedWithUserId: userId } },
    create: { auditId, sharedWithUserId: userId, sharedById: audit.createdById },
    update: {},
  });
}
