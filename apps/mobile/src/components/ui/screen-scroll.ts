/**
 * The `Screen` frame's scroll rules and its "scroll to top" registry (#487).
 *
 * This module is pure TypeScript on purpose: the frame's scroll behaviour can be unit-tested
 * without React Native, so the parts that decide how every screen scrolls and collapses are
 * proven here rather than only on a device.
 */

/** Scroll distance (points) after which a screen's large title has collapsed into the slim bar. */
export const HEADER_COLLAPSE_OFFSET = 40;

/**
 * The collapse rule both scroll handlers use (`Screen`'s own and Timeline's list): the large
 * title is collapsed once the content has scrolled strictly past `HEADER_COLLAPSE_OFFSET` —
 * at exactly the offset it has not collapsed yet, so the title swap and the top bar's fade
 * (which ends at the same offset) never disagree.
 */
export function isHeaderCollapsed(scrollY: number): boolean {
  return scrollY > HEADER_COLLAPSE_OFFSET;
}

/**
 * A small registry of "scroll this screen to the top" functions, keyed by pathname.
 *
 * `Screen` registers its scroll view here while it is mounted. The tab bar cannot reach into a
 * tab's scroll view itself, so on a re-tap of the already-selected tab the tabs layout asks the
 * registry to scroll that tab's root to the top — the native behaviour on iOS, brought to both
 * platforms the same way.
 */
const registry = new Map<string, () => void>();

/** Register `scrollToTop` for `pathname`; returns the unregister function. */
export function registerScreenScroll(pathname: string, scrollToTop: () => void): () => void {
  registry.set(pathname, scrollToTop);
  return () => {
    if (registry.get(pathname) === scrollToTop) {
      registry.delete(pathname);
    }
  };
}

/** Scroll the screen registered for `pathname` to the top, if it is mounted. */
export function scrollScreenToTop(pathname: string): void {
  registry.get(pathname)?.();
}
