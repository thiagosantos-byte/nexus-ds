import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Layers3, Inbox } from "lucide-react";
import { Link } from "wouter";

export function Logo() {
  return (
    <span className="public-logo">
      <span className="brand-mark" aria-hidden="true">
        <Layers3 size={21} />
      </span>
      Nexus
      <span className="brand-dot" aria-hidden="true">
        .
      </span>
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="public-nav">
      <Link href="/" aria-label="Nexus, página inicial">
        <Logo />
      </Link>
      <Link href="/login" className="btn btn-ghost">
        Entrar na plataforma
      </Link>
    </header>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {children}
    </section>
  );
}
export function Status({
  children,
  variant = "",
}: {
  children: ReactNode;
  variant?: string;
}) {
  return <span className={`status ${variant}`}>{children}</span>;
}
export function Stat({
  label,
  value,
  icon,
  foot,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  foot: string;
}) {
  return (
    <Card className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{foot}</div>
    </Card>
  );
}
export function EmptyState({
  children,
  description,
  action,
}: {
  children: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <Inbox size={23} />
      </span>
      <strong>{children}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function LoadingState({
  children = "Carregando dados…",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      {children}
    </div>
  );
}

// Native dialog supplies focus containment, Escape and focus restoration without another dependency.
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onClose}
    >
      <h2 id={titleId}>{title}</h2>
      <div id={descriptionId}>{children}</div>
      <div className="dialog-actions">
        <button
          autoFocus
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onClose}
        >
          Voltar
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Aguarde…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
