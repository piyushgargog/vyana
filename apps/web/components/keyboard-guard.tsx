"use client";

import { useEffect } from "react";

/** The on-screen keyboard counts as open when it takes at least this many px of the layout viewport. */
const KEYBOARD_MIN_PX = 150;
const TEXT_FIELD = "input, textarea, select, [contenteditable='true']";

/**
 * Keeps the field you are typing in above the phone keyboard. It marks `<html data-keyboard="open">` while the keyboard
 * is up (the floating tab bar hides then, see globals.css) and scrolls the focused field into view once the keyboard
 * has finished opening. Renders nothing.
 */
export function KeyboardGuard() {
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
