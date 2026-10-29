import { Link } from "wouter";
import { PublicHeader } from "../components/app-ui";
export default function NotFound() {
  return (
    <div className="auth-page">
      <PublicHeader />
      <main id="main-content" className="auth-card">
        <span className="eyebrow">PÁGINA NÃO ENCONTRADA</span>
        <h1 tabIndex={-1}>Esse caminho não está disponível.</h1>
        <p>
          O endereço pode ter mudado. Acesse sua conta para encontrar seus
          projetos e instituições.
        </p>
        <Link href="/conta" className="btn btn-primary">
          Ir para minha conta
        </Link>
        <Link className="text-link" href="/">
          Voltar ao início
        </Link>
      </main>
    </div>
  );
}
