// Feedback instantaneo ao trocar de aba: o Next mostra este skeleton na hora
// (a sidebar/header do layout continua montada) enquanto o conteudo da rota
// faz streaming. Sem isto, a navegacao "congela" ate a pagina inteira carregar.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {/* cabecalho */}
      <div className="space-y-2.5">
        <div className="h-8 w-48 rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full rounded bg-muted/60" />
      </div>

      {/* lista */}
      <div className="space-y-3">
        <div className="h-4 w-44 rounded bg-muted/60" />
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted/50" />
              </div>
              <div className="h-6 w-20 shrink-0 rounded-full bg-muted/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
