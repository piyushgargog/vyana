import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { T } from '@/constants/theme';

/**
 * An icon: SF Symbols on iOS, Material Symbols on Android (pass both names). Decorative by default; give
 * `label` when the icon carries meaning on its own.
 */
export function Symbol({
  ios,
  android,
  size = 22,
  color = T.color.accent,
  label,
}: {
  ios: SFSymbol;
  android: string;
  size?: number;
  color?: ColorValue;
  label?: string;
}) {
  return (
    <SymbolView
      // The Android name comes from Material Symbols; the package types it as a string union.
      name={{ ios, android: android as never }}
      size={size}
      tintColor={color}
      accessibilityLabel={label}
      accessible={Boolean(label)}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
