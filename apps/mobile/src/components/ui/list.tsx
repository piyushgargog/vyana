import * as Haptics from 'expo-haptics';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { T } from '@/constants/theme';
import { Symbol } from './symbol';
import { Text } from './text';

export type TileColor = keyof typeof T.color.tile;

/** A Settings-style group: an optional header, white rounded rows with hairline separators, an optional footer. */
export function ListGroup({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {header ? (
        <Text variant="sectionHeader" tone="tertiary" style={styles.groupHeader} accessibilityRole="header">
          {header}
        </Text>
      ) : null}
      <View style={styles.rows}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={styles.separator} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="footnote" tone="tertiary" style={styles.groupFooter}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** The coloured 30 pt icon tile of a list row. */
export function IconTile({ ios, android, color = 'accent' }: { ios: Parameters<typeof Symbol>[0]['ios']; android: string; color?: TileColor }) {
  return (
    <View style={[styles.tile, { backgroundColor: T.color.tile[color] }]}>
      <Symbol ios={ios} android={android} size={17} color={T.color.white} />
    </View>
  );
}

/** One row. With `onPress` it gets a chevron, a pressed state and a selection haptic. */
export function ListRow({
  title,
  subtitle,
  value,
  icon,
  onPress,
  trailing,
  label,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: ReactNode;
  onPress?: () => void;
  trailing?: ReactNode;
  label?: string;
}) {
  const body = (
    <>
      {icon}
      <View style={styles.texts}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="subhead" tone="tertiary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {onPress ? <Symbol ios="chevron.right" android="chevron_right" size={14} color={T.color.label3} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? [title, value].filter(Boolean).join(', ')}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupHeader: { paddingHorizontal: T.space.lg },
  groupFooter: { paddingHorizontal: T.space.lg },
  rows: { backgroundColor: T.color.surface, borderRadius: T.radius.tile, borderCurve: 'continuous', overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: T.color.separator, marginLeft: T.space.lg },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: T.space.md, paddingHorizontal: T.space.lg, paddingVertical: 10 },
  pressed: { backgroundColor: T.color.fill },
  texts: { flex: 1, minWidth: 0 },
  tile: { width: 30, height: 30, borderRadius: 8, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
