import { cn } from "@/lib/utils";

/** A simple daymark: a sun rising over a horizon line. Uses the accent color. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-brand", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-current" />
      <circle cx="16" cy="18" r="6" fill="none" stroke="white" strokeWidth="2.4" />
      <rect x="5" y="18" width="22" height="9" className="fill-current" />
      <path d="M7 21.5h18" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
