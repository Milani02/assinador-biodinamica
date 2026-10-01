"use client";

import { useActionState, useState } from "react";
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
import { PdfFieldPicker } from "@/components/documenso/pdf-field-picker";
import { createRevisionAction, type DocumentFormState } from "../actions";

const initialState: DocumentFormState = {};

const CAMPOS_ASSINATURA = [
  { key: "elaborado", label: "Elaborado", colorClass: "border-amber-500 text-amber-700 dark:text-amber-400" },
  { key: "verificado", label: "Verificado", colorClass: "border-blue-500 text-blue-700 dark:text-blue-400" },
  { key: "aprovado", label: "Aprovado", colorClass: "border-emerald-500 text-emerald-700 dark:text-emerald-400" },
];

const POSICOES_PADRAO = {
  elaborado: { x: 15, y: 90 },
  verificado: { x: 45, y: 90 },
  aprovado: { x: 75, y: 90 },
};

function PessoaSelect({
  name,
  label,
  pessoas,
  placeholder,
}: {
  name: string;
  label: string;
  pessoas: { id: string; nome: string }[];
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} required items={pessoas.map((p) => ({ value: p.id, label: p.nome }))}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {pessoas.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NewRevisionForm({
  documentId,
  pessoas,
}: {
  documentId: string;
  pessoas: { id: string; nome: string }[];
}) {
  const action = createRevisionAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [arquivo, setArquivo] = useState<File | null>(null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-4 rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/10"
    >
      <h2 className="font-medium">Enviar nova revisão</h2>
      <div className="space-y-2">
        <Label htmlFor="revisao">Revisão</Label>
        <Input id="revisao" name="revisao" placeholder="Ex: 01" required />
      </div>

      <div className="space-y-4 rounded-lg bg-muted/40 p-4">
        <p className="text-sm font-medium">
          Fluxo de assinaturas <span className="text-muted-foreground">(nesta ordem)</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Você é o elaborador desta revisão — assina como tal ao final.
        </p>
        <PessoaSelect
          name="verificadorId"
          label="1. Verificado por"
          pessoas={pessoas}
          placeholder="Quem verifica"
        />
        <PessoaSelect
          name="aprovadorId"
          label="2. Aprovado por"
          pessoas={pessoas}
          placeholder="Quem aprova"
        />
        <p className="text-xs text-muted-foreground">
          Verificador e aprovador podem ser a mesma pessoa, mas nenhum dos dois pode ser
          você (o elaborador).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="arquivo">Arquivo PDF</Label>
        <Input
          id="arquivo"
          name="arquivo"
          type="file"
          accept="application/pdf"
          required
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="space-y-2">
        <Label>Onde cada assinatura entra no documento</Label>
        <p className="text-xs text-muted-foreground">
          Clique num papel acima da prévia e depois clique no PDF onde a assinatura dele
          deve ficar. Dá pra arrastar depois para ajustar.
        </p>
        <PdfFieldPicker
          file={arquivo}
          fields={CAMPOS_ASSINATURA}
          defaultPositions={POSICOES_PADRAO}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar para assinaturas"}
      </Button>
    </form>
  );
}
