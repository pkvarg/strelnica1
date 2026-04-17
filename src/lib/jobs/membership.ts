import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { notifyMembershipReminder } from "@/lib/notify";
import type { PgBoss } from "pg-boss";

export const MEMBERSHIP_ROLLOVER = "membership.rolloverCreate";
export const MEMBERSHIP_REMINDER = "membership.reminder";

const DEFAULT_FEE = process.env.MEMBERSHIP_DEFAULT_FEE || "50.00";

export async function registerMembershipRolloverHandler(boss: PgBoss) {
  await boss.createQueue(MEMBERSHIP_ROLLOVER);
  await boss.work(MEMBERSHIP_ROLLOVER, async () => {
    const year = new Date().getFullYear();

    const activeMembers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.status, "active"));

    for (const m of activeMembers) {
      const existing = await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(and(eq(memberships.userId, m.id), eq(memberships.year, year)))
        .limit(1);

      if (existing.length > 0) continue;

      await db.insert(memberships).values({
        userId: m.id,
        year,
        feeAmount: DEFAULT_FEE,
      });
    }

    console.log(`[membership-rollover] Created unpaid rows for ${year}`);
  });
}

export async function registerMembershipReminderHandler(boss: PgBoss) {
  await boss.createQueue(MEMBERSHIP_REMINDER);
  await boss.work(MEMBERSHIP_REMINDER, async () => {
    const year = new Date().getFullYear();

    const unpaid = await db
      .select({
        userId: memberships.userId,
        email: users.email,
        phone: users.phoneE164,
        firstName: users.firstName,
        lastName: users.lastName,
        locale: users.locale,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.year, year),
          isNull(memberships.paidAt),
          isNull(memberships.cancelledAt),
          eq(users.status, "active"),
        ),
      );

    for (const u of unpaid) {
      await notifyMembershipReminder({
        email: u.email,
        phone: u.phone,
        memberName: `${u.firstName} ${u.lastName}`,
        year,
        locale: u.locale,
        userId: u.userId,
      }).catch((e) =>
        console.error(`[membership-reminder] notify failed for ${u.userId}:`, e),
      );
    }
  });
}

export async function scheduleMembershipCrons(boss: PgBoss) {
  // Jan 1 00:05 — create unpaid rows for new year
  await boss.schedule(MEMBERSHIP_ROLLOVER, "5 0 1 1 *", {}, {});
  // Dec 15 09:00 — nag members without paid row for current year
  await boss.schedule(MEMBERSHIP_REMINDER, "0 9 15 12 *", {}, {});
  // Jan 5 09:00 — second nag for new year's fees
  await boss.schedule(MEMBERSHIP_REMINDER, "0 9 5 1 *", {}, { singletonKey: "membership-reminder-jan" });
}
