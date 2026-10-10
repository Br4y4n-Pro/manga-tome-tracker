import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { seriesQuery, schedulesQuery, TIPOS, formatCap, unidad, type Series } from "@/lib/data";
import { normalizeTitle, workKey } from "@/lib/titles";
import { possibleNewChapter } from "@/lib/schedule";
import { useUpdateSeries, plusOnePatch } from "@/lib/mutations";
import { Cover } from "@/components/Cover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Mi Biblioteca Otaku" },
      { name: "description", content: "Todas tus series de manga, manhwa, manhua y anime." },
      { property: "og:title", content: "Biblioteca — Mi Biblioteca Otaku" },
      { property: "og:description", content: "Todas tus series y tu progreso." },
    ],
  }),
  component: Library,
});

const PAGE = 36;

function useDebounced<T>(v: T, ms = 200) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function Library() {
  const { data: series, isLoading } = useQuery(seriesQuery);
  const { data: schedules } = useQuery(schedulesQuery);
  const [q, setQ] = useState("");
  const dq = normalizeTitle(useDebounced(q));
  const [tipo, setTipo] = useState("all");
  const [cat, setCat] = useState("all");
  const [estado, setEstado] = useState("all");
  const [unread, setUnread] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const schedMap = useMemo(() => new Map((schedules ?? []).map((s) => [s.series_id, s])), [schedules]);
  const categorias = useMemo(() => [...new Set((series ?? []).flatMap((s) => s.categorias))].sort(), [series]);
  const estados = useMemo(() => [...new Set((series ?? []).map((s) => s.estado).filter(Boolean) as string[])].sort(), [series]);

  const filtered = useMemo(() => {
    return (series ?? []).filter(
      (s) =>
        (!dq || normalizeTitle(`${s.titulo} ${s.autor ?? ""}`).includes(dq)) &&
        (tipo === "all" || s.tipo === tipo) &&
        (cat === "all" || s.categorias.includes(cat)) &&
        (estado === "all" || s.estado === estado) &&
        (!unread || (s.sin_leer ?? 0) > 0),
    );
  }, [series, dq, tipo, cat, estado, unread]);

  useEffect(() => setLimit(PAGE), [dq, tipo, cat, estado, unread]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5">
      <header className="mb-4 flex items-end justify-between">
        <h1 className="text-3xl font-extrabold">Biblioteca</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} series</span>
      </header>
      <div className="sticky top-0 z-30 -mx-4 space-y-2 bg-background/90 px-4 pb-3 pt-1 backdrop-blur-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o autor…" className="h-11 rounded-xl bg-card pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <Chip active={tipo === "all"} onClick={() => setTipo("all")}>Todo</Chip>
          {TIPOS.map((t) => (
            <Chip key={t} active={tipo === t} onClick={() => setTipo(t)}>{t}</Chip>
          ))}
          <Chip active={unread} onClick={() => setUnread(!unread)}>Sin leer</Chip>
          <FilterSelect value={cat} onChange={setCat} placeholder="Categoría" options={categorias} />
          <FilterSelect value={estado} onChange={setEstado} placeholder="Estado" options={estados} />
        </div>
      </div>

      {isLoading ? (
        <Grid>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="mt-2 h-3 w-3/4" />
            </div>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          {series?.length ? "Nada coincide con tu búsqueda." : "Tu biblioteca está vacía. Agrega una serie o importa tu Excel."}
        </div>
      ) : (
        <Grid>
          {filtered.slice(0, limit).map((s) => (
            <SeriesCard key={s.id} s={s} isNew={possibleNewChapter(schedMap.get(s.id), s.last_read_at)} />
          ))}
        </Grid>
      )}
      <div ref={sentinel} className="h-4" />

      <Button
        onClick={() => setAdding(true)}
        className="fixed bottom-24 right-5 z-40 h-14 rounded-full bg-gradient-primary px-5 shadow-glow"
      >
        <Plus className="h-5 w-5" /> Agregar serie
      </Button>
      <AddSeriesDialog open={adding} onOpenChange={setAdding} />
    </main>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all",
        active ? "border-primary bg-primary text-primary-foreground shadow-glow" : "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  if (!options.length) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-auto shrink-0 rounded-full bg-card text-xs", value !== "all" && "border-primary text-primary")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}: todas</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SeriesCard({ s, isNew }: { s: Series; isNew: boolean }) {
  const update = useUpdateSeries();
  return (
    <div className="group animate-fade-up">
      <Link to="/serie/$id" params={{ id: s.id }} className="relative block">
        <Cover series={s} className="aspect-[2/3] w-full rounded-xl" />
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-cover" />
        {isNew && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground shadow-glow">
            <Sparkles className="h-2.5 w-2.5" /> Nuevo
          </span>
        )}
        <div className="absolute inset-x-1.5 bottom-1.5 flex items-end justify-between gap-1">
          <span className="text-[11px] font-semibold text-foreground">
            {unidad(s.tipo)} {formatCap(s.ultimo_cap_leido)}
          </span>
          {s.categorias[0] && <span className="truncate text-[9px] text-muted-foreground">{s.categorias[0]}</span>}
        </div>
      </Link>
      <div className="mt-1.5 flex items-start gap-1">
        <p className="line-clamp-2 flex-1 text-xs font-medium leading-tight">{s.titulo}</p>
        <button
          aria-label={s.tipo === "anime" ? "+1 episodio" : "+1 capítulo"}
          onClick={() => update.mutate({ id: s.id, patch: plusOnePatch(s) })}
          className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-primary transition-transform active:scale-90"
        >
          +1
        </button>
      </div>
    </div>
  );
}

function AddSeriesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: series } = useQuery(seriesQuery);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string>("manga");
  const [cap, setCap] = useState("0");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const key = workKey(titulo, tipo);
    const existing = series?.find((s) => workKey(s.titulo, s.tipo) === key);
    if (existing) {
      toast.error(`Ya tienes “${existing.titulo}” en tu biblioteca`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("series").insert({ titulo: titulo.trim(), tipo, ultimo_cap_leido: Number(cap) || 0, last_read_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "Esa serie ya existe" : "No se pudo agregar"); return; }
    toast.success("Serie agregada");
    qc.invalidateQueries({ queryKey: ["series"] });
    setTitulo(""); setCap("0");
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar serie</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label>Título</Label><Input required value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Capítulo actual</Label><Input type="number" step="any" value={cap} onChange={(e) => setCap(e.target.value)} /></div>
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
