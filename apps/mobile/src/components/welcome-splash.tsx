import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
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
import {
  FADE_MS,
  FLAG,
  getFlagDimensions,
  SHOW_MS,
  WELCOME_STRINGS,
} from './welcome-splash.constants';

export { FADE_MS, FLAG, SHOW_MS, WELCOME_STRINGS };

/** Shown once per app launch, not every time the root layout renders again. */
let shownThisLaunch = false;

/**
 * The national flag, drawn with views (no emoji, no image). These are the flag's official colours, so they are
 * not design tokens: saffron, white, green and the navy blue of the Ashoka Chakra with its 24 spokes.
 */
export function IndiaFlag({ width = 32 }: { width?: number }) {
  const { height, stripe, chakra, spokes, chakraCenter } = getFlagDimensions(width);
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
            top: chakraCenter.top,
            left: chakraCenter.left,
          },
        ]}
      >
        {spokes.map((deg) => (
          <View
            key={deg}
            style={{
              position: 'absolute',
              width: StyleSheet.hairlineWidth * 2,
              height: chakra,
              backgroundColor: FLAG.chakra,
              transform: [{ rotate: `${deg}deg` }],
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
  const [contentScale] = useState(() => new Animated.Value(0.96));
  // Visible from the first frame: the native splash is held until this screen has been laid out, so nothing blank shows in between.
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const nativeHidden = useRef(false);
  const hideNativeSplash = useCallback(() => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);
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
          contentScale.setValue(1);
        } else {
          Animated.timing(contentScale, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      })
      .catch(() => {
        contentScale.setValue(1);
      });

    const timer = setTimeout(close, SHOW_MS);
    return () => clearTimeout(timer);
  }, [visible, close, contentScale]);

  // Nothing to show this launch (the screen was shown before): let the native splash go.
  useEffect(() => {
    if (!visible) hideNativeSplash();
  }, [visible, hideNativeSplash]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} onLayout={hideNativeSplash}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={WELCOME_STRINGS.accessibilityLabel}
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
              {WELCOME_STRINGS.title}
            </Text>

            <Text variant="body" tone="secondary" style={styles.tagline}>
              {WELCOME_STRINGS.tagline}
            </Text>

            {/* Subtle interactive affordance */}
            <View style={styles.skipBadge}>
              <Text variant="caption" tone="secondary" style={styles.skipText}>
                {WELCOME_STRINGS.tapToSkip}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Footer Pill: Flag + Made with love in India */}
        <View style={styles.footerContainer}>
          <View style={styles.footerPill}>
            <IndiaFlag width={26} />
            <Text variant="subhead" tone="secondary" style={styles.footerText}>
              {WELCOME_STRINGS.madeInIndia}
            </Text>
          </View>
        </View>
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
    // Solid, not glass: on Android the shadow of `elevation` shows through a translucent background and the card looks dirty.
    backgroundColor: T.color.surface,
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
    backgroundColor: T.color.surface,
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
