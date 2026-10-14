import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '@/constants/theme';
import { Text } from './text';

/** A white content card on the grey screen. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

/** A card's title row with an optional trailing value. */
export function CardHeader({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View style={styles.header}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {trailing ? (
        <Text variant="subhead" tone="tertiary">
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: T.color.surface, borderRadius: T.radius.card, borderCurve: 'continuous' },
  padded: { padding: T.space.lg, gap: T.space.md },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: T.space.md },
});
