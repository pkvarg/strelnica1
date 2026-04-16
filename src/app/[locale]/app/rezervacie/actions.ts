"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isWithinOpeningHours, isClosedDuring } from "@/lib/availability";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getPgBoss } from "@/lib/pgboss";
import { scheduleBookingExpiry } from "@/lib/jobs/booking-expiry";
import { issueApprovalTokens } from "@/lib/approval-tokens";
import { rateLimit } from "@/lib/rate-limit";
import { notifyAdminsBookingRequest, notifyMemberBookingCancelled } from "@/lib/notify";
import { fmtDate, fmtTime } from "@/lib/format";

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

  const { allowed } = rateLimit(`booking:${session.user.id}`, 5, 60 * 1000);
  if (!allowed) return { error: "Too many requests" };

  const rangeId = formData.get("rangeId") as string;
  const date = formData.get("date") as string;
  const startTime = formData.get("startTime") as string;
  const hours = parseInt(formData.get("hours") as string, 10) || 1;
  const guestCount = parseInt(formData.get("guestCount") as string, 10) || 0;
  const userNote = (formData.get("userNote") as string) || null;

  if (!rangeId || !date || !startTime) {
    return { error: "All fields are required" };
  }

  if (!/^\d{2}:00$/.test(startTime)) {
    return { error: "Start time must be a whole hour" };
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
    const adminTokens = await issueApprovalTokens(booking.id);

    try {
      const [member] = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          locale: users.locale,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      const adminRows = await db
        .select({ id: users.id, email: users.email, phoneE164: users.phoneE164 })
        .from(users)
        .where(eq(users.role, "admin"));

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const locale = member?.locale || "sk";

      const admins = adminRows.map((a) => {
        const approveToken = adminTokens.find(
          (t) => t.adminUserId === a.id && t.action === "approve",
        )?.token;
        const declineToken = adminTokens.find(
          (t) => t.adminUserId === a.id && t.action === "decline",
        )?.token;
        return {
          email: a.email,
          phone: a.phoneE164,
          approveUrl: `${appUrl}/${locale}/admin/decide/${approveToken}`,
          declineUrl: `${appUrl}/${locale}/admin/decide/${declineToken}`,
        };
      });

      await notifyAdminsBookingRequest({
        memberName: member ? `${member.firstName} ${member.lastName}` : "—",
        memberEmail: member?.email || "",
        rangeId,
        date: fmtDate(startsAt),
        time: fmtTime(startsAt),
        guestCount,
        note: userNote,
        admins,
        locale,
        bookingId: booking.id,
      }).catch(console.error);
    } catch (e) {
      console.error("[requestBooking] admin notify failed:", e);
    }

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

  const { allowed } = rateLimit(`cancel:${session.user.id}`, 20, 60 * 60 * 1000);
  if (!allowed) throw new Error("Too many requests");

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

  try {
    const [member] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phoneE164: users.phoneE164,
        locale: users.locale,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (member) {
      await notifyMemberBookingCancelled({
        email: member.email,
        phone: member.phoneE164,
        memberName: `${member.firstName} ${member.lastName}`,
        rangeId: booking.rangeId,
        date: fmtDate(booking.startsAt),
        time: fmtTime(booking.startsAt),
        cancelledBy: "member",
        locale: member.locale,
        bookingId,
        userId: session.user.id,
      }).catch(console.error);
    }
  } catch (e) {
    console.error("[cancelBooking] notify failed:", e);
  }

  revalidatePath("/app/rezervacie");
}
