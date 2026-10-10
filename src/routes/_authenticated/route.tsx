import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lastImportQuery } from "@/lib/data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

const fmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

function AppLayout() {
  const { data: last } = useQuery(lastImportQuery);
  const nav = [
    { to: "/biblioteca", label: "Biblioteca", icon: BookOpen },
    { to: "/semana", label: "Esta semana", icon: CalendarDays },
    { to: "/importar", label: "Importar", icon: Upload },
  ] as const;
  return (
    <div className="min-h-screen pb-safe">
      {last && (
        <div className="border-b border-border bg-card/60 px-4 py-1.5 text-center text-[11px] text-muted-foreground backdrop-blur">
          Última actualización: {fmt.format(new Date(last.created_at))}, {last.total} series ({last.nuevas} nuevas,{" "}
          {last.actualizadas} actualizadas)
        </div>
      )}
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
