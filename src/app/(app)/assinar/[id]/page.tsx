import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { CheckCircle2, Clock, FileDown, Lock } from "lucide-react";
import { db } from "@/lib/db/client";
import { avulsos, avulsoSignatarios, profiles } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { getAvulsoSignedUrl } from "@/lib/files";
import { getEnvelope } from "@/lib/documenso/client";
import { AvulsoSignPanel } from "./sign-panel";

export default async function AssinarAvulsoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [avulso] = await db.select().from(avulsos).where(eq(avulsos.id, id)).limit(1);
  if (!avulso) notFound();

  const signatarios = await db
    .select({
      id: avulsoSignatarios.id,
      ordem: avulsoSignatarios.ordem,
      signerId: avulsoSignatarios.signerId,
      status: avulsoSignatarios.status,
      assinadoEm: avulsoSignatarios.assinadoEm,
      token: avulsoSignatarios.documensoToken,
      nome: profiles.nome,
      assinaturaImagem: profiles.assinaturaImagem,
    })
    .from(avulsoSignatarios)
    .innerJoin(profiles, eq(profiles.id, avulsoSignatarios.signerId))
    .where(eq(avulsoSignatarios.avulsoId, id))
    .orderBy(asc(avulsoSignatarios.ordem));

  const isSignatario = signatarios.some((s) => s.signerId === user.id);
  const podeBaixar = user.role === "diretoria" || user.role === "admin";

  // Acesso à página: quem subiu, qualquer signatário, diretoria ou admin.
  if (avulso.uploaderId !== user.id && !isSignatario && !podeBaixar) {
    redirect("/assinar");
  }

  // Signatário da vez = primeiro pendente na ordem (Documenso é sequencial).
  const atual = signatarios.find((s) => s.status === "pendente") ?? null;
  const minhaVez = atual && atual.signerId === user.id ? atual : null;

  // Compat com avulsos antigos (fluxo de assinatura único, sem tabela de signatários).
  const legadoToken =
    signatarios.length === 0 && avulso.status === "pendente" ? avulso.documensoToken : null;

  // Posição atual do campo do usuário (para "ajustar posição"), quando for a vez
  // dele, e as assinaturas de quem já assinou (para mostrar sobre o documento).
  type AssinaturaAnterior = {
    nome: string;
    imagem: string | null;
    x: number;
    y: number;
    page: number;
    width: number;
  };
  let arquivoUrl: string | null = null;
  let posicaoAtual: { x: number; y: number; page: number } | null = null;
  let assinaturasAnteriores: AssinaturaAnterior[] = [];
  if ((minhaVez || legadoToken) && avulso.documensoEnvelopeId) {
    try {
      const [url, envelope] = await Promise.all([
        getAvulsoSignedUrl(avulso.arquivoPath),
        getEnvelope(avulso.documensoEnvelopeId),
      ]);
      arquivoUrl = url;
      const ordem = minhaVez ? minhaVez.ordem : 0;
      const rec = envelope.recipients.find((r) => r.signingOrder === ordem);
      const campo = rec ? envelope.fields.find((f) => f.recipientId === rec.id) : undefined;
      if (campo) {
        posicaoAtual = { x: Number(campo.positionX), y: Number(campo.positionY), page: campo.page };
      }

      // Assinaturas já aplicadas (quem assinou antes) — para a pessoa da vez ver
      // onde cada um assinou e escolher um lugar livre para a sua.
      assinaturasAnteriores = signatarios
        .filter((s) => s.status === "assinado")
        .map((s) => {
          const r = envelope.recipients.find((rr) => rr.signingOrder === s.ordem);
          const f = r ? envelope.fields.find((ff) => ff.recipientId === r.id) : undefined;
          if (!f) return null;
          return {
            nome: s.nome,
            imagem: s.assinaturaImagem,
            x: Number(f.positionX),
            y: Number(f.positionY),
            page: f.page,
            width: Number(f.width) || 22,
          };
        })
        .filter((a): a is AssinaturaAnterior => a !== null);
    } catch (err) {
      console.error("Falha ao carregar dados para ajuste de posição (avulso):", err);
    }
  }

  const token = minhaVez?.token ?? legadoToken ?? null;
  const assinado = avulso.status === "assinado";

  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleString("pt-BR") : "-");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{avulso.titulo}</h1>
        <p className="mt-1 text-muted-foreground">
          {assinado ? "Assinatura concluída por todos os signatários." : "Assinatura em andamento."}
        </p>
      </div>

      {/* Fila de assinaturas */}
      {signatarios.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-foreground/10">
          <div className="border-b px-5 py-3 text-sm font-medium">Ordem de assinatura</div>
          <ul className="divide-y">
            {signatarios.map((s, i) => {
              const ehAtual = atual?.id === s.id;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                      {i + 1}
                    </span>
                    <span className="font-medium">{s.nome}</span>
                    {s.signerId === user.id && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">você</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {s.status === "assinado" ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" /> Assinado
                      </span>
                    ) : ehAtual ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <Clock className="size-4" /> Assinando agora
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Aguardando</span>
                    )}
                    <span className="tabular-nums text-muted-foreground">{fmt(s.assinadoEm)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Área de ação */}
      {assinado ? (
        <div className="max-w-lg space-y-3 rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/15">
          <p className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="size-4.5" />
            Documento assinado por todos
          </p>
          {podeBaixar ? (
            <div className="flex flex-col gap-1">
              <a
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                href={`/assinar/${avulso.id}/pdf-assinado`}
              >
                <FileDown className="size-3.5" />
                Baixar PDF assinado
              </a>
              <a
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                href={await getAvulsoSignedUrl(avulso.arquivoPath)}
                target="_blank"
                rel="noreferrer"
              >
                <FileDown className="size-3" />
                Baixar PDF original (sem assinatura)
              </a>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-emerald-900/80 dark:text-emerald-300/80">
              <Lock className="size-3.5" />
              O download é liberado apenas para a diretoria.
            </p>
          )}
        </div>
      ) : token ? (
        <AvulsoSignPanel
          id={avulso.id}
          token={token}
          arquivoUrl={arquivoUrl}
          posicaoAtual={posicaoAtual}
          temAssinatura={Boolean(user.assinaturaImagem)}
          minhaAssinatura={user.assinaturaImagem}
          assinaturasAnteriores={assinaturasAnteriores}
        />
      ) : isSignatario ? (
        <div className="max-w-lg rounded-xl bg-card p-5 text-sm shadow-soft ring-1 ring-foreground/10">
          {signatarios.find((s) => s.signerId === user.id)?.status === "assinado" ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Você já assinou. Aguardando os demais signatários.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 text-amber-600 dark:text-amber-400" />
              Aguardando <span className="font-medium text-foreground">{atual?.nome}</span> assinar.
              Você será o próximo na ordem.
            </p>
          )}
        </div>
      ) : (
        <div className="max-w-lg rounded-xl bg-card p-5 text-sm text-muted-foreground shadow-soft ring-1 ring-foreground/10">
          Assinatura em andamento. Aguardando{" "}
          <span className="font-medium text-foreground">{atual?.nome}</span>.
        </div>
      )}
    </div>
  );
}
