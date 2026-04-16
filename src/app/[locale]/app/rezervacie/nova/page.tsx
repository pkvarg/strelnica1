"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { requestBooking } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Range {
  id: string;
  nameSk: string;
}

export default function NewBookingPage() {
  const t = useTranslations("booking");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(requestBooking, null);
  const [ranges, setRanges] = useState<Range[]>([]);

  useEffect(() => {
    fetch("/api/ranges")
      .then((r) => r.json())
      .then(setRanges);
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.push("../rezervacie");
    }
  }, [state, router]);

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label>{t("range")}</Label>
          <select name="rangeId" className="w-full rounded-md border px-3 py-2 text-sm" required>
            {ranges.map((r) => (
              <option key={r.id} value={r.id}>{r.nameSk}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>{t("date")}</Label>
          <Input name="date" type="date" required />
        </div>

        <div className="space-y-2">
          <Label>{t("startTime")}</Label>
          <select
            name="startTime"
            className="w-full rounded-md border px-3 py-2 text-sm"
            defaultValue="09:00"
            required
          >
            {Array.from({ length: 17 }, (_, i) => {
              const h = (i + 6).toString().padStart(2, "0") + ":00";
              return (
                <option key={h} value={h}>{h}</option>
              );
            })}
          </select>
        </div>

        <div className="space-y-2">
          <Label>{t("hours")}</Label>
          <Input name="hours" type="number" min="1" max="8" defaultValue="1" required />
        </div>

        <div className="space-y-2">
          <Label>{t("guestCount")}</Label>
          <Input name="guestCount" type="number" min="0" max="10" defaultValue="0" />
        </div>

        <div className="space-y-2">
          <Label>{t("note")}</Label>
          <Input name="userNote" />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600">
            {t.has(state.error) ? t(state.error as "slotTaken") : state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "..." : t("submit")}
        </Button>
      </form>
    </div>
  );
}
