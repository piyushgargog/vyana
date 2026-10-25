"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";

/**
 * The page's large title (iOS style), with an optional line above and actions on the right.
 * It collapses as the page scrolls (issue #492): past a small scroll the eyebrow and
 * subtitle go and the title steps down to Title 2, so the chrome takes less of the screen.
 */
export function LargeTitle({ eyebrow, title, subtitle, actions, className }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // The eyebrow and subtitle stay mounted and only cross-fade, and the title's box keeps
  // the large-title height: the header's height never changes as it compacts, so the
  // scroll position that triggers the change cannot be undone by the change itself
  // (the unmount-and-shrink version oscillated on barely-tall pages). The title size
  // swaps without a transition — animating font-size is layout work on every frame.
  return (
    <header data-compact={compact || undefined} className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div aria-hidden={compact || undefined} className={cn("text-subheadline text-label-3 transition-[opacity,visibility] duration-200 motion-reduce:transition-none", compact && "invisible opacity-0")}>
            {eyebrow}
          </div>
        ) : null}
        <div className="mt-1 flex min-h-[2.5625rem] items-center">
          <h1 className={cn("text-label", compact ? "text-title-2" : "text-large-title")}>{title}</h1>
        </div>
        {subtitle ? (
          <p aria-hidden={compact || undefined} className={cn("mt-2 max-w-2xl text-body leading-relaxed text-label-2 transition-[opacity,visibility] duration-200 motion-reduce:transition-none", compact && "invisible opacity-0")}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Segmented section navigation (web top bar). `items` link to routes; the current one is highlighted. */
export function SegmentedNav({ items, current, label = "Sections" }: { items: { href: string; label: string }[]; current: string; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 rounded-full bg-fill p-1">
      {items.map((it) => {
        const active = current === it.href || (it.href !== "/" && current.startsWith(`${it.href}/`));
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-[14px] transition-colors",
              active ? "bg-surface font-semibold text-label shadow-[0_1px_4px_rgb(0_0_0/0.08)]" : "text-label-2 hover:text-label",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** An empty state: a soft icon, one line of title, one of help, and at most one action. */
export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      {icon ? <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent [&>svg]:h-7 [&>svg]:w-7">{icon}</span> : null}
      <p className="text-[17px] font-semibold text-label">{title}</p>
      {body ? <p className="max-w-sm text-[15px] leading-relaxed text-label-3">{body}</p> : null}
      {action}
    </div>
  );
}

/** A calm error state: soft neutral icon, calm title/body, and a "Try again" action (Issue #139). */
export function ErrorState({
  title = "Couldn't load this",
  body = "Check your connection or try again.",
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title?: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <EmptyState
      icon={
        <svg aria-hidden="true" className="h-7 w-7 text-label-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      }
      title={title}
      body={body}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
            {retryLabel}
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}

/** Fades and lifts its children in once (lists, cards). Off when the user asks for reduced motion. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 30, delay }}>
      {children}
    </motion.div>
  );
}

/**
 * The scroll-triggered variant, for the public landing page only (issue #492). App
 * screens use `Reveal`: content there can arrive after an async load, and a whileInView
 * trigger could leave it invisible until it scrolls — the landing sections are static
 * and below the fold by design, which is the one place scroll-reveal belongs.
 */
export function RevealOnScroll({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 260, damping: 30, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A grey placeholder bar while data loads. */
export function SkeletonLine({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block h-4 animate-pulse rounded-full bg-fill-strong", className)} />;
}
