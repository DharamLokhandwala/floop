import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { authOptions } from "./auth-options";

const SALT_ROUNDS = 10;

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
