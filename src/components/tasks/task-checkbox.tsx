"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_STYLES } from "@/lib/colors";

export function TaskCheckbox({
  checked,
  priority = 1,
  onToggle,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  priority?: number;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        // Generous hit area on touch, compact visual.
        "group/check relative flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200 before:absolute before:-inset-2.5 before:content-['']",
        checked ? "border-success bg-success text-white" : cn(PRIORITY_STYLES[priority]?.ring, "hover:bg-muted"),
        disabled && "opacity-60",
        className,
      )}
    >
      <Check
        className={cn(
          "size-3 stroke-[3] transition-all duration-200",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0 group-hover/check:scale-90 group-hover/check:opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}
