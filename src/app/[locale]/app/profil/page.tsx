"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {state?.success && (
        <p className="mt-2 text-sm text-green-700">{t("updated")}</p>
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
