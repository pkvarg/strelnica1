"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserAdmin } from "../actions";
import { UserCog } from "lucide-react";

interface EditResult {
  error?: string;
  success?: boolean;
}

interface EditUserFormProps {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string | null;
  birthPlace: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  locale: "sk" | "hu";
  role: "admin" | "member";
  notesAdmin: string | null;
}

export function EditUserForm(props: EditUserFormProps) {
  const bound = updateUserAdmin.bind(null, props.userId);
  const [state, formAction, isPending] = useActionState<EditResult | null, FormData>(
    bound,
    null,
  );

  const [form, setForm] = useState({
    firstName: props.firstName,
    lastName: props.lastName,
    email: props.email,
    phone: props.phone,
    birthDate: props.birthDate ?? "",
    birthPlace: props.birthPlace ?? "",
    addressStreet: props.addressStreet ?? "",
    addressCity: props.addressCity ?? "",
    addressZip: props.addressZip ?? "",
    addressCountry: props.addressCountry ?? "SK",
    locale: props.locale,
    role: props.role,
    notesAdmin: props.notesAdmin ?? "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const field =
    "border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600";
  const select =
    "h-8 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 text-sm text-zinc-100 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <UserCog size={18} className="text-amber-500" />
        <h2 className="text-lg font-semibold text-zinc-100">Upraviť profil</h2>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Meno</Label>
            <Input
              name="firstName"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              required
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Priezvisko</Label>
            <Input
              name="lastName"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              required
              className={field}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400">E-mail</Label>
            <Input
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Telefón (E.164)</Label>
            <Input
              name="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              required
              placeholder="+4219..."
              className={field}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400">Dátum narodenia</Label>
            <Input
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Miesto narodenia</Label>
            <Input
              name="birthPlace"
              value={form.birthPlace}
              onChange={(e) => set("birthPlace", e.target.value)}
              className={field}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-zinc-400">Ulica</Label>
            <Input
              name="addressStreet"
              value={form.addressStreet}
              onChange={(e) => set("addressStreet", e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Mesto</Label>
            <Input
              name="addressCity"
              value={form.addressCity}
              onChange={(e) => set("addressCity", e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">PSČ</Label>
            <Input
              name="addressZip"
              value={form.addressZip}
              onChange={(e) => set("addressZip", e.target.value)}
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Krajina</Label>
            <Input
              name="addressCountry"
              value={form.addressCountry}
              onChange={(e) => set("addressCountry", e.target.value)}
              className={field}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400">Jazyk</Label>
            <select
              name="locale"
              value={form.locale}
              onChange={(e) => set("locale", e.target.value as "sk" | "hu")}
              className={select}
            >
              <option value="sk">Slovenčina</option>
              <option value="hu">Magyar</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Rola</Label>
            <select
              name="role"
              value={form.role}
              onChange={(e) => set("role", e.target.value as "admin" | "member")}
              className={select}
            >
              <option value="member">Člen</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-zinc-400">Interná poznámka (len pre adminov)</Label>
            <textarea
              name="notesAdmin"
              value={form.notesAdmin}
              onChange={(e) => set("notesAdmin", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-400">Uložené</p>}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {isPending ? "Ukladám..." : "Uložiť"}
          </Button>
        </div>
      </form>
    </div>
  );
}
