import { useFocusEffect, usePathname, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  RefreshControl,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScanActionHeight, T, TabBarHeight } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-accessibility-setting';
import { HEADER_COLLAPSE_OFFSET, ScreenHeader, ScreenTopBar } from './screen-header';
import { registerScreenScroll } from './screen-scroll';

/**
 * The v2 frame for every screen (#487): a slim top bar (back chevron, the screen's one action,
 * the title once it collapses), a large title in the content that collapses into the bar on
 * scroll, the grouped background, and safe areas owned here exactly once — the top bar carries
 * the status-bar inset, and the bottom reserve clears the tab bar on tab roots, the gesture
 * area on pushed screens, and the floating Scan action while it is shown. Before this frame
 * the native stack header and the screen both added the top inset, which is where the ~200 px
 * empty header gap came from (#477).
 */
export function Screen({
  title,
  eyebrow,
  trailing,
  children,
  refreshing,
  onRefresh,
  scroll = true,
  floatingAction = false,
}: {
  title?: string;
  eyebrow?: string;
  trailing?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  /** A floating action (Today's Scan button) sits over the bottom of the content; reserve room for it. */
  floatingAction?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();
  const inTabs = segments[0] === '(tabs)';

  // Tab roots reserve the tab bar; pushed screens only the gesture area and a breath of space.
  const bottomReserve =
    insets.bottom +
    (inTabs ? TabBarHeight : T.space.lg) +
    (floatingAction ? ScanActionHeight + T.space.xl : 0);

  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.setValue(y);
      const next = y > HEADER_COLLAPSE_OFFSET;
      if (next !== collapsedRef.current) {
        collapsedRef.current = next;
        setCollapsed(next);
      }
    },
    [scrollY],
  );

  const titleOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [HEADER_COLLAPSE_OFFSET - 24, HEADER_COLLAPSE_OFFSET],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY],
  );

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
  }, [reduceMotion]);

  // A re-tap of the active tab asks the registry to scroll this screen to the top.
  useEffect(() => {
    if (!scroll) return undefined;
    return registerScreenScroll(pathname, scrollToTop);
  }, [pathname, scroll, scrollToTop]);

  // Tab roots open at the top when you come back to them (the Me tab kept its scroll, #487).
  const returnedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!inTabs || !scroll) return;
      if (returnedRef.current) {
        scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
      }
      returnedRef.current = true;
    }, [inTabs, scroll, reduceMotion]),
  );

  const bar = title ? (
    <ScreenTopBar
      title={title}
      trailing={trailing}
      collapsed={scroll ? collapsed : true}
      // With reduced motion the title swap is a plain swap, never a fade.
      titleOpacity={scroll && !reduceMotion ? titleOpacity : undefined}
      back={inTabs ? false : undefined}
    />
  ) : null;

  if (!scroll) {
    return (
      <View style={styles.screen}>
        {bar}
        {title ? (
          <View style={[styles.content, { flex: 1, paddingBottom: bottomReserve }]}>{children}</View>
        ) : (
          // No title: the screen composes its own header (Timeline puts `ScreenTopBar` over its
          // list), so the children own their padding and fill the shell directly.
          children
        )}
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      {bar}
      {/* Scrolls the focused field above the keyboard, also in a long form. `Screen` owns the
          safe-area insets, so the scroll view itself never adjusts for them again. */}
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        bottomOffset={T.space.xl}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottomReserve }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={T.color.accent}
            />
          ) : undefined
        }
      >
        {title ? <ScreenHeader eyebrow={eyebrow} title={title} /> : null}
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.color.canvas },
  scrollArea: { flex: 1 },
  content: { paddingHorizontal: T.space.lg, gap: T.space.lg },
});
