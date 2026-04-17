"use client";

import { useActionState, useState } from "react";
import { requestPhoneChange, confirmPhoneChange } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  currentPhone: string;
}

function errorLabel(key: string | undefined): string | null {
  if (!key) return null;
  const map: Record<string, string> = {
    invalidPhone: "Neplatný telefón (formát +421900123456)",
    samePhone: "Zadali ste rovnaký telefón",
    phoneTaken: "Tento telefón už používa iný účet",
    smsDisabled: "SMS overenie je dočasne vypnuté. Kontaktujte admina.",
    sendFailed: "Nepodarilo sa odoslať SMS. Skúste neskôr.",
    tooManyRequests: "Príliš veľa pokusov, skúste o hodinu",
    invalidCode: "Neplatný kód",
    expiredToken: "Kód expiroval, požiadajte o nový",
    invalidToken: "Neplatná žiadosť",
    tooManyAttempts: "Príliš veľa nesprávnych pokusov",
    userNotFound: "Používateľ sa nenašiel",
  };
  return map[key] ?? key;
}

export function PhoneChange({ currentPhone }: Props) {
  const [reqState, reqAction, reqPending] = useActionState(requestPhoneChange, null);
  const [step, setStep] = useState<"view" | "enter" | "verify" | "done">("view");
  const [newPhone, setNewPhone] = useState("");

  // Move to verify step once token issued
  if (step === "enter" && reqState?.success && reqState.token) {
    setStep("verify");
  }

  if (step === "view") {
    return (
      <div className="space-y-2">
        <Label>Telefón</Label>
        <div className="flex items-center gap-2">
          <Input value={currentPhone} disabled className="flex-1" />
          <Button
            type="button"
            onClick={() => setStep("enter")}
            className="bg-amber-600 text-zinc-950 hover:bg-amber-500"
          >
            Zmeniť
          </Button>
        </div>
      </div>
    );
  }

  if (step === "enter") {
    return (
      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <Label htmlFor="phone-new">Nový telefón</Label>
        <p className="text-xs text-zinc-500">
          Zadajte nové číslo v medzinárodnom formáte, napr. +421900123456. Na nové číslo pošleme SMS s overovacím kódom.
        </p>
        <form action={reqAction} className="space-y-2">
          <Input
            id="phone-new"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+421900123456"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            required
          />
          {reqState?.error && (
            <p className="text-sm text-red-400">{errorLabel(reqState.error)}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={reqPending}
              className="bg-amber-600 text-zinc-950 hover:bg-amber-500"
            >
              {reqPending ? "..." : "Odoslať kód"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("view")}
            >
              Zrušiť
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (step === "verify" && reqState?.token) {
    return (
      <VerifyStep
        token={reqState.token}
        newPhone={newPhone}
        onCancel={() => setStep("view")}
        onDone={() => setStep("done")}
      />
    );
  }

  return (
    <div className="space-y-2">
      <Label>Telefón</Label>
      <div className="flex items-center gap-2">
        <Input value={newPhone} disabled className="flex-1" />
        <span className="text-sm text-emerald-400">✓ overený</span>
      </div>
    </div>
  );
}

function VerifyStep({
  token,
  newPhone,
  onCancel,
  onDone,
}: {
  token: string;
  newPhone: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const boundConfirm = confirmPhoneChange.bind(null, token, newPhone);
  const [state, formAction, pending] = useActionState(boundConfirm, null);

  if (state?.success) {
    setTimeout(onDone, 0);
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-600/40 bg-amber-950/10 p-4">
      <Label htmlFor="phone-code">Overovací kód</Label>
      <p className="text-xs text-zinc-500">
        SMS s 6-miestnym kódom bola odoslaná na {newPhone}. Kód platí 10 minút.
      </p>
      <form action={formAction} className="space-y-2">
        <Input
          id="phone-code"
          name="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
        />
        {state?.error && (
          <p className="text-sm text-red-400">{errorLabel(state.error)}</p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={pending}
            className="bg-amber-600 text-zinc-950 hover:bg-amber-500"
          >
            {pending ? "..." : "Potvrdiť"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Zrušiť
          </Button>
        </div>
      </form>
    </div>
  );
}
