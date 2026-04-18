"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

interface Stats {
  visitors: number;
  bots: number;
  emails: number;
  lastVisitor_at?: string;
  lastBot_at?: string;
  lastEmail_at?: string;
}

export function VisitorStats() {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();
  const localeTag = locale === "hu" ? "hu-HU" : "sk-SK";
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/visitors")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border p-4 text-center">
        <p className="text-3xl font-bold">{stats.visitors ?? 0}</p>
        <p className="text-sm text-zinc-500">{t("visitors")}</p>
        {stats.lastVisitor_at && (
          <p className="mt-1 text-xs text-zinc-600">
            {new Date(stats.lastVisitor_at).toLocaleString(localeTag)}
          </p>
        )}
      </div>
      <div className="rounded-lg border p-4 text-center">
        <p className="text-3xl font-bold text-red-500">{stats.bots ?? 0}</p>
        <p className="text-sm text-zinc-500">{t("bots")}</p>
        {stats.lastBot_at && (
          <p className="mt-1 text-xs text-zinc-600">
            {new Date(stats.lastBot_at).toLocaleString(localeTag)}
          </p>
        )}
      </div>
      <div className="rounded-lg border p-4 text-center">
        <p className="text-3xl font-bold text-amber-500">{stats.emails ?? 0}</p>
        <p className="text-sm text-zinc-500">{t("emails")}</p>
        {stats.lastEmail_at && (
          <p className="mt-1 text-xs text-zinc-600">
            {new Date(stats.lastEmail_at).toLocaleString(localeTag)}
          </p>
        )}
      </div>
    </div>
  );
}
