"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isWithinOpeningHours, isClosedDuring } from "@/lib/availability";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getPgBoss } from "@/lib/pgboss";
import { scheduleBookingExpiry } from "@/lib/jobs/booking-expiry";

interface BookingResult {
  error?: string;
  success?: boolean;
}

export async function requestBooking(
  _prev: BookingResult | null,
  formData: FormData,
): Promise<BookingResult> {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const rangeId = formData.get("rangeId") as string;
  const date = formData.get("date") as string;
  const startTime = formData.get("startTime") as string;
  const hours = parseInt(formData.get("hours") as string, 10) || 1;
  const guestCount = parseInt(formData.get("guestCount") as string, 10) || 0;
  const userNote = (formData.get("userNote") as string) || null;

  if (!rangeId || !date || !startTime) {
    return { error: "All fields are required" };
  }

  const startsAt = new Date(`${date}T${startTime}`);
  const endsAt = new Date(startsAt.getTime() + hours * 60 * 60 * 1000);

  if (startsAt <= new Date()) {
    return { error: "Cannot book in the past" };
  }

  const withinHours = await isWithinOpeningHours(rangeId, startsAt, endsAt);
  if (!withinHours) {
    return { error: "outsideHours" };
  }

  const closed = await isClosedDuring(rangeId, startsAt, endsAt);
  if (closed) {
    return { error: "closedRange" };
  }

  try {
    const [booking] = await db
      .insert(bookings)
      .values({
        userId: session.user.id,
        rangeId,
        startsAt,
        endsAt,
        guestCount,
        userNote,
        rulesConsentVersionAtBooking: "v1",
      })
      .returning({ id: bookings.id });

    await writeAudit({
      actorUserId: session.user.id,
      action: "request_booking",
      entityType: "booking",
      entityId: booking.id,
      after: { rangeId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
    });

    try {
      const boss = getPgBoss();
      await scheduleBookingExpiry(boss, booking.id);
    } catch {
      // pg-boss may not be started yet in dev; booking still created
    }
    // TODO M4: enqueue notify.admins.bookingRequest

    revalidatePath("/app/rezervacie");
    return { success: true };
  } catch (e: unknown) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("bookings_no_overlap")) {
      return { error: "slotTaken" };
    }
    throw e;
  }
}

export async function cancelBooking(bookingId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const [booking] = await db
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)),
    )
    .limit(1);

  if (!booking) throw new Error("Booking not found");
  if (booking.startsAt <= new Date()) throw new Error("Cannot cancel past booking");
  if (!["requested", "approved"].includes(booking.status)) {
    throw new Error("Cannot cancel this booking");
  }

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, bookingId));

  await writeAudit({
    actorUserId: session.user.id,
    action: "cancel_booking",
    entityType: "booking",
    entityId: bookingId,
    before: { status: booking.status },
    after: { status: "cancelled" },
  });

  revalidatePath("/app/rezervacie");
}
