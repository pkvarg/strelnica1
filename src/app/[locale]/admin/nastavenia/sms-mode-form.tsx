"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateSmsMode } from "./actions";
import type { SmsMode } from "@/lib/settings";

const OPTIONS: { value: SmsMode; title: string; desc: string }[] = [
  {
    value: "all",
    title: "Všetkým",
    desc: "SMS sa posielajú adminom aj členom pri každej udalosti (okrem bežnej e-mailovej).",
  },
  {
    value: "admin_only",
    title: "Len adminom",
    desc: "SMS dostávajú len adminovia (napr. nová žiadosť). Členovia dostanú iba e-mail.",
  },
  {
    value: "members_only",
    title: "Len členom",
    desc: "SMS dostávajú iba členovia (schválenie, pripomienka, zrušenie...). Adminovia nie.",
  },
  {
    value: "off",
    title: "Vypnuté",
    desc: "Žiadne lifecycle SMS. OTP pri registrácii zostáva aktívne.",
  },
];

interface Props {
  current: SmsMode;
}

export function SmsModeForm({ current }: Props) {
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
              <p className="font-medium text-zinc-100">{opt.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-400">Uložené</p>}

      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="bg-amber-600 text-white hover:bg-amber-700"
      >
        {isPending ? "Ukladám..." : "Uložiť"}
      </Button>
    </form>
  );
}
