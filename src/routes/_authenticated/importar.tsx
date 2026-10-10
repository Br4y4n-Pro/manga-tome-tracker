import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, History, RefreshCw, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCap, importLogsQuery, seriesQuery } from "@/lib/data";
import { applyImport, planImport, parseWorkbook, type ImportPlan, type ImportRow } from "@/lib/import-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar — Mi Biblioteca Otaku" },
      { name: "description", content: "Importa tu lista desde Excel." },
      { property: "og:title", content: "Importar — Mi Biblioteca Otaku" },
      { property: "og:description", content: "Importa tu lista desde Excel." },
    ],
  }),
  component: Importar,
});

const EXPECTED = [
  "Título",
  "Categoría",
  "Fuente",
  "Estado",
  "Último cap. leído (nº)",
  "Último cap. leído (nombre)",
  "Caps. leídos",
  "Caps. totales",
  "Sin leer",
  "Último cap. disponible",
  "Último cap. en tracker",
];

function Importar() {
  const qc = useQueryClient();
  const { data: series } = useQuery(seriesQuery);
  const { data: logs, isLoading: logsLoading } = useQuery(importLogsQuery);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      if (!parsed.length) {
        toast.error("El archivo no tiene filas con título.");
        setRows(null);
        setPlan(null);
        return;
      }
      setRows(parsed);
      setPlan(planImport(parsed, series ?? []));
      toast.success(`${parsed.length} filas leídas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo");
      setRows(null);
      setPlan(null);
    }
  }

  async function confirm() {
    if (!plan) return;
    setBusy(true);
    try {
      await applyImport(plan, fileName);
      toast.success(
        `Importado: ${plan.nuevas.length} nuevas, ${plan.actualizadas.length} actualizadas`,
      );
      qc.invalidateQueries({ queryKey: ["series"] });
      qc.invalidateQueries({ queryKey: ["last-import"] });
      qc.invalidateQueries({ queryKey: ["import-logs"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setRows(null);
      setPlan(null);
      setFileName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setRows(null);
    setPlan(null);
    setFileName("");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <header className="mb-4">
        <h1 className="text-3xl font-extrabold">Importar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube tu archivo Excel con la hoja <b>“Mangas”</b>. No se tocan tus notas ni calendarios.
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
        <Upload className="h-8 w-8 text-primary" />
        <span className="text-sm font-semibold">Arrastra tu .xlsx aquí o toca para elegir</span>
        <span className="text-xs text-muted-foreground">Se busca la hoja “Mangas”</span>
        <Input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
          Columnas esperadas ({EXPECTED.length})
        </summary>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {EXPECTED.map((c) => (
            <li key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {c}
            </li>
          ))}
        </ul>
      </details>

      {plan && rows && (
        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="truncate text-sm font-semibold">
                <FileSpreadsheet className="mr-1.5 inline h-4 w-4 text-primary" />
                {fileName}
              </p>
              <button aria-label="Quitar archivo" onClick={cancel} className="text-muted-foreground hover:text-foreground">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Nuevas" value={plan.nuevas.length} tone="text-primary" />
              <Stat label="Actualizadas" value={plan.actualizadas.length} tone="text-amber-500" />
              <Stat label="Sin cambios" value={plan.sinCambios} tone="text-muted-foreground" />
            </div>
            <Button onClick={() => void confirm()} disabled={busy} className="mt-4 w-full bg-gradient-primary">
              {busy ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {busy ? "Importando…" : "Confirmar importación"}
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-card text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Fuente</th>
                  <th className="px-3 py-2">Últ. cap.</th>
                  <th className="px-3 py-2">Sin leer</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map((r, i) => (
                  <PreviewRow key={`${r.titulo}-${i}`} row={r} plan={plan} />
                ))}
              </tbody>
            </table>
            {rows.length > 12 && (
              <p className="bg-card px-3 py-2 text-[11px] text-muted-foreground">
                +{rows.length - 12} filas más…
              </p>
            )}
          </div>
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
                <div>
                  <p className="truncate text-sm font-semibold">{l.archivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
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

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-background px-2 py-3">
      <p className={cn("text-2xl font-extrabold", tone)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function PreviewRow({ row, plan }: { row: ImportRow; plan: ImportPlan }) {
  const isNew = plan.nuevas.some((r) => r.titulo === row.titulo && r.fuente === row.fuente);
  const isUpd = plan.actualizadas.some((x) => x.row.titulo === row.titulo && x.row.fuente === row.fuente);
  return (
    <tr className="border-t border-border">
      <td className="max-w-40 truncate px-3 py-2 font-medium">{row.titulo}</td>
      <td className="px-3 py-2 text-muted-foreground">{row.fuente || "—"}</td>
      <td className="px-3 py-2">{formatCap(row.ultimo_cap_leido)}</td>
      <td className="px-3 py-2">{formatCap(row.sin_leer)}</td>
      <td className="px-3 py-2">
        {isNew ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">Nueva</span>
        ) : isUpd ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">Actualiza</span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">Igual</span>
        )}
      </td>
    </tr>
  );
}
