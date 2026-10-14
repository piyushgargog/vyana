import { StyleSheet, View } from 'react-native';
import { T } from '@/constants/theme';
import { Text } from './text';

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

const TONES: Record<Tone, { bg: string; fg: 'secondary' | 'accent' | 'ok' | 'warn' | 'danger' }> = {
  neutral: { bg: T.color.fill, fg: 'secondary' },
  accent: { bg: T.color.accentSoft, fg: 'accent' },
  ok: { bg: T.color.okSoft, fg: 'ok' },
  warn: { bg: T.color.warnSoft, fg: 'warn' },
  danger: { bg: T.color.dangerSoft, fg: 'danger' },
};

/** A small status pill. The text carries the meaning, not the colour. */
export function Pill({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, { backgroundColor: TONES[tone].bg }]}>
      <Text variant="footnote" tone={TONES[tone].fg} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: T.radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontWeight: '600' },
});
