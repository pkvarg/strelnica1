import { db } from "@/db";
import { consentDocuments } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PublishForm } from "./publish-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ConsentAdminPage() {
  const docs = await db
    .select()
    .from(consentDocuments)
    .orderBy(desc(consentDocuments.publishedAt));

  return (
    <div>
      <h1 className="text-2xl font-bold">Súhlasy a dokumenty</h1>

      <div className="mt-6">
        <PublishForm />
      </div>

      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Typ</TableHead>
              <TableHead>Verzia</TableHead>
              <TableHead>Jazyk</TableHead>
              <TableHead>Publikované</TableHead>
              <TableHead>Náhľad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d) => (
              <TableRow key={`${d.kind}-${d.version}-${d.locale}`}>
                <TableCell>{d.kind}</TableCell>
                <TableCell>{d.version}</TableCell>
                <TableCell>{d.locale}</TableCell>
                <TableCell>{d.publishedAt.toLocaleString("sk-SK")}</TableCell>
                <TableCell className="max-w-[300px] truncate text-xs text-zinc-500">
                  {d.contentMd.slice(0, 100)}...
                </TableCell>
              </TableRow>
            ))}
            {docs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-zinc-500">
                  Žiadne dokumenty
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
