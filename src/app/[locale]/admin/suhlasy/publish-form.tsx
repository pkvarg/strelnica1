"use client";

import { useActionState } from "react";
import { publishConsentDocument } from "../consent-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PublishForm() {
  const [state, formAction, isPending] = useActionState(publishConsentDocument, null);

  return (
    <form action={formAction} className="rounded-lg border p-4 space-y-4">
      <h2 className="font-semibold">Publikovať dokument</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Typ</Label>
          <select name="kind" className="w-full rounded-md border px-3 py-2 text-sm" required>
            <option value="gdpr">GDPR</option>
            <option value="range_rules">Pravidlá strelnice</option>
            <option value="terms">Podmienky</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Verzia</Label>
          <Input name="version" placeholder="v2" required />
        </div>
        <div className="space-y-1">
          <Label>Jazyk</Label>
          <select name="locale" className="w-full rounded-md border px-3 py-2 text-sm" required>
            <option value="sk">Slovenčina</option>
            <option value="hu">Magyar</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Obsah (Markdown)</Label>
        <textarea
          name="contentMd"
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={10}
          required
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Dokument bol publikovaný</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "..." : "Publikovať"}
      </Button>
    </form>
  );
}
