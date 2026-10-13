import React, { useEffect, useState } from 'react';
import {
  Animated,
  DimensionValue,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
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
import { useVyanaMobile } from './providers';

export { buildQrMatrix, computeItemRefill, generateQrMatrix, parseCarePlanJson };

export function MobileQrGrid({
  data,
  size = 200,
  label = 'Medical ID QR Code',
}: {
  data: string;
  size?: number;
  label?: string;
}) {
  const matrix = buildQrMatrix(data, 'L');
  const grid = matrix.length;
  const cellSize = Math.max(2, Math.floor((size - 24) / grid));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        styles.qrBox,
        { width: cellSize * grid + 24, height: cellSize * grid + 24 },
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
                backgroundColor: cell ? '#0F172A' : '#FFFFFF',
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

export function MobileTrendChart({
  title,
  unit,
  points,
  refLow,
  refHigh,
}: {
  title: string;
  unit: string;
  points: MobileTrendPoint[];
  refLow?: number | null;
  refHigh?: number | null;
}) {
  if (points.length === 0) {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartEmpty}>
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
      accessibilityLabel={`${title} trend chart across ${points.length} readings`}
      style={styles.chartCard}
    >
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>
          {title} Trend ({unit})
        </Text>
        {typeof refLow === 'number' && typeof refHigh === 'number' && (
          <Text style={styles.chartSub}>
            Normal reference range: {refLow} – {refHigh} {unit}
          </Text>
        )}
      </View>

      <View style={styles.barsContainer}>
        {points.map((pt, idx) => {
          const ratio = Math.min(1, Math.max(0.18, pt.value / (maxVal * 1.15)));
          const barHeight = Math.round(ratio * 110);
          const isAbnormal = pt.flag === 'high' || pt.flag === 'low';
          const flagText =
            pt.flag === 'high' ? 'High' : pt.flag === 'low' ? 'Low' : 'Normal';

          return (
            <View key={`${pt.date}-${idx}`} style={styles.barColumn}>
              <Text
                style={[
                  styles.barValText,
                  isAbnormal ? styles.barValAbnormal : styles.barValNormal,
                ]}
              >
                {pt.value} ({flagText})
              </Text>
              <View
                style={[
                  styles.barFill,
                  {
                    height: barHeight,
                    backgroundColor: isAbnormal ? '#DC2626' : '#0D9488',
                  },
                ]}
              />
              <Text style={styles.barDateText}>{pt.date}</Text>
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
        <Text style={styles.aiBannerLabel}>
          AI-generated, verify with your doctor
        </Text>
        {resolvedRunId ? (
          submitted ? (
            <Text style={styles.aiReportedBadge}>Report recorded</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report an AI mistake"
              onPress={() => setOpen((v) => !v)}
            >
              <Text style={styles.aiReportBtnText}>Report a mistake</Text>
            </Pressable>
          )
        ) : null}
      </View>

      {open && resolvedRunId && (
        <View style={styles.aiReportForm}>
          <Text style={styles.inputLabel}>Describe what the AI got wrong</Text>
          <TextInput
            accessibilityLabel="Describe what the AI got wrong"
            value={note}
            onChangeText={setNote}
            placeholder="e.g., Wrong dosage or misread medicine name"
            style={styles.aiInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit AI mistake report"
            disabled={reportMutation.isPending}
            onPress={handleSubmit}
            style={styles.aiSubmitBtn}
          >
            <Text style={styles.aiSubmitBtnText}>
              {reportMutation.isPending ? 'Sending…' : 'Submit Report'}
            </Text>
          </Pressable>
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
          backgroundColor: '#E2E8F0',
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
          style={{ marginTop: 8 }}
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
      <Text style={styles.footerText}>
        Not a substitute for professional medical advice. In a medical emergency, call 108 or 112 immediately.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  qrRow: {
    flexDirection: 'row',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },
  chartEmpty: {
    fontSize: 13,
    color: '#64748B',
  },
  chartHeader: {
    gap: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  chartSub: {
    fontSize: 12,
    color: '#64748B',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 12,
    minHeight: 155,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  barColumn: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  barValText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  barValNormal: {
    color: '#0F766E',
  },
  barValAbnormal: {
    color: '#B91C1C',
  },
  barFill: {
    width: 26,
    borderRadius: 6,
  },
  barDateText: {
    fontSize: 10,
    color: '#475569',
  },
  aiBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  aiBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  aiBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
  },
  aiReportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    textDecorationLine: 'underline',
  },
  aiReportedBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  aiReportForm: {
    gap: 6,
    paddingTop: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
  },
  aiInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  aiSubmitBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#92400E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  aiSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
  },
  skeletonList: {
    paddingVertical: 4,
  },
});
