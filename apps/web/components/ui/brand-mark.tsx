/**
 * The Vyana mark (ADR-066): an iOS-style teal squircle with one white line that rises, dips into a soft "V" like
 * a pulse, and rises again. This component is the master shape; the favicon, app icons and link preview are
 * exported from the same path (#134).
 */
export const BRAND_MARK_PATH = "M4.5 12.5h3l2-4.5 2.5 9 2.5-9 2 4.5h3";

export function BrandMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="24" height="24" rx="5.4" fill="#0D9488" />
      <path d={BRAND_MARK_PATH} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
