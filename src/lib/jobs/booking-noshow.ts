import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { PgBoss } from "pg-boss";

export const BOOKING_NOSHOW_SWEEP = "booking.noShowSweep";

export function registerNoShowHandler(boss: PgBoss) {
  boss.work<{ bookingId: string }>(BOOKING_NOSHOW_SWEEP, async (jobs) => {
    for (const job of jobs) {
      const { bookingId } = job.data;

      const [booking] = await db
        .select({ id: bookings.id, status: bookings.status })
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, "approved")))
        .limit(1);

      if (!booking) continue;

      await db
        .update(bookings)
        .set({ status: "no_show" })
        .where(eq(bookings.id, bookingId));
    }
  });
}

export async function scheduleNoShowSweep(boss: PgBoss, bookingId: string, startsAt: Date) {
  const sweepAt = new Date(startsAt.getTime() + 15 * 60 * 1000);
  const delaySeconds = Math.floor((sweepAt.getTime() - Date.now()) / 1000);
  if (delaySeconds <= 0) return;

  await boss.send(BOOKING_NOSHOW_SWEEP, { bookingId }, {
    startAfter: delaySeconds,
    singletonKey: `noshow-${bookingId}`,
  });
}
