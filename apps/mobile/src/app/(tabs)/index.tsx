import React, { useEffect, useRef, useState } from 'react';
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
import { BriefCard } from '@/components/brief-card';
import { Rings } from '@/components/rings';
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
import { useActivityCard } from '@/hooks/use-device-activity';
import { useDeleteDoseLog } from '@/hooks/use-delete-dose-log';
import { T } from '@/constants/theme';

/** The status of one scheduled dose slot, as the row shows it. */
type SlotStatus = 'taken' | 'skipped' | 'missed' | 'pending';

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
  const deleteDoseLogMutation = useDeleteDoseLog();
  const activityModel = useActivityCard(null);

  // Dose Undo (#488): after a Take or Skip, the status from before the action is
  // kept for 10 seconds so the action can be taken back; afterwards a quiet
  // "Change" is the way back. One slot per dose, so doses never undo each other.
  const [undoSlots, setUndoSlots] = useState<Record<string, { prevStatus: SlotStatus }>>({});
  const undoTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [changing, setChanging] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timers = undoTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const dropUndo = (key: string) => {
    const timer = undoTimers.current.get(key);
    if (timer) clearTimeout(timer);
    undoTimers.current.delete(key);
    setUndoSlots((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const offerUndo = (key: string, prevStatus: SlotStatus) => {
    setUndoSlots((prev) => ({ ...prev, [key]: { prevStatus } }));
    const timer = undoTimers.current.get(key);
    if (timer) clearTimeout(timer);
    undoTimers.current.set(key, setTimeout(() => dropUndo(key), 10_000));
  };

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

  // The brief card (#488): the next dose still open today, earliest first.
  const nextPendingSlot = scheduledSlots
    .filter((s) => s.status === 'pending')
    .sort((a, b) => a.scheduledIso.localeCompare(b.scheduledIso))[0];
  const nextDose = nextPendingSlot
    ? { medicineName: nextPendingSlot.medicineName, time: nextPendingSlot.timeStr }
    : null;

  // The care rings (#488): steps only with data and a goal, sleep only with data.
  const stepsRing =
    activityModel.steps && activityModel.steps.goal
      ? { value: activityModel.steps.value, goal: activityModel.steps.goal }
      : null;
  const sleepRing = activityModel.sleep
    ? { minutes: activityModel.sleep.minutes, text: activityModel.sleep.text }
    : null;

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
    slot: { key: string; itemId: string; scheduledIso: string; status: string },
    status: 'taken' | 'skipped'
  ) => {
    try {
      await logDoseMutation.mutateAsync({
        item_id: slot.itemId,
        scheduled_for: slot.scheduledIso,
        status,
      });
      // A confirmation tap for a logged dose (U2): success for taken, nothing for skipped.
      if (status === 'taken') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      // No toast any more: the row itself says Taken or Skipped, with Undo beside it.
      setChanging((prev) => ({ ...prev, [slot.key]: false }));
      offerUndo(slot.key, slot.status as SlotStatus);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not log dose',
        'error'
      );
    }
  };

  const handleUndoDose = async (slot: {
    key: string;
    itemId: string;
    scheduledIso: string;
  }) => {
    const prevStatus = undoSlots[slot.key]?.prevStatus;
    dropUndo(slot.key);
    if (!prevStatus) return;
    try {
      if (prevStatus === 'pending') {
        // Before the action there was no log at all: undoing removes the row.
        await deleteDoseLogMutation.mutateAsync({
          item_id: slot.itemId,
          scheduled_for: slot.scheduledIso,
        });
      } else {
        await logDoseMutation.mutateAsync({
          item_id: slot.itemId,
          scheduled_for: slot.scheduledIso,
          status: prevStatus,
        });
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not undo',
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
        {/* The brief and the care rings (#488) replace "Suggestions for you":
            computed from the day's own data, never written by a model. */}
        <BriefCard nextDose={nextDose} dosesScheduled={scheduledSlots.length} />
        <Rings
          doses={
            scheduledSlots.length > 0
              ? { taken: takenCount, due: scheduledSlots.length }
              : null
          }
          steps={stepsRing}
          sleep={sleepRing}
          showConnectLine={!activityModel.steps && !activityModel.sleep}
          onDosesPress={() => router.push('/(tabs)/meds')}
          onStepsPress={() => router.push('/health-trends')}
          onSleepPress={() => router.push('/health-trends')}
          onConnectPress={() => router.push('/devices')}
        />

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
                const undo = undoSlots[slot.key];
                const showButtons = (!isTaken && !isSkipped) || (changing[slot.key] ?? false);
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

                    {showButtons ? (
                      <View style={styles.doseActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Mark ${slot.medicineName} as taken`}
                          disabled={logDoseMutation.isPending}
                          onPress={() => handleDoseAction(slot, 'taken')}
                          style={[styles.doseBtn, styles.doseBtnDefault]}
                        >
                          <Text variant="footnote" tone="accent" style={styles.doseBtnText}>
                            Take
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Mark ${slot.medicineName} as skipped`}
                          disabled={logDoseMutation.isPending}
                          onPress={() => handleDoseAction(slot, 'skipped')}
                          style={[styles.doseBtn, styles.doseBtnSecondary]}
                        >
                          <Text variant="footnote" tone="tertiary" style={styles.doseBtnText}>
                            Skip
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.doseActions}>
                        {/* Plain words, not a pill (#488): the dose is logged, and
                            for 10 seconds Undo sits beside the word; after that a
                            quiet Change is the way back. */}
                        <Text variant="subhead" style={styles.doseStatusText}>
                          {isTaken ? 'Taken' : 'Skipped'}
                        </Text>
                        {undo ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Undo marking ${slot.medicineName} as ${isTaken ? 'taken' : 'skipped'}`}
                            disabled={logDoseMutation.isPending || deleteDoseLogMutation.isPending}
                            onPress={() => handleUndoDose(slot)}
                            style={styles.quietAction}
                          >
                            <Text variant="subhead" tone="accent" style={styles.doseBtnText}>
                              Undo
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Change the ${isTaken ? 'taken' : 'skipped'} mark for ${slot.medicineName}`}
                            onPress={() =>
                              setChanging((prev) => ({ ...prev, [slot.key]: true }))
                            }
                            style={styles.quietAction}
                          >
                            <Text variant="subhead" tone="tertiary">
                              Change
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
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
  doseBtnSecondary: {
    backgroundColor: T.color.fill,
  },
  doseBtnText: {
    fontWeight: '600',
  },
  doseStatusText: {
    fontWeight: '600',
  },
  quietAction: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.space.xs,
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
