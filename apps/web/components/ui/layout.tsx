"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";

/** The page's large title (iOS style), with an optional line above and actions on the right. */
export function LargeTitle({ eyebrow, title, subtitle, actions, className }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="text-[15px] text-label-3">{eyebrow}</div> : null}
        <h1 className="mt-1 text-[32px] font-bold leading-tight tracking-[-0.03em] text-label sm:text-[40px]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-label-2">{subtitle}</p> : null}
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
          <Button variant="secondary" size="md" onClick={onRetry} className="mt-1">
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

/** A grey placeholder bar while data loads. */
export function SkeletonLine({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block h-4 animate-pulse rounded-full bg-fill-strong", className)} />;
}
