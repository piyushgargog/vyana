import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLabReports, useLabValueHistory } from '@vyana/shared';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
  MobileSkeletonCard,
  MobileTrendChart,
} from '@/components/ui-primitives';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconTile,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

export default function MobileReportsTab() {
  const router = useRouter();
  const { data: reports = [], isLoading: reportsLoading, isError: reportsError, refetch: refetchReports } = useLabReports();
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
    <Screen
      title="Reports"
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS — Call 108 Ambulance"
          onPress={() => router.push('/sos')}
          style={styles.sosHeaderBtn}
        >
          <Text variant="footnote" tone="danger" style={styles.sosHeaderText}>
            SOS 108
          </Text>
        </Pressable>
      }
    >
      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Button
          title="Upload Lab Report"
          variant="primary"
          size="md"
          icon={
            <Symbol
              ios="doc.viewfinder.fill"
              android="document_scanner"
              size={18}
              color={T.color.white}
            />
          }
          onPress={() => router.push('/reports/upload')}
          style={styles.actionBtn}
        />
        <Button
          title="Compare Lab Prices"
          variant="secondary"
          size="md"
          onPress={() => router.push('/labs-compare')}
          style={styles.actionBtn}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open chronological health timeline and create doctor share link"
        onPress={() => router.push('/timeline')}
      >
        <Card style={styles.timelineBanner}>
          <View style={styles.timelineContent}>
            <IconTile
              ios="clock.arrow.circlepath"
              android="history"
              color="accent"
            />
            <View style={{ flex: 1 }}>
              <Text variant="headline">
                Chronological Health Timeline & Doctor Share Link
              </Text>
              <Text variant="footnote" tone="secondary" style={styles.timelineSub}>
                View all prescriptions, lab reports & OPD visits · Generate 24h QR link
              </Text>
            </View>
            <Symbol
              ios="chevron.right"
              android="chevron_right"
              size={16}
              color={T.color.label3}
            />
          </View>
        </Card>
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
        <MobileSkeletonCard lines={3} />
      ) : reportsError ? (
        <Card>
          <ErrorState onRetry={() => refetchReports()} />
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState
            ios="doc.text.fill"
            android="description"
            title="No lab reports yet"
            body="Upload a report photo or PDF to see extracted values, abnormal flags, and health trends."
            action={
              <Button
                title="Upload First Report"
                variant="primary"
                size="md"
                icon={
                  <Symbol
                    ios="doc.viewfinder.fill"
                    android="document_scanner"
                    size={18}
                    color={T.color.white}
                  />
                }
                onPress={() => router.push('/reports/upload')}
              />
            }
          />
        </Card>
      ) : (
        reports.map((rep) => (
          <Card key={rep.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="accent" style={styles.labName}>
                  {rep.lab_name || 'Diagnostic Laboratory'}
                  {rep.report_date ? ` · ${rep.report_date}` : ''}
                </Text>
                <Text variant="headline" style={styles.reportTitle}>
                  {rep.lab_name ? `${rep.lab_name} Report` : 'Lab Report'}
                </Text>
              </View>
              <Button
                title="Details"
                variant="secondary"
                size="sm"
                label={`Open full report ${rep.id}`}
                onPress={() => router.push(`/reports/${rep.id}`)}
                style={styles.detailsBtn}
              />
            </View>

            {rep.summary && (
              <>
                <MobileAiSafetyBanner feature="report_analyze" />
                <View style={styles.summaryBox}>
                  <Text variant="caption" tone="secondary" style={styles.summaryLabel}>
                    Plain-Language Summary
                  </Text>
                  <Text variant="subhead">{rep.summary}</Text>
                </View>
              </>
            )}
          </Card>
        ))
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sosHeaderBtn: {
    backgroundColor: T.color.dangerSoft,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.xs,
    borderRadius: T.radius.pill,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosHeaderText: {
    fontWeight: '700',
  },
  actionRow: { flexDirection: 'row', gap: T.space.sm },
  actionBtn: { flex: 1 },
  timelineBanner: {
    backgroundColor: T.color.accentSoft,
    borderColor: T.color.separator,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timelineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.md,
  },
  timelineSub: { marginTop: T.space.xs },
  reportCard: {
    gap: T.space.md,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  labName: { fontWeight: '700' },
  reportTitle: {
    marginTop: T.space.xs,
  },
  detailsBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  summaryBox: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    padding: T.space.md,
    gap: T.space.xs,
  },
  summaryLabel: { fontWeight: '700' },
});
