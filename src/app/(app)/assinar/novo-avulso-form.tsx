"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { PenLine, X, ArrowUp, ArrowDown, Send, Plus, Search } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PdfFieldPicker } from "@/components/documenso/pdf-field-picker";
import { criarAvulsoAction, type AvulsoFormState } from "./actions";

const initialState: AvulsoFormState = {};

const CAMPOS_ASSINATURA = [
  { key: "assinatura", label: "Sua assinatura", colorClass: "border-primary text-primary" },
];

const POSICOES_PADRAO = {
  assinatura: { x: 70, y: 88, page: 1 },
};

type Role = "admin" | "aprovador" | "diretoria";
type Pessoa = { id: string; nome: string; role: Role };

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const primeiro = partes[0]?.[0] ?? "";
  const ultimo = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeiro + ultimo).toUpperCase();
}

const ROLE_INFO: Record<Role, { label: string; avatar: string; badge: string }> = {
  diretoria: {
    label: "Diretoria",
    avatar: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300",
  },
  aprovador: {
    label: "Aprovador",
    avatar: "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200",
    badge: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300",
  },
  admin: {
    label: "Admin",
    avatar: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  },
};

function Avatar({ nome, role, size = "md" }: { nome: string; role: Role; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
        ROLE_INFO[role].avatar,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        ROLE_INFO[role].badge,
      )}
    >
      {ROLE_INFO[role].label}
    </span>
  );
}

function SeletorPessoa({
  disponiveis,
  onAdd,
}: {
  disponiveis: Pessoa[];
  onAdd: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aberto]);

  const filtrados = useMemo(
    () => disponiveis.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase())),
    [disponiveis, busca],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="size-4" />
        Adicionar pessoa para encaminhar…
      </button>

      {aberto && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-foreground/10 bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtrados.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                Ninguém encontrado.
              </li>
            )}
            {filtrados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(p.id);
                    setBusca("");
                    setAberto(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                >
                  <Avatar nome={p.nome} role={p.role} />
                  <span className="flex-1 truncate font-medium">{p.nome}</span>
                  <RoleBadge role={p.role} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function NovoAvulsoForm({
  pessoas,
  minhaAssinatura,
}: {
  pessoas: Pessoa[];
  minhaAssinatura: string | null;
}) {
  const [state, formAction, pending] = useActionState(criarAvulsoAction, initialState);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [chain, setChain] = useState<Pessoa[]>([]);

  const disponiveis = useMemo(
    () => pessoas.filter((p) => !chain.some((c) => c.id === p.id)),
    [pessoas, chain],
  );

  function add(id: string) {
    const p = pessoas.find((x) => x.id === id);
    if (!p) return;
    setChain((c) => (c.some((x) => x.id === id) ? c : [...c, p]));
  }
  function remove(id: string) {
    setChain((c) => c.filter((x) => x.id !== id));
  }
  function move(idx: number, dir: -1 | 1) {
    setChain((c) => {
      const n = [...c];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return c;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  }

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-5 rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-2">
        <PenLine className="size-4.5 text-primary" />
        <h2 className="font-medium">Assinar e encaminhar um documento</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Suba um PDF, assine com assinatura eletrônica real e (opcionalmente) encaminhe para
        outras pessoas assinarem na ordem que você definir.
      </p>

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" placeholder="Ex: Avaliação técnica do fornecedor X" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="arquivo-avulso">Arquivo PDF</Label>
        <Input
          id="arquivo-avulso"
          name="arquivo"
          type="file"
          accept="application/pdf"
          required
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Encaminhamento sequencial */}
      <div className="space-y-3 rounded-lg bg-muted/40 p-4">
        <div>
          <p className="text-sm font-medium">Ordem de assinatura</p>
          <p className="text-xs text-muted-foreground">
            Você assina primeiro. Adicione pessoas para encaminhar em sequência — cada uma só
            libera depois que a anterior assinar. Deixe vazio para assinar só você.
          </p>
        </div>

        <ol className="space-y-1.5">
          <li className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-foreground/10">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary tabular-nums">
              1
            </span>
            <span className="font-medium">Você</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              quem envia
            </span>
          </li>
          {chain.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-foreground/10"
            >
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                {i + 2}
              </span>
              <Avatar nome={p.nome} role={p.role} size="sm" />
              <span className="flex-1 truncate font-medium">{p.nome}</span>
              <RoleBadge role={p.role} />
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === chain.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label="Descer"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  aria-label="Remover"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        {disponiveis.length > 0 && <SeletorPessoa disponiveis={disponiveis} onAdd={add} />}

        <input type="hidden" name="signatariosIds" value={chain.map((c) => c.id).join(",")} />
      </div>

      <div className="space-y-2">
        <Label>Onde a sua assinatura entra no documento</Label>
        <p className="text-xs text-muted-foreground">
          {minhaAssinatura
            ? "Arraste a sua assinatura para o lugar certo no documento. Ao enviar, ela já é aplicada e assinada. Cada pessoa encaminhada posiciona a própria na hora de assinar."
            : "Clique no PDF onde a sua assinatura deve ficar. Cada pessoa encaminhada posiciona a própria assinatura na hora de assinar."}
        </p>
        <PdfFieldPicker
          file={arquivo}
          fields={[{ ...CAMPOS_ASSINATURA[0], label: "Sua assinatura", image: minhaAssinatura }]}
          defaultPositions={POSICOES_PADRAO}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Enviando..." : minhaAssinatura ? "Enviar e assinar" : "Enviar"}
      </Button>
    </form>
  );
}
