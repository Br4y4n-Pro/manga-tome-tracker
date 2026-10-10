import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { autoFetchCover } from "@/lib/covers";
import type { Series } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Lazy cover: fetches from AniList once when it scrolls into view. */
export function Cover({ series, className }: { series: Series; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (series.cover_url || series.cover_checked || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (!e.isIntersecting) return;
        io.disconnect();
        autoFetchCover(series.id, series.titulo).then((url) => {
          qc.setQueryData<Series[]>(["series"], (old) =>
            old?.map((s) => (s.id === series.id ? { ...s, cover_url: url, cover_checked: true } : s)),
          );
        });
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [series.id, series.cover_url, series.cover_checked, series.titulo, qc]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-muted", className)}>
      {series.cover_url ? (
        <img
          src={series.cover_url}
          alt={series.titulo}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn("h-full w-full object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        />
      ) : series.cover_checked ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-accent to-muted p-2 text-center">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="line-clamp-3 text-[10px] font-medium text-muted-foreground">{series.titulo}</span>
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
    </div>
  );
}
