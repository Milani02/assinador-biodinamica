import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { recordAudit, verificarCadeiaAuditoria } from "@/lib/audit";
import { formatarDataHora } from "@/lib/datas";
import { buscarEventosAuditoria } from "../query";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const situacaoTexto = { integro: "Íntegro", encadeado: "Encadeado", quebrado: "Cadeia quebrada" };

export async function GET(request: Request) {
  const user = await requireUser();
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());

  const [eventos, cadeia] = await Promise.all([
    buscarEventosAuditoria({
      acao: sp.acao || undefined,
      usuarioId: sp.usuarioId || undefined,
      de: sp.de || undefined,
      ate: sp.ate || undefined,
    }),
    verificarCadeiaAuditoria(),
  ]);

  const header = ["Data/Hora (Brasília)", "Usuário", "Ação", "Registro afetado", "IP", "Hash SHA-256", "Integridade"];
  const lines = [header.join(",")];
  for (const e of eventos) {
    lines.push(
      [
        formatarDataHora(e.createdAt),
        e.usuario,
        e.acaoLabel,
        e.registro,
        e.ip ?? "",
        e.rowHash,
        situacaoTexto[cadeia.situacao.get(e.id) ?? "quebrado"],
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }

  await recordAudit({
    entityType: "auditoria",
    entityId: user.id,
    action: "exportar_csv",
    actorId: user.id,
    metadata: { relatorio: "trilha_eventos", filtros: sp, totalRegistros: eventos.length },
  });

  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-trilha-eventos.csv"`,
    },
  });
}
