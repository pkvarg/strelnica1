import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  ranges,
  openingHoursTemplates,
  closures,
  bookings,
} from "@/db/schema";
import { eq, and, gte, lte, or, isNull, asc, inArray } from "drizzle-orm";

export async function GET() {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const allRanges = await db
    .select({ id: ranges.id, nameSk: ranges.nameSk, nameHu: ranges.nameHu })
    .from(ranges)
    .where(eq(ranges.active, true))
    .orderBy(asc(ranges.sortOrder));

  const todayStr = now.toISOString().split("T")[0];
  const endStr = twoWeeksLater.toISOString().split("T")[0];

  const hours = await db
    .select()
    .from(openingHoursTemplates)
    .where(
      and(
        lte(openingHoursTemplates.validFrom, endStr),
        or(
          isNull(openingHoursTemplates.validTo),
          gte(openingHoursTemplates.validTo, todayStr),
        ),
      ),
    );

  const activClosures = await db
    .select()
    .from(closures)
    .where(
      and(lte(closures.startsAt, twoWeeksLater), gte(closures.endsAt, now)),
    );

  const activeBookings = await db
    .select({
      rangeId: bookings.rangeId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        gte(bookings.startsAt, now),
        lte(bookings.startsAt, twoWeeksLater),
        inArray(bookings.status, ["requested", "approved", "checked_in"]),
      ),
    );

  const days: {
    date: string;
    weekday: number;
    ranges: {
      rangeId: string;
      open: boolean;
      startTime: string | null;
      endTime: string | null;
      closed: boolean;
      closureReason: string | null;
      bookedSlots: { start: string; end: string }[];
    }[];
  }[] = [];

  for (let d = 0; d < 14; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];
    const weekday = date.getDay();

    const dayRanges = allRanges.map((range) => {
      const rangeHours = hours.find(
        (h) =>
          h.rangeId === range.id &&
          h.weekday === weekday &&
          h.validFrom <= dateStr &&
          (!h.validTo || h.validTo >= dateStr),
      );

      const rangeClosure = activClosures.find(
        (c) =>
          (!c.rangeId || c.rangeId === range.id) &&
          c.startsAt <= new Date(dateStr + "T23:59:59") &&
          c.endsAt >= new Date(dateStr + "T00:00:00"),
      );

      const dayBookings = activeBookings
        .filter(
          (b) =>
            b.rangeId === range.id &&
            b.startsAt.toISOString().startsWith(dateStr),
        )
        .map((b) => ({
          start: b.startsAt.toTimeString().slice(0, 5),
          end: b.endsAt.toTimeString().slice(0, 5),
        }));

      return {
        rangeId: range.id,
        open: !!rangeHours && !rangeClosure,
        startTime: rangeHours?.startTime ?? null,
        endTime: rangeHours?.endTime ?? null,
        closed: !!rangeClosure,
        closureReason: rangeClosure?.reasonSk ?? null,
        bookedSlots: dayBookings,
      };
    });

    days.push({ date: dateStr, weekday, ranges: dayRanges });
  }

  return NextResponse.json({ ranges: allRanges, days });
}
