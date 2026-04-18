"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateSmsMode } from "./actions";
import type { SmsMode } from "@/lib/settings";

const OPTIONS: { value: SmsMode; titleKey: string; descKey: string }[] = [
  { value: "all", titleKey: "allTitle", descKey: "allDesc" },
  { value: "admin_only", titleKey: "adminOnlyTitle", descKey: "adminOnlyDesc" },
  { value: "members_only", titleKey: "membersOnlyTitle", descKey: "membersOnlyDesc" },
  { value: "off", titleKey: "offTitle", descKey: "offDesc" },
];

interface Props {
  current: SmsMode;
}

export function SmsModeForm({ current }: Props) {
  const t = useTranslations("settings.smsMode");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(updateSmsMode, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-amber-600/50"
          >
            <input
              type="radio"
              name="smsMode"
              value={opt.value}
              defaultChecked={current === opt.value}
              className="mt-1 h-4 w-4 accent-amber-600"
            />
            <div>
              <p className="font-medium text-zinc-100">{t(opt.titleKey as "allTitle")}</p>
              <p className="mt-1 text-sm text-zinc-400">{t(opt.descKey as "allDesc")}</p>
            </div>
          </label>
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-400">{tCommon("saved")}</p>}

      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="bg-amber-600 text-white hover:bg-amber-700"
      >
        {isPending ? tCommon("saving") : tCommon("save")}
      </Button>
    </form>
  );
}
