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
        <ActivityIndicator size="large" color="#0D9488" />
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
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: { fontSize: 13, color: '#64748B' },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  notFoundTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B' },
  backBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  summaryBody: { fontSize: 13, color: '#334155', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#64748B' },
  valueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  refRange: { fontSize: 12, color: '#64748B' },
  valueRight: { alignItems: 'flex-end', gap: 4 },
  valueNum: { fontSize: 16, fontWeight: '800', color: '#0F766E' },
  valueAbnormal: { color: '#B91C1C' },
  unitText: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  flagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flagHigh: { backgroundColor: '#FEE2E2' },
  flagLow: { backgroundColor: '#FEF3C7' },
  flagNormal: { backgroundColor: '#D1FAE5' },
  flagBadgeText: { fontSize: 11, fontWeight: '800' },
  flagHighText: { color: '#B91C1C' },
  flagLowText: { color: '#B45309' },
  flagNormalText: { color: '#065F46' },
});
