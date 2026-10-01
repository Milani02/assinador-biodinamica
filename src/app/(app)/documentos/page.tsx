import Link from "next/link";
import { desc } from "drizzle-orm";
import { FilePlus2, FileText } from "lucide-react";
import { db } from "@/lib/db/client";
import { documentVersions, documents } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "./status";

export default async function DocumentosPage() {
  await requireAdminArea();
  const [docs, versions] = await Promise.all([
    db.select().from(documents).orderBy(desc(documents.createdAt)),
    db.select().from(documentVersions).orderBy(desc(documentVersions.enviadoEm)),
  ]);

  const latestByDocument = new Map<string, (typeof versions)[number]>();
  for (const v of versions) {
    if (!latestByDocument.has(v.documentId)) {
      latestByDocument.set(v.documentId, v);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documentos do SGQ</h1>
          <p className="mt-1 text-muted-foreground">
            Cadastro, revisões e status de aprovação eletrônica.
          </p>
        </div>
        <Button render={<Link href="/documentos/novo" />} nativeButton={false}>
          <FilePlus2 className="size-4" />
          Novo documento
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Última revisão</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => {
              const latest = latestByDocument.get(doc.id);
              return (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/documentos/${doc.id}`}
                      className="text-primary hover:underline"
                    >
                      {doc.codigo}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{doc.titulo}</TableCell>
                  <TableCell className="tabular-nums">{latest?.revisao ?? "-"}</TableCell>
                  <TableCell>{latest ? <StatusBadge status={latest.status} /> : "-"}</TableCell>
                </TableRow>
              );
            })}
            {docs.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="size-8 opacity-40" />
                    <p>Nenhum documento cadastrado ainda.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
