import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "plain" | "destructive" | "glass";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-accent hover:bg-accent-strong",
  secondary: "bg-surface text-accent-strong border border-separator hover:bg-canvas",
  plain: "text-accent-strong hover:bg-accent-soft",
  destructive: "bg-danger-soft text-danger-text hover:bg-danger/15",
  glass: "glass text-label hover:bg-white/80",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[15px]",
  md: "h-11 px-5 text-[17px]",
  lg: "h-[52px] px-7 text-[17px]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none " +
  "transition-[transform,background-color,box-shadow] duration-150 ease-out active:scale-[0.97] " +
  "disabled:opacity-40 disabled:pointer-events-none";

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** A pill button (one primary per screen). */
export function Button({ variant = "primary", size = "md", icon, className, children, type = "button", ...rest }: Common & ComponentProps<"button">) {
  return (
    <button type={type} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** The same pill as a link (internal routes use Next's Link, `tel:` / `mailto:` / external a plain anchor; `native` forces a plain anchor for a route that is not a page, such as a download). */
export function ButtonLink({ variant = "primary", size = "md", icon, className, children, href, native, ...rest }: Common & Omit<ComponentProps<"a">, "href"> & { href: string; native?: boolean }) {
  const cls = cn(BASE, VARIANTS[variant], SIZES[size], className);
  if (href.startsWith("/") && !native) {
    return (
      <Link href={href} className={cls} {...rest}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} {...rest}>
      {icon}
      {children}
    </a>
  );
}

const ICON_SIZES: Record<Size, string> = {
  sm: "h-9 w-9 p-0",
  md: "h-11 w-11 p-0",
  lg: "h-[52px] w-[52px] p-0",
};

export type IconButtonProps = {
  label: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
  href?: string;
} & Omit<ComponentProps<"button"> & ComponentProps<"a">, "href" | "type"> & {
  type?: "button" | "submit" | "reset";
};

/** A round icon-only button or link; `label` is required for screen readers. */
export function IconButton({ label, variant = "glass", size = "md", className, children, href, ...rest }: IconButtonProps) {
  const cls = cn(BASE, VARIANTS[variant], ICON_SIZES[size], className);
  if (href) {
    const linkRest = rest as Record<string, unknown>;
    if (href.startsWith("/")) {
      return (
        <Link href={href} aria-label={label} title={label} className={cls} {...linkRest}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} aria-label={label} title={label} className={cls} {...linkRest}>
        {children}
      </a>
    );
  }
  const { type = "button", ...buttonRest } = rest as ComponentProps<"button">;
  return (
    <button type={type} aria-label={label} title={label} className={cls} {...buttonRest}>
      {children}
    </button>
  );
}
