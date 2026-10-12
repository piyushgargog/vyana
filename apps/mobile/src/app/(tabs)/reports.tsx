import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLabReports, useLabValueHistory } from '@vyana/shared';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
  MobileTrendChart,
} from '@/components/ui-primitives';

export default function MobileReportsTab() {
  const router = useRouter();
  const { data: reports = [], isLoading: reportsLoading } = useLabReports();
  const { data: hba1cHistory = [] } = useLabValueHistory('HbA1c');

  const chartPoints = hba1cHistory
    .filter((item) => item.value !== null)
    .map((item) => ({
      date: item.measured_on ?? 'Recent',
      value: Number(item.value ?? 0),
      flag: (item.flag as 'low' | 'normal' | 'high' | null) ?? 'normal',
    }));

  const refLow = hba1cHistory[0]?.ref_low ?? null;
  const refHigh = hba1cHistory[0]?.ref_high ?? null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload and analyze a new lab report"
          onPress={() => router.push('/reports/upload')}
          style={styles.uploadBtn}
        >
          <Text style={styles.uploadBtnText}>+ Upload Lab Report</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compare lab test prices across diagnostic labs"
          onPress={() => router.push('/labs-compare')}
          style={styles.compareBtn}
        >
          <Text style={styles.compareBtnText}>Compare Lab Prices</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open chronological health timeline and create doctor share link"
        onPress={() => router.push('/timeline')}
        style={styles.timelineBanner}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.timelineBannerTitle}>
            Chronological Health Timeline & Doctor Share Link
          </Text>
          <Text style={styles.timelineBannerSub}>
            View all prescriptions, lab reports & OPD visits · Generate 24h QR
            link
          </Text>
        </View>
        <Text style={styles.timelineArrow}>Open →</Text>
      </Pressable>

      {/* Historical HbA1c Trend Chart */}
      <MobileTrendChart
        title="HbA1c Glycemic Control"
        unit="%"
        points={chartPoints}
        refLow={refLow}
        refHigh={refHigh}
      />

      {/* Lab Reports List */}
      {reportsLoading ? (
        <View style={styles.reportCard}>
          <Text style={styles.summaryText}>Loading lab reports…</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.reportCard}>
          <Text style={styles.summaryText}>
            No lab reports uploaded yet. Tap &ldquo;+ Upload Lab Report&rdquo;
            to analyze a report.
          </Text>
        </View>
      ) : (
        reports.map((rep) => (
          <View key={rep.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.labName}>
                  {rep.lab_name || 'Diagnostic Laboratory'}
                  {rep.report_date ? ` · ${rep.report_date}` : ''}
                </Text>
                <Text style={styles.reportTitle}>
                  {rep.lab_name ? `${rep.lab_name} Report` : 'Lab Report'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open full report ${rep.id}`}
                onPress={() => router.push(`/reports/${rep.id}`)}
                style={styles.openBtn}
              >
                <Text style={styles.openBtnText}>Details →</Text>
              </Pressable>
            </View>

            {rep.summary && (
              <>
                <MobileAiSafetyBanner feature="report_analyze" />
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>
                    Plain-Language Summary
                  </Text>
                  <Text style={styles.summaryText}>{rep.summary}</Text>
                </View>
              </>
            )}
          </View>
        ))
      )}

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  actionRow: { flexDirection: 'row', gap: 10 },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#0D9488',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  uploadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  compareBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  compareBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  timelineBanner: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timelineBannerTitle: { fontSize: 13, fontWeight: '700', color: '#0F766E' },
  timelineBannerSub: { fontSize: 11, color: '#115E59', marginTop: 2 },
  timelineArrow: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  labName: { fontSize: 11, fontWeight: '700', color: '#0F766E' },
  reportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  openBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openBtnText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
  summaryText: { fontSize: 13, color: '#1E293B', lineHeight: 19 },
});
