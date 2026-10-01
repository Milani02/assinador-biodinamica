import Link from "next/link";
import { and, asc, eq, or } from "drizzle-orm";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { db } from "@/lib/db/client";
import { documentVersions, documents } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const papelDoStatus: Record<string, string> = {
  aguardando_elaboracao: "Elaborar",
  aguardando_verificacao: "Verificar",
  aguardando_aprovacao: "Aprovar",
};

export default async function AprovacoesPage() {
  const user = await requireAdminArea();

  // Pega revisões em que é a VEZ do usuário assinar (papel = status atual).
  const rows = await db
    .select({
      versionId: documentVersions.id,
      revisao: documentVersions.revisao,
      enviadoEm: documentVersions.enviadoEm,
      status: documentVersions.status,
      codigo: documents.codigo,
      titulo: documents.titulo,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(
      or(
        and(
          eq(documentVersions.status, "aguardando_elaboracao"),
          eq(documentVersions.elaboradorId, user.id),
        ),
        and(
          eq(documentVersions.status, "aguardando_verificacao"),
          eq(documentVersions.verificadorId, user.id),
        ),
        and(
          eq(documentVersions.status, "aguardando_aprovacao"),
          eq(documentVersions.aprovadorId, user.id),
        ),
      ),
    )
    .orderBy(asc(documentVersions.enviadoEm));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Minhas assinaturas</h1>
        <p className="mt-1 text-muted-foreground">
          Documentos que aguardam a sua assinatura, na etapa em que você é responsável.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Revisão</TableHead>
              <TableHead>Sua etapa</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.versionId}>
                <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                <TableCell className="font-medium">{p.titulo}</TableCell>
                <TableCell className="tabular-nums">{p.revisao}</TableCell>
                <TableCell>{papelDoStatus[p.status] ?? "-"}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {new Date(p.enviadoEm).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    render={<Link href={`/aprovacoes/${p.versionId}`} />}
                    nativeButton={false}
                    size="sm"
                  >
                    Assinar
                    <ChevronRight className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="size-8 opacity-40" />
                    <p>Nenhuma assinatura pendente no momento.</p>
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
