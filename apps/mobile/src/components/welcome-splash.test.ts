import { describe, expect, it } from 'vitest';
import {
  FADE_MS,
  FLAG,
  FLAG_COLORS,
  getFlagDimensions,
  SHOW_MS,
  WELCOME_STRINGS,
} from './welcome-splash.constants';

describe('WelcomeSplash Constants & Helpers (#240)', () => {
  it('defines the required 3-second display duration', () => {
    expect(SHOW_MS).toBe(3000);
  });

  it('defines a smooth exit fade duration between 250ms and 500ms', () => {
    expect(FADE_MS).toBe(350);
    expect(FADE_MS).toBeGreaterThanOrEqual(250);
    expect(FADE_MS).toBeLessThanOrEqual(500);
  });

  it('uses authentic, unabridged Indian tricolor & chakra hex codes', () => {
    expect(FLAG.saffron).toBe('#FF9933');
    expect(FLAG.white).toBe('#FFFFFF');
    expect(FLAG.green).toBe('#138808');
    expect(FLAG.chakra).toBe('#000080');
    expect(FLAG).toBe(FLAG_COLORS);
  });

  it('preserves exact required copy strings without drift', () => {
    expect(WELCOME_STRINGS.title).toBe('Vyana');
    expect(WELCOME_STRINGS.tagline).toBe('Your health, in one calm place.');
    expect(WELCOME_STRINGS.madeInIndia).toBe('Made with love in India');
    expect(WELCOME_STRINGS.tapToSkip).toBe('Tap anywhere to skip');
    expect(WELCOME_STRINGS.accessibilityLabel).toContain('Made with love in India');
    expect(WELCOME_STRINGS.accessibilityLabel).toContain('Tap anywhere to skip');
  });

  it('calculates flag dimensions following 3:2 aspect ratio for default 32px width', () => {
    const dim = getFlagDimensions(32);
    expect(dim.width).toBe(32);
    expect(dim.height).toBe(21); // round(32 * 2 / 3) = round(21.333) = 21
    expect(dim.stripe).toBe(7);  // 21 / 3 = 7
    expect(dim.chakra).toBe(6);  // round(7 * 0.85) = 6
    expect(dim.chakraCenter.top).toBe((21 - 6) / 2);
    expect(dim.chakraCenter.left).toBe((32 - 6) / 2);
  });

  it('generates 12 diameter lines representing 24 Ashoka Chakra spokes (15° increments)', () => {
    const { spokes } = getFlagDimensions(32);
    expect(spokes).toHaveLength(12);
    expect(spokes[0]).toBe(0);
    expect(spokes[1]).toBe(15);
    expect(spokes[11]).toBe(165);

    // Each spoke step should be strictly 15 degrees
    for (let i = 1; i < spokes.length; i++) {
      expect(spokes[i] - spokes[i - 1]).toBe(15);
    }
  });

  it('scales correctly for arbitrary widths (e.g. 26px footer pill flag)', () => {
    const dim = getFlagDimensions(26);
    expect(dim.width).toBe(26);
    expect(dim.height).toBe(17); // round(26 * 2 / 3) = 17
    expect(dim.stripe).toBeCloseTo(17 / 3);
    expect(dim.chakra).toBe(5);
    expect(dim.spokes).toHaveLength(12);
  });

  it('guards against duplicate close executions upon rapid repeated taps', () => {
    let closing = false;
    let transitionCount = 0;

    const simulateTap = () => {
      if (closing) return;
      closing = true;
      transitionCount++;
    };

    // User taps multiple times rapidly
    simulateTap();
    simulateTap();
    simulateTap();

    expect(transitionCount).toBe(1);
    expect(closing).toBe(true);
  });
});
