import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '@/constants/theme';
import { useHighContrast, useReduceTransparency } from '@/hooks/use-accessibility-setting';

const LIQUID = isLiquidGlassAvailable();

/**
 * Liquid Glass for chrome only (floating buttons, bars, sheets' handles): the native iOS 26 material where it
 * exists, a translucent white surface with a hairline and a soft shadow elsewhere. When the system asks for
 * reduced transparency the surface is solid instead — glass the person cannot see through is worse than none.
 * When it asks for higher contrast the hairline becomes the stronger tertiary-label colour, so the edge of the
 * surface still reads as an edge (the native material follows the system setting itself).
 */
export function Glass({ children, style, interactive = false }: { children?: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  const reducedTransparency = useReduceTransparency();
  const highContrast = useHighContrast();
  const edge = highContrast ? styles.edgeStrong : undefined;
  if (reducedTransparency) {
    return <View style={[styles.solid, edge, style]}>{children}</View>;
  }
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme="light" style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, edge, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: T.color.glassFallback,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.glassBorder,
    ...T.shadow.float,
  },
  solid: {
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.glassBorder,
    ...T.shadow.float,
  },
  edgeStrong: {
    borderColor: T.color.label3,
  },
});
