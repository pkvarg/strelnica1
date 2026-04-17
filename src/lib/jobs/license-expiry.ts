import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { notifyLicenseExpiring } from "@/lib/notify";
import type { PgBoss } from "pg-boss";

export const LICENSE_EXPIRY_SCAN = "license.expiryScan";

const THRESHOLD_DAYS = [60, 30, 7];

function daysUntil(target: Date, now: Date): number {
  const ms = target.getTime() - now.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function registerLicenseExpiryHandler(boss: PgBoss) {
  await boss.createQueue(LICENSE_EXPIRY_SCAN);
  await boss.work(LICENSE_EXPIRY_SCAN, async () => {
    const now = new Date();
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phoneE164,
        firstName: users.firstName,
        lastName: users.lastName,
        locale: users.locale,
        expiresAt: users.zbrojnyPreukazExpiresAt,
      })
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          isNotNull(users.zbrojnyPreukazExpiresAt),
        ),
      );

    for (const row of rows) {
      if (!row.expiresAt) continue;
      const expiresDate = new Date(row.expiresAt);
      const days = daysUntil(expiresDate, now);
      if (!THRESHOLD_DAYS.includes(days)) continue;

      await notifyLicenseExpiring({
        email: row.email,
        phone: row.phone,
        memberName: `${row.firstName} ${row.lastName}`,
        daysLeft: days,
        locale: row.locale,
        userId: row.id,
      }).catch((e) =>
        console.error(`[license-expiry] notify failed for ${row.id}:`, e),
      );
    }
  });
}

export async function scheduleLicenseExpiry(boss: PgBoss) {
  await boss.schedule(LICENSE_EXPIRY_SCAN, "0 3 * * *", {}, {});
}
