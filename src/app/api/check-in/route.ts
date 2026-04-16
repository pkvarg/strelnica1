import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyCheckInToken } from "@/lib/check-in-token";
import { writeAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const bookingId = verifyCheckInToken(token);
  if (!bookingId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "approved")))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ error: "Booking not found or not in approved state" }, { status: 404 });
  }

  await db
    .update(bookings)
    .set({ status: "checked_in", checkInAt: new Date() })
    .where(eq(bookings.id, bookingId));

  await writeAudit({
    actorUserId: booking.userId,
    action: "check_in",
    entityType: "booking",
    entityId: bookingId,
    before: { status: "approved" },
    after: { status: "checked_in" },
  });

  const locale = "sk";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/${locale}/app/rezervacie`);
}
