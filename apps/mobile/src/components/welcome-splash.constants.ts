/**
 * Pure constants and geometric helpers for the Mobile Welcome Splash Screen (#240).
 *
 * This file has ZERO React Native dependencies to allow fast, isolated unit testing
 * across node/vitest environments without native mocks or polyfills.
 */

/** How long the welcome splash stays visible before automatic transition (3 seconds). */
export const SHOW_MS = 3000;

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
  accessibilityLabel:
    'Vyana. Your health, in one calm place. Made with love in India. Tap anywhere to skip.',
} as const;

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
