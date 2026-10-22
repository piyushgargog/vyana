"use client";

import { useEffect } from "react";

/** The on-screen keyboard counts as open when it takes at least this many px of the layout viewport. */
const KEYBOARD_MIN_PX = 150;
const TEXT_FIELD = "input, textarea, select, [contenteditable='true']";

/** The viewport key that makes the page shrink when the phone keyboard opens (#245). */
const INTERACTIVE_WIDGET = "interactive-widget=resizes-content";

/**
 * Only Chromium understands the `interactive-widget` viewport key. `navigator.userAgentData` is the tell: it
 * exists in Chromium browsers (Chrome, Edge, Samsung Internet, the Android WebView) and nowhere else — Safari
 * and Firefox do not ship it, and Chrome on iOS is WebKit underneath and does not have it either.
 */
export function supportsInteractiveWidget(nav: Navigator): boolean {
  return (nav as Navigator & { userAgentData?: unknown }).userAgentData !== undefined;
}

/** Adds the `interactive-widget` key to a viewport meta content string, once. */
export function withInteractiveWidget(content: string): string {
  if (content.includes("interactive-widget")) return content;
  return content ? `${content}, ${INTERACTIVE_WIDGET}` : INTERACTIVE_WIDGET;
}

/**
 * Keeps the field you are typing in above the phone keyboard. It marks `<html data-keyboard="open">` while the keyboard
 * is up (the floating tab bar hides then, see globals.css) and scrolls the focused field into view once the keyboard
 * has finished opening. Renders nothing.
 */
export function KeyboardGuard() {
  // #245's keyboard behaviour, for the one engine that has it: the `interactive-widget` key cannot sit in the
  // static viewport meta tag, because WebKit logs the key it does not know as a console error on every page
  // load (#362). Chromium re-reads the meta tag when its content changes, so adding the key here, before the
  // user can open a keyboard, has the same effect.
  useEffect(() => {
    if (!supportsInteractiveWidget(navigator)) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.content;
    meta.content = withInteractiveWidget(original);
    return () => {
      meta.content = original;
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      const covered = vv ? window.innerHeight - vv.height : 0;
      if (covered > KEYBOARD_MIN_PX) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
    };

    const reveal = () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.matches(TEXT_FIELD)) el.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLElement) || !e.target.matches(TEXT_FIELD)) return;
      clearTimeout(timer);
      // The keyboard animates in for about 300 ms; scrolling before it ends measures the wrong height.
      timer = setTimeout(reveal, 350);
    };

    const onResize = () => {
      sync();
      if (root.dataset.keyboard === "open") reveal();
    };

    sync();
    vv?.addEventListener("resize", onResize);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      clearTimeout(timer);
      vv?.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocusIn);
      delete root.dataset.keyboard;
    };
  }, []);

  return null;
}
