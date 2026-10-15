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
const SHOW_MS = 3000;
const FADE_MS = 350;

/** Shown once per app launch, not every time the root layout renders again. */
let shownThisLaunch = false;

/**
 * The national flag, drawn with views (no emoji, no image). These are the flag's official colours, so they are
 * not design tokens: saffron, white, green and the navy blue of the Ashoka Chakra with its 24 spokes.
 */
const FLAG = { saffron: '#FF9933', white: '#FFFFFF', green: '#138808', chakra: '#000080' } as const;

export function IndiaFlag({ width = 36 }: { width?: number }) {
  const height = (width * 2) / 3;
  const stripe = height / 3;
  const chakra = stripe * 0.82;
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
        style={[styles.chakra, { width: chakra, height: chakra, borderRadius: chakra / 2, top: (height - chakra) / 2, left: (width - chakra) / 2 }]}
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
 * A calm welcome screen for the first 3 seconds after the app opens. Tap to skip. With "reduce motion" on it
 * disappears without the fade. It sits above the navigator, so the sign-in screen is ready behind it.
 */
export function WelcomeSplash() {
  const [visible, setVisible] = useState(() => !shownThisLaunch);
  const [opacity] = useState(() => new Animated.Value(1));
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
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [opacity]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(close, SHOW_MS);
    return () => clearTimeout(timer);
  }, [visible, close]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vyana. Your health, in one calm place. Made with love in India. Tap to continue."
        onPress={close}
        style={styles.fill}
      >
        <View style={styles.center}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text variant="largeTitle" style={styles.name}>
            Vyana
          </Text>
          <Text variant="body" tone="secondary" style={styles.tagline}>
            Your health, in one calm place.
          </Text>
        </View>

        <View style={styles.footer}>
          <IndiaFlag width={30} />
          <Text variant="subhead" tone="secondary">
            Made with love in India
          </Text>
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
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: T.space.xl },
  logo: { width: 132, height: 132 },
  name: { marginTop: T.space.lg, textAlign: 'center' },
  tagline: { marginTop: T.space.sm, textAlign: 'center' },
  footer: {
    alignItems: 'center',
    gap: T.space.sm,
    paddingBottom: T.space.xxl + T.space.lg,
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
