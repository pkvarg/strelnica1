import { db } from "@/db";
import { consentDocuments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getLatestConsent(
  kind: "gdpr" | "range_rules" | "terms",
  locale: "sk" | "hu",
) {
  const [doc] = await db
    .select()
    .from(consentDocuments)
    .where(and(eq(consentDocuments.kind, kind), eq(consentDocuments.locale, locale)))
    .orderBy(desc(consentDocuments.publishedAt))
    .limit(1);

  return doc ?? null;
}

export async function getLatestConsentVersion(
  kind: "gdpr" | "range_rules" | "terms",
): Promise<string | null> {
  const [doc] = await db
    .select({ version: consentDocuments.version })
    .from(consentDocuments)
    .where(eq(consentDocuments.kind, kind))
    .orderBy(desc(consentDocuments.publishedAt))
    .limit(1);

  return doc?.version ?? null;
}
