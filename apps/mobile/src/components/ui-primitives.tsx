import React, { useEffect, useState } from 'react';
import {
  Animated,
  DimensionValue,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import {
  buildQrMatrix,
  computeItemRefill,
  parseCarePlanJson,
  useReportAiMistake,
} from '@vyana/shared';
import { T } from '@/constants/theme';
import { Button, Pill, Symbol, Text } from '@/components/ui';
import { useVyanaMobile } from './providers';

export { buildQrMatrix, computeItemRefill, parseCarePlanJson };

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
  /** Axis label when the caller formats the date itself (the lab model adds the year when it changes). */
  dateLabel?: string;
  /** Range status from the caller's model; wins over `flag` when set. */
  status?: 'above' | 'below' | null;
  /** Screen-reader text for this one point (full date, value, range status). */
  a11yLabel?: string;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-10-20" → "20 Oct", so a date label never wraps in the middle (#332). */
export function shortChartDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  const month = SHORT_MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month}` : date;
}

/** The fixed height of the bar area; the reference band and the bars share this one scale. */
const PLOT_HEIGHT = 120;
/** Room under the bars for the date labels (caption line height + the column gap); the band's baseline sits this far from the bottom. */
const DATE_LABEL_SPACE = 20;
/** Past this many points the value/date labels thin out; every point stays tappable instead. */
const MAX_POINT_LABELS = 8;

export function MobileTrendChart({
  title,
  unit,
  points,
  refLow,
  refHigh,
  label,
  headline,
  flags = true,
}: {
  title: string;
  unit: string;
  points: MobileTrendPoint[];
  refLow?: number | null;
  refHigh?: number | null;
  /** Screen-reader label for the whole chart; defaults to the readings count. */
  label?: string;
  /** The one-line takeaway over the chart, built by the caller's model (brief #486, rule 11). */
  headline?: string | null;
  /**
   * Print the range status under each value and colour the bars by it (lab reports).
   * Device readings pass false (issue #328): a device value is never labelled
   * high/low/normal here, and every bar keeps the neutral accent.
   */
  flags?: boolean;
}) {
  // The selected point is the chart's tooltip: the latest by default, any bar on tap.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (points.length === 0) {
    return (
      <View style={styles.chartCard}>
        <Text variant="subhead" tone="secondary" style={styles.chartEmptyText}>
          No historical points recorded for {title} yet.
        </Text>
      </View>
    );
  }

  // One scale for the bars and the band, with headroom over the tallest of them.
  const scaleMax =
    Math.max(
      ...points.map((p) => p.value),
      typeof refHigh === 'number' ? refHigh : 0,
      typeof refLow === 'number' ? refLow : 0,
      1,
    ) * 1.15;
  const barHeight = (value: number) =>
    Math.max(3, Math.min(PLOT_HEIGHT, (value / scaleMax) * PLOT_HEIGHT));
  const hasBand = typeof refLow === 'number' && typeof refHigh === 'number';
  const bandBottom = hasBand ? (refLow / scaleMax) * PLOT_HEIGHT : 0;
  const bandHeight = hasBand ? Math.max(3, ((refHigh - refLow) / scaleMax) * PLOT_HEIGHT) : 0;

  const pointStatus = (pt: MobileTrendPoint): 'above' | 'below' | null => {
    if (!flags) return null;
    if (pt.status !== undefined) return pt.status;
    return pt.flag === 'high' ? 'above' : pt.flag === 'low' ? 'below' : null;
  };
  const pointLabel = (pt: MobileTrendPoint) => pt.dateLabel ?? shortChartDate(pt.date);
  const pointA11y = (pt: MobileTrendPoint): string => {
    if (pt.a11yLabel) return pt.a11yLabel;
    const status = pointStatus(pt);
    const statusWord = status === 'above' ? ', above range' : status === 'below' ? ', below range' : '';
    return `${pointLabel(pt)}: ${pt.value}${unit ? ` ${unit}` : ''}${statusWord}`;
  };

  const selectedIdx = (() => {
    if (selectedKey === null) return points.length - 1;
    const idx = points.findIndex((p) => `${p.date}|${p.value}` === selectedKey);
    return idx >= 0 ? idx : points.length - 1;
  })();
  const selectedPoint = points[selectedIdx];

  // With more points than fit, thin the printed labels; the tap readout and the
  // screen-reader labels still carry every point (brief #486, rule 11).
  const labelStep = Math.max(1, Math.ceil(points.length / MAX_POINT_LABELS));
  const showLabel = (idx: number) =>
    points.length <= MAX_POINT_LABELS || idx % labelStep === 0 || idx === points.length - 1 || idx === selectedIdx;

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
        {hasBand && (
          <Text variant="footnote" tone="tertiary">
            Reference range: {refLow} – {refHigh} {unit} (shaded band)
          </Text>
        )}
        {headline ? (
          <Text variant="subhead" tone="secondary">
            {headline}
          </Text>
        ) : null}
      </View>

      {flags && selectedPoint ? (
        <Text variant="footnote" tone="secondary" style={styles.chartReadout}>
          {pointA11y(selectedPoint)}
        </Text>
      ) : null}

      <View style={styles.chartPlot}>
        {hasBand && (
          <View
            pointerEvents="none"
            style={[
              styles.chartBand,
              { bottom: DATE_LABEL_SPACE + bandBottom, height: bandHeight },
            ]}
          />
        )}
        <View
          pointerEvents="none"
          style={[styles.chartAxis, { bottom: DATE_LABEL_SPACE }]}
        />
        <View style={styles.barsRow}>
          {points.map((pt, idx) => {
            const status = pointStatus(pt);
            // One calm tone for out of range in either direction, the neutral accent
            // in range — never red or green, and never colour alone: an out-of-range
            // point also carries an arrow icon and the words "Above/Below range".
            const barColor = status ? T.color.warn : T.color.accent;
            const labelled = showLabel(idx);
            const column = (
              <>
                <View style={styles.barZone}>
                  {status && labelled ? (
                    <View style={styles.barStatus}>
                      <Symbol
                        ios={status === 'above' ? 'arrow.up.circle.fill' : 'arrow.down.circle.fill'}
                        android={status === 'above' ? 'arrow_circle_up' : 'arrow_circle_down'}
                        size={11}
                        color={T.color.warn}
                      />
                      <Text variant="caption2" tone="warn" style={styles.barStatusText}>
                        {status === 'above' ? 'Above range' : 'Below range'}
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    variant="caption"
                    style={[
                      styles.barValText,
                      idx === selectedIdx && styles.barValSelected,
                      !labelled && styles.hiddenLabel,
                    ]}
                  >
                    {pt.value}
                  </Text>
                  <View
                    style={[
                      styles.barFill,
                      { height: barHeight(pt.value), backgroundColor: barColor },
                      idx === selectedIdx && styles.barFillSelected,
                    ]}
                  />
                </View>
                <Text
                  variant="caption"
                  tone="tertiary"
                  style={[styles.barDateText, !labelled && styles.hiddenLabel]}
                >
                  {pointLabel(pt)}
                </Text>
              </>
            );

            return flags ? (
              <Pressable
                key={`${pt.date}-${idx}`}
                accessibilityRole="button"
                accessibilityLabel={pointA11y(pt)}
                accessibilityState={{ selected: idx === selectedIdx }}
                onPress={() => setSelectedKey(`${pt.date}|${pt.value}`)}
                style={styles.barColumn}
              >
                {column}
              </Pressable>
            ) : (
              <View
                key={`${pt.date}-${idx}`}
                accessible
                accessibilityLabel={pointA11y(pt)}
                style={styles.barColumn}
              >
                {column}
              </View>
            );
          })}
        </View>
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
  chartReadout: {
    fontWeight: '600',
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
  },
  chartPlot: {
    position: 'relative',
    paddingTop: T.space.sm,
  },
  chartBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: T.color.accentSoft,
    borderRadius: 4,
  },
  chartAxis: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.color.separator,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barColumn: {
    alignItems: 'center',
    gap: T.space.xs,
    flex: 1,
  },
  barZone: {
    height: PLOT_HEIGHT,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
  },
  barStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  barStatusText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  barValText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  barValSelected: {
    textDecorationLine: 'underline',
  },
  hiddenLabel: {
    opacity: 0,
  },
  barFill: {
    width: 26,
    borderRadius: 6,
  },
  barFillSelected: {
    borderWidth: 2,
    borderColor: T.color.label,
  },
  barDateText: {
    textAlign: 'center',
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
