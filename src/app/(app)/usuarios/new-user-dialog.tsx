"use client";

import { useActionState, useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAction, type CreateUserState } from "./actions";

const initialState: CreateUserState = {};

export function NewUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button />}>
        <UserPlus className="size-4" />
        Novo aprovador
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar usuário</DialogTitle>
        </DialogHeader>

        {state.tempPassword ? (
          <div className="space-y-3">
            <p className="text-sm">
              Usuário <strong>{state.email}</strong> criado. Envie a senha temporária
              abaixo por um canal seguro — ela precisa ser trocada no primeiro acesso e
              não será mostrada novamente:
            </p>
            <p className="flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-sm">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              {state.tempPassword}
            </p>
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              Concluir
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" name="nome" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select
                name="role"
                defaultValue="aprovador"
                items={[
                  { value: "aprovador", label: "Aprovador" },
                  { value: "admin", label: "Administrador" },
                ]}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovador">Aprovador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Criando..." : "Criar usuário"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
