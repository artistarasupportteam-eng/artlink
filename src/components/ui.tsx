import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  surface: "border border-border bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-danger-fg hover:opacity-90",
} as const;

export function Button({
  variant = "surface",
  className = "",
  busy,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-muted";

export const areaClass =
  "min-h-28 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none placeholder:text-muted";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-fg/40 p-4 sm:place-items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl text-fg">{title}</h2>
        <div className="mt-3 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <p className="font-medium text-fg">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Loading
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}
