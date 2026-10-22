import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as loginMetadata } from "@/app/(public)/login/page";
import { metadata as signupMetadata } from "@/app/(public)/signup/page";
import { metadata as privacyMetadata } from "@/app/(public)/privacy/page";
import { metadata as termsMetadata } from "@/app/(public)/terms/page";

const PUBLIC_URLS = [
  "https://vyanahealth.app/",
  "https://vyanahealth.app/login",
  "https://vyanahealth.app/signup",
  "https://vyanahealth.app/privacy",
  "https://vyanahealth.app/terms",
];

describe("sitemap", () => {
  it("lists exactly the public pages", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual(PUBLIC_URLS);
  });
});

describe("robots", () => {
  it("allows the public pages, blocks the app and /api/, and names the sitemap", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://vyanahealth.app/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toEqual(["/", "/login", "/signup", "/privacy", "/terms"]);
    expect(rules?.disallow).toContain("/api/");
    expect(rules?.disallow).toContain("/dashboard");
    expect(rules?.disallow).toContain("/share/");
  });
});

describe("canonicals", () => {
  it("every public page declares its own canonical path", () => {
    expect(homeMetadata.alternates?.canonical).toBe("/");
    expect(loginMetadata.alternates?.canonical).toBe("/login");
    expect(signupMetadata.alternates?.canonical).toBe("/signup");
    expect(privacyMetadata.alternates?.canonical).toBe("/privacy");
    expect(termsMetadata.alternates?.canonical).toBe("/terms");
  });
});
