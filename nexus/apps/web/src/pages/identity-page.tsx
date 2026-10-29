import { apiFetch } from "../lib/api";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { Session } from "@supabase/supabase-js";
import { isGoogleEnabled, supabase } from "../lib/supabase";
import { WorkspaceApp } from "../features/workspace/app";
import type { Identity } from "../features/workspace/types";
import LoginPage from "./login";

export function IdentityPage({
  mode,
}: {
  mode: "login" | "callback" | "account";
}) {
  const [, navigate] = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error: authError }) => {
        if (!alive) return;
        setSession(data.session);
        setLoading(false);
        if (authError)
          setError(
            "Não foi possível concluir o acesso. Tente entrar novamente.",
          );
        else if (mode === "callback" && !data.session)
          setError(
            "O acesso não foi concluído. Volte ao login e tente novamente.",
          );
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setError("Serviço de autenticação indisponível.");
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [mode]);

  useEffect(() => {
    if (session && mode !== "account") {
      const requested = mode === "callback"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
      const next = requested && /^\/avaliar\/[^/]+\/[^/]+$/.test(requested)
        ? requested
        : "/conta";
      navigate(next, { replace: true });
    }
  }, [session, mode, navigate]);

  useEffect(() => {
    if (mode !== "account" || !session) {
      setIdentity(null);
      return;
    }
    const controller = new AbortController();
    setIdentity(null);
    setError("");
    void apiFetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Sua sessão não é válida. Saia e entre novamente."
              : "Não foi possível consultar seus vínculos. Tente novamente.",
          );
        const data: Identity = await response.json();
        if (!controller.signal.aborted) setIdentity(data);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível consultar seus vínculos.",
          );
      });
    return () => controller.abort();
  }, [mode, session, attempt]);

  async function signIn() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      if (!(await isGoogleEnabled())) {
        setError(
          "O login com Google ainda está sendo configurado. Tente novamente mais tarde.",
        );
        setBusy(false);
        return;
      }
      const next = /^\/avaliar\/[^/]+\/[^/]+$/.test(window.location.pathname)
        ? `?next=${encodeURIComponent(window.location.pathname)}`
        : "";
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${next}`,
        },
      });
      if (authError) throw authError;
    } catch {
      setError(
        "Não foi possível iniciar o acesso com Google. Tente novamente.",
      );
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (authError) throw authError;
      setIdentity(null);
      setSession(null);
      navigate("/login", { replace: true });
    } catch {
      // The SDK can clear this browser's session even when remote revocation fails.
      const current = await supabase.auth.getSession().catch(() => null);
      if (current && !current.error && !current.data.session) {
        setIdentity(null);
        setSession(null);
        setError(
          "A sessão neste navegador foi encerrada, mas não foi possível confirmar a revogação no serviço. Entre novamente se precisar continuar.",
        );
      } else {
        setError("Não foi possível sair. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (mode === "account" && session && identity) {
    return (
      <WorkspaceApp
        identity={identity}
        token={session.access_token}
        onSignOut={signOut}
        refreshIdentity={() => setAttempt((v) => v + 1)}
        authError={error}
        signingOut={busy}
      />
    );
  }
  return (
    <LoginPage
      mode={mode}
      hasSession={!!session}
      configured={!!supabase}
      loading={loading}
      error={error}
      busy={busy}
      signIn={signIn}
      signOut={signOut}
      retry={() => setAttempt((v) => v + 1)}
    />
  );
}
