const SK = "sk-SK";
export const BRATISLAVA_TZ = "Europe/Bratislava";

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(SK, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: BRATISLAVA_TZ,
  });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(SK, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BRATISLAVA_TZ,
  });
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString(SK, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BRATISLAVA_TZ,
  });
}

/**
 * Returns the local Bratislava wall-clock date as "YYYY-MM-DD", regardless of
 * the runtime's configured TZ. Use this instead of `.toISOString().split("T")[0]`
 * whenever the string must reflect what a Bratislava user calls "today".
 */
export function bratislavaDateStr(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRATISLAVA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

/**
 * Returns Bratislava wall-clock time as "HH:mm". Independent of the runtime TZ.
 */
export function bratislavaTimeStr(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BRATISLAVA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
