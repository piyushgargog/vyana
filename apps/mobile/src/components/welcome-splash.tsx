import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { T, useThemeColors } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-accessibility-setting';
import {
  ENTER_MS,
  FADE_MS,
  FLAG,
  SHOW_MS,
  WELCOME_STRINGS,
  getFlagDimensions,
  gradientBands,
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
 * The welcome (#488, Apple TV style): a full-bleed calm gradient from the brand teal to
 * its deep end, the brand mark as a tile with soft depth, the name in Large Title and
 * one line under it. No card, no chips. The content fades and scales in over about
 * 600 ms — under Reduce Motion it only cross-fades. It hides by itself after 2.5 s at
 * the latest, and a tap skips it. The gradient is stacked bands of views: the app
 * ships no gradient library (the flag and the rings are drawn with views too).
 */
export function WelcomeSplash() {
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(() => !shownThisLaunch);
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [contentOpacity] = useState(() => new Animated.Value(0));
  const [contentScale] = useState(() => new Animated.Value(0.96));
  const nativeHidden = useRef(false);
  const hideNativeSplash = useCallback(() => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    shownThisLaunch = true;
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
  }, [overlayOpacity, reduceMotion]);

  useEffect(() => {
    if (!visible) return;

    if (reduceMotion) {
      // Cross-fade only: no scale, no movement (HIG motion rule).
      contentScale.setValue(1);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: ENTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentScale, {
          toValue: 1,
          duration: ENTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    const timer = setTimeout(close, SHOW_MS);
    return () => clearTimeout(timer);
  }, [visible, close, contentOpacity, contentScale, reduceMotion]);

  // Nothing to show this launch (the screen was shown before): let the native splash go.
  useEffect(() => {
    if (!visible) hideNativeSplash();
  }, [visible, hideNativeSplash]);

  if (!visible) return null;

  const bands = gradientBands(colors.accent, colors.accentDeep);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} onLayout={hideNativeSplash}>
      {/* The gradient itself: stacked bands behind everything, from the first frame,
          so handing over from the native splash never shows a blank screen. */}
      <View style={styles.bands} pointerEvents="none" accessibilityElementsHidden>
        {bands.map((color, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: color }} />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={WELCOME_STRINGS.accessibilityLabel}
        onPress={close}
        style={[
          styles.fill,
          { paddingTop: insets.top + T.space.xl, paddingBottom: insets.bottom + T.space.xl },
        ]}
      >
        <Animated.View
          style={[
            styles.center,
            { opacity: contentOpacity, transform: [{ scale: contentScale }] },
          ]}
        >
          {/* The brand mark as a tile with soft depth, like an app icon on a hero. */}
          <View style={styles.logoTile}>
            <Image
              source={require('../../assets/images/splash-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>

          <Text variant="largeTitle" style={[styles.name, { color: colors.white }]}>
            {WELCOME_STRINGS.title}
          </Text>

          <Text variant="body" style={[styles.tagline, { color: colors.white }]}>
            {WELCOME_STRINGS.tagline}
          </Text>
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
  },
  bands: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
  },
  fill: {
    flex: 1,
    paddingHorizontal: T.space.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTile: {
    width: 104,
    height: 104,
    borderRadius: 24,
    backgroundColor: T.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.space.lg,
    ...T.shadow.float,
  },
  logo: {
    width: 104,
    height: 104,
    borderRadius: 24,
  },
  name: {
    textAlign: 'center',
  },
  tagline: {
    marginTop: T.space.sm,
    textAlign: 'center',
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
