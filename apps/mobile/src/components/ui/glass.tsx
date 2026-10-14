import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '@/constants/theme';

const LIQUID = isLiquidGlassAvailable();

/**
 * Liquid Glass for chrome only (floating buttons, bars, sheets' handles): the native iOS 26 material where it
 * exists, a translucent white surface with a hairline and a soft shadow elsewhere.
 */
export function Glass({ children, style, interactive = false }: { children?: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme="light" style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: T.color.glassFallback,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.glassBorder,
    ...T.shadow.float,
  },
});
