import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  Layers3,
  ListChecks,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Logo, PublicHeader } from "../components/app-ui";

export function PublicHome() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content">
        <section className="public-hero">
          <div className="hero-copy">
            <span className="eyebrow">DA IDEIA À AVALIAÇÃO</span>
            <h1 tabIndex={-1}>
              Um espaço para
              <br />
              ideias <em>avançarem.</em>
            </h1>
            <p>
              Conecte pessoas, acompanhe projetos e organize avaliações. Cada
              instituição com seu contexto, cada equipe com seu próximo passo.
            </p>
            <div className="workspace-actions">
              <Link href="/login" className="btn btn-primary">
                Acessar minha conta <ArrowRight size={18} />
              </Link>
              <a href="#como-funciona" className="btn btn-ghost">
                Como funciona
              </a>
            </div>
            <p className="hero-note">
              <ShieldCheck size={17} aria-hidden="true" />
              Acesso com Google e vínculos aprovados pela instituição.
            </p>
          </div>
          <div className="journey-card">
            <div className="journey-heading">
              <span className="brand-mark" aria-hidden="true">
                <Layers3 size={22} />
              </span>
              <span>
                Seu ciclo de inovação<small>Organização em cada etapa</small>
              </span>
            </div>
            <ol className="journey-steps">
              <li>
                <span className="step-number">01</span>
                <div>
                  <h2>Conecte sua equipe</h2>
                  <p>Projetos, integrantes e orientadores em um só lugar.</p>
                </div>
              </li>
              <li>
                <span className="step-number">02</span>
                <div>
                  <h2>Avalie com clareza</h2>
                  <p>Bancas, critérios e rubricas definidos antes das notas.</p>
                </div>
              </li>
              <li>
                <span className="step-number">03</span>
                <div>
                  <h2>Compartilhe resultados</h2>
                  <p>Classificações publicadas quando a gestão autorizar.</p>
                </div>
              </li>
            </ol>
            <div className="journey-footer">
              <Check size={16} aria-hidden="true" />
              Contextos separados para cada instituição
            </div>
          </div>
        </section>
        <section className="public-section" id="como-funciona">
          <div className="section-intro">
            <span className="eyebrow">TRABALHO EM CONJUNTO</span>
            <h2>
              Menos dispersão.
              <br />
              Mais espaço para construir.
            </h2>
            <p>
              Do acompanhamento à avaliação, cada pessoa encontra os projetos e
              as ações que fazem parte do seu trabalho.
            </p>
          </div>
          <div className="feature-row">
            <article className="card feature">
              <span className="feature-icon">
                <UsersRound aria-hidden="true" />
              </span>
              <h3>Pessoas e projetos</h3>
              <p>
                Alunos, orientadores e gestores conectados por vínculos
                institucionais e equipes de projeto.
              </p>
            </article>
            <article className="card feature">
              <span className="feature-icon">
                <ListChecks aria-hidden="true" />
              </span>
              <h3>Avaliações consistentes</h3>
              <p>
                Notas de 1 a 5, critérios com pesos e descritores preservados
                durante cada banca.
              </p>
            </article>
            <article className="card feature">
              <span className="feature-icon">
                <ShieldCheck aria-hidden="true" />
              </span>
              <h3>Acesso com contexto</h3>
              <p>
                Papéis por instituição, aprovação de vínculos e publicação
                controlada dos resultados.
              </p>
            </article>
          </div>
        </section>
        <section className="public-callout">
          <div>
            <span className="eyebrow">SEU PRÓXIMO PASSO</span>
            <h2>Faça parte da sua instituição.</h2>
            <p>
              Entre com Google e solicite um vínculo. A gestão da instituição
              revisa seu pedido de acesso.
            </p>
          </div>
          <Link href="/solicitar-acesso" className="btn btn-primary">
            Entender o acesso <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <Logo />
        <span>Gestão e avaliação de projetos</span>
        <Link href="/login">Acessar plataforma</Link>
      </footer>
    </div>
  );
}

export function AccessInfo() {
  return (
    <div className="auth-page">
      <PublicHeader />
      <main id="main-content" className="auth-card">
        <span className="eyebrow">VÍNCULO INSTITUCIONAL</span>
        <h1 tabIndex={-1}>Seu acesso começa pela sua conta.</h1>
        <p>
          Entre com Google. Em <strong>Meus acessos</strong>, escolha sua
          instituição e o perfil que deseja solicitar.
        </p>
        <ol className="info-steps">
          <li>Entre ou crie sua conta usando o Google.</li>
          <li>Envie a solicitação na área Meus acessos.</li>
          <li>Acompanhe a aprovação pela gestão da instituição.</li>
        </ol>
        <p>
          Nenhuma solicitação é enviada nesta página. O acesso aos projetos
          depende da aprovação do vínculo.
        </p>
        <Link href="/app/access" className="btn btn-primary">
          Continuar com minha conta <ArrowRight size={18} />
        </Link>
        <Link className="text-link" href="/">
          Voltar ao início
        </Link>
      </main>
    </div>
  );
}
export function RecoveryInfo() {
  return (
    <div className="auth-page">
      <PublicHeader />
      <main id="main-content" className="auth-card">
        <span className="eyebrow">AJUDA COM O ACESSO</span>
        <h1 tabIndex={-1}>Não consegue entrar?</h1>
        <p>
          O Nexus usa sua conta Google para autenticação. Não há senha
          própria da plataforma para recuperar.
        </p>
        <p>
          Se você perdeu o acesso ao Google, use a recuperação de conta do
          próprio provedor. Se o problema for um vínculo pendente ou suspenso,
          procure a gestão da sua instituição.
        </p>
        <a
          className="btn btn-primary"
          href="https://accounts.google.com/signin/recovery"
          target="_blank"
          rel="noreferrer"
        >
          Recuperar conta Google{" "}
          <span className="sr-only">(abre em outra aba)</span>
          <ArrowRight size={18} />
        </a>
        <Link href="/login" className="text-link">
          Voltar ao acesso
        </Link>
      </main>
    </div>
  );
}
