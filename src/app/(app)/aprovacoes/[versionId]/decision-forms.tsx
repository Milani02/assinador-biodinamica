"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Move, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  signAction,
  reposicionarAssinaturaAction,
  type DecisionState,
  type ReposicionarState,
} from "../actions";
import { EmbedSigning } from "@/components/documenso/embed-signing";
import { PdfFieldPicker } from "@/components/documenso/pdf-field-picker";

const initialState: DecisionState = {};
const initialReposState: ReposicionarState = {};

const CAMPOS_ASSINATURA = [
  { key: "assinatura", label: "Minha assinatura", colorClass: "border-primary text-primary" },
];

function AjustarPosicao({
  versionId,
  arquivoUrl,
  posicaoAtual,
  onSaved,
}: {
  versionId: string;
  arquivoUrl: string;
  posicaoAtual: { x: number; y: number; page: number } | null;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const action = reposicionarAssinaturaAction.bind(null, versionId);
  const [state, formAction, pending] = useActionState(action, initialReposState);

  useEffect(() => {
    // Busca o PDF só uma vez para a pré-visualização de posicionamento.
    if (file) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- busca proposital só na primeira montagem.
  }, []);

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
        Clique no PDF onde a sua assinatura deve ficar e depois salve. Só você move a sua
        assinatura, e só antes de assinar.
      </p>
      <PdfFieldPicker
        file={file}
        fields={CAMPOS_ASSINATURA}
        defaultPositions={{ assinatura: posicaoAtual ?? { x: 15, y: 90, page: 1 } }}
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

export function DecisionForms({
  versionId,
  verboAssinar,
  signingToken,
  arquivoUrl,
  posicaoAtual,
}: {
  versionId: string;
  verboAssinar: string;
  signingToken: string | null;
  arquivoUrl: string | null;
  posicaoAtual: { x: number; y: number; page: number } | null;
}) {
  const router = useRouter();
  const assinarAction = signAction.bind(null, versionId, "assinado");
  const reprovarAction = signAction.bind(null, versionId, "reprovado");

  const [assinarState, assinarFormAction, assinarPending] = useActionState(
    assinarAction,
    initialState,
  );
  const [reprovarState, reprovarFormAction, reprovarPending] = useActionState(
    reprovarAction,
    initialState,
  );
  const [registrando, startRegistrar] = useTransition();
  const [ajustando, setAjustando] = useState(false);
  // Muda a cada reposicionamento para forçar o widget embutido a recarregar e
  // mostrar a assinatura na nova posição (o token não muda ao mover o campo).
  const [reposVersion, setReposVersion] = useState(0);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {signingToken ? (
        <div className="space-y-3 sm:col-span-2">
          <h2 className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="size-4.5 text-emerald-600 dark:text-emerald-400" />
            {verboAssinar} — assine dentro do documento abaixo
          </h2>

          {arquivoUrl && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAjustando((v) => !v)}
              >
                <Move className="size-3.5" />
                {ajustando ? "Fechar ajuste de posição" : "Ajustar posição da minha assinatura"}
              </Button>
              {ajustando && (
                <AjustarPosicao
                  versionId={versionId}
                  arquivoUrl={arquivoUrl}
                  posicaoAtual={posicaoAtual}
                  onSaved={() => {
                    setReposVersion((n) => n + 1);
                    router.refresh();
                  }}
                />
              )}
            </div>
          )}

          <EmbedSigning
            key={`${signingToken}-${reposVersion}`}
            token={signingToken}
            onCompleted={() =>
              startRegistrar(() => assinarFormAction(new FormData()))
            }
          />
          {(registrando || assinarPending) && (
            <p className="text-sm text-muted-foreground">Registrando assinatura...</p>
          )}
          {assinarState.error && (
            <p className="text-sm text-destructive">{assinarState.error}</p>
          )}
        </div>
      ) : (
        <form
          action={assinarFormAction}
          className="space-y-3 rounded-xl bg-emerald-50 p-5 shadow-soft ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/15"
        >
          <h2 className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="size-4.5" />
            Assinar
          </h2>
          <div className="space-y-2">
            <Label htmlFor="comentario-assinar">Comentário (opcional)</Label>
            <Textarea id="comentario-assinar" name="comentario" rows={3} className="bg-background" />
          </div>
          {assinarState.error && (
            <p className="text-sm text-destructive">{assinarState.error}</p>
          )}
          <Button type="submit" disabled={assinarPending} className="w-full">
            {assinarPending ? "Registrando..." : verboAssinar}
          </Button>
        </form>
      )}

      <form
        action={reprovarFormAction}
        className={`space-y-3 rounded-xl bg-red-50 p-5 shadow-soft ring-1 ring-red-600/15 dark:bg-red-500/10 dark:ring-red-400/15 ${signingToken ? "sm:col-span-2" : ""}`}
      >
        <h2 className="flex items-center gap-2 font-medium text-red-900 dark:text-red-300">
          <XCircle className="size-4.5" />
          Reprovar
        </h2>
        <div className="space-y-2">
          <Label htmlFor="comentario-reprovar">Motivo da reprovação (obrigatório)</Label>
          <Textarea
            id="comentario-reprovar"
            name="comentario"
            rows={3}
            required
            className="bg-background"
          />
        </div>
        {reprovarState.error && (
          <p className="text-sm text-destructive">{reprovarState.error}</p>
        )}
        <Button
          type="submit"
          disabled={reprovarPending}
          variant="destructive"
          className="w-full"
        >
          {reprovarPending ? "Registrando..." : "Reprovar documento"}
        </Button>
      </form>
    </div>
  );
}
