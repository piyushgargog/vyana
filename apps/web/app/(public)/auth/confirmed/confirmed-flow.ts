export type ConfirmationDestination =
  | { href: "/consent"; label: "Continue to DPDP consent" }
  | { href: "/login"; label: "Sign in to continue" };

/** Supabase puts a failed confirmation's error in the query or the URL fragment. */
export function confirmationLinkError(currentUrl: string): string | null {
  try {
    const url = new URL(currentUrl);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    return (
      fragment.get("error_description") ||
      fragment.get("error_code") ||
      fragment.get("error") ||
      url.searchParams.get("error_description") ||
      url.searchParams.get("error_code") ||
      url.searchParams.get("error")
    );
  } catch {
    return null;
  }
}

export function confirmationDestination(
  hasSession: boolean,
): ConfirmationDestination {
  return hasSession
    ? { href: "/consent", label: "Continue to DPDP consent" }
    : { href: "/login", label: "Sign in to continue" };
}
