import type { MetadataRoute } from "next";

const SITE_URL = "https://vyanahealth.app";

/** The signed-in app (the `(app)` route group) — none of it belongs in a search index. */
const APP_PATHS = [
  "/admin",
  "/appointments",
  "/assistant",
  "/basket",
  "/blood",
  "/care",
  "/consent",
  "/dashboard",
  "/doctor",
  "/onboarding",
  "/prescriptions",
  "/reports",
  "/sos",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup", "/privacy", "/terms"],
      // /share/ pages are token links to a person's medical record — never crawlable.
      disallow: ["/api/", "/share/", ...APP_PATHS],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
