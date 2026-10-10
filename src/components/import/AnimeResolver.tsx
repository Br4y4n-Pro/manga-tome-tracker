import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  aniListErrorMessage,
  findCandidates,
  preferredTitle,
  rankCandidates,
  rowWithMedia,
  searchMedia,
  type AniListMedia,
  type Candidate,
} from "@/lib/anilist";
import type { ImportRow } from "@/lib/normalizer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Item {
  row: ImportRow;
  candidates: Candidate[];
  /** Index of the chosen candidate; null keeps the name as written. */
  choice: number | null;
}

const KEEP = "keep";

const QUALITY_STYLE: Record<string, string> = {
  exacta: "bg-primary/15 text-primary",
  parecida: "bg-amber-500/15 text-amber-500",
  dudosa: "bg-destructive/15 text-destructive",
};

const describe = (m: AniListMedia) =>
  [preferredTitle(m), m.format?.replace("_", " "), m.startDate?.year].filter(Boolean).join(" · ");

/**
 * Matches hand-written anime names with AniList. Exact matches are linked automatically;
 * the rest are shown for review with the best candidates preselected.
 */
export function AnimeResolver({
  rows,
  onDone,
}: {
  rows: ImportRow[];
  onDone: (rows: ImportRow[]) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [showExact, setShowExact] = useState(false);

  async function resolve() {
    setRunning(true);
    setDone(0);
    try {
      const found = await Promise.all(
        rows.map((row) =>
          findCandidates(row.titulo, "anime").then((candidates) => {
            setDone((d) => d + 1);
            const top = candidates[0]?.quality;
            return { row, candidates, choice: top === "exacta" || top === "parecida" ? 0 : null };
          }),
        ),
      );
      setItems(found);
    } catch (e) {
      toast.error(aniListErrorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  const counts = useMemo(() => {
    const c = { exacta: 0, revisar: 0, sinResultados: 0 };
    for (const it of items ?? []) {
      const q = it.candidates[0]?.quality;
      if (!q) c.sinResultados++;
      else if (q === "exacta") c.exacta++;
      else c.revisar++;
    }
    return c;
  }, [items]);

  function update(i: number, patch: Partial<Item>) {
    setItems((prev) => prev && prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  if (!items) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm">
          Voy a buscar cada nombre en <b>AniList</b> para traer el título oficial, la portada, los
          episodios y la sinopsis. Los que coincidan exacto se enlazan solos; los demás te los
          muestro para que elijas.
        </p>
        {running ? (
          <div className="mt-4 space-y-2">
            <Progress value={(done / rows.length) * 100} />
            <p className="text-xs text-muted-foreground">
              {done} de {rows.length} · AniList permite pocas consultas por minuto, esto tarda 1–2
              minutos.
            </p>
          </div>
        ) : (
          <Button onClick={() => void resolve()} className="mt-4 w-full bg-gradient-primary">
            <Sparkles className="h-4 w-4" /> Buscar {rows.length} animes en AniList
          </Button>
        )}
      </div>
    );
  }

  const visible = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => showExact || it.candidates[0]?.quality !== "exacta");

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <p className="rounded-lg bg-background py-2">
          <b className="block text-lg text-primary">{counts.exacta}</b>enlazados solos
        </p>
        <p className="rounded-lg bg-background py-2">
          <b className="block text-lg text-amber-500">{counts.revisar}</b>para revisar
        </p>
        <p className="rounded-lg bg-background py-2">
          <b className="block text-lg text-muted-foreground">{counts.sinResultados}</b>sin
          resultados
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={showExact} onCheckedChange={(v) => setShowExact(v === true)} />
        Mostrar también los enlazados automáticamente
      </label>

      <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {visible.map(({ it, i }) => (
          <ReviewRow key={i} item={it} onChange={(patch) => update(i, patch)} />
        ))}
      </ul>

      <Button
        onClick={() =>
          onDone(
            items.map((it) =>
              it.choice == null ? it.row : rowWithMedia(it.row, it.candidates[it.choice]!.media),
            ),
          )
        }
        className="w-full bg-gradient-primary"
      >
        <CheckCircle2 className="h-4 w-4" /> Usar estas coincidencias
      </Button>
    </div>
  );
}

function ReviewRow({ item, onChange }: { item: Item; onChange: (patch: Partial<Item>) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = item.choice == null ? null : item.candidates[item.choice];
  const quality = item.candidates[0]?.quality;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const found = rankCandidates(await searchMedia(q.trim(), "ANIME"), item.row.titulo);
      onChange({ candidates: found, choice: found.length ? 0 : null });
      if (!found.length) toast.info("AniList no encontró nada con ese nombre");
    } catch (err) {
      toast.error(aniListErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex gap-3 rounded-lg border border-border bg-background p-2">
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
        {chosen?.media.coverImage?.large && (
          <img
            src={chosen.media.coverImage.large}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{item.row.titulo}</p>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              quality ? QUALITY_STYLE[quality] : "bg-secondary text-muted-foreground",
            )}
          >
            {quality ?? "sin resultados"}
          </span>
        </div>
        {item.candidates.length > 0 && (
          <select
            value={item.choice == null ? KEEP : String(item.choice)}
            onChange={(e) =>
              onChange({ choice: e.target.value === KEEP ? null : Number(e.target.value) })
            }
            className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs"
            aria-label={`Coincidencia para ${item.row.titulo}`}
          >
            {item.candidates.map((c, j) => (
              <option key={c.media.id} value={j}>
                {describe(c.media)}
              </option>
            ))}
            <option value={KEEP}>Ninguno: dejar “{item.row.titulo}” sin enlazar</option>
          </select>
        )}
        <form onSubmit={search} className="flex gap-1.5">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar con otro nombre…"
            className="h-8 bg-card text-xs"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={busy}
            aria-label="Buscar en AniList"
          >
            {busy ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      </div>
    </li>
  );
}
