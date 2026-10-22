import React, { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { parseMarkdownBlocks, type InlineSegment } from '@vyana/shared';
import { Text } from './ui';
import { T } from '@/constants/theme';

/**
 * Assistant replies drawn as formatted text on the phone (#332): headings, bold,
 * italics, lists and links — the same subset the web renderer shows. The parsing
 * lives in @vyana/shared (`parseMarkdownBlocks`); this file only draws it.
 */

function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        switch (s.kind) {
          case 'bold':
            return (
              <Text key={i} style={styles.bold}>
                {s.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} style={styles.italic}>
                {s.text}
              </Text>
            );
          case 'code':
            return (
              <Text key={i} style={styles.code}>
                {s.text}
              </Text>
            );
          case 'link':
            return (
              <Text
                key={i}
                style={styles.link}
                accessibilityRole="link"
                accessibilityLabel={`Open link: ${s.text}`}
                onPress={() => Linking.openURL(s.url).catch(() => undefined)}
              >
                {s.text}
              </Text>
            );
          default:
            return <React.Fragment key={i}>{s.text}</React.Fragment>;
        }
      })}
    </>
  );
}

export function FormattedMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Text
                key={i}
                variant={block.level <= 1 ? 'title3' : block.level === 2 ? 'headline' : 'subhead'}
                style={styles.heading}
              >
                <Inline segments={block.segments} />
              </Text>
            );
          case 'bullet-list':
          case 'numbered-list':
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.listRow}>
                    <Text variant="body" tone="secondary" style={styles.marker}>
                      {block.kind === 'bullet-list' ? '•' : `${j + 1}.`}
                    </Text>
                    <Text variant="body" style={styles.listText}>
                      <Inline segments={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          default:
            return (
              <Text key={i} variant="body">
                <Inline segments={block.segments} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: T.space.sm },
  heading: { marginTop: T.space.xs },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'Courier', backgroundColor: T.color.fill },
  link: { color: T.color.accentStrong, textDecorationLine: 'underline' },
  list: { gap: T.space.xs },
  listRow: { flexDirection: 'row', gap: T.space.sm },
  marker: { minWidth: 14 },
  listText: { flex: 1 },
});
