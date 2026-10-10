import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BookOpen, CalendarDays, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mi Biblioteca Otaku — tu manga, manhwa y anime en un lugar" },
      { name: "description", content: "Lleva tu progreso, notas por capítulo y calendario de salidas de manga, manhwa, manhua y anime." },
      { property: "og:title", content: "Mi Biblioteca Otaku" },
      { property: "og:description", content: "Progreso, notas y calendario de salidas de tus series favoritas." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/biblioteca", replace: true });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
        <BookOpen className="h-7 w-7 text-primary-foreground" />
      </div>
      <h1 className="text-5xl font-extrabold leading-[1.05]">
        Mi Biblioteca <span className="bg-gradient-primary bg-clip-text text-transparent">Otaku</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Tus series, tu progreso y cada capítulo nuevo, sin perder el hilo.
      </p>
      <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
        <li className="flex items-center gap-3"><BookOpen className="h-4 w-4 text-primary" /> Carátulas automáticas y +1 capítulo en un toque</li>
        <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-primary" /> Calendario de salidas de cada serie</li>
        <li className="flex items-center gap-3"><Upload className="h-4 w-4 text-primary" /> Importa tu Excel sin perder tus notas</li>
      </ul>
      <Button asChild size="lg" className="mt-10 h-12 bg-gradient-primary text-base shadow-glow">
        <Link to="/auth">Entrar</Link>
      </Button>
    </main>
  );
}
