import Link from "next/link";
import { Download, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { formatarDataHora } from "@/lib/datas";
import { requireAdminArea } from "@/lib/auth/current-user";
import { verificarCadeiaAuditoria, type SituacaoRegistro } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditoriaAbas } from "../abas";
import { acaoLabel, buscarEventosAuditoria } from "./query";

const situacaoBadge: Record<SituacaoRegistro, { texto: string; classe: string }> = {
  integro: {
    texto: "Íntegro",
    classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  encadeado: {
    texto: "Encadeado",
    classe: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  },
  quebrado: {
    texto: "Cadeia quebrada",
    classe: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  },
};

export default async function TrilhaEventosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminArea();
  const sp = await searchParams;

  const filters = {
    acao: sp.acao || undefined,
    usuarioId: sp.usuarioId || undefined,
    de: sp.de || undefined,
    ate: sp.ate || undefined,
  };

  const [eventos, cadeia, pessoas] = await Promise.all([
    buscarEventosAuditoria(filters),
    verificarCadeiaAuditoria(),
    db.select({ id: profiles.id, nome: profiles.nome }).from(profiles),
  ]);

  const queryString = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => !!v) as [string, string][],
  ).toString();
  const acoes = Object.entries(acaoLabel);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Auditoria</h1>
          <p className="mt-1 text-muted-foreground">
            Trilha de eventos do sistema: acessos, usuários e assinaturas, com data/hora de
            Brasília, IP e encadeamento por hash. Somente leitura — não há como editar,
            excluir ou desligar a trilha.
          </p>
        </div>
        <AuditoriaAbas ativa="/auditoria/eventos" />
      </div>

      <div
        className={
          cadeia.quebrados === 0
            ? "flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
            : "flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/30"
        }
      >
        {cadeia.quebrados === 0 ? (
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        ) : (
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
        )}
        <div>
          <p className="font-medium">
            {cadeia.quebrados === 0
              ? `Cadeia de hash íntegra: ${cadeia.total} registros verificados agora.`
              : `Atenção: ${cadeia.quebrados} registro(s) com a cadeia de hash quebrada.`}
          </p>
          <p className="mt-0.5 opacity-80">
            {cadeia.integros} íntegros (hash recalculado e conferido) · {cadeia.encadeados}{" "}
            encadeados (registros antigos cujo conteúdo não pode ser recalculado, mas que
            apontam corretamente para o anterior) · {cadeia.quebrados} quebrados.
          </p>
        </div>
      </div>

      <form
        className="grid gap-4 rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/10 sm:grid-cols-6"
        method="get"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="acao">Ação</Label>
          <Select
            name="acao"
            defaultValue={filters.acao}
            items={acoes.map(([value, label]) => ({ value, label }))}
          >
            <SelectTrigger id="acao" className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {acoes.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="usuarioId">Usuário</Label>
          <Select
            name="usuarioId"
            defaultValue={filters.usuarioId}
            items={pessoas.map((p) => ({ value: p.id, label: p.nome }))}
          >
            <SelectTrigger id="usuarioId" className="w-full">
              <SelectValue placeholder="Todos" />
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
        <div className="space-y-2">
          <Label htmlFor="de">De</Label>
          <Input id="de" name="de" type="date" defaultValue={filters.de} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" name="ate" type="date" defaultValue={filters.ate} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-6">
          <Button
            render={
              <Link href={`/auditoria/eventos/export${queryString ? `?${queryString}` : ""}`} />
            }
            nativeButton={false}
            variant="outline"
          >
            <Download className="size-4" />
            Exportar CSV
          </Button>
          <Button type="submit">
            <SlidersHorizontal className="size-4" />
            Filtrar
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Data/hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Registro afetado</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead>Integridade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventos.map((e) => {
              const badge = situacaoBadge[cadeia.situacao.get(e.id) ?? "quebrado"];
              return (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {formatarDataHora(e.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{e.usuario}</TableCell>
                  <TableCell>{e.acaoLabel}</TableCell>
                  <TableCell className="max-w-sm truncate" title={e.registro}>
                    {e.registro}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.ip ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs" title={e.rowHash}>
                    {e.rowHash.slice(0, 10)}…
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.classe}`}
                    >
                      {badge.texto}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {eventos.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum evento encontrado para os filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
