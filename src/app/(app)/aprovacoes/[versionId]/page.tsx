import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { FileSearch } from "lucide-react";
import { db } from "@/lib/db/client";
import { documentVersions, documents, profiles, signatures } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import { getDocumentoSignedUrl } from "@/lib/files";
import { getEnvelope } from "@/lib/documenso/client";
import { DecisionForms } from "./decision-forms";

const ordemPapel: Record<string, number> = {
  elaborado: 0,
  verificado: 1,
  aprovado: 2,
};

const papelDaEtapa: Record<string, { papel: string; titulo: string; verbo: string }> = {
  aguardando_elaboracao: { papel: "elaborado", titulo: "Elaboração", verbo: "Assinar elaboração" },
  aguardando_verificacao: {
    papel: "verificado",
    titulo: "Verificação",
    verbo: "Assinar verificação",
  },
  aguardando_aprovacao: { papel: "aprovado", titulo: "Aprovação", verbo: "Assinar aprovação" },
};

export default async function AnalisarAprovacaoPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const user = await requireAdminArea();
  const { versionId } = await params;

  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);
  if (!version) notFound();

  const etapa = papelDaEtapa[version.status];
  if (!etapa) {
    redirect(`/documentos/${version.documentId}`);
  }

  const responsavelId =
    version.status === "aguardando_elaboracao"
      ? version.elaboradorId
      : version.status === "aguardando_verificacao"
        ? version.verificadorId
        : version.aprovadorId;

  if (responsavelId !== user.id) {
    redirect("/aprovacoes");
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, version.documentId))
    .limit(1);

  // Assinaturas já feitas nas etapas anteriores.
  const feitas = await db
    .select({
      papel: signatures.papel,
      nome: profiles.nome,
      assinadoEm: signatures.assinadoEm,
    })
    .from(signatures)
    .innerJoin(profiles, eq(profiles.id, signatures.signerId))
    .where(eq(signatures.documentVersionId, versionId))
    .orderBy(asc(signatures.assinadoEm));

  const papelLabel: Record<string, string> = {
    elaborado: "Elaborado",
    verificado: "Verificado",
    aprovado: "Aprovado",
  };

  const tokenPorPapel: Record<string, string | null> = {
    elaborado: version.documensoTokenElaborador,
    verificado: version.documensoTokenVerificador,
    aprovado: version.documensoTokenAprovador,
  };
  const signingToken = tokenPorPapel[etapa.papel] ?? null;

  // Posição atual do campo de assinatura desta etapa + URL do PDF, para permitir
  // que o responsável arraste a própria assinatura antes de assinar. Se algo
  // falhar (ex.: Documenso indisponível), o ajuste some mas a assinatura segue.
  let arquivoUrl: string | null = null;
  let posicaoAtual: { x: number; y: number; page: number } | null = null;
  if (signingToken && version.documensoEnvelopeId) {
    try {
      const [url, envelope] = await Promise.all([
        getDocumentoSignedUrl(version.arquivoPath),
        getEnvelope(version.documensoEnvelopeId),
      ]);
      arquivoUrl = url;
      const recipient = envelope.recipients.find(
        (r) => r.signingOrder === ordemPapel[etapa.papel],
      );
      const campo = recipient
        ? envelope.fields.find((f) => f.recipientId === recipient.id)
        : undefined;
      if (campo) {
        posicaoAtual = {
          x: Number(campo.positionX),
          y: Number(campo.positionY),
          page: campo.page,
        };
      }
    } catch (err) {
      console.error("Falha ao carregar dados para ajuste de posição:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">{doc?.codigo}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{doc?.titulo}</h1>
        <p className="mt-1 text-muted-foreground">
          Revisão {version.revisao} · sua etapa:{" "}
          <span className="font-medium text-foreground">{etapa.titulo}</span>
        </p>
      </div>

      {feitas.length > 0 && (
        <div className="rounded-xl bg-card p-4 text-sm shadow-soft ring-1 ring-foreground/10">
          <p className="mb-2 font-medium">Etapas já assinadas</p>
          <ul className="space-y-1 text-muted-foreground">
            {feitas.map((f, i) => (
              <li key={i}>
                <span className="text-foreground">{papelLabel[f.papel] ?? f.papel}</span> por{" "}
                {f.nome} · {new Date(f.assinadoEm).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={`/documentos/versoes/${version.id}/arquivo`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-medium text-primary shadow-soft ring-1 ring-foreground/10 hover:underline"
      >
        <FileSearch className="size-4" />
        Abrir PDF para análise
      </a>

      <DecisionForms
        versionId={version.id}
        verboAssinar={etapa.verbo}
        signingToken={signingToken}
        arquivoUrl={arquivoUrl}
        posicaoAtual={posicaoAtual}
      />
    </div>
  );
}
