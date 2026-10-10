import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/semana")({
  head: () => ({ meta: [{ title: "semana — Mi Biblioteca Otaku" }, { name: "description", content: "Mi Biblioteca Otaku" }, { property: "og:title", content: "semana — Mi Biblioteca Otaku" }, { property: "og:description", content: "Mi Biblioteca Otaku" }] }),
  component: () => <main className="mx-auto max-w-3xl px-4 pt-6"><h1 className="text-3xl font-extrabold capitalize">semana</h1><p className="mt-4 text-muted-foreground">Próximamente.</p></main>,
});
