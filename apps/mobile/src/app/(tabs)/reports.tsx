import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { buildLabChart, useLabReports, useLabValueHistory } from '@vyana/shared';
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
  SosPill,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

export default function MobileReportsTab() {
  const router = useRouter();
  const { data: reports = [], isLoading: reportsLoading, isError: reportsError, refetch: refetchReports } = useLabReports();
  const { data: hba1cHistory = [] } = useLabValueHistory('HbA1c');

  // The shared model does the chart's thinking (issue #489): chronological points with
  // year-aware labels, the reference band, the headline sentence and the screen-reader
  // texts all come from the stored rows; this screen only renders them.
  const labChart = buildLabChart(hba1cHistory, { title: 'HbA1c', unit: '%' });

  return (
    <Screen
      title="Reports"
      trailing={<SosPill />}
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
          title="Compare Lab Tests"
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
      {labChart ? (
        <MobileTrendChart
          title="HbA1c Glycemic Control"
          unit={labChart.unit}
          points={labChart.points.map((p) => ({
            date: p.day,
            value: p.value,
            dateLabel: p.dateLabel,
            // Only a placed value colours a bar: "in" and "unknown" (no range
            // claim established) both render as a plain bar.
            status: p.status === 'above' || p.status === 'below' ? p.status : null,
            a11yLabel: p.a11yLabel,
          }))}
          refLow={labChart.refLow}
          refHigh={labChart.refHigh}
          headline={labChart.headline}
          label={labChart.label}
        />
      ) : (
        <MobileTrendChart title="HbA1c Glycemic Control" unit="%" points={[]} />
      )}

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
  // The two actions stack (issue #489): at phone widths their labels wrapped onto
  // two lines side by side; as a vertical pair each keeps one line at full width.
  actionRow: { flexDirection: 'column', gap: T.space.sm },
  actionBtn: {},
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
