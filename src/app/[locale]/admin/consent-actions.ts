"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { consentDocuments } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function publishConsentDocument(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" };
  }

  const kind = formData.get("kind") as string;
  const version = formData.get("version") as string;
  const locale = formData.get("locale") as string;
  const contentMd = formData.get("contentMd") as string;

  if (!kind || !version || !locale || !contentMd) {
    return { error: "All fields are required" };
  }

  await db.insert(consentDocuments).values({
    kind: kind as "gdpr" | "range_rules" | "terms",
    version,
    locale: locale as "sk" | "hu",
    contentMd,
    publishedAt: new Date(),
    publishedBy: session.user.id,
  });

  await writeAudit({
    actorUserId: session.user.id,
    action: "publish_consent",
    entityType: "consent_document",
    entityId: `${kind}:${version}:${locale}`,
    after: { kind, version, locale },
  });

  revalidatePath("/admin");
  revalidatePath("/gdpr");
  revalidatePath("/pravidla-strelnice");
  return { success: true };
}
