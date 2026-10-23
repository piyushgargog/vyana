import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** A white content card on the grey page. Content is always solid (issue #288): glass is for chrome only. */
export function Card({ className, padded = true, ...rest }: ComponentProps<"section"> & { padded?: boolean }) {
  return <section className={cn("rounded-card bg-surface", padded && "p-5 sm:p-6", className)} {...rest} />;
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
