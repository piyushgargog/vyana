import React from "react";

import { cn } from "./cn";

/**
 * One in-page option chip (a filter, a range, a date, a status): a pill with a 44 px touch target, accent when
 * selected and the quiet fill when not. A choice among several uses `role="radio"` (read as `aria-checked`); a
 * toggle keeps `aria-pressed`. Put the chips of one choice in a `ChipGroup`. For page navigation use `SegmentedNav`.
 */
export function Chip({
  selected,
  onSelect,
  children,
  role,
  label,
  disabled,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  role?: "radio";
  /** The accessible name when the visible text is not enough. */
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const state = role === "radio" ? { role, "aria-checked": selected } : { "aria-pressed": selected };
  return (
    <button
      type="button"
      {...state}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors active:scale-[0.97] disabled:opacity-50",
        selected ? "bg-accent text-white" : "bg-fill text-label-2 hover:bg-fill-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** The wrapper of one set of chips, named for assistive technology. */
export function ChipGroup({ label, radio, className, children }: { label: string; radio?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div role={radio ? "radiogroup" : "group"} aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  );
}
