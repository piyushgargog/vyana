import React, { useEffect, useState } from 'react';
import {
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import {
  buildQrMatrix,
  computeItemRefill,
  generateQrMatrix,
  parseCarePlanJson,
  useReportAiMistake,
} from '@vyana/shared';
import { T } from '@/constants/theme';
import { Button, Pill, Symbol, Text } from '@/components/ui';
import { useVyanaMobile } from './providers';

export { buildQrMatrix, computeItemRefill, generateQrMatrix, parseCarePlanJson };

export function MobileQrGrid({
  data,
  size = 280,
  label = 'Medical ID QR Code',
}: {
  data: string;
  size?: number;
  label?: string;
}) {
  // Error level M: more damage tolerance for scanning from a phone screen
  const matrix = buildQrMatrix(data, 'M');
  const grid = matrix.length;
  const quiet = 4;
  const cellSize = Math.max(1, Math.floor(size / (grid + quiet * 2)));
  const pad = cellSize * quiet;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        styles.qrBox,
        {
          width: cellSize * grid + pad * 2,
          height: cellSize * grid + pad * 2,
          padding: pad,
        },
      ]}
    >
      {matrix.map((row, r) => (
        <View key={r} style={styles.qrRow}>
          {row.map((cell, c) => (
            <View
              key={`${r}-${c}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: cell ? T.color.label : T.color.white,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export interface MobileTrendPoint {
  date: string;
  value: number;
  flag?: 'low' | 'normal' | 'high' | null;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-10-20" → "20 Oct", so a date label never wraps in the middle (#332). */
export function shortChartDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  const month = SHORT_MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month}` : date;
}

export function MobileTrendChart({
  title,
  unit,
  points,
  refLow,
  refHigh,
  label,
  flags = true,
}: {
  title: string;
  unit: string;
  points: MobileTrendPoint[];
  refLow?: number | null;
  refHigh?: number | null;
  /** Screen-reader label for the whole chart; defaults to the readings count. */
  label?: string;
  /**
   * Print the flag word under each value and colour the bars by it (lab reports).
   * Device readings pass false (issue #328): a device value is never labelled
   * high/low/normal here, and every bar keeps the neutral accent.
   */
  flags?: boolean;
}) {
  if (points.length === 0) {
    return (
      <View style={styles.chartCard}>
        <Text variant="subhead" tone="secondary" style={styles.chartEmptyText}>
          No historical points recorded for {title} yet.
        </Text>
      </View>
    );
  }

  const maxVal = Math.max(
    ...points.map((p) => p.value),
    typeof refHigh === 'number' ? refHigh : 0,
    1
  );

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={label ?? `${title} trend chart across ${points.length} readings`}
      style={styles.chartCard}
    >
      <View style={styles.chartHeader}>
        <Text variant="headline">
          {unit ? `${title} Trend (${unit})` : `${title} Trend`}
        </Text>
        {typeof refLow === 'number' && typeof refHigh === 'number' && (
          <Text variant="footnote" tone="tertiary">
            Normal reference range: {refLow} – {refHigh} {unit}
          </Text>
        )}
      </View>

      <View style={styles.barsContainer}>
        {points.map((pt, idx) => {
          const ratio = Math.min(1, Math.max(0.18, pt.value / (maxVal * 1.15)));
          const barHeight = Math.round(ratio * 110);
          const flagText =
            pt.flag === 'high' ? 'High' : pt.flag === 'low' ? 'Low' : 'Normal';
          // The bar takes the colour of the flag the report itself gave (#332):
          // a calm warning tone for "above range", the strong red only for "low",
          // never one alarm colour for everything. With flags off (device data)
          // every bar is the neutral accent and no flag word is printed.
          const barColor = !flags
            ? T.color.accent
            : pt.flag === 'high'
              ? T.color.warn
              : pt.flag === 'low'
                ? T.color.danger
                : T.color.accent;
          // With more than four bars the labels touch (#332): show every second
          // one, plus always the latest. Hidden labels keep their space so the
          // bars stay on one baseline.
          const crowded = points.length > 4;
          const showLabel = !crowded || idx % 2 === 0 || idx === points.length - 1;

          return (
            <View key={`${pt.date}-${idx}`} style={styles.barColumn}>
              <Text
                variant="caption"
                style={[styles.barValText, { color: barColor }, !showLabel && styles.hiddenLabel]}
              >
                {flags ? `${pt.value} (${flagText})` : pt.value}
              </Text>
              <View
                style={[
                  styles.barFill,
                  {
                    height: barHeight,
                    backgroundColor: barColor,
                  },
                ]}
              />
              <Text variant="caption" tone="tertiary" style={!showLabel ? styles.hiddenLabel : undefined}>
                {shortChartDate(pt.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MobileAiSafetyBanner({
  contextId,
  aiRunId,
}: {
  feature?: string;
  contextId?: string;
  aiRunId?: string | null;
}) {
  const reportMutation = useReportAiMistake();
  const { showToast } = useVyanaMobile();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const resolvedRunId = aiRunId ?? contextId;

  const handleSubmit = async () => {
    if (!resolvedRunId) return;
    try {
      await reportMutation.mutateAsync({
        ai_run_id: resolvedRunId,
        note: note.trim() || undefined,
      });
      setSubmitted(true);
      setOpen(false);
      setNote('');
      showToast('Mistake report logged for review', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not submit mistake report',
        'error'
      );
    }
  };

  return (
    <View style={styles.aiBanner}>
      <View style={styles.aiBannerRow}>
        <View style={styles.aiBannerLabelRow}>
          <Symbol
            ios="sparkles"
            android="auto_awesome"
            size={16}
            color={T.color.warn}
          />
          <Text variant="footnote" tone="warn" style={styles.aiBannerLabel}>
            AI-generated, verify with your doctor
          </Text>
        </View>
        {resolvedRunId ? (
          submitted ? (
            <Pill text="Report recorded" tone="ok" />
          ) : (
            <Button
              title={open ? 'Close' : 'Report a mistake'}
              label="Report an AI mistake"
              variant="plain"
              onPress={() => setOpen((v) => !v)}
            />
          )
        ) : null}
      </View>

      {open && resolvedRunId && (
        <View style={styles.aiReportForm}>
          <Text variant="footnote" tone="warn">
            Describe what the AI got wrong
          </Text>
          <TextInput
            accessibilityLabel="Describe what the AI got wrong"
            value={note}
            onChangeText={setNote}
            placeholder="e.g., Wrong dosage or misread medicine name"
            placeholderTextColor={T.color.label3}
            style={styles.aiInput}
          />
          <Button
            title="Submit Report"
            label="Submit AI mistake report"
            variant="secondary"
            loading={reportMutation.isPending}
            onPress={handleSubmit}
            style={styles.aiSubmitBtn}
          />
        </View>
      )}
    </View>
  );
}

export function MobileSkeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | `${number}%` | 'auto';
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [opacity] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="none"
      accessibilityLabel="Loading content"
      style={[
        {
          width: width as DimensionValue,
          height,
          borderRadius,
          backgroundColor: T.color.fill,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function MobileSkeletonCard({
  lines = 3,
  style,
}: {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.skeletonCard, style]}>
      <MobileSkeleton width="45%" height={18} borderRadius={6} />
      {Array.from({ length: lines }).map((_, idx) => (
        <MobileSkeleton
          key={idx}
          width={idx === lines - 1 ? '70%' : '100%'}
          height={14}
          borderRadius={6}
          style={{ marginTop: T.space.sm }}
        />
      ))}
    </View>
  );
}

export function MobileSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: count }).map((_, idx) => (
        <MobileSkeletonCard key={idx} />
      ))}
    </View>
  );
}

export function MobileDisclaimerFooter() {
  return (
    <View style={styles.footer}>
      <Text variant="footnote" tone="tertiary" style={styles.footerText}>
        Not a substitute for professional medical advice. In a medical emergency, call 108 or 112 immediately.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrBox: {
    backgroundColor: T.color.white,
    padding: T.space.lg,
    // No border radius: a QR code needs square corners, rounded ones clip its quiet zone on Android
    borderRadius: 0,
    borderWidth: 1,
    borderColor: T.color.separator,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  qrRow: {
    flexDirection: 'row',
  },
  chartCard: {
    backgroundColor: T.color.surface,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: T.color.separator,
    padding: T.space.lg,
    gap: T.space.md,
  },
  chartEmptyText: {
    textAlign: 'center',
  },
  chartHeader: {
    gap: T.space.xs,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: T.space.md,
    minHeight: 155,
    borderBottomWidth: 1,
    borderBottomColor: T.color.separator,
    paddingBottom: T.space.sm,
  },
  barColumn: {
    alignItems: 'center',
    gap: T.space.xs,
    flex: 1,
  },
  barValText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  hiddenLabel: {
    opacity: 0,
  },
  barFill: {
    width: 26,
    borderRadius: 6,
  },
  aiBanner: {
    backgroundColor: T.color.warnSoft,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.sm,
  },
  aiBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: T.space.sm,
  },
  aiBannerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.xs,
    flex: 1,
  },
  aiBannerLabel: {
    fontWeight: '600',
    flex: 1,
  },
  aiReportForm: {
    gap: T.space.xs,
    paddingTop: T.space.xs,
  },
  aiInput: {
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 44,
    ...T.text.body,
    color: T.color.label,
  },
  aiSubmitBtn: {
    alignSelf: 'flex-start',
    marginTop: T.space.xs,
  },
  footer: {
    marginTop: T.space.lg,
    paddingVertical: T.space.md,
    paddingHorizontal: T.space.sm,
    borderTopWidth: 1,
    borderTopColor: T.color.separator,
  },
  footerText: {
    textAlign: 'center',
  },
  skeletonCard: {
    backgroundColor: T.color.surface,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: T.color.separator,
    padding: T.space.lg,
    marginBottom: T.space.md,
  },
  skeletonList: {
    paddingVertical: T.space.xs,
  },
});
