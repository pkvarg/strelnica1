"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";

interface DayRange {
  rangeId: string;
  open: boolean;
  startTime: string | null;
  endTime: string | null;
  closed: boolean;
  closureReason: string | null;
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

export function AvailabilityCalendar() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [data, setData] = useState<AvailabilityData | null>(null);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-center text-zinc-500">...</p>;

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t("title")}</h2>

      <div className="flex gap-4 text-xs mb-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-green-700" /> {t("available")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-700" /> {t("booked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-zinc-400" /> {t("closed")}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-medium">{locale === "hu" ? "Dátum" : "Dátum"}</th>
              {data.ranges.map((r) => (
                <th key={r.id} className="px-2 py-1 text-left font-medium">
                  {locale === "hu" ? r.nameHu : r.nameSk}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.days.map((day) => (
              <tr key={day.date} className="border-t">
                <td className="px-2 py-2 font-medium whitespace-nowrap">
                  {formatDate(day.date, locale)}
                </td>
                {day.ranges.map((dr) => (
                  <td key={dr.rangeId} className="px-2 py-2">
                    {!dr.open ? (
                      <span className="rounded bg-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {dr.closed && dr.closureReason
                          ? dr.closureReason
                          : t("closed")}
                      </span>
                    ) : (
                      <div>
                        <span className="text-xs text-zinc-600">
                          {dr.startTime} - {dr.endTime}
                        </span>
                        {dr.bookedSlots.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {dr.bookedSlots.map((s, i) => (
                              <span
                                key={i}
                                className="rounded bg-red-700 px-1.5 py-0.5 text-xs font-medium text-white"
                              >
                                {s.start}-{s.end}
                              </span>
                            ))}
                          </div>
                        )}
                        {dr.bookedSlots.length === 0 && (
                          <span className="ml-1 rounded bg-green-700 px-1.5 py-0.5 text-xs font-medium text-white">
                            {t("available")}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
