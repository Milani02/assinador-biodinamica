// Datas exibidas sempre no horário de Brasília. O servidor roda em UTC, então
// toLocaleString() sem timeZone mostraria a hora 3h adiantada.
export const FUSO_SISTEMA = "America/Sao_Paulo";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_SISTEMA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "22/10/2026, 10:01:58" no horário de Brasília. */
export function formatarDataHora(quando: Date | string): string {
  return formatoDataHora.format(new Date(quando));
}

// Brasília não tem horário de verão desde 2019: o deslocamento é fixo em -03:00.
const OFFSET_BRASILIA = "-03:00";

/** Início do dia (00:00:00) em Brasília para uma data "AAAA-MM-DD". */
export function inicioDoDia(data: string): Date {
  return new Date(`${data}T00:00:00.000${OFFSET_BRASILIA}`);
}

/** Fim do dia (23:59:59.999) em Brasília para uma data "AAAA-MM-DD". */
export function fimDoDia(data: string): Date {
  return new Date(`${data}T23:59:59.999${OFFSET_BRASILIA}`);
}
