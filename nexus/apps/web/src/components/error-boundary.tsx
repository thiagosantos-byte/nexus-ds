import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === "string") {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <main id="main-content" className="auth-page">
      <div className="auth-card" role="alert">
        <span className="eyebrow">NÃO FOI POSSÍVEL ABRIR ESTA TELA</span>
        <h1 tabIndex={-1}>Vamos tentar novamente?</h1>
        <p>
          Ocorreu um erro ao exibir este conteúdo. Tente novamente ou volte à
          sua conta.
        </p>
        {import.meta.env.DEV && <pre>{error.message}</pre>}
        <button type="button" className="btn btn-primary" onClick={resetError}>
          Tentar novamente
        </button>
        <a className="text-link" href="/conta">
          Voltar à minha conta
        </a>
      </div>
    </main>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (import.meta.env.DEV)
      console.error("Erro de interface:", toError(error), info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
