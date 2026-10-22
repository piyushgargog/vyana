import type { MetadataRoute } from "next";

const SITE_URL = "https://vyanahealth.app";

/** Public pages only — every signed-in route stays out of the sitemap (and is disallowed in robots.ts). */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
  }));
}
