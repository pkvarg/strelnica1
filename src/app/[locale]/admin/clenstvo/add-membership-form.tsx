"use client";

import { useActionState } from "react";
import { markMembershipPaid } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Member {
  id: string;
  firstName: string;
  lastName: string;
}

export function AddMembershipForm({
  members,
  year,
}: {
  members: Member[];
  year: number;
}) {
  const [state, formAction, isPending] = useActionState(markMembershipPaid, null);

  return (
    <form action={formAction} className="rounded-lg border p-4">
      <h2 className="mb-4 font-semibold">Zaznamenať platbu</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1">
          <Label>Člen</Label>
          <select name="userId" className="w-full rounded-md border px-3 py-2 text-sm" required>
            <option value="">Vybrať...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.lastName} {m.firstName}
              </option>
            ))}
          </select>
        </div>

        <input type="hidden" name="year" value={year} />

        <div className="space-y-1">
          <Label>Suma (EUR)</Label>
          <Input name="feeAmount" type="number" step="0.01" defaultValue="50.00" required />
        </div>

        <div className="space-y-1">
          <Label>Spôsob platby</Label>
          <select name="paymentMethod" className="w-full rounded-md border px-3 py-2 text-sm" required>
            <option value="cash">Hotovosť</option>
            <option value="transfer">Prevod</option>
            <option value="other">Iné</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label>Poznámka</Label>
          <Input name="note" />
        </div>
      </div>

      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-green-700">Platba zaznamenaná</p>}

      <Button type="submit" className="mt-4" disabled={isPending}>
        {isPending ? "..." : "Zaznamenať"}
      </Button>
    </form>
  );
}
