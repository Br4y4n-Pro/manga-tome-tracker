import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ExternalLink, ImagePlus, Info, Link2, Plus, Save, Sparkles, Star, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  chapterNotesQuery,
  formatCap,
  scheduleQuery,
  unidad,
  seriesQuery,
  type ChapterNote,
  type Schedule,
  type Series,
} from "@/lib/data";
import {
  DIAS,
  describeRule,
  possibleNewChapter,
  toISODate,
  upcomingReleases,
  type ScheduleRule,
} from "@/lib/schedule";
import {
  aniListErrorMessage,
  infoPatch,
  mediaTypeOf,
  preferredTitle,
  searchMedia,
  type AniListMedia,
} from "@/lib/anilist";
import {
  plusOnePatch,
  useDeleteChapterNote,
  useSaveChapterNote,
  useSaveSchedule,
  useUpdateSeries,
} from "@/lib/mutations";
import { Cover } from "@/components/Cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/serie/$id")({
  head: () => ({
    meta: [
      { title: "Serie — Mi Biblioteca Otaku" },
      { name: "description", content: "Detalle de la serie" },
      { property: "og:title", content: "Serie — Mi Biblioteca Otaku" },
      { property: "og:description", content: "Detalle de la serie" },
    ],
  }),
  component: Detail,
});

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function Detail() {
  const { id } = Route.useParams();
  const { data: series, isLoading } = useQuery(seriesQuery);
  const s = series?.find((x) => x.id === id);
  const { data: schedule } = useQuery(scheduleQuery(id));
  const { data: notes } = useQuery(chapterNotesQuery(id));
  const [linking, setLinking] = useState(false);
  const update = useUpdateSeries();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-6">
        <Skeleton className="h-4 w-24" />
        <div className="mt-4 flex gap-4">
          <Skeleton className="aspect-[2/3] w-32 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </main>
    );
  }
  if (!s) return <main className="p-6 text-muted-foreground">Serie no encontrada.</main>;

  const isNew = possibleNewChapter(schedule, s.last_read_at);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <Link to="/biblioteca" className="text-sm text-muted-foreground">
        ← Biblioteca
      </Link>

      <div className="mt-4 flex gap-4">
        <div className="relative shrink-0">
          <Cover series={s} className="aspect-[2/3] w-32 rounded-xl" />
          <button
            aria-label="Vincular con AniList y cambiar carátula"
            onClick={() => setLinking(true)}
            className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-primary shadow"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{s.titulo}</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {[s.tipo, s.estado, s.autor].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {s.tipo === "anime" ? "Vistos" : "Leídos"} {formatCap(s.caps_leidos)} / {formatCap(s.caps_totales)} ·{" "}
            {s.tipo === "anime" ? "Pendientes" : "Sin leer"} {formatCap(s.sin_leer)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <CapInput s={s} />
            <Button size="sm" onClick={() => update.mutate({ id: s.id, patch: plusOnePatch(s) })}>
              <Plus className="h-4 w-4" /> +1
            </Button>
            {isNew && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                <Sparkles className="h-3 w-3" /> Nuevo
              </span>
            )}
          </div>
        </div>
      </div>

      <InfoSection s={s} onLink={() => setLinking(true)} />
      <GeneralNote s={s} />
      <ScheduleEditor schedule={schedule} seriesId={s.id} />
      <ChapterNotes notes={notes} seriesId={s.id} />
      <LinkAniListDialog open={linking} onOpenChange={setLinking} series={s} />
    </main>
  );
}

function CapInput({ s }: { s: Series }) {
  const update = useUpdateSeries();
  const [v, setV] = useState(String(s.ultimo_cap_leido));
  useEffect(() => setV(String(s.ultimo_cap_leido)), [s.id, s.ultimo_cap_leido]);
  return (
    <Input
      type="number"
      step="any"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Number(v);
        if (Number.isFinite(n) && n !== Number(s.ultimo_cap_leido)) {
          update.mutate({ id: s.id, patch: { ultimo_cap_leido: n, last_read_at: new Date().toISOString() } });
        }
      }}
      className="h-9 w-24 rounded-lg bg-card"
      aria-label="Capítulo actual"
    />
  );
}

function GeneralNote({ s }: { s: Series }) {
  const update = useUpdateSeries();
  const [text, setText] = useState(s.nota_general ?? "");
  const saved = useRef(s.nota_general ?? "");
  const debounced = useDebounced(text, 700);

  useEffect(() => {
    setText(s.nota_general ?? "");
    saved.current = s.nota_general ?? "";
  }, [s.id, s.nota_general]);

  useEffect(() => {
    if (debounced === saved.current) return;
    saved.current = debounced;
    update.mutate({ id: s.id, patch: { nota_general: debounced } }, { onSuccess: () => toast.success("Nota guardada") });
    // Only react to the debounced text: re-running on id changes would save the previous text into the new row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <section className="mt-8">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
        <StickyNote className="h-4 w-4 text-primary" /> Nota general
      </h2>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Resumen, impresiones, dónde lo dejaste… (se guarda solo)"
        className="min-h-24 rounded-xl bg-card"
      />
    </section>
  );
}

function ScheduleEditor({ schedule, seriesId }: { schedule: Schedule | null | undefined; seriesId: string }) {
  const save = useSaveSchedule(seriesId);
  const [tipo_regla, setTipoRegla] = useState<ScheduleRule["tipo_regla"]>(schedule?.tipo_regla ?? "dia_fijo");
  const [cada_n_dias, setCadaNDias] = useState(String(schedule?.cada_n_dias ?? 7));
  const [dias, setDias] = useState<number[]>(schedule?.dias_semana ?? [2]);
  const [fecha_inicio, setFechaInicio] = useState(schedule?.fecha_inicio ?? toISODate(new Date()));
  const [activo, setActivo] = useState(schedule?.activo ?? true);

  const rule: ScheduleRule = useMemo(
    () => ({
      tipo_regla,
      cada_n_dias: tipo_regla === "cada_n" ? Math.max(1, Number(cada_n_dias) || 1) : null,
      dias_semana: dias,
      fecha_inicio,
      activo,
    }),
    [tipo_regla, cada_n_dias, dias, fecha_inicio, activo],
  );

  const next = useMemo(() => {
    if (!activo) return [];
    return upcomingReleases(rule, new Date(), 21).slice(0, 6);
  }, [rule, activo]);

  function toggleDia(d: number) {
    setDias((old) => (old.includes(d) ? old.filter((x) => x !== d) : [...old, d].sort()));
  }

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <CalendarDays className="h-4 w-4 text-primary" /> Calendario de salidas
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={activo} onCheckedChange={setActivo} />
          {activo ? "Activo" : "Pausado"}
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Regla</Label>
            <Select value={tipo_regla} onValueChange={(v) => setTipoRegla(v as ScheduleRule["tipo_regla"])}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia_fijo">Día fijo de la semana</SelectItem>
                <SelectItem value="varios_dias">Varios días</SelectItem>
                <SelectItem value="cada_n">Cada N días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Inicio</Label>
            <Input type="date" value={fecha_inicio} onChange={(e) => setFechaInicio(e.target.value)} className="bg-background" />
          </div>
        </div>
        {tipo_regla === "cada_n" ? (
          <div className="space-y-2">
            <Label>Cada (días)</Label>
            <Input type="number" min={1} value={cada_n_dias} onChange={(e) => setCadaNDias(e.target.value)} className="bg-background" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Días de salida</Label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDia(i)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    dias.includes(i)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            {schedule ? describeRule(schedule) : "Sin guardar aún"}
          </p>
          <Button size="sm" onClick={() => save.mutate(rule)} disabled={save.isPending} className="bg-gradient-primary">
            <Save className="h-3.5 w-3.5" /> Guardar
          </Button>
        </div>
        {activo && next.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Próximas salidas</p>
            <div className="flex flex-wrap gap-1.5">
              {next.map((d) => (
                <span key={toISODate(d)} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground">
                  {d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ChapterNotes({ notes, seriesId }: { notes: ChapterNote[] | undefined; seriesId: string }) {
  const save = useSaveChapterNote(seriesId);
  const remove = useDeleteChapterNote(seriesId);
  const [cap, setCap] = useState("");
  const [text, setText] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const c = Number(cap);
    if (!Number.isFinite(c) || !text.trim()) return;
    save.mutate({ capitulo: c, nota: text.trim() });
    setCap("");
    setText("");
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
        <StickyNote className="h-4 w-4 text-primary" /> Notas por capítulo
        <span className="text-sm font-normal text-muted-foreground">({notes?.length ?? 0})</span>
      </h2>
      <form onSubmit={add} className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex gap-2">
          <Input
            type="number"
            step="any"
            placeholder="Cap."
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="w-20 bg-background"
          />
          <Input
            placeholder="Nota del capítulo…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-background"
          />
          <Button type="submit" size="sm" disabled={save.isPending || !cap || !text.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>
      <ul className="mt-3 space-y-2">
        {(notes ?? []).map((n) => (
          <NoteRow key={n.id} note={n} onDelete={() => remove.mutate(n.id)} />
        ))}
      </ul>
    </section>
  );
}

function NoteRow({ note, onDelete }: { note: ChapterNote; onDelete: () => void }) {
  const save = useSaveChapterNote(note.series_id);
  const [text, setText] = useState(note.nota);
  const saved = useRef(note.nota);
  const debounced = useDebounced(text, 700);

  useEffect(() => {
    setText(note.nota);
    saved.current = note.nota;
  }, [note.id, note.nota]);

  useEffect(() => {
    if (debounced === saved.current || !debounced.trim()) return;
    saved.current = debounced;
    save.mutate({ id: note.id, capitulo: note.capitulo, nota: debounced });
    // Only react to the debounced text: re-running on id changes would save the previous text into the new row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <li className="group flex items-start gap-2 rounded-xl border border-border bg-card p-3">
      <span className="mt-0.5 shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-primary">
        Cap. {formatCap(note.capitulo)}
      </span>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-10 flex-1 resize-none rounded-lg bg-background text-sm"
      />
      <button
        aria-label="Borrar nota"
        onClick={onDelete}
        className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

const fechaCorta = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function InfoSection({ s, onLink }: { s: Series; onLink: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const facts = [
    s.artista && s.artista !== s.autor ? ["Arte", s.artista] : null,
    s.estado_api ? ["Publicación (AniList)", s.estado_api] : null,
    s.total_api ? [s.tipo === "anime" ? "Episodios" : "Capítulos", String(s.total_api)] : null,
    s.fuentes.length ? ["Fuentes", s.fuentes.join(", ")] : null,
    s.fecha_agregado ? ["En tu biblioteca desde", new Date(s.fecha_agregado).toLocaleDateString("es")] : null,
  ].filter((f): f is [string, string] => !!f);

  return (
    <section className="mt-8 space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Info className="h-4 w-4 text-primary" /> Información
      </h2>
      {s.categorias.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.categorias.map((c) => (
            <span key={c} className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px] text-primary">
              {c}
            </span>
          ))}
        </div>
      )}
      {s.generos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.generos.map((g) => (
            <span key={g} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {g}
            </span>
          ))}
        </div>
      )}
      {s.sinopsis && (
        <div>
          <p className={cn("whitespace-pre-line text-sm text-muted-foreground", !expanded && "line-clamp-4")}>
            {s.sinopsis}
          </p>
          <button onClick={() => setExpanded(!expanded)} className="mt-1 text-xs font-semibold text-primary">
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        </div>
      )}
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-card px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {s.proximo_ep && s.proximo_ep_at && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
          Episodio {s.proximo_ep}: {fechaCorta.format(new Date(s.proximo_ep_at))}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {s.puntuacion != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-500">
            <Star className="h-3 w-3" /> {s.puntuacion}%
          </span>
        )}
        {s.anilist_url && (
          <a
            href={s.anilist_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
          >
            AniList <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <Button size="sm" variant="secondary" onClick={onLink}>
          <Link2 className="h-3.5 w-3.5" /> {s.anilist_id ? "Corregir obra en AniList" : "Vincular con AniList"}
        </Button>
      </div>
    </section>
  );
}

function LinkAniListDialog({
  open,
  onOpenChange,
  series,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  series: Series;
}) {
  const update = useUpdateSeries();
  const [q, setQ] = useState(series.titulo);
  const dq = useDebounced(q, 600);
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !dq.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    searchMedia(dq.trim(), mediaTypeOf(series.tipo))
      .then((r) => !cancelled && setResults(r))
      .catch((e) => {
        if (cancelled) return;
        setResults([]);
        setError(aniListErrorMessage(e));
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [open, dq, series.tipo]);

  function pick(m: AniListMedia) {
    update.mutate(
      { id: series.id, patch: infoPatch(m, series, { replaceCover: true }) },
      { onSuccess: () => toast.success(`Vinculado con “${preferredTitle(m)}”`) },
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Elegir la obra en AniList</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Se traen la portada, el total de {series.tipo === "anime" ? "episodios" : "capítulos"}, el estado y la
          puntuación. Tu título, progreso y sinopsis en español se mantienen.
        </p>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en AniList…" className="bg-background" />
        {busy ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados. Prueba con el título original (japonés o coreano) o en inglés.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 overflow-y-auto">
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => pick(m)}
                className={cn(
                  "group relative overflow-hidden rounded-lg text-left",
                  m.id === series.anilist_id && "ring-2 ring-primary",
                )}
              >
                {m.coverImage?.large ? (
                  <img src={m.coverImage.large} alt={preferredTitle(m)} className="aspect-[2/3] w-full object-cover" />
                ) : (
                  <div className="aspect-[2/3] w-full bg-muted" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/75 p-1 text-[9px] leading-tight text-white">
                  {preferredTitle(m)}
                  <span className="block opacity-70">
                    {[m.format?.replace("_", " "), m.startDate?.year, m.countryOfOrigin].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
