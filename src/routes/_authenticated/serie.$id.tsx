import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { seriesQuery, formatCap } from "@/lib/data";
import { Cover } from "@/components/Cover";
export const Route = createFileRoute("/_authenticated/serie/$id")({
  head: () => ({ meta: [{ title: "Serie — Mi Biblioteca Otaku" }, { name: "description", content: "Detalle de la serie" }, { property: "og:title", content: "Serie — Mi Biblioteca Otaku" }, { property: "og:description", content: "Detalle de la serie" }] }),
  component: Detail,
});
function Detail() {
  const { id } = Route.useParams();
  const { data } = useQuery(seriesQuery);
  const s = data?.find((x) => x.id === id);
  if (!s) return <main className="p-6 text-muted-foreground">Cargando…</main>;
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6">
      <Link to="/biblioteca" className="text-sm text-muted-foreground">← Biblioteca</Link>
      <div className="mt-4 flex gap-4">
        <Cover series={s} className="aspect-[2/3] w-32 shrink-0 rounded-xl" />
        <div><h1 className="text-2xl font-bold">{s.titulo}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{s.estado ?? "—"} · {s.fuente || "—"}</p>
          <p className="mt-2 text-sm">Leídos {s.caps_leidos ?? "—"} / {s.caps_totales ?? "—"} · Último: {formatCap(s.ultimo_cap_leido)}</p>
        </div>
      </div>
    </main>
  );
}
