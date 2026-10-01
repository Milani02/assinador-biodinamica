"use client";

import { useActionState, useState } from "react";
import { KeyRound, Power, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  resetPasswordAction,
  toggleUserActiveAction,
  type ResetPasswordState,
  type ToggleUserState,
} from "./actions";

const initialToggleState: ToggleUserState = {};
const initialResetState: ResetPasswordState = {};

export function UserRowActions({ userId, ativo }: { userId: string; ativo: boolean }) {
  const toggleAction = toggleUserActiveAction.bind(null, userId, !ativo);
  const [toggleState, toggleFormAction, togglePending] = useActionState(
    toggleAction,
    initialToggleState,
  );

  const resetAction = resetPasswordAction.bind(null, userId);
  const [resetState, resetFormAction, resetPending] = useActionState(
    resetAction,
    initialResetState,
  );
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <KeyRound className="size-3.5" />
            Resetar senha
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resetar senha</DialogTitle>
            </DialogHeader>
            {resetState.tempPassword ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Nova senha temporária para <strong>{resetState.email}</strong>. Envie por um
                  canal seguro — ela precisa ser trocada no próximo login e não será mostrada
                  novamente:
                </p>
                <p className="flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-sm">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                  {resetState.tempPassword}
                </p>
                <Button onClick={() => setResetOpen(false)}>Concluir</Button>
              </div>
            ) : (
              <form action={resetFormAction} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Isso gera uma nova senha temporária e invalida a senha atual do usuário.
                </p>
                {resetState.error && (
                  <p className="text-sm text-destructive">{resetState.error}</p>
                )}
                <Button type="submit" disabled={resetPending} className="w-full">
                  {resetPending ? "Gerando..." : "Confirmar reset"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <form action={toggleFormAction}>
          <Button type="submit" variant="outline" size="sm" disabled={togglePending}>
            {ativo ? <Power className="size-3.5" /> : <RotateCcw className="size-3.5" />}
            {ativo ? "Desativar" : "Reativar"}
          </Button>
        </form>
      </div>
      {toggleState.error && (
        <p className="max-w-xs text-right text-xs text-destructive">{toggleState.error}</p>
      )}
    </div>
  );
}
