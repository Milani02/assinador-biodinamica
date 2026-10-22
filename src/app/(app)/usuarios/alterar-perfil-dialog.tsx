"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { alterarPerfilAction, type AlterarPerfilState } from "./actions";

const PERFIS = [
  { value: "aprovador", label: "Aprovador" },
  { value: "diretoria", label: "Diretoria" },
  { value: "admin", label: "Administrador" },
];

const initialState: AlterarPerfilState = {};

export function AlterarPerfilDialog({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: AlterarPerfilState, formData: FormData) => {
      const resultado = await alterarPerfilAction(userId, prev, formData);
      if (resultado.ok) {
        setOpen(false);
        router.refresh();
      }
      return resultado;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserCog className="size-3.5" />
        Alterar perfil
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar perfil</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O novo perfil vale a partir da próxima ação do usuário. A alteração fica
            registrada na trilha de auditoria (perfil anterior e novo).
          </p>
          <div className="space-y-2">
            <Label htmlFor={`role-${userId}`}>Perfil</Label>
            <Select name="role" defaultValue={role} items={PERFIS}>
              <SelectTrigger id={`role-${userId}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERFIS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Salvando..." : "Salvar perfil"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
