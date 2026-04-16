"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";

interface DayRange {
  rangeId: string;
  open: boolean;
  startTime: string | null;
  endTime: string | null;
  closed: boolean;
  closureReasonSk: string | null;
  closureReasonHu: string | null;
  bookedSlots: { start: string; end: string }[];
}

interface Day {
  date: string;
  weekday: number;
  ranges: DayRange[];
}

interface Range {
  id: string;
  nameSk: string;
  nameHu: string;
}

interface AvailabilityData {
  ranges: Range[];
  days: Day[];
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr + "T12:00:00");
  if (locale === "hu") {
    return date.toLocaleDateString("hu-HU", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const weekday = date.toLocaleDateString("sk-SK", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("sk-SK", { month: "long" });
  const year = date.getFullYear();
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day}. ${month} ${year}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

export function AvailabilityCalendar() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [data, setData] = useState<AvailabilityData | null>(null);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-zinc-800" />
        <h2 className="font-[family-name:var(--font-bebas)] text-3xl tracking-widest text-zinc-400">
          {t("title")}
        </h2>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <div className="mb-6 flex gap-5 text-xs">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          <span className="text-zinc-400">{t("available")}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />
          <span className="text-zinc-400">{t("booked")}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-700" />
          <span className="text-zinc-400">{t("closed")}</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {locale === "hu" ? "Dátum" : "Dátum"}
              </th>
              {data.ranges.map((r) => (
                <th
                  key={r.id}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500"
                >
                  {locale === "hu" ? r.nameHu : r.nameSk}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.days.map((day) => {
              const today = isToday(day.date);
              return (
                <tr
                  key={day.date}
                  className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 ${today ? "bg-amber-950/10" : ""}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-medium ${today ? "text-amber-500" : "text-zinc-300"}`}>
                      {formatDate(day.date, locale)}
                    </span>
                  </td>
                  {day.ranges.map((dr) => (
                    <td key={dr.rangeId} className="px-4 py-3">
                      {!dr.open ? (
                        <span className="inline-flex items-center rounded bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-500">
                          {dr.closed &&
                          (locale === "hu"
                            ? dr.closureReasonHu
                            : dr.closureReasonSk)
                            ? locale === "hu"
                              ? dr.closureReasonHu
                              : dr.closureReasonSk
                            : t("closed")}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">
                            {dr.startTime} - {dr.endTime}
                          </span>
                          {dr.bookedSlots.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {dr.bookedSlots.map((s, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-red-600/20 px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-600/30"
                                >
                                  {s.start}-{s.end}
                                </span>
                              ))}
                            </div>
                          )}
                          {dr.bookedSlots.length === 0 && (
                            <span className="rounded bg-emerald-600/15 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-600/30">
                              {t("available")}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
