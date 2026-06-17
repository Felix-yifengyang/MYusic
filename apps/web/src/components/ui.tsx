import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "ok" | "warn" | "danger";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  size?: "default" | "compact";
}) {
  return (
    <button
      className={cx("button", variant === "secondary" && "secondary", size === "compact" && "compact", className)}
      type={type}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Panel({
  title,
  description,
  wide = false,
  className,
  children
}: {
  title?: string;
  description?: string;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("settings-card", wide && "wide", className)}>
      {(title || description) && <PanelHeader title={title || ""} description={description} />}
      {children}
    </section>
  );
}

function PanelHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="settings-card-header">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function StatPill({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className={`summary-pill ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Disclosure({
  title,
  description,
  defaultOpen = false,
  className,
  children
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={cx("disclosure", className)} open={defaultOpen}>
      <summary>
        <span>
          <strong>{title}</strong>
          {description ? <small>{description}</small> : null}
        </span>
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
