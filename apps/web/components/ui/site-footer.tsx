import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { cn } from "./cn";

const COLUMNS: {
  title: string;
  links: { label: string; href: string; tone?: "danger" }[];
}[] = [
  {
    title: "Vyana",
    links: [
      { label: "Features", href: "/#features" },
      { label: "For doctors", href: "/#doctors" },
      { label: "Plans", href: "/plans" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Contact us", href: "mailto:piyushgarg@vyanahealth.app" },
    ],
  },
  {
    title: "In an emergency",
    links: [
      { label: "Call 108 for an ambulance", href: "tel:108", tone: "danger" },
      { label: "Call 112", href: "tel:112", tone: "danger" },
    ],
  },
];

function FooterLink({
  label,
  href,
  tone,
}: {
  label: string;
  href: string;
  tone?: "danger";
}) {
  const cls = cn(
    "text-[13px] transition-colors",
    tone === "danger"
      ? "font-medium text-danger-text hover:text-danger"
      : "text-label-2 hover:text-label",
  );
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {label}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {label}
    </a>
  );
}

/**
 * The site footer (ADR-066): a quiet Apple-style footer. The brand on the left, three short link columns, the
 * medical note as fine print, and one line of credit. `withTabBar` leaves room for the phone tab bar.
 */
export function SiteFooter({ withTabBar = false }: { withTabBar?: boolean }) {
  return (
    <footer
      className={cn(
        "mt-auto border-t border-separator bg-canvas",
        withTabBar && "pb-24 md:pb-0",
      )}
    >
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 self-start rounded-full"
            >
              <BrandMark size={28} />
              <span className="text-[17px] font-semibold tracking-tight text-label">
                Vyana
              </span>
            </Link>
            <p className="text-[15px] leading-relaxed text-label-2">
              Your health, in one calm place.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3"
          >
            {COLUMNS.map((col) => (
              <div
                key={col.title}
                className={cn(
                  "flex flex-col gap-2.5",
                  col.title === "In an emergency" && "col-span-2 sm:col-span-1",
                )}
              >
                <h2 className="text-[13px] font-semibold text-label">
                  {col.title}
                </h2>
                {col.links.map((l) => (
                  <FooterLink key={l.label} {...l} />
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 border-t border-separator pt-5">
          <p className="max-w-3xl text-[12px] leading-relaxed text-label-3">
            Vyana helps you keep track of your health. It is not a substitute
            for a doctor: please check AI summaries and medicine information
            with your doctor or pharmacist before acting on them.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-1.5 text-[12px] text-label-3 sm:flex-row sm:justify-between">
          <p>© 2026 Vyana</p>
          <p>
            Made with care in India, for patients and the families who look
            after them.
          </p>
        </div>
      </div>
    </footer>
  );
}
