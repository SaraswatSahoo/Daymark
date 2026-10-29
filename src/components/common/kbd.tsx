import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "hidden h-5 select-none items-center rounded border bg-muted px-1.5 font-sans text-[0.68rem] font-medium text-muted-foreground lg:inline-flex",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
