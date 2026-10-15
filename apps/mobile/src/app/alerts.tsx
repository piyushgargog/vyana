import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  DbDrugAlert,
  useCheckAlerts,
  useDrugAlerts,
  useMarkAlertSeen,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';
import { T } from '@/constants/theme';

const REQUIRED_ALERT_NOTICE =
  "A government quality alert mentions this medicine. Alerts usually concern specific batches: check the batch number on your pack with your pharmacist. Don't stop the medicine without asking your doctor.";

export default function DrugQualityAlertsScreen() {
  const { showToast } = useVyanaMobile();

  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const { data: alerts = [], isLoading, refetch } = useDrugAlerts();
  const markSeenMutation = useMarkAlertSeen();
  const checkAlertsMutation = useCheckAlerts();

  const handleOpenSource = (url: string, title: string) => {
    if (!url) {
      showToast('No official URL available for this alert', 'info');
      return;
    }
    Linking.openURL(url).catch(() => {
      showToast('Could not open the official government notice link', 'error');
    });
  };

  const handleMarkAsRead = async (id: string, title: string) => {
    try {
      await markSeenMutation.mutateAsync(id);
      showToast('Alert marked as reviewed', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update alert', 'error');
    }
  };

  const handleRunCheck = async () => {
    try {
      const res = await checkAlertsMutation.mutateAsync();
      const count = res.alerts?.length ?? 0;
      if (count > 0) {
        showToast(`Checked active medicines: ${count} relevant notice(s) found`, 'warning');
      } else {
        showToast('No alert found in the sources checked. This does not mean a medicine is fine: ask your pharmacist if unsure.', 'info');
      }
      void refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not check CDSCO alerts', 'error');
    }
  };

  const displayedAlerts = filterUnreadOnly ? alerts.filter((a) => !a.seen) : alerts;
  const unreadCount = alerts.filter((a) => !a.seen).length;

  return (
    <Screen
      title="Drug Quality Alerts"
      eyebrow="CDSCO · Government notices"
      refreshing={isLoading}
      onRefresh={() => {
        void refetch();
      }}
    >
      <MobileAiSafetyBanner />

      <Card>
        <CardHeader
          title="Active medicine watch"
          trailing={unreadCount > 0 ? `${unreadCount} new` : undefined}
        />
        <Text variant="footnote" tone="tertiary">
          Monitors government gazettes and CDSCO batch recalls for your active
          prescriptions.
        </Text>
        <Button
          title="Check now"
          label="Check for new government quality alerts"
          icon={
            <Symbol
              ios="arrow.clockwise"
              android="refresh"
              size={18}
              color={T.color.white}
            />
          }
          loading={checkAlertsMutation.isPending}
          onPress={handleRunCheck}
        />
        <View style={styles.filterRow}>
          <FilterChip
            label={`All alerts (${alerts.length})`}
            a11y="Show all alerts"
            active={!filterUnreadOnly}
            onPress={() => setFilterUnreadOnly(false)}
          />
          <FilterChip
            label={`Unread (${unreadCount})`}
            a11y="Show unread alerts only"
            active={filterUnreadOnly}
            onPress={() => setFilterUnreadOnly(true)}
          />
        </View>
      </Card>

      {isLoading && displayedAlerts.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={T.color.accent} />
          <Text variant="footnote" tone="tertiary">
            Loading drug quality alerts…
          </Text>
        </View>
      ) : null}

      {!isLoading && displayedAlerts.length === 0 ? (
        <EmptyState
          ios="shield.fill"
          android="shield"
          title="No quality alerts"
          body={
            filterUnreadOnly
              ? 'All quality alerts have been marked as reviewed. Switch to "All alerts" to view previous notices.'
              : 'None of your active prescription medicines have recent government quality or batch recall notices from CDSCO.'
          }
        />
      ) : null}

      {displayedAlerts.map((alert: DbDrugAlert) => {
        const isUnread = !alert.seen;
        return (
          <Card key={alert.id} style={isUnread ? styles.unreadCard : undefined}>
            <View style={styles.cardTopRow}>
              <Pill text={alert.medicine_name.toUpperCase()} tone="danger" />
              <Pill text={isUnread ? 'New' : 'Reviewed'} tone={isUnread ? 'warn' : 'ok'} />
            </View>

            <Text variant="headline">{alert.title}</Text>
            <Text variant="footnote" tone="tertiary">
              Published{' '}
              {new Date(alert.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>

            {alert.snippet ? (
              <View style={styles.snippetBox}>
                <Text variant="caption" tone="secondary" style={styles.snippetLabel}>
                  Official notice extract
                </Text>
                <Text variant="subhead" tone="secondary" style={styles.snippetText}>
                  {alert.snippet}
                </Text>
              </View>
            ) : null}

            <View style={styles.noticeBox}>
              <Text variant="footnote" tone="danger" style={styles.noticeTitle}>
                Important clinical guidance
              </Text>
              <Text variant="footnote" tone="danger">
                {REQUIRED_ALERT_NOTICE}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <Button
                variant="secondary"
                title="Official source"
                label={`Read official government source notice for ${alert.medicine_name}`}
                icon={
                  <Symbol
                    ios="arrow.up.right"
                    android="open_in_new"
                    size={16}
                    color={T.color.accentStrong}
                  />
                }
                onPress={() => handleOpenSource(alert.url, alert.title)}
              />
              {isUnread ? (
                <Button
                  variant="plain"
                  title="Mark as reviewed"
                  loading={markSeenMutation.isPending}
                  onPress={() => handleMarkAsRead(alert.id, alert.title)}
                />
              ) : null}
            </View>
          </Card>
        );
      })}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

function FilterChip({
  label,
  a11y,
  active,
  onPress,
}: {
  label: string;
  a11y: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text
        variant="footnote"
        style={[styles.chipText, active && styles.chipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: T.space.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: T.space.lg,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.fill,
  },
  chipActive: { backgroundColor: T.color.accent },
  chipText: { fontWeight: '600', color: T.color.label2 },
  chipTextActive: { color: T.color.white },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.sm,
    paddingVertical: T.space.lg,
  },
  unreadCard: { borderWidth: 2, borderColor: T.color.warn, borderCurve: 'continuous' },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: T.space.sm,
  },
  snippetBox: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.xs,
  },
  snippetLabel: { fontWeight: '700' },
  snippetText: { fontStyle: 'italic' },
  noticeBox: {
    backgroundColor: T.color.dangerSoft,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.xs,
  },
  noticeTitle: { fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.space.sm,
    alignItems: 'center',
  },
});
