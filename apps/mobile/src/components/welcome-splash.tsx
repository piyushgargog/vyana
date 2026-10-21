import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ui';
import { T } from '@/constants/theme';

/** How long the welcome screen stays, and how long it takes to fade away. */
export const SHOW_MS = 3000;
export const FADE_MS = 350;

/** Shown once per app launch, not every time the root layout renders again. */
let shownThisLaunch = false;

export function resetShownThisLaunchForTest() {
  shownThisLaunch = false;
}

export function hasShownThisLaunch() {
  return shownThisLaunch;
}

/**
 * The national flag, drawn with views (no emoji, no image). These are the flag's official colours, so they are
 * not design tokens: saffron, white, green and the navy blue of the Ashoka Chakra with its 24 spokes.
 */
export const FLAG = { saffron: '#FF9933', white: '#FFFFFF', green: '#138808', chakra: '#000080' } as const;

export function IndiaFlag({ width = 32 }: { width?: number }) {
  const height = Math.round((width * 2) / 3);
  const stripe = height / 3;
  const chakra = Math.round(stripe * 0.85);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Flag of India"
      style={[styles.flag, { width, height }]}
    >
      <View style={{ height: stripe, backgroundColor: FLAG.saffron }} />
      <View style={{ height: stripe, backgroundColor: FLAG.white }} />
      <View style={{ height: stripe, backgroundColor: FLAG.green }} />
      <View
        pointerEvents="none"
        style={[
          styles.chakra,
          {
            width: chakra,
            height: chakra,
            borderRadius: chakra / 2,
            top: (height - chakra) / 2,
            left: (width - chakra) / 2,
          },
        ]}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: StyleSheet.hairlineWidth * 2,
              height: chakra,
              backgroundColor: FLAG.chakra,
              transform: [{ rotate: `${i * 15}deg` }],
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A calm, premium welcome screen for the first 3 seconds after the app opens.
 * Tap anywhere to skip. Respects reduced-motion preferences.
 * Adheres strictly to Vyana's Liquid Glass design language.
 */
export function WelcomeSplash() {
  const [visible, setVisible] = useState(() => !shownThisLaunch);
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [contentScale] = useState(() => new Animated.Value(0.95));
  const [contentOpacity] = useState(() => new Animated.Value(0));
  const closing = useRef(false);

  const close = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    shownThisLaunch = true;
    let reduceMotion = false;
    try {
      reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    } catch {
      reduceMotion = false;
    }
    if (reduceMotion) {
      setVisible(false);
      return;
    }
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [overlayOpacity]);

  useEffect(() => {
    if (!visible) return;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (enabled) {
          contentOpacity.setValue(1);
          contentScale.setValue(1);
        } else {
          Animated.parallel([
            Animated.timing(contentOpacity, {
              toValue: 1,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(contentScale, {
              toValue: 1,
              duration: 550,
              easing: Easing.out(Easing.back(1.05)),
              useNativeDriver: true,
            }),
          ]).start();
        }
      })
      .catch(() => {
        contentOpacity.setValue(1);
        contentScale.setValue(1);
      });

    const timer = setTimeout(close, SHOW_MS);
    return () => clearTimeout(timer);
  }, [visible, close, contentOpacity, contentScale]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vyana. Your health, in one calm place. Made with love in India. Tap anywhere to skip."
        onPress={close}
        style={styles.fill}
      >
        {/* Subtle ambient accent glow behind the central brand card */}
        <View style={styles.ambientGlow} pointerEvents="none" />

        <View style={styles.centerContainer}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: contentOpacity,
                transform: [{ scale: contentScale }],
              },
            ]}
          >
            {/* Logo container with rounded elevation */}
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/images/splash-icon.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>

            <Text variant="largeTitle" style={styles.name}>
              Vyana
            </Text>

            <Text variant="body" tone="secondary" style={styles.tagline}>
              Your health, in one calm place.
            </Text>

            {/* Subtle interactive affordance */}
            <View style={styles.skipBadge}>
              <Text variant="caption" tone="secondary" style={styles.skipText}>
                Tap anywhere to skip
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Footer Pill: Flag + Made with love in India */}
        <Animated.View style={[styles.footerContainer, { opacity: contentOpacity }]}>
          <View style={styles.footerPill}>
            <IndiaFlag width={26} />
            <Text variant="subhead" tone="secondary" style={styles.footerText}>
              Made with love in India
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: T.color.canvas,
  },
  fill: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: T.space.lg,
  },
  ambientGlow: {
    position: 'absolute',
    top: '32%',
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: T.color.accentSoft,
    opacity: 0.85,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    backgroundColor: T.color.glassFallback,
    borderRadius: T.radius.feature,
    borderWidth: 1,
    borderColor: T.color.glassBorder,
    paddingVertical: T.space.xl + T.space.sm,
    paddingHorizontal: T.space.xl,
    ...T.shadow.float,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: T.radius.card,
    backgroundColor: T.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.space.md,
    borderWidth: 1,
    borderColor: T.color.separator,
    ...T.shadow.float,
  },
  logo: {
    width: 92,
    height: 92,
  },
  name: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: T.color.label,
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: T.space.xs + 2,
    textAlign: 'center',
    color: T.color.label2,
  },
  skipBadge: {
    marginTop: T.space.lg,
    backgroundColor: T.color.fill,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.xs,
    borderRadius: T.radius.pill,
  },
  skipText: {
    fontSize: 12,
    color: T.color.label3,
    fontWeight: '500',
  },
  footerContainer: {
    alignItems: 'center',
    paddingBottom: T.space.xxl + T.space.md,
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
    backgroundColor: T.color.glassFallback,
    borderRadius: T.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    paddingVertical: T.space.sm,
    paddingHorizontal: T.space.lg,
    ...T.shadow.float,
  },
  footerText: {
    fontWeight: '500',
    color: T.color.label2,
  },
  flag: {
    overflow: 'hidden',
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
  },
  chakra: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: FLAG.chakra,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
