import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/utils";

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

type Mode = "in" | "up" | "forgot";

const TITLES: Record<Mode, string> = {
  in: "Bienvenido de vuelta",
  up: "Crea tu cuenta",
  forgot: "Recupera tu contraseña",
};

const SUBMIT_LABELS: Record<Mode, string> = {
  in: "Entrar",
  up: "Registrarme",
  forgot: "Enviar enlace",
};

const SENT_MESSAGES: Partial<Record<Mode, string>> = {
  up: "Revisa tu correo y confirma tu cuenta para entrar.",
  // Same message whether or not the account exists, so the form can't be used to discover emails.
  forgot:
    "Si existe una cuenta con ese correo, te enviamos un enlace para crear una nueva contraseña.",
};

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setSent(false);
    setPassword("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/biblioteca", replace: true });
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/biblioteca", replace: true });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo continuar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-3xl font-bold">{TITLES[mode]}</h1>
      {sent ? (
        <p className="mt-6 rounded-xl bg-card p-4 text-sm text-muted-foreground">
          {SENT_MESSAGES[mode]}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw">Contraseña</Label>
                {mode === "in" && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => switchMode("forgot")}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <Input
                id="pw"
                type="password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                required
                minLength={mode === "up" ? MIN_PASSWORD_LENGTH : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full bg-gradient-primary shadow-glow"
          >
            {busy ? "…" : SUBMIT_LABELS[mode]}
          </Button>
        </form>
      )}
      <button
        type="button"
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => switchMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
      </button>
    </main>
  );
}
