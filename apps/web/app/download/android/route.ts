import { NextResponse } from "next/server";

const REPO = "piyushgargog/vyana";
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

/**
 * Sends the visitor to the newest Android build (the .apk attached to the latest GitHub release), so the link on the
 * website never goes stale when a new version ships. If GitHub cannot be reached, or no build is attached yet, it falls
 * back to the release page.
 */
export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const release = (await res.json()) as { assets?: { name?: string; browser_download_url?: string }[] };
      const apk = release.assets?.find((a) => a.name?.endsWith(".apk") && a.browser_download_url?.startsWith(`https://github.com/${REPO}/`));
      if (apk?.browser_download_url) return NextResponse.redirect(apk.browser_download_url, 302);
    }
  } catch {
    // fall through to the release page
  }
  return NextResponse.redirect(RELEASES_PAGE, 302);
}
