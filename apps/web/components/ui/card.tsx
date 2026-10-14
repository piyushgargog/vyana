import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** A white content card on the grey page. */
export function Card({ className, padded = true, ...rest }: ComponentProps<"section"> & { padded?: boolean }) {
  return <section className={cn("rounded-card bg-surface", padded && "p-5 sm:p-6", className)} {...rest} />;
}

/** A Liquid Glass card: only for things that float over content (a hero card, a summary over a chart). */
export function GlassCard({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cn("glass rounded-card p-5 sm:p-6", className)} {...rest} />;
}

/** A card's title row: title on the left, an optional value or action on the right. */
export function CardHeader({ title, trailing, className }: { title: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-xl font-semibold tracking-tight text-label">{title}</h2>
      {trailing ? <div className="text-[15px] text-label-3">{trailing}</div> : null}
    </div>
  );
}
