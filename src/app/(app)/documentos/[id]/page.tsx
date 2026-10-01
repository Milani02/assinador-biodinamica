import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { FileDown, FileSignature, History, ScrollText } from "lucide-react";
import { db } from "@/lib/db/client";
import { documentVersions, documents, profiles, signatures } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "../status";
import { NewRevisionForm } from "./new-revision-form";
import { VerifyIntegrity } from "./verify-integrity";

const papelLabel: Record<string, string> = {
  elaborado: "Elaborado",
  verificado: "Verificado",
  aprovado: "Aprovado",
};
const ordemPapel = ["elaborado", "verificado", "aprovado"] as const;

const emAndamento = [
  "aguardando_elaboracao",
  "aguardando_verificacao",
  "aguardando_aprovacao",
];

export default async function DocumentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminArea();
  const { id } = await params;

  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) notFound();

  const [versions, allUsers] = await Promise.all([
    db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, id))
      .orderBy(desc(documentVersions.enviadoEm)),
    db.select({ id: profiles.id, nome: profiles.nome }).from(profiles),
  ]);

  const versionIds = versions.map((v) => v.id);
  const allSignatures = versionIds.length
    ? await db
        .select({
          documentVersionId: signatures.documentVersionId,
          papel: signatures.papel,
          decisao: signatures.decisao,
          signerId: signatures.signerId,
          assinadoEm: signatures.assinadoEm,
        })
        .from(signatures)
        .where(inArray(signatures.documentVersionId, versionIds))
        .orderBy(asc(signatures.assinadoEm))
    : [];

  const userName = new Map(allUsers.map((u) => [u.id, u.nome]));
  const sigByVersion = new Map<string, typeof allSignatures>();
  for (const s of allSignatures) {
    const arr = sigByVersion.get(s.documentVersionId) ?? [];
    arr.push(s);
    sigByVersion.set(s.documentVersionId, arr);
  }

  const hasOpenVersion = versions.some((v) => emAndamento.includes(v.status));
  // Quem sobe a revisão é o elaborador automaticamente, então não pode
  // aparecer como opção de verificador/aprovador.
  const pessoas = allUsers.filter((p) => p.id !== user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">{doc.codigo}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{doc.titulo}</h1>
        {doc.categoria && <p className="mt-1 text-muted-foreground">{doc.categoria}</p>}
      </div>

      <Tabs defaultValue="revisoes">
        <TabsList variant="line">
          <TabsTrigger value="revisoes" className="gap-1.5">
            <History className="size-4" />
            Revisões e alterações
          </TabsTrigger>
          <TabsTrigger value="assinaturas" className="gap-1.5">
            <FileSignature className="size-4" />
            Assinaturas (Documenso)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revisoes" className="space-y-6 pt-4">
          <div className="space-y-3">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-5 py-4 shadow-soft ring-1 ring-foreground/10"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">Revisão {v.revisao}</span>
                  <StatusBadge status={v.status} />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {v.sha256Hash.slice(0, 12)}…
                  </span>
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={`/documentos/versoes/${v.id}/arquivo`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileDown className="size-3.5" />
                    PDF
                  </a>
                  {v.protocoloPath && (
                    <a
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      href={`/aprovacoes/protocolo/${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ScrollText className="size-3.5" />
                      Protocolo
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {!hasOpenVersion && <NewRevisionForm documentId={doc.id} pessoas={pessoas} />}
            {hasOpenVersion && (
              <p className="text-sm text-muted-foreground">
                Já existe uma revisão em andamento no fluxo de assinaturas. Uma nova só pode
                ser enviada depois que essa for concluída.
              </p>
            )}
            <VerifyIntegrity documentId={doc.id} />
          </div>
        </TabsContent>

        <TabsContent value="assinaturas" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Cada etapa é assinada eletronicamente dentro do Documenso — não são imagens de
            assinatura coladas no PDF.
          </p>
          {versions.map((v) => {
            const sigs = sigByVersion.get(v.id) ?? [];
            const sigDone = new Map(sigs.map((s) => [s.papel, s]));
            const designados: Record<string, string> = {
              elaborado: v.elaboradorId,
              verificado: v.verificadorId,
              aprovado: v.aprovadorId,
            };
            return (
              <div
                key={v.id}
                className="overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-foreground/10"
              >
                <div className="flex items-center gap-3 border-b px-5 py-3">
                  <span className="font-medium tabular-nums">Revisão {v.revisao}</span>
                  <StatusBadge status={v.status} />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Etapa</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Data/hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordemPapel.map((papel) => {
                      const s = sigDone.get(papel);
                      const nome = userName.get(designados[papel]) ?? "-";
                      let situacao: React.ReactNode;
                      if (s?.decisao === "assinado") {
                        situacao = (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Assinado
                          </span>
                        );
                      } else if (s?.decisao === "reprovado") {
                        situacao = <span className="text-destructive">Reprovado</span>;
                      } else {
                        situacao = <span className="text-muted-foreground">Pendente</span>;
                      }
                      return (
                        <TableRow key={papel}>
                          <TableCell>{papelLabel[papel]}</TableCell>
                          <TableCell className="font-medium">{nome}</TableCell>
                          <TableCell>{situacao}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {s ? new Date(s.assinadoEm).toLocaleString("pt-BR") : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
