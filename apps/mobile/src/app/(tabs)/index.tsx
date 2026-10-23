import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  DEFAULT_TIMES,
  QUERY_ROOTS,
  parseCarePlanJson,
  useActiveItems,
  useAdherence,
  useCarePlans,
  useConditions,
  useDoseLogs,
  useLogDose,
  useMyAppointments,
  useMyProfile,
  type FrequencyType,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { SuggestionsForYou } from '@/components/suggestions';
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  Glass,
  IconTile,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  SosPill,
  Symbol,
  Text,
} from '@/components/ui';
import { MobileSkeletonCard } from '@/components/ui-primitives';
import { ActivityCard } from '@/components/activity-card';
import { T } from '@/constants/theme';

export default function PatientHomeScreen() {
  const router = useRouter();
  const { setSelectedBasketMedicines, showToast } = useVyanaMobile();

  const { data: profile } = useMyProfile();
  const { data: activeItems = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useActiveItems();
  const { data: conditions = [] } = useConditions();
  const { data: carePlans = [] } = useCarePlans();
  const activeCarePlan = parseCarePlanJson(carePlans[0]?.plan_json);

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  ).toISOString();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0
  ).toISOString();

  const { data: todayDoseLogs = [], refetch: refetchLogs } = useDoseLogs(startOfDay, endOfDay);
  const { data: adherence } = useAdherence(30);
  const { data: appointments = [], refetch: refetchAppts } = useMyAppointments();
  const logDoseMutation = useLogDose();

  const queryClient = useQueryClient();

  const onRefresh = () => {
    refetchItems();
    refetchLogs();
    refetchAppts();
    // The suggestions list has its own query; a pull-to-refresh refreshes it too.
    void queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.agentProposals] });
  };

  const scheduledSlots = activeItems.flatMap((item) => {
    const times =
      item.times && item.times.length > 0
        ? item.times
        : DEFAULT_TIMES[(item.frequency as FrequencyType) ?? 'OD'] ?? [];
    return times.map((timeStr) => {
      const [hh = '09', mm = '00'] = timeStr.split(':');
      const scheduledDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        Number(hh),
        Number(mm),
        0
      );
      const scheduledIso = scheduledDate.toISOString();
      const matchedLog = todayDoseLogs.find(
        (d) =>
          d.item_id === item.id &&
          Math.abs(
            new Date(d.scheduled_for).getTime() - scheduledDate.getTime()
          ) <=
            30 * 60 * 1000
      );
      const status = matchedLog?.status ?? 'pending';
      return {
        key: `${item.id}-${timeStr}`,
        itemId: item.id,
        scheduledIso,
        medicineName: item.medicine_name,
        strength: item.strength,
        dosage: item.dose,
        withFood: item.with_food,
        timeStr,
        status,
      };
    });
  });

  const takenCount = scheduledSlots.filter((s) => s.status === 'taken').length;

  const refillDueItems = activeItems
    .map((item) => ({
      item,
      refill: computeItemRefill(item, now),
    }))
    .filter((entry) => entry.refill.needsRefillSoon);

  const upcomingAppointments = appointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'completed'
  );
  const nextAppt = upcomingAppointments[0];

  const handleDoseAction = async (
    itemId: string,
    scheduledIso: string,
    status: 'taken' | 'skipped',
    medicineLabel: string
  ) => {
    try {
      await logDoseMutation.mutateAsync({
        item_id: itemId,
        scheduled_for: scheduledIso,
        status,
      });
      // A confirmation tap for a logged dose (U2): success for taken, nothing for skipped.
      if (status === 'taken') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      showToast(
        `${medicineLabel} marked as ${status.toUpperCase()}`,
        status === 'taken' ? 'success' : 'warning'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not log dose',
        'error'
      );
    }
  };

  const handleReorderSingle = (
    name: string,
    strength: string | null,
    quantity: number | null
  ) => {
    setSelectedBasketMedicines([
      {
        name,
        strength: strength ?? undefined,
        quantity: quantity && quantity > 0 ? quantity : 30,
      },
    ]);
    router.push('/basket');
  };

  const carePlanHref = conditions[0]
    ? `/care/${conditions[0].id}`
    : '/onboarding';

  const hour = now.getHours();
  const greetingTime = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `${greetingTime}, ${firstName}` : greetingTime;

  const eyebrowDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={styles.container}>
      <Screen
        eyebrow={eyebrowDate}
        title={greeting}
        onRefresh={onRefresh}
        trailing={<SosPill />}
        floatingAction
      >
        {/* Care suggestions (#304): pending proposals the patient confirms or dismisses. */}
        <SuggestionsForYou />

        {/* Doses Card with Progress */}
        <Card>
          <CardHeader
            title="Doses"
            trailing={`${takenCount} of ${scheduledSlots.length} taken`}
          />

          {itemsLoading ? (
            <MobileSkeletonCard lines={2} />
          ) : itemsError ? (
            <ErrorState onRetry={() => refetchItems()} />
          ) : scheduledSlots.length === 0 ? (
            <View style={styles.emptyDoses}>
              <Text variant="subhead" tone="secondary">
                No scheduled doses for today.
              </Text>
              <Button
                title="Scan prescription"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/prescriptions/scan')}
              />
            </View>
          ) : (
            <View style={styles.dosesList}>
              {scheduledSlots.map((slot) => {
                const isTaken = slot.status === 'taken';
                const isSkipped = slot.status === 'skipped';
                return (
                  <View key={slot.key} style={styles.doseRow}>
                    <View style={styles.doseInfo}>
                      <View style={styles.doseTitleRow}>
                        <Text variant="headline">{slot.medicineName}</Text>
                        {slot.strength ? (
                          <Text variant="subhead" tone="secondary">
                            {' '}{slot.strength}
                          </Text>
                        ) : null}
                      </View>
                      <Text variant="footnote" tone="tertiary">
                        {slot.timeStr} · {slot.dosage ?? 'As prescribed'} ·{' '}
                        {slot.withFood ? 'With food' : 'Anytime'}
                      </Text>
                    </View>

                    <View style={styles.doseActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${slot.medicineName} as taken`}
                        disabled={logDoseMutation.isPending}
                        onPress={() =>
                          handleDoseAction(
                            slot.itemId,
                            slot.scheduledIso,
                            'taken',
                            `${slot.medicineName} ${slot.strength ?? ''}`
                          )
                        }
                        style={[
                          styles.doseBtn,
                          isTaken ? styles.doseBtnTaken : styles.doseBtnDefault,
                        ]}
                      >
                        <Text
                          variant="footnote"
                          tone={isTaken ? 'white' : 'accent'}
                          style={styles.doseBtnText}
                        >
                          {isTaken ? '✓ Taken' : 'Take'}
                        </Text>
                      </Pressable>

                      {!isTaken && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Mark ${slot.medicineName} as skipped`}
                          disabled={logDoseMutation.isPending}
                          onPress={() =>
                            handleDoseAction(
                              slot.itemId,
                              slot.scheduledIso,
                              'skipped',
                              `${slot.medicineName} ${slot.strength ?? ''}`
                            )
                          }
                          style={[
                            styles.doseBtn,
                            isSkipped
                              ? styles.doseBtnSkipped
                              : styles.doseBtnSecondary,
                          ]}
                        >
                          <Text
                            variant="footnote"
                            tone={isSkipped ? 'white' : 'tertiary'}
                            style={styles.doseBtnText}
                          >
                            {isSkipped ? 'Skipped' : 'Skip'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {adherence && (
            <View style={styles.adherenceFooter}>
              <Text variant="caption" tone="tertiary">
                30-day adherence rate: {adherence.percent}%
              </Text>
            </View>
          )}
        </Card>

        {/* Activity Card (device readings, #328) */}
        <ActivityCard />

        {/* Refill Due Card */}
        {refillDueItems.length > 0 && (
          <Card>
            <CardHeader
              title="Refill Due Soon"
              trailing={`${refillDueItems.length} items`}
            />
            <View style={styles.refillList}>
              {refillDueItems.map(({ item, refill }) => (
                <View key={item.id} style={styles.refillRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">{item.medicine_name}</Text>
                    <Text variant="footnote" tone="tertiary">
                      {refill.daysLeft} days remaining · Qty:{' '}
                      {item.quantity_total ?? '—'}
                    </Text>
                  </View>
                  <Button
                    title="Reorder"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      handleReorderSingle(
                        item.medicine_name,
                        item.strength,
                        item.quantity_total
                      )
                    }
                  />
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Your Health Grouped List */}
        <ListGroup header="Your health">
          <ListRow
            icon={
              <IconTile
                ios="chart.line.uptrend.xyaxis"
                android="monitoring"
                color="orange"
              />
            }
            title="Blood Reports & Trends"
            subtitle="Track biomarkers over time"
            onPress={() => router.push('/(tabs)/reports')}
          />
          <ListRow
            icon={
              <IconTile
                ios="calendar"
                android="calendar_today"
                color="blue"
              />
            }
            title="Hospital OPD Token"
            subtitle={
              nextAppt
                ? `${nextAppt.hospitals?.name} · Token #${nextAppt.token_no}`
                : 'Book hospital appointment'
            }
            trailing={
              nextAppt ? (
                <Pill text={`#${nextAppt.token_no}`} tone="accent" />
              ) : undefined
            }
            onPress={() =>
              router.push(nextAppt ? '/appointments' : '/appointments/book')
            }
          />
          <ListRow
            icon={
              <IconTile
                ios="heart.text.square.fill"
                android="clinical_notes"
                color="green"
              />
            }
            title="Chronic Care Plan"
            subtitle={
              activeCarePlan
                ? activeCarePlan.condition
                : 'Physician care instructions'
            }
            onPress={() => router.push(carePlanHref as never)}
          />
          <ListRow
            icon={
              <IconTile
                ios="qrcode"
                android="qr_code"
                color="red"
              />
            }
            title="Offline Medical ID QR"
            subtitle={`Blood Group: ${profile?.blood_group || '—'} · Tap to display`}
            onPress={() => router.push('/medical-id')}
          />
          <ListRow
            icon={
              <IconTile
                ios="person.2.fill"
                android="group"
                color="indigo"
              />
            }
            title="Caregiver Circle"
            subtitle="Family alerts & missed-dose check-in"
            onPress={() => router.push('/caregiver')}
          />
          <ListRow
            icon={
              <IconTile
                ios="stethoscope"
                android="stethoscope"
                color="accent"
              />
            }
            title="Symptom Triage"
            subtitle="Check urgency & medical department"
            onPress={() => router.push('/triage')}
          />
        </ListGroup>
      </Screen>

      {/* Floating Glass Scan Button */}
      <View pointerEvents="box-none" style={styles.floatingContainer}>
        <Glass style={styles.glassWrapper}>
          <Button
            title="Scan a prescription"
            variant="primary"
            size="md"
            icon={
              <Symbol
                ios="doc.viewfinder.fill"
                android="document_scanner"
                size={20}
                color={T.color.white}
              />
            }
            onPress={() => router.push('/prescriptions/scan')}
          />
        </Glass>
      </View>
    </View>
  );
}

function computeItemRefill(item: { start_date?: string | null; duration_days?: number | null }, now: Date) {
  if (!item.start_date || !item.duration_days) {
    return { needsRefillSoon: false, daysLeft: 0, refillDate: null };
  }
  const start = new Date(item.start_date).getTime();
  const end = start + item.duration_days * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
  return {
    needsRefillSoon: daysLeft <= 5 && daysLeft >= 0,
    daysLeft: Math.max(0, daysLeft),
    refillDate: new Date(end).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    }),
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  emptyDoses: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: T.space.lg,
    gap: T.space.md,
  },
  dosesList: {
    gap: T.space.md,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: T.space.xs,
    gap: T.space.md,
  },
  doseInfo: {
    flex: 1,
    gap: 2,
  },
  doseTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  doseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.xs,
  },
  doseBtn: {
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.xs + 2,
    borderRadius: T.radius.pill,
    minHeight: 36,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doseBtnDefault: {
    backgroundColor: T.color.accentSoft,
  },
  doseBtnTaken: {
    backgroundColor: T.color.ok,
  },
  doseBtnSecondary: {
    backgroundColor: T.color.fill,
  },
  doseBtnSkipped: {
    backgroundColor: T.color.label3,
  },
  doseBtnText: {
    fontWeight: '600',
  },
  adherenceFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.color.separator,
    paddingTop: T.space.sm,
    marginTop: T.space.xs,
  },
  refillList: {
    gap: T.space.md,
  },
  refillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.space.md,
  },
  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassWrapper: {
    borderRadius: T.radius.pill,
    padding: 4,
    borderCurve: 'continuous',
    ...T.shadow.float,
  },
});
