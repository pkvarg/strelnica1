import { db } from "@/db";
import { openingHoursTemplates, closures } from "@/db/schema";
import { eq, and, lte, or, isNull, gte } from "drizzle-orm";

function timeToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

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

  const startMin = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMin = endsAt.getHours() * 60 + endsAt.getMinutes();

  return hours.some(
    (h) => startMin >= timeToMin(h.startTime) && endMin <= timeToMin(h.endTime),
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
