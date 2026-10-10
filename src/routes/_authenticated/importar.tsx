import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Merge,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { importLogsQuery, seriesQuery } from "@/lib/data";
import {
  applyImport,
  planImport,
  readImportFile,
  type ImportPlan,
  type ImportResult,
  type ParsedFile,
} from "@/lib/import-service";
import {
  analyzeBackup,
  EXCEL_COLUMNS,
  remergeRows,
  type Analysis,
  type ImportRow,
} from "@/lib/normalizer";
import { AnimeResolver } from "@/components/import/AnimeResolver";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar — Mi Biblioteca Otaku" },
      { name: "description", content: "Importa tu respaldo de Komikku o tus listas en Excel." },
      { property: "og:title", content: "Importar — Mi Biblioteca Otaku" },
      {
        property: "og:description",
        content: "Importa tu respaldo de Komikku o tus listas en Excel.",
      },
    ],
  }),
  component: Importar,
});

const SOURCE_LABEL: Record<ParsedFile["source"], string> = {
  komikku: "Respaldo de Komikku / Mihon",
  "excel-mangas": "Excel de mangas",
  "excel-anime": "Lista de animes",
};

function Importar() {
  const qc = useQueryClient();
  const { data: series } = useQuery(seriesQuery);
  const { data: logs, isLoading: logsLoading } = useQuery(importLogsQuery);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [incluirFuera, setIncluirFuera] = useState(false);
  /** Anime rows after the AniList review (anime lists only). */
  const [resolved, setResolved] = useState<Analysis | null>(null);
  const [borrarHuerfanas, setBorrarHuerfanas] = useState(false);
  const [busy, setBusy] = useState(false);

  const analysis = useMemo(() => {
    if (!parsed) return null;
    if (resolved) return resolved;
    return parsed.backup ? analyzeBackup(parsed.backup, incluirFuera) : parsed.analysis;
  }, [parsed, resolved, incluirFuera]);

  const needsReview = parsed?.source === "excel-anime" && !resolved;
  const fullLibrary = parsed?.source === "komikku" && !incluirFuera;
  const plan = useMemo(
    () =>
      analysis && series && !needsReview
        ? planImport(analysis.rows, series, { fullLibrary })
        : null,
    [analysis, series, needsReview, fullLibrary],
  );
  const dupPlan = useMemo(
    () => (!parsed && series ? planImport([], series, { fullLibrary: false }) : null),
    [parsed, series],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    reset();
    setFileName(file.name);
    setReading(true);
    try {
      const p = await readImportFile(file);
      if (!p.analysis.rows.length) throw new Error("El archivo no tiene series para importar.");
      setParsed(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo");
      setFileName("");
    } finally {
      setReading(false);
    }
  }

  function reset() {
    setParsed(null);
    setResolved(null);
    setFileName("");
    setIncluirFuera(false);
    setBorrarHuerfanas(false);
  }

  async function run(p: ImportPlan, archivo: string, opts: { borrarHuerfanas: boolean }) {
    setBusy(true);
    try {
      const r = await applyImport(p, archivo, opts);
      toast.success(summary(r));
      for (const key of [
        "series",
        "last-import",
        "import-logs",
        "schedules",
        "schedule",
        "chapter-notes",
      ]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setBusy(false);
    }
  }

  function onResolved(rows: ImportRow[]) {
    if (!parsed) return;
    setResolved(remergeRows(rows, parsed.analysis));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <header className="mb-4">
        <h1 className="text-3xl font-extrabold">Importar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube tu respaldo de <b>Komikku</b> (<code>.tachibk</code>), el Excel de mangas o una lista
          de animes. Antes de guardar verás qué se va a cambiar. Tus notas y calendarios nunca se
          borran.
        </p>
      </header>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files?.[0]);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/50 px-6 py-10 text-center transition-colors hover:border-primary/50"
      >
        {reading ? (
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-primary" />
        )}
        <span className="text-sm font-semibold">
          {reading ? "Analizando…" : "Arrastra tu archivo aquí o toca para elegir"}
        </span>
        <span className="text-xs text-muted-foreground">
          .tachibk · .xlsx con hoja “Mangas” · .xlsx con columna “Anime”
        </span>
        <Input
          type="file"
          accept=".tachibk,.gz,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
          ¿Qué archivo uso?
        </summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <p>
            <b>Recomendado:</b> en Komikku ve a Más → Ajustes → Datos y almacenamiento → Crear
            respaldo, y sube el <code>.tachibk</code>. Es el más completo: trae sinopsis, géneros,
            autor y solo los mangas que siguen en tu biblioteca.
          </p>
          <p>Excel de mangas, columnas esperadas:</p>
          <ul className="flex flex-wrap gap-1.5">
            {EXCEL_COLUMNS.map((c) => (
              <li key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                {c}
              </li>
            ))}
          </ul>
          <p>Lista de animes: una hoja con una columna llamada “Anime” (o “Título”).</p>
        </div>
      </details>

      {parsed && analysis && (
        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  <FileSpreadsheet className="mr-1.5 inline h-4 w-4 text-primary" />
                  {fileName}
                </p>
                <p className="text-xs text-muted-foreground">{SOURCE_LABEL[parsed.source]}</p>
              </div>
              <button
                aria-label="Quitar archivo"
                onClick={reset}
                className="text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <AnalysisReport analysis={analysis} />
            {parsed.source === "komikku" && (
              <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={incluirFuera}
                  onCheckedChange={(v) => setIncluirFuera(v === true)}
                  className="mt-0.5"
                />
                Incluir también las{" "}
                {analysis.excluidas || parsed.backup!.filter((e) => !e.favorito).length} entradas
                que no están en tu biblioteca (mangas migrados, quitados o solo abiertos).
              </label>
            )}
            {parsed.source === "excel-mangas" && (
              <p className="mt-3 flex gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Este Excel no indica qué mangas siguen en tu biblioteca, así que incluye entradas
                viejas. Con el respaldo .tachibk el resultado es exacto.
              </p>
            )}
          </div>

          {needsReview && <AnimeResolver rows={analysis.rows} onDone={onResolved} />}

          {plan && (
            <PlanCard
              plan={plan}
              busy={busy}
              fullLibrary={fullLibrary}
              borrarHuerfanas={borrarHuerfanas}
              onBorrarHuerfanas={setBorrarHuerfanas}
              onConfirm={() => void run(plan, fileName, { borrarHuerfanas })}
            />
          )}
        </section>
      )}

      {!parsed && dupPlan && dupPlan.fusiones.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <Merge className="h-4 w-4 text-amber-500" /> Tienes series repetidas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dupPlan.fusiones.length} series aparecen más de una vez (mismo título con otra fuente,
            mayúsculas o tildes). Se dejará una sola con el mayor progreso; sus notas y calendarios
            pasan a la que queda.
          </p>
          <FusionList fusiones={dupPlan.fusiones} />
          <Button
            onClick={() => void run(dupPlan, "Limpieza de duplicados", { borrarHuerfanas: false })}
            disabled={busy}
            className="mt-3 w-full"
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
            Fusionar {dupPlan.fusiones.reduce((n, f) => n + f.remove.length, 0)} duplicados
          </Button>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <History className="h-4 w-4 text-primary" /> Historial
        </h2>
        {logsLoading ? (
          <Skeleton className="h-12 w-full rounded-xl" />
        ) : !logs?.length ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Aún no has importado nada.
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{l.archivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("es", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{l.total}</span> totales ·{" "}
                  <span className="font-semibold text-primary">{l.nuevas}</span> nuevas ·{" "}
                  {l.actualizadas} act.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function summary(r: ImportResult) {
  const parts = [`${r.nuevas} nuevas`, `${r.actualizadas} actualizadas`];
  if (r.fusionadas) parts.push(`${r.fusionadas} duplicados fusionados`);
  if (r.eliminadas) parts.push(`${r.eliminadas} eliminadas`);
  if (r.protegidas) parts.push(`${r.protegidas} conservadas por tener notas o calendario`);
  return `Listo: ${parts.join(", ")}`;
}

function AnalysisReport({ analysis: a }: { analysis: Analysis }) {
  const facts = [
    { label: "Filas leídas", value: a.leidas },
    { label: "Fuera de tu biblioteca (omitidas)", value: a.excluidas },
    {
      label: "Repetidas fusionadas",
      value: a.fusiones.reduce((n, f) => n + f.variantes.length - 1, 0),
    },
    { label: "Títulos con espacios corregidos", value: a.titulosLimpiados },
    { label: "Series con géneros unificados", value: a.generosUnificados },
  ].filter((f) => f.value > 0);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Resultado: <b className="text-primary">{a.rows.length} series</b> únicas.
      </p>
      <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {facts.map((f) => (
          <li key={f.label} className="rounded-lg bg-background px-3 py-2">
            <b className="block text-base">{f.value}</b>
            <span className="text-muted-foreground">{f.label}</span>
          </li>
        ))}
      </ul>
      <Chips title="Por tipo" counts={a.porTipo} />
      <Chips title="Por estado" counts={a.porEstado} />
      {a.fusiones.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Ver las {a.fusiones.length} series que venían repetidas
          </summary>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
            {a.fusiones.map((f) => (
              <li key={f.titulo} className="rounded bg-background px-2 py-1">
                <b>{f.titulo}</b>
                <span className="text-muted-foreground">
                  {" "}
                  ←{" "}
                  {f.variantes
                    .map((v) => `${v.fuente || "sin fuente"} (cap. ${v.ultimo})`)
                    .join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Chips({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-muted-foreground">{title}:</span>
      {entries.map(([k, v]) => (
        <span key={k} className="rounded-full bg-secondary px-2 py-0.5 capitalize">
          {k} <b>{v}</b>
        </span>
      ))}
    </div>
  );
}

function FusionList({ fusiones }: { fusiones: ImportPlan["fusiones"] }) {
  return (
    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
      {fusiones.map((f) => (
        <li key={f.keep.id} className="rounded bg-background px-2 py-1">
          <b>{f.keep.titulo}</b>
          <span className="text-muted-foreground"> · se quitan {f.remove.length} copia(s)</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCard(props: {
  plan: ImportPlan;
  busy: boolean;
  fullLibrary: boolean;
  borrarHuerfanas: boolean;
  onBorrarHuerfanas: (v: boolean) => void;
  onConfirm: () => void;
}) {
  const { plan, busy } = props;
  const duplicados = plan.fusiones.reduce((n, f) => n + f.remove.length, 0);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-bold">Cambios en tu biblioteca</h2>
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Stat label="Nuevas" value={plan.nuevas.length} tone="text-primary" />
        <Stat label="Actualizadas" value={plan.actualizadas.length} tone="text-amber-500" />
        <Stat label="Sin cambios" value={plan.sinCambios} tone="text-muted-foreground" />
        <Stat label="Duplicados a fusionar" value={duplicados} tone="text-amber-500" />
      </div>
      {plan.fusiones.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Ver duplicados que ya tenías guardados
          </summary>
          <FusionList fusiones={plan.fusiones} />
        </details>
      )}
      {props.fullLibrary && plan.huerfanas.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-3">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={props.borrarHuerfanas}
              onCheckedChange={(v) => props.onBorrarHuerfanas(v === true)}
              className="mt-0.5"
            />
            <span>
              Eliminar <b>{plan.huerfanas.length}</b> series que ya no están en tu biblioteca de
              Komikku.
              <span className="block text-xs text-muted-foreground">
                Las que tengan notas o calendario se conservan. Los animes nunca se tocan.
              </span>
            </span>
          </label>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">Ver cuáles</summary>
            <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-muted-foreground">
              {plan.huerfanas.map((s) => (
                <li key={s.id}>{s.titulo}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
      <Button
        onClick={props.onConfirm}
        disabled={
          busy ||
          (!plan.nuevas.length &&
            !plan.actualizadas.length &&
            !duplicados &&
            !props.borrarHuerfanas)
        }
        className="w-full bg-gradient-primary"
      >
        {busy ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {busy ? "Importando…" : "Confirmar importación"}
      </Button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-background px-2 py-3">
      <p className={cn("text-2xl font-extrabold", tone)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
