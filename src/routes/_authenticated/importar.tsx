import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({ meta: [{ title: "importar — Mi Biblioteca Otaku" }, { name: "description", content: "Mi Biblioteca Otaku" }, { property: "og:title", content: "importar — Mi Biblioteca Otaku" }, { property: "og:description", content: "Mi Biblioteca Otaku" }] }),
  component: () => <main className="mx-auto max-w-3xl px-4 pt-6"><h1 className="text-3xl font-extrabold capitalize">importar</h1><p className="mt-4 text-muted-foreground">Próximamente.</p></main>,
});
