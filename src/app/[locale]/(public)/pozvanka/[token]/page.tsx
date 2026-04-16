"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useParams } from "next/navigation";
import { acceptInvitation } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InvitationPage() {
  const t = useTranslations("invitation");
  const { token } = useParams<{ token: string }>();

  const boundAction = acceptInvitation.bind(null, token);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  if (state?.success) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm space-y-4 p-6 text-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-green-700">{t("success")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-zinc-500">{t("subtitle")}</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("setPassword")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="gdprConsent"
                required
                className="mt-0.5"
              />
              {t("acceptGdpr")}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="rulesConsent"
                required
                className="mt-0.5"
              />
              {t("acceptRules")}
            </label>
          </div>

          {state?.error && (
            <p className="text-sm text-red-600">{t(state.error)}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "..." : t("activate")}
          </Button>
        </form>
      </div>
    </div>
  );
}
