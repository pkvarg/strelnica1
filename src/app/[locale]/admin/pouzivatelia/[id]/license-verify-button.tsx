"use client";

import { Button } from "@/components/ui/button";
import { verifyUserLicense, unverifyUserLicense } from "../actions";
import { ShieldCheck, ShieldX } from "lucide-react";

export function LicenseVerifyButton({
  userId,
  isVerified,
}: {
  userId: string;
  isVerified: boolean;
}) {
  if (isVerified) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-zinc-500 hover:text-red-400"
        onClick={() => unverifyUserLicense(userId)}
      >
        <ShieldX size={14} />
        Zrušiť overenie
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-emerald-800 text-xs text-emerald-400 hover:bg-emerald-900/30"
      onClick={() => verifyUserLicense(userId)}
    >
      <ShieldCheck size={14} />
      Overiť preukaz
    </Button>
  );
}
