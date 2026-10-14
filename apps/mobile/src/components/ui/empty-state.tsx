import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '@/constants/theme';
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

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: T.space.md, paddingVertical: T.space.xxl, paddingHorizontal: T.space.xl },
  icon: { width: 56, height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: T.color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
