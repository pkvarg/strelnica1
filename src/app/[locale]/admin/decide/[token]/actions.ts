"use server";

import { db } from "@/db";
import { adminApprovalTokens, bookings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/tokens";
import { invalidateSiblingTokens } from "@/lib/approval-tokens";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/ip";
import { notifyMemberBookingApproved, notifyMemberBookingDeclined } from "@/lib/notify";
import { fmtDate, fmtTime } from "@/lib/format";
import { getPgBoss } from "@/lib/pgboss";
import { scheduleBookingReminder } from "@/lib/jobs/booking-reminder";
import { scheduleNoShowSweep } from "@/lib/jobs/booking-noshow";
import { scheduleAutoComplete } from "@/lib/jobs/booking-autocomplete";
import { rateLimit } from "@/lib/rate-limit";

interface DecideResult {
  error?: string;
  success?: boolean;
  action?: string;
}

export async function executeDecision(
  token: string,
  _prev: DecideResult | null,
  formData: FormData,
): Promise<DecideResult> {
  const ip = (await getClientIp()) ?? "unknown";
  const { allowed } = rateLimit(`decide:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) return { error: "Too many attempts" };

  const reason = (formData.get("reason") as string) || null;

  const tokenHash = hashToken(token);

  const [approvalToken] = await db
    .select()
    .from(adminApprovalTokens)
    .where(eq(adminApprovalTokens.tokenHash, tokenHash))
    .limit(1);

  if (!approvalToken) {
    return { error: "Invalid or expired token" };
  }

  if (approvalToken.usedAt) {
    return { error: "This token has already been used" };
  }

  if (approvalToken.expiresAt < new Date()) {
    return { error: "This token has expired" };
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, approvalToken.bookingId))
    .limit(1);

  if (!booking) {
    return { error: "Booking not found" };
  }

  if (booking.status !== "requested") {
    return { error: `Booking already ${booking.status}` };
  }

  const newStatus = approvalToken.action === "approve" ? "approved" : "declined";

  await db
    .update(bookings)
    .set({
      status: newStatus,
      decidedBy: approvalToken.adminUserId,
      decidedAt: new Date(),
      decisionReason: reason,
    })
    .where(eq(bookings.id, booking.id));

  await db
    .update(adminApprovalTokens)
    .set({ usedAt: new Date(), usedIp: ip })
    .where(eq(adminApprovalTokens.id, approvalToken.id));

  await invalidateSiblingTokens(booking.id, approvalToken.id);

  await writeAudit({
    actorUserId: approvalToken.adminUserId,
    action: `booking_${newStatus}`,
    entityType: "booking",
    entityId: booking.id,
    before: { status: "requested" },
    after: { status: newStatus, reason, ip },
  });

  await notifyMemberAfterDecision(booking.id, newStatus, reason).catch(console.error);

  return { success: true, action: newStatus };
}

async function notifyMemberAfterDecision(
  bookingId: string,
  newStatus: "approved" | "declined",
  reason: string | null,
) {
  const [row] = await db
    .select({
      rangeId: bookings.rangeId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      userId: bookings.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phoneE164,
      locale: users.locale,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row) return;

  const common = {
    email: row.email,
    phone: row.phone,
    memberName: `${row.firstName} ${row.lastName}`,
    rangeId: row.rangeId,
    date: fmtDate(row.startsAt),
    time: fmtTime(row.startsAt),
    locale: row.locale,
    bookingId,
    userId: row.userId,
  };

  if (newStatus === "approved") {
    await notifyMemberBookingApproved(common);
    try {
      const boss = getPgBoss();
      await scheduleBookingReminder(boss, bookingId, row.startsAt);
      await scheduleNoShowSweep(boss, bookingId, row.startsAt);
      await scheduleAutoComplete(boss, bookingId, row.endsAt);
    } catch (e) {
      console.error("[decide] pg-boss scheduling failed:", e);
    }
  } else {
    await notifyMemberBookingDeclined({ ...common, reason });
  }
}

export async function getTokenDetails(token: string) {
  const tokenHash = hashToken(token);

  const [approvalToken] = await db
    .select()
    .from(adminApprovalTokens)
    .where(eq(adminApprovalTokens.tokenHash, tokenHash))
    .limit(1);

  if (!approvalToken) return null;

  const [booking] = await db
    .select({
      id: bookings.id,
      rangeId: bookings.rangeId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      guestCount: bookings.guestCount,
      userNote: bookings.userNote,
    })
    .from(bookings)
    .where(eq(bookings.id, approvalToken.bookingId))
    .limit(1);

  if (!booking) return null;

  const [member] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phoneE164: users.phoneE164,
    })
    .from(users)
    .innerJoin(bookings, eq(bookings.userId, users.id))
    .where(eq(bookings.id, approvalToken.bookingId))
    .limit(1);

  return {
    action: approvalToken.action,
    expired: approvalToken.expiresAt < new Date(),
    used: !!approvalToken.usedAt,
    booking,
    member,
  };
}
