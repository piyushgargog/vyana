"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

const CONTROL =
  "w-full rounded-row border border-transparent bg-fill px-4 text-[17px] text-label placeholder:text-label-3 " +
  "outline-none transition-colors focus:border-accent focus:bg-surface aria-[invalid=true]:border-danger";

interface FieldShell {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

function Shell({ id, label, hint, error, className, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="px-1 text-[15px] font-medium text-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="px-1 text-[13px] text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="px-1 text-[13px] text-label-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled text input. Every input has a visible label (no placeholder-only fields). */
export function Field({ label, hint, error, className, id, ...rest }: FieldShell & ComponentProps<"input">) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <input id={fid} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined} className={cn(CONTROL, "h-12")} {...rest} />
    </Shell>
  );
}

/** A labelled select. */
export function SelectField({ label, hint, error, className, id, children, ...rest }: FieldShell & ComponentProps<"select">) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <select id={fid} aria-invalid={error ? true : undefined} className={cn(CONTROL, "h-12 appearance-none")} {...rest}>
        {children}
      </select>
    </Shell>
  );
}

/** A labelled multi-line input. */
export function TextAreaField({ label, hint, error, className, id, ...rest }: FieldShell & ComponentProps<"textarea">) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} className={className}>
      <textarea id={fid} aria-invalid={error ? true : undefined} className={cn(CONTROL, "min-h-28 py-3")} {...rest} />
    </Shell>
  );
}
