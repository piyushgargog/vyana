import Link from "next/link";
import { Heart } from "lucide-react";
import pkg from "../../package.json";

const REPO = "https://github.com/piyushgargog/vyana";

/** The AI providers the app can use (ADR-056); shown as plain chips, never as an endorsement. */
const PROVIDERS = ["Groq", "NVIDIA", "TinyFish"];

/**
 * The site footer (DocuLens-style, ADR-066): credit on the left, the services we use in the middle, links and the
 * version on the right, and the medical note under them. Same on every page.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-separator bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-[13px] text-label-3 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-1.5">
          Made with <Heart aria-label="love" className="h-3.5 w-3.5 fill-danger text-danger" /> by the Vyana team
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Services Vyana uses">
          <span className="text-[11px] font-semibold uppercase tracking-wide">Built with</span>
          {PROVIDERS.map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent/70" />
              {p}
            </span>
          ))}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={REPO} className="text-label-2 hover:text-label">
            GitHub
          </a>
          <a href={`${REPO}/releases`} className="text-label-2 hover:text-label">
            Releases
          </a>
          <a href={`${REPO}/issues`} className="text-label-2 hover:text-label">
            Issues
          </a>
          <Link href="/privacy" className="text-label-2 hover:text-label">
            Privacy
          </Link>
          <Link href="/terms" className="text-label-2 hover:text-label">
            Terms
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border border-separator bg-surface px-2.5 py-0.5 text-[12px] font-semibold text-label-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ok" />v{pkg.version}
          </span>
        </nav>
      </div>
      <div className="border-t border-separator">
        <p className="mx-auto max-w-6xl px-4 py-3 text-[12px] leading-relaxed text-label-3">
          Vyana is not a substitute for a doctor. Check AI summaries and medicine information with your doctor. In an emergency call{" "}
          <a href="tel:108" className="font-semibold text-danger-text">
            108
          </a>{" "}
          or{" "}
          <a href="tel:112" className="font-semibold text-danger-text">
            112
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
