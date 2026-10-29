import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Logo, LoadingState } from "../components/app-ui";
import { Button } from "../components/ui/button";
import { useAccessibility } from "../features/accessibility/AccessibilityProvider";
export type LoginProps = {
  mode: "login" | "callback" | "account";
  hasSession: boolean;
  configured: boolean;
  loading: boolean;
  error: string;
  busy: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
};
export default function LoginPage({
  mode,
  hasSession,
  configured,
  loading,
  error,
  busy,
  signIn,
  signOut,
  retry,
}: LoginProps) {
  const { reduceMotion } = useAccessibility();
  const loginButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyL") {
        e.preventDefault();
        loginButton.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className="login-page">
      <header className="login-header">
        <Link href="/" aria-label="Nexus, página inicial">
          <Logo />
        </Link>
        <Link href="/" className="back-link">
          <ArrowLeft size={16} />
          Voltar ao início
        </Link>
      </header>
      <main id="main-content" className="login-layout">
        <motion.section
          className="login-form-pane"
          aria-labelledby="login-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35 }}
        >
          <h1 id="login-heading" tabIndex={-1}>
            {mode === "callback"
              ? "Só mais um instante."
              : hasSession
                ? "Sua conta, seu espaço."
                : "Acesse o Nexus"}
          </h1>
          <p className="login-description">
            {mode === "callback"
              ? "Estamos concluindo seu acesso com segurança."
              : "Entre para acompanhar seus projetos e avaliações."}
          </p>
          <div className="login-access-card">
            <div className="login-access-title">
              <ShieldCheck size={19} />
              <h2>
                {mode === "callback"
                  ? "Concluindo seu acesso"
                  : mode === "account" && hasSession
                    ? "Minha conta"
                    : "Entrar na plataforma"}
              </h2>
            </div>
            {error && (
              <div
                className="notice error login-error"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle size={19} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            {!configured ? (
              <p role="status">
                O acesso à plataforma ainda está sendo configurado.
              </p>
            ) : loading ? (
              <LoadingState>Verificando sua sessão…</LoadingState>
            ) : hasSession ? (
              <>
                <p>
                  {error
                    ? "Tente consultar seus vínculos novamente."
                    : "Consultando seus vínculos…"}
                </p>
                {error && (
                  <Button variant="ghost" onClick={retry}>
                    Tentar novamente
                  </Button>
                )}
                <Button onClick={signOut} disabled={busy}>
                  Sair da conta
                </Button>
              </>
            ) : (
              <>
                <p>
                  Use sua conta Google para entrar ou criar sua conta. O acesso
                  à instituição depende de um vínculo aprovado.
                </p>
                <Button
                  ref={loginButton}
                  className="google-signin"
                  onClick={() => {
                    void signIn();
                  }}
                  disabled={busy}
                >
                  {busy ? (
                    "Redirecionando…"
                  ) : (
                    <>
                      <span className="google-letter" aria-hidden="true">
                        G
                      </span>
                      Entrar com Google
                      <ArrowRight size={18} />
                    </>
                  )}
                </Button>
                <p className="login-privacy">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Sua senha fica com o Google. Não a pedimos aqui.
                </p>
              </>
            )}
            <div className="auth-links">
              <Link href="/solicitar-acesso">Como solicitar acesso</Link>
              <Link href="/recuperar-senha">Preciso de ajuda</Link>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
