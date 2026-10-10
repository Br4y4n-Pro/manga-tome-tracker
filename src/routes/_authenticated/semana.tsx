import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Plus, Sparkles } from "lucide-react";
import { schedulesQuery, seriesQuery, formatCap, type Schedule, type Series } from "@/lib/data";
import { isReleaseDay, startOfDay, toISODate } from "@/lib/schedule";
import { plusOnePatch, useUpdateSeries } from "@/lib/mutations";
import { Cover } from "@/components/Cover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/semana")({
  head: () => ({
    meta: [
      { title: "Esta semana — Mi Biblioteca Otaku" },
      { name: "description", content: "Capítulos que salen esta semana." },
      { property: "og:title", content: "Esta semana — Mi Biblioteca Otaku" },
      { property: "og:description", content: "Capítulos que salen esta semana." },
    ],
  }),
  component: Semana,
});

function addDays(d: Date, n: number) {
  const r = startOfDay(d);
  r.setDate(r.getDate() + n);
  return r;
}

interface Entry {
  s: Series;
  rule: Schedule;
}

function Semana() {
  const { data: series, isLoading } = useQuery(seriesQuery);
  const { data: schedules } = useQuery(schedulesQuery);

  const { days, byDay, unscheduled } = useMemo(() => {
    const today = startOfDay(new Date());
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const schedMap = new Map((schedules ?? []).map((x) => [x.series_id, x]));
    const byDay = new Map<string, Entry[]>();
    const scheduledIds = new Set<string>();
    for (const d of days) {
      const iso = toISODate(d);
      const list: Entry[] = [];
      for (const s of series ?? []) {
        const rule = schedMap.get(s.id);
        if (!rule) continue;
        if (isReleaseDay(rule, d)) {
          list.push({ s, rule });
          scheduledIds.add(s.id);
        }
      }
      byDay.set(iso, list);
    }
    const unscheduled = (series ?? []).filter((s) => !scheduledIds.has(s.id));
    return { days, byDay, unscheduled };
  }, [series, schedules]);

  const todayIso = toISODate(new Date());
  const totalThisWeek = [...byDay.values()].reduce((n, l) => n + l.length, 0);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-6">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-end justify-between">
        <h1 className="text-3xl font-extrabold">Esta semana</h1>
        <span className="text-sm text-muted-foreground">{totalThisWeek} salidas</span>
      </header>

      {totalThisWeek === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nada sale esta semana. Activa el calendario de una serie desde su detalle.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const iso = toISODate(d);
            const list = byDay.get(iso) ?? [];
            const isToday = iso === todayIso;
            return (
              <section key={iso}>
                <div className="mb-2 flex items-center gap-2">
                  <h2
                    className={
                      isToday ? "text-lg font-bold capitalize text-primary" : "text-lg font-bold capitalize text-muted-foreground"
                    }
                  >
                    {d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" })}
                  </h2>
                  {isToday && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                      Hoy
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                    Sin salidas.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map(({ s }) => (
                      <DayCard key={s.id} s={s} isNew={isToday} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {unscheduled.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
            Sin calendario ({unscheduled.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unscheduled.map((s) => (
              <Link
                key={s.id}
                to="/serie/$id"
                params={{ id: s.id }}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
              >
                {s.titulo}
              </Link>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}

function DayCard({ s, isNew }: { s: Series; isNew: boolean }) {
  const update = useUpdateSeries();
  const nextCap = Number(s.ultimo_cap_leido) + 1;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
      <Link to="/serie/$id" params={{ id: s.id }} className="shrink-0">
        <Cover series={s} className="h-16 w-11 rounded-md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to="/serie/$id" params={{ id: s.id }} className="block truncate text-sm font-semibold">
          {s.titulo}
        </Link>
        <p className="text-xs text-muted-foreground">
          Siguiente: Cap. {formatCap(nextCap)}
        </p>
      </div>
      {isNew && (
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Sale hoy" />
      )}
      <Button
        size="sm"
        variant="secondary"
        aria-label="+1 capítulo"
        onClick={() => update.mutate({ id: s.id, patch: plusOnePatch(s) })}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
