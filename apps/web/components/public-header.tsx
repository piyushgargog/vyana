import React from "react";
import Link from "next/link";
import { AuthActions } from "@/components/auth-actions";
import { BrandMark, IconButton } from "@/components/ui";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export interface PublicHeaderProps {
  navLinks?: { label: string; href: string }[];
}

/**
 * Shared public header (Issue #140): glass header.
 * - BrandMark and "Vyana" on the left
 * - Optional middle section navigation links on desktop (e.g. for homepage)
 * - Right side: "Sign in" (secondary pill), "Get started" (primary pill), and accessible GitHub IconButton
 * - Glass bar when scrolling, stacks cleanly at 360px
 */
export function PublicHeader({ navLinks }: PublicHeaderProps) {
  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-separator">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <BrandMark size={30} />
          <span className="text-[17px] font-semibold tracking-tight text-label">
            Vyana
          </span>
        </Link>

        {navLinks && navLinks.length > 0 && (
          <nav
            aria-label="Section navigation"
            className="hidden md:flex items-center gap-6 text-[15px] font-medium text-label-2"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-label"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <AuthActions />
          <IconButton
            href="https://github.com/piyushgargog/vyana"
            label="GitHub"
            variant="glass"
            size="sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
