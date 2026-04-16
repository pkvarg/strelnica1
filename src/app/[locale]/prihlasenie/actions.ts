"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  const login = formData.get("login") as string;
  const password = formData.get("password") as string;

  if (!login || !password) {
    return { error: "invalidCredentials" };
  }

  const ip = await getClientIp() ?? "unknown";
  const { allowed } = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return { error: "invalidCredentials" };
  }

  try {
    await signIn("credentials", {
      login,
      password,
      redirect: false,
    });

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, login), eq(users.phoneE164, login)))
      .limit(1);

    if (user) {
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      await writeAudit({
        actorUserId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
      });
    }

    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "invalidCredentials" };
    }
    throw error;
  }
}
