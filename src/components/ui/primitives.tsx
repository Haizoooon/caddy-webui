import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "muted"
  | "ink";

export const toneBadge: Record<Tone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary-ink",
  info: "border-info/30 bg-info/10 text-info-ink",
  success: "border-success/30 bg-success/10 text-success-ink",
  warning: "border-warning/40 bg-warning/20 text-warning-ink",
  danger: "border-danger/30 bg-danger/10 text-danger-ink",
  purple: "border-purple/25 bg-purple/10 text-purple-ink",
  muted: "border-line-strong bg-cloud text-muted",
  ink: "border-ink/20 bg-ink/10 text-ink",
};

export const toneSolid: Record<Tone, string> = {
  primary: "bg-primary text-white",
  info: "bg-info text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-[#2c3e50]",
  danger: "bg-danger text-white",
  purple: "bg-purple text-white",
  muted: "bg-cloud text-ink-soft",
  ink: "bg-ink text-canvas",
};

export const toneNotice: Record<Tone, string> = {
  primary: "border-primary/30 bg-primary/5",
  info: "border-info/30 bg-info/5",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/30 bg-danger/5",
  purple: "border-purple/30 bg-purple/5",
  muted: "border-line bg-cloud/60",
  ink: "border-ink/20 bg-cloud/60",
};

export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap",
        toneBadge[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "info" | "success" | "danger" | "outline" | "ghost" | "ink";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[3px] border font-semibold leading-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-white hover:border-primary-dark hover:bg-primary-dark",
  info: "border-info bg-info text-white hover:border-info-dark hover:bg-info-dark",
  success:
    "border-success bg-success text-white hover:border-success-dark hover:bg-success-dark",
  danger:
    "border-danger bg-danger text-white hover:border-danger-dark hover:bg-danger-dark",
  outline:
    "border-line-strong bg-surface text-ink-soft hover:border-primary hover:text-primary-ink",
  ghost: "border-transparent bg-transparent text-ink-soft hover:bg-cloud",
  ink: "border-ink bg-ink text-canvas hover:border-ink-soft hover:bg-ink-soft",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[3px] border border-line bg-surface", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-bold tracking-wide text-ink uppercase">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{label}</p>
        <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</div>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
      </div>
      {icon ? (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px]",
            toneSolid[tone],
          )}
        >
          {icon}
        </span>
      ) : null}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[3px] bg-cloud text-muted">
          {icon}
        </span>
      ) : null}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 rounded-[3px] border px-4 py-3",
        toneNotice[tone],
        className,
      )}
    >
      <div className="min-w-0 text-sm text-ink-soft">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children ? (
          <div className={cn("leading-relaxed", title ? "mt-1" : undefined, "text-muted")}>
            {children}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[2px] bg-cloud", className)} />;
}

export function CodeBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "max-h-[28rem] overflow-auto rounded-[3px] border border-line bg-cloud/50 p-3 font-mono text-[11.5px] leading-relaxed text-ink-soft",
        className,
      )}
    >
      {children}
    </pre>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 last:border-b-0">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}
