import { describe, expect, it, vi } from 'vitest';

import {
  HEADER_COLLAPSE_OFFSET,
  isHeaderCollapsed,
  registerScreenScroll,
  scrollScreenToTop,
} from './screen-scroll';

/**
 * The `Screen` frame's scroll rules (#487): the registry the tab bar uses to scroll a re-tapped
 * tab's root to the top, and the collapse rule both scroll handlers share. These are the parts
 * of the frame that decide behaviour on every screen, so they are proven here — the registry is
 * module-level state, so each test registers under its own pathname to stay isolated.
 */
describe('registerScreenScroll / scrollScreenToTop — the tab re-tap registry (#487)', () => {
  it('does nothing for a pathname no screen has registered', () => {
    expect(() => scrollScreenToTop('/never-registered')).not.toThrow();
  });

  it('scrolls the screen registered for the pathname', () => {
    const scrollToTop = vi.fn();
    const unregister = registerScreenScroll('/today-a', scrollToTop);

    scrollScreenToTop('/today-a');

    expect(scrollToTop).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('does not scroll a different screen', () => {
    const scrollToTop = vi.fn();
    const unregister = registerScreenScroll('/today-b', scrollToTop);

    scrollScreenToTop('/somewhere-else');

    expect(scrollToTop).not.toHaveBeenCalled();
    unregister();
  });

  it('stops scrolling a screen once it unregisters (unmount)', () => {
    const scrollToTop = vi.fn();
    const unregister = registerScreenScroll('/today-c', scrollToTop);
    unregister();

    scrollScreenToTop('/today-c');

    expect(scrollToTop).not.toHaveBeenCalled();
  });

  it('a re-registration replaces the previous function for the pathname', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerScreenScroll('/today-d', first);
    const unregisterSecond = registerScreenScroll('/today-d', second);

    scrollScreenToTop('/today-d');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unregisterFirst();
    unregisterSecond();
  });

  it('unregistering a replaced function keeps the current registration', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerScreenScroll('/today-e', first);
    const unregisterSecond = registerScreenScroll('/today-e', second);

    // The replaced screen unmounts late: its cleanup must not evict the current screen.
    unregisterFirst();
    scrollScreenToTop('/today-e');

    expect(second).toHaveBeenCalledTimes(1);
    unregisterSecond();
  });
});

describe('isHeaderCollapsed — the large-title collapse rule (#487)', () => {
  it('pins the collapse offset the top bar fade also ends at', () => {
    expect(HEADER_COLLAPSE_OFFSET).toBe(40);
  });

  it('is not collapsed at the top or while bouncing above it', () => {
    expect(isHeaderCollapsed(0)).toBe(false);
    expect(isHeaderCollapsed(-20)).toBe(false);
  });

  it('is not collapsed at exactly the offset — the scroll must pass it', () => {
    expect(isHeaderCollapsed(HEADER_COLLAPSE_OFFSET)).toBe(false);
  });

  it('is collapsed once past the offset', () => {
    expect(isHeaderCollapsed(HEADER_COLLAPSE_OFFSET + 1)).toBe(true);
    expect(isHeaderCollapsed(400)).toBe(true);
  });
});
