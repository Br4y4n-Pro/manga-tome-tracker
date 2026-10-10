import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, BookOpen, CalendarDays, LogOut, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lastImportQuery, schedulesQuery, seriesQuery } from "@/lib/data";
import {
  requestNotificationPermission,
  useNewChapterNotifications,
  useNotifPref,
} from "@/hooks/useNotifications";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const fmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

function AppLayout() {
  const { user } = Route.useRouteContext();
  const { data: last } = useQuery(lastImportQuery);
  const { data: series } = useQuery(seriesQuery);
  const { data: schedules } = useQuery(schedulesQuery);
  const [notifEnabled, setNotifEnabled] = useNotifPref();
  useNewChapterNotifications(series, schedules, notifEnabled);

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
      <button
        aria-label="Notificaciones"
        onClick={async () => {
          if (!notifEnabled) {
            const ok = await requestNotificationPermission();
            if (!ok) {
              toast.error("El navegador bloqueó las notificaciones");
              return;
            }
          }
          setNotifEnabled(!notifEnabled);
          toast.success(notifEnabled ? "Notificaciones desactivadas" : "Te avisaremos de capítulos nuevos");
        }}
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/85 text-muted-foreground backdrop-blur-xl transition-colors"
      >
        {notifEnabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
      </button>
      <button
        aria-label="Cerrar sesión"
        title={`Sesión: ${user.email ?? "sin correo"} — cerrar sesión`}
        onClick={async () => {
          const { error } = await supabase.auth.signOut();
          if (error) toast.error("No se pudo cerrar sesión");
        }}
        className="fixed right-16 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/85 text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
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
