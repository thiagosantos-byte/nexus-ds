import { lazy, Suspense, useEffect } from "react";
import { Redirect, useLocation } from "wouter";
import { PublicHome, AccessInfo, RecoveryInfo } from "./pages/public-pages";
import { LoadingState } from "./components/app-ui";
import { useAccessibility } from "./features/accessibility/AccessibilityProvider";
const IdentityPage = lazy(() =>
  import("./pages/identity-page").then((module) => ({
    default: module.IdentityPage,
  })),
);
function IdentityRoute({ mode }: { mode: "login" | "callback" | "account" }) {
  return (
    <Suspense
      fallback={
        <main id="main-content">
          <LoadingState>Carregando acesso…</LoadingState>
        </main>
      }
    >
      <IdentityPage mode={mode} />
    </Suspense>
  );
}
import NotFound from "./pages/not-found";

// Preserve bookmarked addresses without retaining any simulated application.
const legacyRoutes: Record<string, string> = {
  "/instituicao": "/conta",
  "/superadmin": "/app/institutions",
  "/usuarios": "/app/members",
  "/projetos": "/app/projects",
  "/projetos/novo": "/app/projects",
  "/equipes": "/app/projects",
  "/orientacao": "/app/projects",
  "/bancas": "/app/events",
  "/criterios": "/app/criteria",
  "/avaliacoes": "/app/evaluations",
  "/resultados": "/app/results",
  "/relatorios": "/app/reports",
  "/podio": "/app/podium",
  "/permissoes": "/conta",
};

export default function App() {
  const [path] = useLocation();
  const { announce } = useAccessibility();
  useEffect(() => {
    document.title = "Nexus · Gestão e avaliação de projetos";
    // Announce route changes to keyboard and screen-reader users.
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.focus();
    window.scrollTo({ top: 0 });
    announce(
      heading?.textContent
        ? `Página ${heading.textContent}.`
        : "Página atualizada.",
    );
  }, [path, announce]);
  if (path === "/") return <PublicHome />;
  if (path === "/login") return <IdentityRoute mode="login" />;
  if (path === "/auth/callback") return <IdentityRoute mode="callback" />;
  if (
    path === "/conta" ||
    path.startsWith("/app/") ||
    /^\/avaliar\/[^/]+\/[^/]+$/.test(path)
  )
    return <IdentityRoute mode="account" />;
  if (path === "/app") return <Redirect to="/conta" />;
  if (path === "/solicitar-acesso") return <AccessInfo />;
  if (path === "/recuperar-senha") return <RecoveryInfo />;
  const destination =
    legacyRoutes[path] ??
    (/^\/projetos\/[^/]+$/.test(path) ? "/app/projects" : undefined) ??
    (/^\/bancas\/[^/]+$/.test(path) ? "/app/events" : undefined);
  return destination ? <Redirect to={destination} /> : <NotFound />;
}
