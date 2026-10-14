import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-fill text-label-2",
  accent: "bg-accent-soft text-accent-strong",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger-text",
};

/** A small status pill ("Taken", "Above range", "Verified"). Colour never carries the meaning alone: the text does. */
export function Pill({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold [&>svg]:h-3.5 [&>svg]:w-3.5", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
