"use client";

import { useActionState } from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyIntegrityAction, type VerifyState } from "../actions";
import { statusLabel } from "../status-label";

const initialState: VerifyState = { status: "idle" };

export function VerifyIntegrity({ documentId }: { documentId: string }) {
  const action = verifyIntegrityAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="max-w-lg space-y-4 rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4.5 text-primary" />
        <h2 className="font-medium">Verificar integridade</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Envie um PDF para conferir se ele corresponde exatamente a alguma revisão
        aprovada deste documento. A comparação é feita pelo hash SHA-256 — nenhum arquivo
        é armazenado nesta verificação.
      </p>

      <form action={formAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="verificar-arquivo">Arquivo PDF a verificar</Label>
          <Input
            id="verificar-arquivo"
            name="arquivo"
            type="file"
            accept="application/pdf"
            required
          />
        </div>
        <Button type="submit" disabled={pending} variant="outline">
          {pending ? "Verificando..." : "Verificar"}
        </Button>
      </form>

      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {state.status === "match" && (
        <div className="space-y-2 rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/15">
          <p className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="size-4.5" />
            Íntegro — corresponde à revisão {state.revisao} ({statusLabel(state.versionStatus)})
          </p>
          <p className="text-sm text-emerald-900/80 dark:text-emerald-300/80">
            O arquivo enviado é idêntico ao aprovado. Nenhuma alteração foi feita.
          </p>
          <p className="font-mono text-xs break-all text-emerald-900/70 dark:text-emerald-300/70">
            {state.hash}
          </p>
        </div>
      )}

      {state.status === "no_match" && (
        <div className="space-y-2 rounded-lg bg-red-50 p-4 ring-1 ring-red-600/15 dark:bg-red-500/10 dark:ring-red-400/15">
          <p className="flex items-center gap-2 font-medium text-red-900 dark:text-red-300">
            <XCircle className="size-4.5" />
            Não corresponde a nenhuma revisão deste documento
          </p>
          <p className="text-sm text-red-900/80 dark:text-red-300/80">
            O arquivo foi alterado, é outro documento, ou pertence a outro código. Não
            considere este arquivo como a versão aprovada.
          </p>
          <p className="font-mono text-xs break-all text-red-900/70 dark:text-red-300/70">
            {state.hash}
          </p>
        </div>
      )}
    </div>
  );
}
