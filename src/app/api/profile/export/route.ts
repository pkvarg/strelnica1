import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, bookings, memberships, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phoneE164: users.phoneE164,
      birthDate: users.birthDate,
      birthPlace: users.birthPlace,
      addressStreet: users.addressStreet,
      addressCity: users.addressCity,
      addressZip: users.addressZip,
      addressCountry: users.addressCountry,
      role: users.role,
      status: users.status,
      locale: users.locale,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      gdprConsentVersion: users.gdprConsentVersion,
      gdprConsentAt: users.gdprConsentAt,
      rangeRulesConsentVersion: users.rangeRulesConsentVersion,
      rangeRulesConsentAt: users.rangeRulesConsentAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const userBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, userId));

  const userMemberships = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId));

  const userAudit = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.actorUserId, userId));

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    bookings: userBookings,
    memberships: userMemberships,
    auditLog: userAudit,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gdpr-export-${userId}.json"`,
    },
  });
}
