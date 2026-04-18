"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateBookingRecipients } from "./actions";

interface AdminRow {
  id: string;
  name: string;
  email: string;
  receivesBookingRequests: boolean;
}

export function BookingRecipientsForm({ admins }: { admins: AdminRow[] }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    updateBookingRecipients,
    null,
  );

  const [selected, setSelected] = useState<Set<string>>(
    new Set(admins.filter((a) => a.receivesBookingRequests).map((a) => a.id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (admins.length === 0) {
    return <p className="text-sm text-zinc-400">{t("noAdmins")}</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        {admins.map((a) => {
          const checked = selected.has(a.id);
          return (
            <label
              key={a.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-amber-600/50"
            >
              <input
                type="checkbox"
                name="adminId"
                value={a.id}
                checked={checked}
                onChange={() => toggle(a.id)}
                className="mt-1 h-4 w-4 accent-amber-600"
              />
              <div>
                <p className="font-medium text-zinc-100">{a.name}</p>
                <p className="text-xs text-zinc-500">{a.email}</p>
              </div>
            </label>
          );
        })}
      </div>

      {selected.size === 0 && (
        <p className="text-sm text-amber-400">{t("bookingRecipientsNone")}</p>
      )}

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-emerald-400">{tCommon("saved")}</p>
      )}

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
