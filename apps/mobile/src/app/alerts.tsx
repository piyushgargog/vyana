import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  DbDrugAlert,
  useCheckAlerts,
  useDrugAlerts,
  useMarkAlertSeen,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

const REQUIRED_ALERT_NOTICE =
  "A government quality alert mentions this medicine. Alerts usually concern specific batches: check the batch number on your pack with your pharmacist. Don't stop the medicine without asking your doctor.";

export default function DrugQualityAlertsScreen() {
  const router = useRouter();
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>CDSCO Drug Quality Alerts</Text>
          <Text style={styles.sub}>
            Official Central Drugs Standard Control Organisation (CDSCO) notices
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </Pressable>
      </View>

      <MobileAiSafetyBanner />

      {/* Check & Filter Controls */}
      <View style={styles.controlCard}>
        <View style={styles.controlHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Live Active Medicine Watch</Text>
            <Text style={styles.controlSub}>
              Monitors government gazettes & CDSCO batch recalls for your active prescriptions
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check for new government quality alerts"
            disabled={checkAlertsMutation.isPending}
            onPress={handleRunCheck}
            style={[
              styles.checkBtn,
              checkAlertsMutation.isPending && styles.btnDisabled,
            ]}
          >
            {checkAlertsMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.checkBtnText}>Check Now ↻</Text>
            )}
          </Pressable>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show all alerts"
            onPress={() => setFilterUnreadOnly(false)}
            style={[styles.filterChip, !filterUnreadOnly && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                !filterUnreadOnly && styles.filterChipTextActive,
              ]}
            >
              All Alerts ({alerts.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show unread alerts only"
            onPress={() => setFilterUnreadOnly(true)}
            style={[styles.filterChip, filterUnreadOnly && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                filterUnreadOnly && styles.filterChipTextActive,
              ]}
            >
              Unread Notices ({unreadCount})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* List of Alerts */}
      <View style={styles.alertListSection}>
        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0D9488" />
            <Text style={styles.loadingText}>Loading drug quality alerts…</Text>
          </View>
        )}

        {!isLoading && displayedAlerts.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Quality Alerts Found</Text>
            <Text style={styles.emptySub}>
              {filterUnreadOnly
                ? 'All quality alerts have been marked as reviewed. Switch to "All Alerts" to view previous notices.'
                : 'None of your active prescription medicines have recent government quality or batch recall notices from CDSCO.'}
            </Text>
          </View>
        )}

        {displayedAlerts.map((alert: DbDrugAlert) => {
          const isUnread = !alert.seen;

          return (
            <View
              key={alert.id}
              style={[styles.alertCard, isUnread && styles.alertCardUnread]}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.medicineBadge}>
                  <Text style={styles.medicineBadgeText}>
                    {alert.medicine_name.toUpperCase()}
                  </Text>
                </View>
                {isUnread ? (
                  <View style={styles.unreadTag}>
                    <Text style={styles.unreadTagText}>NEW / UNREVIEWED</Text>
                  </View>
                ) : (
                  <View style={styles.reviewedTag}>
                    <Text style={styles.reviewedTagText}>✓ REVIEWED</Text>
                  </View>
                )}
              </View>

              {/* Title & Date */}
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertDate}>
                Published on{' '}
                {new Date(alert.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>

              {/* Snippet */}
              {alert.snippet ? (
                <View style={styles.snippetBox}>
                  <Text style={styles.snippetLabel}>Official Notice Extract:</Text>
                  <Text style={styles.snippetText}>{alert.snippet}</Text>
                </View>
              ) : null}

              {/* MANDATORY FIXED GUIDANCE TEXT */}
              <View style={styles.requiredNoticeBox}>
                <Text style={styles.requiredNoticeTitle}>Important Clinical Guidance</Text>
                <Text style={styles.requiredNoticeText}>{REQUIRED_ALERT_NOTICE}</Text>
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Read official government source notice for ${alert.medicine_name}`}
                  onPress={() => handleOpenSource(alert.url, alert.title)}
                  style={styles.sourceBtn}
                >
                  <Text style={styles.sourceBtnText}>Official Government Source ↗</Text>
                </Pressable>

                {isUnread && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mark alert as reviewed"
                    disabled={markSeenMutation.isPending}
                    onPress={() => handleMarkAsRead(alert.id, alert.title)}
                    style={styles.markReadBtn}
                  >
                    <Text style={styles.markReadBtnText}>Mark as Reviewed</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  closeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  controlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  controlTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  controlSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  checkBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  checkBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  filterChipActive: { backgroundColor: '#0F766E' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#FFFFFF' },
  alertListSection: { gap: 14 },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    justifyContent: 'center',
  },
  loadingText: { fontSize: 13, color: '#64748B' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  alertCardUnread: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicineBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  medicineBadgeText: { fontSize: 11, fontWeight: '800', color: '#991B1B' },
  unreadTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unreadTagText: { fontSize: 10, fontWeight: '800', color: '#B45309' },
  reviewedTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reviewedTagText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  alertTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  alertDate: { fontSize: 12, color: '#64748B' },
  snippetBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  snippetLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
  snippetText: { fontSize: 12, color: '#334155', fontStyle: 'italic', lineHeight: 18 },
  requiredNoticeBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  requiredNoticeTitle: { fontSize: 12, fontWeight: '800', color: '#991B1B' },
  requiredNoticeText: { fontSize: 12, color: '#7F1D1D', lineHeight: 18, fontWeight: '500' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 6,
  },
  sourceBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  sourceBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  markReadBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  markReadBtnText: { color: '#334155', fontWeight: '700', fontSize: 12 },
});
