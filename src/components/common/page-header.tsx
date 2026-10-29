import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end gap-x-4 gap-y-3", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</p>}
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
  count,
  id,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  count?: number;
  id?: string;
}) {
  return (
    <section className={cn("min-w-0", className)} aria-labelledby={id}>
      <div className="mb-1.5 flex items-center gap-2 px-2">
        <h2 id={id} className="text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {count !== undefined && count > 0 && <span className="text-xs tabular-nums text-muted-foreground/80">{count}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
