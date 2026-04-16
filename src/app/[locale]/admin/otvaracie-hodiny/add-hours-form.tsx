"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addOpeningHours } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Range {
  id: string;
  nameSk: string;
}

export function AddHoursForm({ ranges }: { ranges: Range[] }) {
  const t = useTranslations("openingHours");
  const days: string[] = t.raw("days");
  const [state, formAction, isPending] = useActionState(addOpeningHours, null);

  return (
    <form action={formAction} className="rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1">
          <Label>{t("range")}</Label>
          <select name="rangeId" className="w-full rounded-md border px-3 py-2 text-sm" required>
            {ranges.map((r) => (
              <option key={r.id} value={r.id}>{r.nameSk}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label>{t("weekday")}</Label>
          <select name="weekday" className="w-full rounded-md border px-3 py-2 text-sm" required>
            {days.map((day, i) => (
              <option key={i} value={i}>{day}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label>{t("startTime")}</Label>
          <Input name="startTime" type="time" required />
        </div>

        <div className="space-y-1">
          <Label>{t("endTime")}</Label>
          <Input name="endTime" type="time" required />
        </div>

        <div className="space-y-1">
          <Label>{t("validFrom")}</Label>
          <Input name="validFrom" type="date" required />
        </div>

        <div className="space-y-1">
          <Label>{t("validTo")}</Label>
          <Input name="validTo" type="date" />
        </div>
      </div>

      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-green-700">{t("saved")}</p>}

      <Button type="submit" className="mt-4" disabled={isPending}>
        {isPending ? "..." : t("add")}
      </Button>
    </form>
  );
}
