import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Mi Biblioteca Otaku" },
      { name: "description", content: "Inicia sesión o crea tu cuenta en Mi Biblioteca Otaku." },
      { property: "og:title", content: "Entrar — Mi Biblioteca Otaku" },
      { property: "og:description", content: "Accede a tu biblioteca personal de manga y anime." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/biblioteca", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/biblioteca", replace: true });
        else setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo continuar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-3xl font-bold">{mode === "in" ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h1>
      {sent ? (
        <p className="mt-6 rounded-xl bg-card p-4 text-sm text-muted-foreground">
          Revisa tu correo y confirma tu cuenta para entrar.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Contraseña</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full bg-gradient-primary shadow-glow">
            {busy ? "…" : mode === "in" ? "Entrar" : "Registrarme"}
          </Button>
        </form>
      )}
      <button
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => { setMode(mode === "in" ? "up" : "in"); setSent(false); }}
      >
        {mode === "in" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
      </button>
    </main>
  );
}
