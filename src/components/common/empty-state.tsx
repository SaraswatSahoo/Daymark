import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 px-4 py-6" : "gap-2 rounded-xl border border-dashed px-6 py-14",
        className,
      )}
    >
      <div className={cn("flex items-center justify-center rounded-full bg-muted text-muted-foreground", compact ? "size-8" : "size-11")}>
        <Icon className={compact ? "size-4" : "size-5"} aria-hidden />
      </div>
      <p className={cn("font-medium", compact ? "text-sm" : "font-display text-lg")}>{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground text-balance">{description}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
