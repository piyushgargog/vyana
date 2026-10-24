import { useNavigation, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, TopBarHeight } from '@/constants/theme';
import { Symbol } from './symbol';
import { Text } from './text';

// The collapse threshold lives with the frame's other scroll rules in `screen-scroll` (pure
// TypeScript, unit-tested); it is re-exported here so existing imports keep working.
export { HEADER_COLLAPSE_OFFSET } from './screen-scroll';

/**
 * The large title block at the top of a screen's scrolling content (Apple's large-title pattern,
 * #487): an optional eyebrow over the title. It scrolls away with the content; `ScreenTopBar` is
 * the slim bar it collapses into. `Screen` renders this for you when you pass `title`.
 */
export function ScreenHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={styles.largeHeader}>
      {eyebrow ? (
        <Text variant="sectionHeader" tone="tertiary">
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="largeTitle" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/**
 * The slim bar at the very top of every screen (#487): the status-bar inset, a back chevron at the
 * leading edge when there is somewhere to go back to, the screen's title centred once the large
 * title has scrolled away, and one optional trailing action. The bar is part of the layout, never
 * an overlay, so content can never scroll under it or be cut off by it. The title swap is a
 * cross-fade of opacity only — no movement — and `Screen` makes it a plain swap when the system
 * asks for reduced motion.
 */
export function ScreenTopBar({
  title,
  trailing,
  collapsed = true,
  titleOpacity,
  back,
}: {
  title?: string;
  trailing?: ReactNode;
  /** Whether the large title has scrolled away and the small title should show. */
  collapsed?: boolean;
  /** Animated opacity for the small title; overrides `collapsed` when given. */
  titleOpacity?: Animated.Value | Animated.AnimatedInterpolation<number>;
  /** Show the back chevron. Default: when the navigator can go back. Never on tab roots. */
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const showBack = back ?? navigation.canGoBack();

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top },
        collapsed ? styles.barCollapsed : styles.barAtRest,
      ]}
    >
      <View style={styles.barRow}>
        <View style={styles.barSide}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Symbol ios="chevron.left" android="arrow_back_ios_new" size={22} color={T.color.accentStrong} />
            </Pressable>
          ) : null}
        </View>
        {title ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.barTitle, { opacity: titleOpacity ?? (collapsed ? 1 : 0) }]}
          >
            <Text variant="headline" numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
        ) : null}
        <View style={[styles.barSide, styles.barSideEnd]}>{trailing}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  largeHeader: { gap: T.space.xs, paddingBottom: T.space.xs },
  bar: { backgroundColor: T.color.canvas },
  barAtRest: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  barCollapsed: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.color.separator },
  barRow: {
    height: TopBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.space.lg,
  },
  barSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  barSideEnd: { justifyContent: 'flex-end' },
  barTitle: { flex: 2, alignItems: 'center' },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    marginLeft: -T.space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
