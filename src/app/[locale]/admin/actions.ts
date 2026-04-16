"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { invalidateSiblingTokens } from "@/lib/approval-tokens";
import { adminApprovalTokens } from "@/db/schema";
import { revalidatePath } from "next/cache";

async function decideBookingInline(
  bookingId: string,
  newStatus: "approved" | "declined",
  reason?: string,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const [booking] = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "requested") throw new Error("Booking not in requested state");

  await db
    .update(bookings)
    .set({
      status: newStatus,
      decidedBy: session.user.id,
      decidedAt: new Date(),
      decisionReason: reason ?? null,
    })
    .where(eq(bookings.id, bookingId));

  // Invalidate all approval tokens for this booking
  const tokens = await db
    .select({ id: adminApprovalTokens.id })
    .from(adminApprovalTokens)
    .where(eq(adminApprovalTokens.bookingId, bookingId));

  for (const t of tokens) {
    await db
      .update(adminApprovalTokens)
      .set({ usedAt: new Date(), usedIp: "inline-dashboard" })
      .where(eq(adminApprovalTokens.id, t.id));
  }

  await writeAudit({
    actorUserId: session.user.id,
    action: `booking_${newStatus}`,
    entityType: "booking",
    entityId: bookingId,
    before: { status: "requested" },
    after: { status: newStatus, reason },
  });

  // TODO M4: enqueue notify.member.bookingApproved or bookingDeclined

  revalidatePath("/admin");
}

export async function approveBookingInline(bookingId: string) {
  await decideBookingInline(bookingId, "approved");
}

export async function declineBookingInline(bookingId: string, reason?: string) {
  await decideBookingInline(bookingId, "declined", reason);
}

export async function checkInBookingAdmin(bookingId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const [booking] = await db
    .select({ id: bookings.id, status: bookings.status, userId: bookings.userId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "approved") throw new Error("Booking not in approved state");

  await db
    .update(bookings)
    .set({ status: "checked_in", checkInAt: new Date() })
    .where(eq(bookings.id, bookingId));

  await writeAudit({
    actorUserId: session.user.id,
    action: "admin_check_in",
    entityType: "booking",
    entityId: bookingId,
    before: { status: "approved" },
    after: { status: "checked_in" },
  });

  revalidatePath("/admin");
}
