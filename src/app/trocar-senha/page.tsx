"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth-shell";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export default function TrocarSenhaPage() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state.redirectTo, router]);

  const busy = pending || Boolean(state.redirectTo);

  return (
    <AuthShell>
      <Card className="relative w-full max-w-sm gap-6 p-2 shadow-soft ring-1 ring-foreground/10">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-5.5" />
          </div>
          <CardTitle className="text-xl">Defina sua senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            É necessário trocar a senha temporária antes de continuar.
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="atual">Senha atual (temporária)</Label>
              <Input id="atual" name="atual" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova">Nova senha</Label>
              <Input id="nova" name="nova" type="password" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <Input id="confirmar" name="confirmar" type="password" minLength={8} required />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
