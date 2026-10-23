import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T, useThemeColors } from '@/constants/theme';
import { useHighContrast, useReduceTransparency } from '@/hooks/use-accessibility-setting';

const LIQUID = isLiquidGlassAvailable();

/**
 * Liquid Glass for chrome only (floating buttons, bars, sheets' handles): the native iOS 26 material where it
 * exists, a translucent surface with a hairline and a soft shadow elsewhere. When the system asks for reduced
 * transparency the surface is solid instead — glass the person cannot see through is worse than none. When it
 * asks for higher contrast the hairline becomes the stronger tertiary-label colour, so the edge of the surface
 * still reads as an edge (the native material follows the system setting itself). Colours come from
 * `useThemeColors()` (issue #287): the native glass follows the system (`colorScheme="auto"`), and the fallback
 * and solid surfaces take the palette for the current appearance.
 */
export function Glass({ children, style, interactive = false }: { children?: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  const reducedTransparency = useReduceTransparency();
  const highContrast = useHighContrast();
  const colors = useThemeColors();
  const edge = highContrast ? { borderColor: colors.label3 } : undefined;
  if (reducedTransparency) {
    return (
      <View style={[styles.frame, { backgroundColor: colors.surface, borderColor: colors.glassBorder }, edge, style]}>
        {children}
      </View>
    );
  }
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme="auto" style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.frame, { backgroundColor: colors.glassFallback, borderColor: colors.glassBorder }, edge, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    ...T.shadow.float,
  },
});
