"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ZP_CATEGORIES = ["A", "B", "C", "D", "E", "F"] as const;

export default function ProfilePage() {
  const t = useTranslations("profile");
  const [state, formAction, isPending] = useActionState(updateProfile, null);
  const [user, setUser] = useState<Record<string, string | null> | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setUser);
  }, [state]);

  if (!user) return <p>{t("title")}...</p>;

  const isVerified = !!user.zbrojnyPreukazVerifiedAt;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {state?.success && (
        <p className="mt-2 text-sm text-emerald-400">{t("updated")}</p>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("firstName")}</Label>
            <Input name="firstName" defaultValue={user.firstName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>{t("lastName")}</Label>
            <Input name="lastName" defaultValue={user.lastName ?? ""} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("email")}</Label>
          <Input value={user.email ?? ""} disabled />
        </div>

        <div className="space-y-2">
          <Label>{t("phone")}</Label>
          <Input value={user.phoneE164 ?? ""} disabled />
        </div>

        <div className="space-y-2">
          <Label>{t("birthDate")}</Label>
          <Input name="birthDate" type="date" defaultValue={user.birthDate ?? ""} />
        </div>

        <h2 className="pt-4 text-lg font-semibold">{t("address")}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("street")}</Label>
            <Input name="addressStreet" defaultValue={user.addressStreet ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>{t("city")}</Label>
            <Input name="addressCity" defaultValue={user.addressCity ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>{t("zip")}</Label>
            <Input name="addressZip" defaultValue={user.addressZip ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>{t("country")}</Label>
            <Input name="addressCountry" defaultValue={user.addressCountry ?? ""} />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <h2 className="text-lg font-semibold">{t("license")}</h2>
          {isVerified ? (
            <span className="rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              Overený
            </span>
          ) : user.zbrojnyPreukazCategory ? (
            <span className="rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              Čaká na overenie
            </span>
          ) : null}
        </div>
        {isVerified && (
          <p className="text-xs text-zinc-500">
            Úprava údajov zruší overenie a bude potrebné opätovné overenie správcom.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("licenseNumber")}</Label>
            <Input
              name="zpNumber"
              type="password"
              autoComplete="off"
              placeholder="napr. AA-000123"
              defaultValue=""
            />
            <p className="text-xs text-zinc-500">
              {user.zbrojnyPreukazCategory ? "Vyplňte len ak chcete zmeniť" : ""}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("licenseCategory")}</Label>
            <select
              name="zpCategory"
              defaultValue={user.zbrojnyPreukazCategory ?? ""}
              className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 text-sm text-zinc-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">--</option>
              {ZP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("licenseIssuedAt")}</Label>
            <Input name="zpIssuedAt" type="date" defaultValue={user.zbrojnyPreukazIssuedAt ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>{t("licenseExpiresAt")}</Label>
            <Input name="zpExpiresAt" type="date" defaultValue={user.zbrojnyPreukazExpiresAt ?? ""} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>{t("licenseAuthority")}</Label>
            <Input name="zpAuthority" defaultValue={user.zbrojnyPreukazIssuingAuthority ?? ""} />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "..." : t("personalInfo")}
          </Button>
          <a
            href="/api/profile/export"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            {t("exportData")}
          </a>
        </div>
      </form>
    </div>
  );
}
