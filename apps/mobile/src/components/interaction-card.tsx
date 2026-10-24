import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { Interaction } from '@vyana/shared';
import { Text } from '@/components/ui';
import { useVyanaMobile } from '@/components/providers';
import { T } from '@/constants/theme';

/**
 * One drug–drug interaction (issue #489). The Medicines tab and the prescription
 * screen used to render this twice, differently, both times wrong in the same ways:
 * the severity badge clipped at the card's edge, the whole card sat in alarm colour,
 * the quote was headed "Verbatim Evidence" and the sources printed as raw text with
 * the URL spelled out. Here the badge is the only coloured element and it wraps
 * under the pair's names on narrow widths; the body reads in the normal label
 * colour, and every source is a tappable link named by its title.
 */
export function InteractionCard({ interaction }: { interaction: Interaction }) {
  const { showToast } = useVyanaMobile();

  const openSource = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      showToast('Could not open the source link', 'error');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text variant="subhead" style={styles.pair}>
          {interaction.medicine_a} + {interaction.medicine_b}
        </Text>
        <View
          style={[
            styles.badge,
            interaction.severity === 'major'
              ? styles.badgeMajor
              : interaction.severity === 'moderate'
                ? styles.badgeModerate
                : styles.badgeMinor,
          ]}
        >
          <Text variant="caption" tone="white" style={styles.badgeText}>
            Severity: {interaction.severity}
          </Text>
        </View>
      </View>

      {interaction.layer ? (
        <Text variant="caption" tone="tertiary">
          {interaction.layer === 'table' ? 'From the reviewed list' : 'From a trusted source'}
        </Text>
      ) : null}

      <Text variant="callout">{interaction.effect}</Text>

      <Text variant="footnote" tone="secondary">
        Guidance: {interaction.advice}
      </Text>

      {interaction.quote ? (
        <Text variant="footnote" tone="secondary" style={styles.quote}>
          Quote from the source: “{interaction.quote}”
        </Text>
      ) : null}

      {interaction.sources.length > 0 && (
        <View style={styles.sources}>
          <Text variant="footnote" tone="secondary" style={styles.sourcesLabel}>
            Sources:
          </Text>
          {interaction.sources.map((source, idx) => (
            <Pressable
              key={`${source.url}-${idx}`}
              accessibilityRole="link"
              accessibilityLabel={`Open source ${source.title}`}
              onPress={() => openSource(source.url)}
              style={styles.sourceLink}
            >
              <Text variant="footnote" style={styles.sourceLinkText}>
                {source.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.color.surface,
    borderColor: T.color.separator,
    borderWidth: 1,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.sm,
  },
  // Wraps as a group: on a narrow phone the badge drops under the names whole
  // instead of being clipped at the card's edge.
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: T.space.sm,
  },
  pair: { fontWeight: '700', flexShrink: 1 },
  badge: {
    paddingHorizontal: T.space.sm,
    paddingVertical: T.space.xs / 2,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
  },
  badgeMajor: { backgroundColor: T.color.danger },
  badgeModerate: { backgroundColor: T.color.warn },
  badgeMinor: { backgroundColor: T.color.label3 },
  badgeText: { fontWeight: '800', textTransform: 'capitalize' },
  quote: { fontStyle: 'italic' },
  sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: T.space.sm },
  sourcesLabel: { fontWeight: '600' },
  // 44 px minimum touch target (brief #486): the link text itself is footnote-sized.
  sourceLink: { minHeight: 44, justifyContent: 'center' },
  sourceLinkText: { color: T.color.accentStrong, fontWeight: '600', textDecorationLine: 'underline' },
});
