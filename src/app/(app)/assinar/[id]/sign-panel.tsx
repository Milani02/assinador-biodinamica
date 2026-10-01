"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Move, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmbedSigning } from "@/components/documenso/embed-signing";
import { PdfFieldPicker, type PdfOverlay } from "@/components/documenso/pdf-field-picker";
import {
  assinarComPosicaoAction,
  marcarAvulsoAssinadoAction,
  reposicionarAvulsoAction,
  type AssinarState,
  type ReposicionarState,
} from "../actions";

const CAMPOS_ASSINATURA = [
  { key: "assinatura", label: "Minha assinatura", colorClass: "border-primary text-primary" },
];

/** Busca o PDF (uma vez) e devolve como File para o PdfFieldPicker. */
function usePdfFile(arquivoUrl: string) {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(arquivoUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (!cancelled) setFile(new File([blob], "documento.pdf", { type: "application/pdf" }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- busca só na primeira montagem.
  }, []);
  return file;
}

const initialAssinar: AssinarState = {};

/**
 * Tela unificada: mostra o documento com a assinatura da pessoa como um
 * marcador arrastável (no tamanho real do campo) e as assinaturas de quem já
 * assinou. Arrasta para o lugar e assina ali mesmo, num passo só.
 */
function AssinarNaTela({
  id,
  arquivoUrl,
  posicaoAtual,
  overlays,
  minhaAssinatura,
  onSigned,
}: {
  id: string;
  arquivoUrl: string;
  posicaoAtual: { x: number; y: number; page: number } | null;
  overlays: PdfOverlay[];
  minhaAssinatura: string;
  onSigned: () => void;
}) {
  const file = usePdfFile(arquivoUrl);
  const action = assinarComPosicaoAction.bind(null, id);
  const [state, formAction, pending] = useActionState(action, initialAssinar);

  useEffect(() => {
    if (state.ok) onSigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage só ao sucesso.
  }, [state.ok]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/10"
    >
      <p className="text-sm text-muted-foreground">
        {overlays.length > 0
          ? "As assinaturas em verde já foram aplicadas. Arraste a SUA assinatura para um espaço livre e clique em Assinar."
          : "Arraste a sua assinatura para o lugar certo no documento e clique em Assinar."}
      </p>
      <PdfFieldPicker
        file={file}
        fields={[{ ...CAMPOS_ASSINATURA[0], label: "Sua assinatura", image: minhaAssinatura }]}
        defaultPositions={{ assinatura: posicaoAtual ?? { x: 70, y: 88, page: 1 } }}
        overlays={overlays}
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending || !file}>
        <PenLine className="size-4" />
        {pending ? "Assinando..." : "Assinar aqui"}
      </Button>
    </form>
  );
}

const initialRepos: ReposicionarState = {};

/** Reposicionamento simples (fallback de quem assina pelo widget de desenho). */
function AjustarPosicao({
  id,
  arquivoUrl,
  posicaoAtual,
  overlays,
  onSaved,
}: {
  id: string;
  arquivoUrl: string;
  posicaoAtual: { x: number; y: number; page: number } | null;
  overlays: PdfOverlay[];
  onSaved: () => void;
}) {
  const file = usePdfFile(arquivoUrl);
  const action = reposicionarAvulsoAction.bind(null, id);
  const [state, formAction, pending] = useActionState(action, initialRepos);

  useEffect(() => {
    if (state.ok) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à conclusão bem-sucedida.
  }, [state.ok]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/10"
    >
      <p className="text-sm text-muted-foreground">
        {overlays.length > 0
          ? "As assinaturas em verde já foram aplicadas por quem assinou antes. Clique no PDF em um espaço livre para posicionar a sua e salve."
          : "Clique no PDF onde a sua assinatura deve ficar e depois salve."}
      </p>
      <PdfFieldPicker
        file={file}
        fields={CAMPOS_ASSINATURA}
        defaultPositions={{ assinatura: posicaoAtual ?? { x: 70, y: 88, page: 1 } }}
        overlays={overlays}
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Posição atualizada — a área de assinatura abaixo já reflete o novo lugar.
        </p>
      )}
      <Button type="submit" disabled={pending || !file}>
        {pending ? "Salvando..." : "Salvar nova posição"}
      </Button>
    </form>
  );
}

export function AvulsoSignPanel({
  id,
  token,
  arquivoUrl,
  posicaoAtual,
  temAssinatura,
  minhaAssinatura,
  assinaturasAnteriores = [],
}: {
  id: string;
  token: string;
  arquivoUrl: string | null;
  posicaoAtual: { x: number; y: number; page: number } | null;
  /** Se o usuário tem imagem de assinatura fixa cadastrada. */
  temAssinatura: boolean;
  /** Data URL da assinatura do usuário (marcador arrastável). */
  minhaAssinatura: string | null;
  /** Assinaturas de quem já assinou (mostradas sobre o documento). */
  assinaturasAnteriores?: PdfOverlay[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ajustando, setAjustando] = useState(false);
  // Muda a cada reposicionamento para forçar o widget a recarregar na nova posição.
  const [reposVersion, setReposVersion] = useState(0);

  // Com assinatura cadastrada: tela unificada — arrasta a assinatura e assina ali.
  if (temAssinatura && arquivoUrl && minhaAssinatura) {
    return (
      <AssinarNaTela
        id={id}
        arquivoUrl={arquivoUrl}
        posicaoAtual={posicaoAtual}
        overlays={assinaturasAnteriores}
        minhaAssinatura={minhaAssinatura}
        onSigned={() => router.refresh()}
      />
    );
  }

  // Sem assinatura cadastrada: widget de desenho embutido (com ajuste de posição).
  return (
    <div className="space-y-3">
      {arquivoUrl && (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => setAjustando((v) => !v)}>
            <Move className="size-3.5" />
            {ajustando ? "Fechar ajuste de posição" : "Ajustar posição da minha assinatura"}
          </Button>
          {ajustando && (
            <AjustarPosicao
              id={id}
              arquivoUrl={arquivoUrl}
              posicaoAtual={posicaoAtual}
              overlays={assinaturasAnteriores}
              onSaved={() => {
                setReposVersion((n) => n + 1);
                router.refresh();
              }}
            />
          )}
        </>
      )}
      <EmbedSigning
        key={`${token}-${reposVersion}`}
        token={token}
        onCompleted={() =>
          startTransition(async () => {
            await marcarAvulsoAssinadoAction(id);
            router.refresh();
          })
        }
      />
      {pending && <p className="text-sm text-muted-foreground">Registrando assinatura...</p>}
    </div>
  );
}
