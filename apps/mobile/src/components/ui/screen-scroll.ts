/**
 * A small registry of "scroll this screen to the top" functions, keyed by pathname (#487).
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
