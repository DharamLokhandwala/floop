import { prisma } from "./db";
import type { Pin } from "@/types/audit";

export interface CreateAuditInput {
  id: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  pins: Pin[];
}

export async function createAudit(input: CreateAuditInput) {
  return prisma.audit.create({
    data: {
      id: input.id,
      url: input.url,
      goal: input.goal,
      screenshotUrl: input.screenshotUrl,
      pinsJson: JSON.stringify(input.pins),
    },
  });
}

export async function getAuditById(id: string) {
  const audit = await prisma.audit.findUnique({
    where: { id },
  });
  if (!audit) return null;
  
  const aiPins = JSON.parse(audit.pinsJson) as Pin[];
  const userPins = audit.userPinsJson 
    ? (JSON.parse(audit.userPinsJson) as Pin[])
    : [];
  
  return {
    ...audit,
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

export async function archiveAudit(id: string) {
  await prisma.audit.update({
    where: { id },
    data: { archived: true },
  });
}

export async function unarchiveAudit(id: string) {
  await prisma.audit.update({
    where: { id },
    data: { archived: false },
  });
}

export async function deleteAudit(id: string) {
  await prisma.audit.delete({
    where: { id },
  });
}

export async function getAllAudits(): Promise<AuditListItem[]> {
  const audits = await prisma.audit.findMany({
    where: { archived: false },
    orderBy: {
      createdAt: "desc",
    },
  });

  return audits.map((audit) => ({
    id: audit.id,
    url: audit.url,
    goal: audit.goal,
    screenshotUrl: audit.screenshotUrl,
    createdAt: audit.createdAt,
  }));
}

export async function getArchivedAudits(): Promise<AuditListItem[]> {
  const audits = await prisma.audit.findMany({
    where: { archived: true },
    orderBy: {
      createdAt: "desc",
    },
  });

  return audits.map((audit) => ({
    id: audit.id,
    url: audit.url,
    goal: audit.goal,
    screenshotUrl: audit.screenshotUrl,
    createdAt: audit.createdAt,
  }));
}
