"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserLicense, type LicenseResult } from "../actions";
import { Shield } from "lucide-react";

const CATEGORIES = ["A", "B", "C", "D", "E", "F"] as const;

interface LicenseFormProps {
  userId: string;
  number: string | null;
  category: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  authority: string | null;
}

export function LicenseForm({
  userId,
  number,
  category,
  issuedAt,
  expiresAt,
  authority,
}: LicenseFormProps) {
  const [state, formAction, isPending] = useActionState<LicenseResult | null, FormData>(
    updateUserLicense,
    null,
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Shield size={18} className="text-amber-500" />
        <h2 className="text-lg font-semibold text-zinc-100">Zbrojny preukaz</h2>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="userId" value={userId} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="zp-number" className="text-zinc-400">
              Cislo preukazu
            </Label>
            <Input
              id="zp-number"
              name="number"
              defaultValue={number ?? ""}
              placeholder="napr. AA-000123"
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zp-category" className="text-zinc-400">
              Kategoria
            </Label>
            <select
              id="zp-category"
              name="category"
              defaultValue={category ?? ""}
              className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 text-sm text-zinc-100 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">-- Vyberte --</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zp-issuedAt" className="text-zinc-400">
              Vydany dna
            </Label>
            <Input
              id="zp-issuedAt"
              name="issuedAt"
              type="date"
              defaultValue={issuedAt ?? ""}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zp-expiresAt" className="text-zinc-400">
              Platnost do
            </Label>
            <Input
              id="zp-expiresAt"
              name="expiresAt"
              type="date"
              defaultValue={expiresAt ?? ""}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="zp-authority" className="text-zinc-400">
              Vydavajuci organ
            </Label>
            <Input
              id="zp-authority"
              name="authority"
              defaultValue={authority ?? ""}
              placeholder="napr. Okresne riaditelstvo PZ Bratislava"
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-emerald-400">Ulozene</p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {isPending ? "Ukladam..." : "Ulozit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
