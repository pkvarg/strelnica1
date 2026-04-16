import { db } from "@/db";
import { openingHoursTemplates, closures } from "@/db/schema";
import { eq, and, lte, or, isNull, gte } from "drizzle-orm";

export async function isWithinOpeningHours(
  rangeId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  const weekday = startsAt.getDay();
  const dateStr = startsAt.toISOString().split("T")[0];

  const hours = await db
    .select()
    .from(openingHoursTemplates)
    .where(
      and(
        eq(openingHoursTemplates.rangeId, rangeId),
        eq(openingHoursTemplates.weekday, weekday),
        lte(openingHoursTemplates.validFrom, dateStr),
        or(
          isNull(openingHoursTemplates.validTo),
          gte(openingHoursTemplates.validTo, dateStr),
        ),
      ),
    );

  if (hours.length === 0) return false;

  const startTimeStr = startsAt.toTimeString().slice(0, 5);
  const endTimeStr = endsAt.toTimeString().slice(0, 5);

  return hours.some(
    (h) => startTimeStr >= h.startTime && endTimeStr <= h.endTime,
  );
}

export async function isClosedDuring(
  rangeId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  const overlapping = await db
    .select({ id: closures.id })
    .from(closures)
    .where(
      and(
        or(isNull(closures.rangeId), eq(closures.rangeId, rangeId)),
        lte(closures.startsAt, endsAt),
        gte(closures.endsAt, startsAt),
      ),
    )
    .limit(1);

  return overlapping.length > 0;
}
