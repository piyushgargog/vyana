import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '@/constants/theme';

const LIQUID = isLiquidGlassAvailable();

/** Whether the person has asked the system for reduced transparency; glass falls back to solid while it is on. */
function useReduceTransparency(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (live) setReduced(enabled);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * Liquid Glass for chrome only (floating buttons, bars, sheets' handles): the native iOS 26 material where it
 * exists, a translucent white surface with a hairline and a soft shadow elsewhere. When the system asks for
 * reduced transparency the surface is solid instead — glass the person cannot see through is worse than none.
 */
export function Glass({ children, style, interactive = false }: { children?: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  const reducedTransparency = useReduceTransparency();
  if (reducedTransparency) {
    return <View style={[styles.solid, style]}>{children}</View>;
  }
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
  solid: {
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.glassBorder,
    ...T.shadow.float,
  },
});
