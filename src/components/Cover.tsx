import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Tv } from "lucide-react";
import { autoLinkSeries } from "@/lib/anilist";
import type { Series } from "@/lib/data";
import { cn } from "@/lib/utils";

function patchCache(qc: ReturnType<typeof useQueryClient>, id: string, patch: Partial<Series>) {
  qc.setQueryData<Series[]>(["series"], (old) =>
    old?.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  );
}

/**
 * Lazy cover: when the card scrolls into view, links the series with AniList once
 * (cover, synopsis, totals). If the source's cover is broken, AniList's replaces it.
 */
export function Cover({ series, className }: { series: Series; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const triedFallback = useRef(false);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [series.cover_url]);

  useEffect(() => {
    if (series.info_checked || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        void autoLinkSeries(series).then((patch) => patch && patchCache(qc, series.id, patch));
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // The series object changes on every cache update; only its identity and link state matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.id, series.info_checked, qc]);

  function onError() {
    setBroken(true);
    if (triedFallback.current) return;
    triedFallback.current = true;
    // Source sites often block hotlinked covers: fall back to AniList's.
    void autoLinkSeries(series, { replaceCover: true }).then((patch) => {
      if (patch?.cover_url && patch.cover_url !== series.cover_url)
        patchCache(qc, series.id, patch);
    });
  }

  const Icon = series.tipo === "anime" ? Tv : BookOpen;
  const showImage = series.cover_url && !broken;

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-muted", className)}>
      {showImage ? (
        <img
          src={series.cover_url!}
          alt={series.titulo}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={onError}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : series.info_checked || broken ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-accent to-muted p-2 text-center">
          <Icon className="h-6 w-6 text-primary" />
          <span className="line-clamp-3 text-[10px] font-medium text-muted-foreground">
            {series.titulo}
          </span>
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
    </div>
  );
}
