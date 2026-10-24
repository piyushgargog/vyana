import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '@/constants/theme';
import { Button } from './button';
import { Symbol } from './symbol';
import { Text } from './text';

/** An empty state: a soft icon, a title, one line of help, at most one action. */
export function EmptyState({ ios, android, title, body, action }: { ios: Parameters<typeof Symbol>[0]['ios']; android: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.box}>
      <View style={styles.icon}>
        <Symbol ios={ios} android={android} size={28} />
      </View>
      <Text variant="headline" style={styles.center}>
        {title}
      </Text>
      {body ? (
        <Text variant="subhead" tone="tertiary" style={styles.center}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/** A calm error state: soft neutral icon, non-technical title/body, optional retry button (Issue #139). */
export function ErrorState({
  title = "Couldn't load this",
  body = 'Pull to refresh or try again.',
  onRetry,
  retryLabel = 'Try again',
  retryAccessibilityLabel,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** What screen readers announce for the retry when "Try again" is not descriptive enough on its own. */
  retryAccessibilityLabel?: string;
}) {
  return (
    <View style={styles.box}>
      <View style={[styles.icon, styles.errorIcon]}>
        <Symbol ios="exclamationmark.triangle" android="warning" size={28} color={T.color.label3} />
      </View>
      <Text variant="headline" style={styles.center}>
        {title}
      </Text>
      {body ? (
        <Text variant="subhead" tone="tertiary" style={styles.center}>
          {body}
        </Text>
      ) : null}
      {onRetry ? (
        <Button
          title={retryLabel}
          variant="secondary"
          size="md"
          label={retryAccessibilityLabel}
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: T.space.md, paddingVertical: T.space.xxl, paddingHorizontal: T.space.xl },
  icon: { width: 56, height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: T.color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { backgroundColor: T.color.fill },
  center: { textAlign: 'center' },
});
