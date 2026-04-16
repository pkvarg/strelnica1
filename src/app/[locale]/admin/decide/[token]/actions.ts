"use server";

import { db } from "@/db";
import { adminApprovalTokens, bookings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/tokens";
import { invalidateSiblingTokens } from "@/lib/approval-tokens";
import { writeAudit } from "@/lib/audit";
import { headers } from "next/headers";

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
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? null;

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

  // TODO M4: enqueue notify.member.bookingApproved or bookingDeclined

  return { success: true, action: newStatus };
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
