/**
 * Pure constants and geometric helpers for the Mobile Welcome Splash Screen (#240).
 *
 * This file has ZERO React Native dependencies to allow fast, isolated unit testing
 * across node/vitest environments without native mocks or polyfills.
 */

/** How long the welcome splash stays visible before automatic transition (2.5 seconds at the latest, #488). */
export const SHOW_MS = 2500;

/** Duration of the entrance fade (and scale, unless Reduce Motion is on) in milliseconds (#488). */
export const ENTER_MS = 600;

/** Duration of the exit fade animation in milliseconds. */
export const FADE_MS = 350;

/**
 * Official colors of the Indian National Flag:
 * - Kesari (Saffron): strength and courage
 * - White: peace and truth
 * - India Green: fertility, growth and auspiciousness of the land
 * - Navy Blue: Ashoka Chakra representing the eternal wheel of law (Dharma)
 */
export const FLAG_COLORS = {
  saffron: '#FF9933',
  white: '#FFFFFF',
  green: '#138808',
  chakra: '#000080',
} as const;

/** Alias for brevity and backwards-compatibility. */
export const FLAG = FLAG_COLORS;

/** Exact required copy strings for the welcome screen. */
export const WELCOME_STRINGS = {
  title: 'Vyana',
  tagline: 'Your health, in one calm place.',
  madeInIndia: 'Made with love in India',
  tapToSkip: 'Tap anywhere to skip',
  // What the screen actually shows (#488): the brand mark, the name and the
  // tagline. "Made with love in India" and the tap-to-skip words are not on
  // the welcome screen any more, so the label no longer announces them.
  accessibilityLabel: 'Vyana. Your health, in one calm place.',
} as const;

/**
 * The bands of the welcome hero gradient, top to bottom, as `#RRGGBB` colours between
 * `from` and `to`. The app ships no gradient library (the flag and the rings are drawn
 * with views too), so the splash stacks these bands; at 32 the step between neighbours
 * is too small to see. The interpolation deepens quickly (a square-root curve), so the
 * name and tagline in the middle of the screen already sit on the deep end, where white
 * words keep their contrast. Only `#RRGGBB` inputs are supported — that is all the
 * theme's accent tokens use.
 */
export function gradientBands(from: string, to: string, count = 32): string[] {
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const a = parse(from);
  const b = parse(to);
  const channel = (v: number) =>
    Math.round(v)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 1 : Math.sqrt(i / (count - 1));
    const rgb = a.map((v, c) => v + (b[c] - v) * t);
    return `#${rgb.map(channel).join('')}`;
  });
}

/**
 * Calculate dimensions and 24-spoke wheel geometry for the India flag.
 *
 * Flag ratio in India is 3:2 (width:height).
 * The Ashoka Chakra sits centered in the white stripe.
 * 12 diameter lines rotated in steps of 15° (12 × 15° = 180°) render the 24 radial spokes.
 */
export function getFlagDimensions(width = 32) {
  const height = Math.round((width * 2) / 3);
  const stripe = height / 3;
  const chakra = Math.round(stripe * 0.85);
  const spokes = Array.from({ length: 12 }, (_, i) => i * 15);

  return {
    width,
    height,
    stripe,
    chakra,
    spokes,
    chakraCenter: {
      top: (height - chakra) / 2,
      left: (width - chakra) / 2,
    },
  };
}
