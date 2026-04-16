"use server";

import { db } from "@/db";
import { users, verificationCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/tokens";
import crypto from "crypto";
import { writeAudit } from "@/lib/audit";

export async function requestPasswordReset(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "Email is required" };

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success to avoid email enumeration
  if (!user) return { success: true };

  const code = crypto.randomInt(100000, 999999).toString();
  const token = generateToken();

  await db.insert(verificationCodes).values({
    userId: user.id,
    purpose: "password_reset",
    codeHash: hashToken(code),
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
  });

  // TODO M4: send password reset email via hono_bun with token

  return { success: true };
}

export async function resetPassword(
  token: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 8) return { error: "passwordTooShort" };
  if (password !== confirmPassword) return { error: "passwordMismatch" };

  const tokenHash = hashToken(token);

  const [vc] = await db
    .select()
    .from(verificationCodes)
    .where(eq(verificationCodes.tokenHash, tokenHash))
    .limit(1);

  if (!vc || vc.usedAt || vc.expiresAt < new Date()) {
    return { error: "invalidToken" };
  }

  const argon2 = await import("argon2");
  const passwordHash = await argon2.hash(password);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, vc.userId));

  await db
    .update(verificationCodes)
    .set({ usedAt: new Date() })
    .where(eq(verificationCodes.id, vc.id));

  await writeAudit({
    actorUserId: vc.userId,
    action: "password_reset",
    entityType: "user",
    entityId: vc.userId,
  });

  return { success: true };
}
