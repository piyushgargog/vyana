import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { T } from '@/constants/theme';
import { Button, EmptyState, Screen } from '@/components/ui';
import { useLabReport } from '@vyana/shared';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
  MobileSkeletonCard,
} from '@/components/ui-primitives';

export default function LabReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: report, isLoading } = useLabReport(id);

  if (isLoading) {
    return (
      <Screen title="Lab Report">
        <MobileSkeletonCard lines={4} />
      </Screen>
    );
  }

  if (!report) {
    return (
      <Screen title="Lab Report">
        <EmptyState
          ios="doc.text.fill"
          android="description"
          title="Lab Report Not Found"
          body="The report may have been removed, or the link that brought you here is wrong."
          action={
            <Button title="Back to Reports" onPress={() => router.back()} />
          }
        />
      </Screen>
    );
  }

  const values = report.lab_values ?? [];

  return (
    <Screen title={report.lab_name || 'Lab Report'}>
      <Text style={styles.headerSub}>
        Tested on {report.report_date || '—'}
      </Text>

      {/* AI Plain-Language Summary */}
      {report.summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Plain-Language Summary</Text>
          <Text style={styles.summaryBody}>{report.summary}</Text>
        </View>
      )}

      {/* Safety Banner */}
      <MobileAiSafetyBanner feature="lab_report" />

      {/* Values List */}
      <Text style={styles.sectionTitle}>Test Results ({values.length})</Text>

      {values.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No values recorded for this report.</Text>
        </View>
      ) : (
        values.map((v) => {
          const isHigh = v.flag === 'high';
          const isLow = v.flag === 'low';
          return (
            <View key={v.id} style={styles.valueCard}>
              <View style={styles.valueRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.testName}>{v.test_name}</Text>
                  <Text style={styles.refRange}>
                    Reference:{' '}
                    {v.ref_low !== null && v.ref_high !== null
                      ? `${v.ref_low} – ${v.ref_high} ${v.unit ?? ''}`
                      : v.ref_high !== null
                        ? `< ${v.ref_high} ${v.unit ?? ''}`
                        : v.ref_low !== null
                          ? `> ${v.ref_low} ${v.unit ?? ''}`
                          : 'Standard'}
                  </Text>
                </View>

                <View style={styles.valueRight}>
                  <Text
                    style={[
                      styles.valueNum,
                      (isHigh || isLow) && styles.valueAbnormal,
                    ]}
                  >
                    {v.value !== null ? v.value : v.value_text || '—'}{' '}
                    <Text style={styles.unitText}>{v.unit || ''}</Text>
                  </Text>
                  <View
                    style={[
                      styles.flagBadge,
                      isHigh
                        ? styles.flagHigh
                        : isLow
                          ? styles.flagLow
                          : styles.flagNormal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.flagBadgeText,
                        isHigh
                          ? styles.flagHighText
                          : isLow
                            ? styles.flagLowText
                            : styles.flagNormalText,
                      ]}
                    >
                      {(v.flag || 'NORMAL').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerSub: { fontSize: 12, color: T.color.label2 },
  summaryCard: {
    backgroundColor: T.color.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: T.color.separator,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: T.color.label },
  summaryBody: { fontSize: 13, color: T.color.label, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: T.color.label },
  emptyCard: {
    backgroundColor: T.color.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: T.color.label2 },
  valueCard: {
    backgroundColor: T.color.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: T.color.separator,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testName: { fontSize: 15, fontWeight: '700', color: T.color.label },
  refRange: { fontSize: 12, color: T.color.label2 },
  valueRight: { alignItems: 'flex-end', gap: 4 },
  valueNum: { fontSize: 16, fontWeight: '800', color: T.color.accentStrong },
  valueAbnormal: { color: T.color.dangerText },
  unitText: { fontSize: 12, fontWeight: '500', color: T.color.label2 },
  flagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flagHigh: { backgroundColor: T.color.dangerSoft },
  flagLow: { backgroundColor: T.color.warnSoft },
  flagNormal: { backgroundColor: T.color.okSoft },
  flagBadgeText: { fontSize: 11, fontWeight: '800' },
  flagHighText: { color: T.color.dangerText },
  flagLowText: { color: T.color.warn },
  flagNormalText: { color: T.color.ok },
});
