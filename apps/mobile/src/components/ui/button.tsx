import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { T } from '@/constants/theme';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A pill button with a light haptic and a spring press (0.97). One primary per screen. `label` is what screen
 * readers say when the visible text is not enough.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  label,
  style,
  size = 'md',
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const off = disabled || loading;
  const v = VARIANTS[variant];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPressIn={() => {
        if (!reduce) scale.set(withSpring(0.97, { damping: 18, stiffness: 400 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 18, stiffness: 400 }));
      }}
      onPress={() => {
        if (variant === 'primary' || variant === 'destructive') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={[styles.base, SIZES[size], v.box, off && styles.off, pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="headline" style={{ color: v.text }}>
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const VARIANTS: Record<Variant, { box: ViewStyle; text: string }> = {
  primary: { box: { backgroundColor: T.color.accent, ...T.shadow.accent }, text: T.color.white },
  secondary: { box: { backgroundColor: T.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: T.color.separator }, text: T.color.accentStrong },
  plain: { box: { backgroundColor: 'transparent' }, text: T.color.accentStrong },
  destructive: { box: { backgroundColor: T.color.dangerSoft }, text: T.color.dangerText },
};

const SIZES: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: { minHeight: 36, paddingHorizontal: 14 },
  md: { minHeight: 46, paddingHorizontal: 20 },
  lg: { minHeight: 54, paddingHorizontal: 26 },
};

const styles = StyleSheet.create({
  base: { borderRadius: T.radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  off: { opacity: 0.4 },
});
