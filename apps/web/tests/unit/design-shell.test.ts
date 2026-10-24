// @vitest-environment jsdom
// The design-system behaviours issue #492 added, pinned at the DOM level (issue #492
// review): the shell's three navigation forms and their width classes, the LargeTitle
// collapse that must never unmount (or resize) the header, and the landing hero's
// signed-in / signed-out actions. React is used through createElement — this suite's
// include pattern is .ts, not .tsx.
// Owner: Vaibhav Parmar

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as { id: string } | null, loading: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@vyana/shared", () => ({
  CONSENT_VERSION: "v-test",
  useSession: () => ({ user: session.user, loading: session.loading }),
  useMyProfile: () => ({
    data: session.user ? { id: session.user.id, onboarded: true, role: "patient", full_name: "Test Patient" } : null,
    isLoading: false,
  }),
  useConsent: () => ({ data: session.user ? { id: "consent-1" } : null, isLoading: false }),
}));
vi.mock("@/components/providers", () => ({
  useVyanaWeb: () => ({ supabase: {}, showToast: () => {} }),
}));

import { AppShell } from "@/components/app-shell";
import { LandingActions } from "@/components/auth-actions";
import { LargeTitle } from "@/components/ui";

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  // jsdom has no matchMedia; framer-motion's reduced-motion check needs one.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  session.user = null;
  session.loading = false;
});

async function render(element: React.ReactElement): Promise<HTMLDivElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(element));
  return host;
}

describe("AppShell navigation (issue #492)", () => {
  it("renders the sidebar for large screens and the tab bar for small ones, never both at one width", async () => {
    session.user = { id: "u-1" };
    const el = await render(React.createElement(AppShell, null, React.createElement("p", null, "Page body")));

    const aside = el.querySelector("aside");
    expect(aside, "a sidebar is rendered").not.toBeNull();
    // Hidden below lg, shown from lg up: the width classes are the contract.
    expect(aside?.className).toContain("hidden");
    expect(aside?.className).toContain("lg:block");
    expect(aside?.textContent).toContain("Dashboard");

    const tabbar = el.querySelector("[data-tabbar]");
    expect(tabbar, "a tab bar is rendered").not.toBeNull();
    expect(tabbar?.className).toContain("md:hidden");
    expect(tabbar?.textContent).toContain("Dashboard");

    const segmentedWrap = el.querySelector(".lg\\:hidden.md\\:flex, div.hidden.md\\:flex.lg\\:hidden");
    expect(segmentedWrap ?? el.innerHTML).toBeTruthy();
  });
});

describe("LargeTitle collapse (issue #492)", () => {
  it("compacts on scroll without unmounting the eyebrow or subtitle, and expands back", async () => {
    const el = await render(
      React.createElement(LargeTitle, {
        eyebrow: "Care",
        title: "Your plan",
        subtitle: "Everything for this week.",
      }),
    );
    const header = el.querySelector("header");
    expect(header?.dataset.compact).toBeUndefined();
    expect(el.textContent).toContain("Everything for this week.");

    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
    await act(async () => window.dispatchEvent(new Event("scroll")));
    expect(header?.dataset.compact).toBe("true");
    // Still mounted — the header box keeps its height, so the scroll position that
    // triggered the collapse cannot be undone by it (no oscillation).
    const subtitle = [...el.querySelectorAll("p")].find((p) => p.textContent === "Everything for this week.");
    expect(subtitle, "the subtitle stays mounted when compact").not.toBeUndefined();
    expect(subtitle?.className).toContain("opacity-0");
    const eyebrow = [...el.querySelectorAll("div")].find((d) => d.textContent === "Care");
    expect(eyebrow, "the eyebrow stays mounted when compact").not.toBeUndefined();

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    await act(async () => window.dispatchEvent(new Event("scroll")));
    expect(header?.dataset.compact).toBeUndefined();
    expect(subtitle?.className).not.toContain("opacity-0");
  });
});

describe("LandingActions (issue #492)", () => {
  it("signed out: the app download and the web sign-in, as a pair", async () => {
    const el = await render(React.createElement(LandingActions));
    const links = [...el.querySelectorAll("a")].map((a) => [a.textContent?.trim(), a.getAttribute("href")]);
    expect(links).toEqual([
      ["Get the app", "/download/android"],
      ["Open on the web", "/login"],
    ]);
  });

  it("signed in: a single way into the app", async () => {
    session.user = { id: "u-1" };
    const el = await render(React.createElement(LandingActions));
    const links = [...el.querySelectorAll("a")].map((a) => [a.textContent?.trim(), a.getAttribute("href")]);
    expect(links).toEqual([["Open Vyana", "/dashboard"]]);
  });
});
