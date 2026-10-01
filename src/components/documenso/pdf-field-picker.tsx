"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

export interface PdfFieldDef {
  key: string;
  label: string;
  /** Classes Tailwind para o marcador (borda + texto), ex.: "border-amber-500 text-amber-700". */
  colorClass: string;
  /** Imagem da assinatura (data URL). Quando presente, o marcador arrastável é a
   *  própria assinatura no tamanho real do campo, em vez de um rótulo genérico. */
  image?: string | null;
}

export type PdfFieldPositions = Record<string, { x: number; y: number; page?: number }>;

/** Assinatura já aplicada por quem assinou antes, mostrada sobre o documento. */
export interface PdfOverlay {
  nome: string;
  imagem: string | null;
  /** Canto superior esquerdo (% da página), igual ao Documenso. */
  x: number;
  y: number;
  page: number;
  /** Largura do campo (% da página). */
  width?: number;
}

function clamp(n: number, min = 4, max = 96) {
  return Math.min(max, Math.max(min, n));
}

// Tamanho padrão e limites da assinatura (largura em % da página).
const DEFAULT_WIDTH_PCT = 22;
const MIN_WIDTH_PCT = 8;
const MAX_WIDTH_PCT = 45;

export function PdfFieldPicker({
  file,
  fields,
  defaultPositions,
  overlays = [],
  defaultWidthPct = DEFAULT_WIDTH_PCT,
}: {
  file: File | null;
  fields: PdfFieldDef[];
  /** Posições padrão (%) usadas até o usuário clicar/arrastar. */
  defaultPositions: PdfFieldPositions;
  /** Assinaturas de quem já assinou, mostradas (só leitura) sobre o PDF. */
  overlays?: PdfOverlay[];
  /** Largura (%) padrão da assinatura — igual para todos (padronização). */
  defaultWidthPct?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; page: number }>>(() =>
    Object.fromEntries(
      Object.entries(defaultPositions).map(([key, pos]) => [key, { ...pos, page: pos.page ?? 1 }]),
    ),
  );
  const [activeKey, setActiveKey] = useState(fields[0]?.key ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  // Largura (%) de cada assinatura e proporção (imgW/imgH) da imagem carregada.
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [pageAspect, setPageAspect] = useState(0.707); // W/H (A4 retrato por padrão)
  const draggingKey = useRef<string | null>(null);
  const resizingKey = useRef<string | null>(null);
  // Deslocamento (em %) entre o cursor e o canto do marcador ao começar a arrastar.
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const widthOf = (key: string) => widths[key] ?? defaultWidthPct;

  // Carrega a proporção natural de cada imagem de assinatura (para calcular a
  // altura do campo a partir da largura escolhida).
  useEffect(() => {
    for (const f of fields) {
      if (!f.image || aspects[f.key]) continue;
      const img = new Image();
      img.onload = () =>
        setAspects((prev) => ({ ...prev, [f.key]: img.naturalWidth / img.naturalHeight }));
      img.src = f.image;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage à lista de campos.
  }, [fields]);

  /** Altura do campo (% da página) a partir da largura, mantendo a proporção. */
  function heightPctOf(key: string) {
    const a = aspects[key];
    if (!a) return widthOf(key) * 0.28; // fallback até a imagem carregar
    return widthOf(key) * pageAspect / a;
  }

  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipo do documento pdfjs, importado dinamicamente.
  const pdfRef = useRef<any>(null);

  async function renderPage(pageNum: number) {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.6 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageAspect(viewport.width / viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Cancela qualquer render anterior ainda em andamento neste mesmo
      // canvas antes de iniciar um novo (pdfjs não permite dois renders
      // concorrentes no mesmo canvas — acontece quando o arquivo ou a
      // página mudam de novo antes do primeiro render terminar).
      renderTaskRef.current?.cancel();
      const task = page.render({ canvasContext: ctx, viewport, canvas });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      const isCancelled =
        err instanceof Error && err.name === "RenderingCancelledException";
      if (!isCancelled) throw err;
    }
  }

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta o estado ao remover o arquivo selecionado.
      setStatus("idle");
      pdfRef.current = null;
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setCurrentPage(1);

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Servido como arquivo estático em public/ (copiado de
        // node_modules/pdfjs-dist/build/pdf.worker.min.mjs) — o padrão
        // `new URL(..., import.meta.url)` trava indefinidamente com o
        // Turbopack em dev, então evitamos o pipeline de assets do bundler.
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        await renderPage(1);
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          console.error("Falha ao renderizar PDF para posicionamento:", err);
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      pdfRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    if (!pdfRef.current || status !== "ready") return;
    renderPage(currentPage).catch((err) => {
      console.error("Falha ao renderizar página do PDF:", err);
      setStatus("error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderPage depende só de refs estáveis.
  }, [currentPage]);

  function goToPage(delta: number) {
    setCurrentPage((p) => Math.min(numPages, Math.max(1, p + delta)));
  }

  function selectField(key: string) {
    setActiveKey(key);
    const savedPage = positions[key]?.page;
    if (savedPage) setCurrentPage(savedPage);
  }

  /** Ponto do cursor em % (sem clamp), relativo ao container. */
  function pointerPct(e: { clientX: number; clientY: number }) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }

  /** Marcadores são ancorados pelo canto superior esquerdo (igual ao Documenso),
   *  então limitamos o canto para o campo caber na página. */
  function clampTopLeft(key: string, x: number, y: number) {
    const w = fields.find((f) => f.key === key)?.image ? widthOf(key) : 8;
    const h = fields.find((f) => f.key === key)?.image ? heightPctOf(key) : 4;
    return {
      x: clamp(x, 0, Math.max(0, 100 - w)),
      y: clamp(y, 0, Math.max(0, 100 - h)),
    };
  }

  function handleContainerClick(e: ReactPointerEvent<HTMLDivElement>) {
    if (draggingKey.current) return;
    const p = pointerPct(e);
    if (!p || !activeKey) return;
    // Clicar posiciona a assinatura CENTRADA no cursor (mais intuitivo), mas é
    // guardada pelo canto superior esquerdo.
    const isImg = Boolean(fields.find((f) => f.key === activeKey)?.image);
    const w = isImg ? widthOf(activeKey) : 0;
    const h = isImg ? heightPctOf(activeKey) : 0;
    const tl = clampTopLeft(activeKey, p.x - w / 2, p.y - h / 2);
    setPositions((prev) => ({ ...prev, [activeKey]: { ...tl, page: currentPage } }));
  }

  function handleMarkerPointerDown(key: string, e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    setActiveKey(key);
    draggingKey.current = key;
    const p = pointerPct(e);
    const cur = positions[key];
    dragOffset.current = p && cur ? { dx: p.x - cur.x, dy: p.y - cur.y } : { dx: 0, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleResizePointerDown(key: string, e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    setActiveKey(key);
    resizingKey.current = key;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleMarkerPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const p = pointerPct(e);
    if (!p) return;
    // Redimensionamento: largura = distância do cursor ao canto esquerdo (x).
    const rk = resizingKey.current;
    if (rk) {
      const wpct = clamp(p.x - (positions[rk]?.x ?? 0), MIN_WIDTH_PCT, MAX_WIDTH_PCT);
      setWidths((prev) => ({ ...prev, [rk]: wpct }));
      return;
    }
    const key = draggingKey.current;
    if (!key) return;
    const tl = clampTopLeft(key, p.x - dragOffset.current.dx, p.y - dragOffset.current.dy);
    setPositions((prev) => ({ ...prev, [key]: { ...tl, page: currentPage } }));
  }

  function handleMarkerPointerUp() {
    draggingKey.current = null;
    resizingKey.current = null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {fields.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => selectField(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              f.colorClass,
              activeKey === f.key ? "bg-current/10" : "opacity-60 hover:opacity-100",
            )}
          >
            {f.label}
            {positions[f.key]?.page ? ` (pág. ${positions[f.key].page})` : ""}
          </button>
        ))}
      </div>

      {!file && (
        <p className="text-sm text-muted-foreground">
          Selecione um PDF para escolher onde a assinatura entra no documento.
        </p>
      )}
      {status === "loading" && (
        <p className="text-sm text-muted-foreground">Carregando pré-visualização do PDF...</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">
          Não foi possível pré-visualizar este PDF. As posições padrão serão usadas.
        </p>
      )}

      {file && status === "ready" && numPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => goToPage(-1)}
            disabled={currentPage <= 1}
            className="rounded-md p-1 ring-1 ring-foreground/10 disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-muted-foreground">
            Página {currentPage} de {numPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(1)}
            disabled={currentPage >= numPages}
            className="rounded-md p-1 ring-1 ring-foreground/10 disabled:opacity-30"
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            Navegue até a página certa antes de clicar para posicionar o campo selecionado.
          </span>
        </div>
      )}

      {file && (
        <div
          ref={containerRef}
          onPointerDown={handleContainerClick}
          onPointerMove={handleMarkerPointerMove}
          onPointerUp={handleMarkerPointerUp}
          className={cn(
            "relative cursor-crosshair touch-none overflow-hidden rounded-lg ring-1 ring-foreground/10",
            status !== "ready" && "hidden",
          )}
        >
          <canvas ref={canvasRef} className="block h-auto w-full select-none" />
          {/* Assinaturas de quem já assinou — só leitura, para orientar onde há espaço livre. */}
          {overlays
            .filter((o) => o.page === currentPage)
            .map((o, i) => (
              <div
                key={`ov-${i}`}
                style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.width ?? DEFAULT_WIDTH_PCT}%` }}
                className="pointer-events-none absolute z-10 flex flex-col items-start"
              >
                {o.imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL da assinatura.
                  <img
                    src={o.imagem}
                    alt={`Assinatura de ${o.nome}`}
                    className="w-full object-contain opacity-95"
                  />
                ) : (
                  <div className="rounded-md border-2 border-emerald-500/70 bg-emerald-50/90 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Assinado
                  </div>
                )}
                <span className="mt-0.5 rounded bg-emerald-600/90 px-1.5 text-[9px] font-medium whitespace-nowrap text-white">
                  {o.nome}
                </span>
              </div>
            ))}
          {fields.map((f) => {
            const pos = positions[f.key];
            if (!pos || pos.page !== currentPage) return null;
            if (f.image) {
              // Marcador = a própria assinatura, no tamanho do campo (ajustável).
              return (
                <div
                  key={f.key}
                  onPointerDown={(e) => handleMarkerPointerDown(f.key, e)}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${widthOf(f.key)}%` }}
                  className="group absolute cursor-move touch-none rounded-sm bg-primary/5 p-0.5 ring-2 ring-primary/70 select-none"
                >
                  <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-primary px-1.5 text-[9px] font-medium whitespace-nowrap text-primary-foreground">
                    Arraste • alça ↘ redimensiona
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL da assinatura. */}
                  <img
                    src={f.image}
                    alt={f.label}
                    draggable={false}
                    className="pointer-events-none block w-full object-contain"
                  />
                  {/* Alça de redimensionamento (canto inferior direito). */}
                  <div
                    onPointerDown={(e) => handleResizePointerDown(f.key, e)}
                    className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize touch-none rounded-sm border border-white bg-primary shadow"
                    aria-label="Redimensionar assinatura"
                  />
                </div>
              );
            }
            return (
              <div
                key={f.key}
                onPointerDown={(e) => handleMarkerPointerDown(f.key, e)}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={cn(
                  "absolute cursor-move touch-none rounded-md border-2 bg-background/95 px-2 py-1 text-[10px] font-semibold whitespace-nowrap shadow-md select-none",
                  f.colorClass,
                )}
              >
                {f.label}
              </div>
            );
          })}
        </div>
      )}

      {fields.map((f) => (
        <span key={f.key}>
          <input type="hidden" name={`pos_${f.key}_x`} value={positions[f.key]?.x ?? 10} />
          <input type="hidden" name={`pos_${f.key}_y`} value={positions[f.key]?.y ?? 85} />
          <input type="hidden" name={`pos_${f.key}_page`} value={positions[f.key]?.page ?? 1} />
          {f.image && (
            <>
              <input type="hidden" name={`pos_${f.key}_w`} value={widthOf(f.key).toFixed(2)} />
              <input type="hidden" name={`pos_${f.key}_h`} value={heightPctOf(f.key).toFixed(2)} />
            </>
          )}
        </span>
      ))}
    </div>
  );
}
