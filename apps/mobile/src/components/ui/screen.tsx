import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/constants/theme';
import { Text } from './text';

/**
 * A screen with an iOS large title over the grey background. Content scrolls; the bottom inset leaves room for
 * the floating tab bar. Use `trailing` for one header action (for example SOS).
 */
export function Screen({
  title,
  eyebrow,
  trailing,
  children,
  refreshing,
  onRefresh,
  scroll = true,
  inset = true,
}: {
  title?: string;
  eyebrow?: string;
  trailing?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  /** Add the status-bar inset on top. Turn off under a native header, which already does. */
  inset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = (inset ? insets.top : 0) + T.space.sm;
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.titles}>
        {eyebrow ? (
          <Text variant="sectionHeader" tone="tertiary">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="largeTitle" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {trailing}
    </View>
  ) : null;

  if (!scroll) {
    return (
      <View style={[styles.screen, { paddingTop: top }]}>
        {header}
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: insets.bottom + 110 }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={T.color.accent} /> : undefined}
    >
      {header}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.color.canvas },
  content: { paddingHorizontal: T.space.lg, gap: T.space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: T.space.md, paddingBottom: T.space.xs },
  titles: { flex: 1, minWidth: 0 },
});
