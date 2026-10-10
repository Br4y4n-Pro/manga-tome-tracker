import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Mi Biblioteca Otaku" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  // null = still checking the recovery link, false = no valid recovery session.
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The client exchanges the token from the email link for a session and emits PASSWORD_RECOVERY.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady((prev) => prev || !!session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      navigate({ to: "/biblioteca", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-3xl font-bold">Nueva contraseña</h1>
      {ready === null ? (
        <p className="mt-6 text-sm text-muted-foreground">Verificando enlace…</p>
      ) : ready ? (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw">Nueva contraseña</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Repite la contraseña</Label>
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full bg-gradient-primary shadow-glow"
          >
            {busy ? "…" : "Guardar contraseña"}
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground">
            El enlace no es válido o ya expiró. Pide uno nuevo desde la pantalla de inicio de
            sesión.
          </p>
          <Button asChild variant="secondary" className="h-11 w-full">
            <Link to="/auth">Volver a entrar</Link>
          </Button>
        </div>
      )}
    </main>
  );
}
