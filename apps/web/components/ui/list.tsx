import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** A Settings-style group: optional header above, white rounded group, optional footer below. */
export function ListGroup({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {header ? <div className="px-4 text-[13px] font-semibold uppercase tracking-wide text-label-3">{header}</div> : null}
      <ul className="overflow-hidden rounded-tile bg-surface [&>li+li]:border-t [&>li+li]:border-separator">{children}</ul>
      {footer ? <div className="px-4 text-[13px] leading-snug text-label-3">{footer}</div> : null}
    </div>
  );
}

const TILES = {
  accent: "bg-accent",
  blue: "bg-[#007aff]",
  green: "bg-[#34c759]",
  orange: "bg-[#ff9500]",
  red: "bg-danger",
  gray: "bg-[#8e8e93]",
  indigo: "bg-[#5856d6]",
} as const;
export type TileColor = keyof typeof TILES;

/** The coloured 30 px icon tile used in list rows (iOS Settings). */
export function IconTile({ color = "accent", children }: { color?: TileColor; children: ReactNode }) {
  return (
    <span aria-hidden="true" className={cn("flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white [&>svg]:h-4 [&>svg]:w-4", TILES[color])}>
      {children}
    </span>
  );
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  iconColor?: TileColor;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  className?: string;
}

/** One row of a ListGroup. A row with `href` or `onClick` gets a chevron and a pressed state. */
export function ListRow({ title, subtitle, value, icon, iconColor, href, onClick, trailing, className }: RowProps) {
  const body = (
    <>
      {icon ? <IconTile color={iconColor}>{icon}</IconTile> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] text-label">{title}</span>
        {subtitle ? <span className="block truncate text-[13px] text-label-3">{subtitle}</span> : null}
      </span>
      {value ? <span className="shrink-0 text-[15px] text-label-3">{value}</span> : null}
      {trailing}
      {href || onClick ? <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-label-3/60" /> : null}
    </>
  );
  const cls = cn("flex min-h-[48px] w-full items-center gap-3 px-4 py-2.5 text-left", (href || onClick) && "transition-colors active:bg-fill hover:bg-canvas/70", className);
  if (href) {
    return (
      <li>
        {href.startsWith("/") ? (
          <Link href={href} className={cls}>
            {body}
          </Link>
        ) : (
          <a href={href} className={cls}>
            {body}
          </a>
        )}
      </li>
    );
  }
  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      </li>
    );
  }
  return (
    <li>
      <div className={cls}>{body}</div>
    </li>
  );
}
