import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { T } from '@/constants/theme';
import { useLabReport } from '@vyana/shared';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function LabReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: report, isLoading } = useLabReport(id);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={T.color.accent} />
        <Text style={styles.loadingText}>Loading lab report…</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundTitle}>Lab Report Not Found</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Back to Reports</Text>
        </Pressable>
      </View>
    );
  }

  const values = report.lab_values ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {report.lab_name || 'Lab Report'}
          </Text>
          <Text style={styles.headerSub}>
            Tested on {report.report_date || '—'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.color.canvas },
  content: { padding: 16, gap: 14 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: { fontSize: 13, color: T.color.label2 },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  notFoundTitle: { fontSize: 16, fontWeight: '700', color: T.color.label },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: T.color.label },
  headerSub: { fontSize: 12, color: T.color.label2 },
  backBtn: {
    backgroundColor: T.color.accentStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  backBtnText: { color: T.color.white, fontWeight: '700', fontSize: 12 },
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
