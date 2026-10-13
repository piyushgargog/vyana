import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  DEFAULT_TIMES,
  parseCarePlanJson,
  useActiveItems,
  useAdherence,
  useCarePlans,
  useConditions,
  useDoseLogs,
  useDrugAlerts,
  useLogDose,
  useMyAppointments,
  useMyProfile,
  type FrequencyType,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  computeItemRefill,
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function PatientHomeScreen() {
  const router = useRouter();
  const { setSelectedBasketMedicines, showToast } = useVyanaMobile();

  const { data: profile } = useMyProfile();
  const { data: activeItems = [], isLoading: itemsLoading } = useActiveItems();
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

  const { data: todayDoseLogs = [] } = useDoseLogs(startOfDay, endOfDay);
  const { data: adherence } = useAdherence(30);
  const { data: appointments = [] } = useMyAppointments();
  const { data: drugAlerts = [] } = useDrugAlerts();
  const logDoseMutation = useLogDose();

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

  const unseenAlerts = drugAlerts.filter((a) => !a.seen);

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* First focusable & largest target: Emergency SOS Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS — Call 108 Ambulance, send location SMS to family, and show nearby hospitals"
        onPress={() => router.push('/sos')}
        style={styles.sosBanner}
      >
        <View style={styles.sosBannerLeft}>
          <Text style={styles.sosBadge}>EMERGENCY SOS · 108 / 112</Text>
          <Text style={styles.sosTitle}>Tap for Immediate Ambulance & Alert</Text>
          <Text style={styles.sosSub}>
            3-sec countdown → Dials 108 · Texts GPS to family · Offline Medical ID
          </Text>
        </View>
        <View style={styles.sosCircle}>
          <Text style={styles.sosCircleText}>SOS</Text>
        </View>
      </Pressable>

      {/* Welcome + Medical ID + Caregiver Circle */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Namaste{profile?.full_name ? `, ${profile.full_name}` : ''}
            </Text>
            <Text style={styles.subGreeting}>
              Blood Group: {profile?.blood_group || '—'} · Allergies:{' '}
              {(profile?.allergies ?? []).join(', ') || 'None recorded'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Offline Medical ID QR Code"
            onPress={() => router.push('/medical-id')}
            style={styles.qrQuickBtn}
          >
            <Text style={styles.qrQuickBtnText}>Medical ID QR</Text>
          </Pressable>
        </View>

        <View style={styles.quickNavRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Caregiver Circle"
            onPress={() => router.push('/caregiver')}
            style={styles.secondaryLinkBtn}
          >
            <Text style={styles.secondaryLinkText}>Caregiver Circle →</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Health Timeline"
            onPress={() => router.push('/timeline')}
            style={styles.secondaryLinkBtn}
          >
            <Text style={styles.secondaryLinkText}>Health Timeline →</Text>
          </Pressable>
        </View>
      </View>

      {/* Unseen CDSCO Drug Safety Alert Banner */}
      {unseenAlerts.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${unseenAlerts.length} CDSCO Drug Quality Alert for your active medicines. Tap to view`}
          onPress={() => router.push('/alerts')}
          style={styles.alertBanner}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.alertBadge}>
              CDSCO DRUG QUALITY ALERT ({unseenAlerts.length})
            </Text>
            <Text style={styles.alertTitle}>
              {unseenAlerts[0].medicine_name}: {unseenAlerts[0].title}
            </Text>
            <Text style={styles.alertSub} numberOfLines={2}>
              {unseenAlerts[0].snippet}
            </Text>
          </View>
          <Text style={styles.alertArrow}>View →</Text>
        </Pressable>
      )}

      {/* Today's Doses + 30-Day Adherence */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Today&apos;s Medicine Schedule</Text>
            <Text style={styles.sectionSub}>
              {takenCount} of {scheduledSlots.length} doses taken today
            </Text>
          </View>
          <View style={styles.adherencePill}>
            <Text style={styles.adherenceText}>
              {adherence ? `${adherence.percent}%` : '—'} 30-day adherence
            </Text>
          </View>
        </View>

        {itemsLoading ? (
          <Text style={styles.sectionSub}>Loading active medicines…</Text>
        ) : scheduledSlots.length === 0 ? (
          <Text style={styles.sectionSub}>
            No scheduled doses for today. Scan a prescription to add medicines.
          </Text>
        ) : (
          scheduledSlots.map((slot) => {
            const isTaken = slot.status === 'taken';
            const isSkipped = slot.status === 'skipped';
            return (
              <View key={slot.key} style={styles.doseRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.doseTitleRow}>
                    <Text style={styles.doseTime}>{slot.timeStr}</Text>
                    <Text style={styles.doseName}>
                      {slot.medicineName} {slot.strength}
                    </Text>
                  </View>
                  <Text style={styles.doseMeta}>
                    {slot.dosage ?? 'As prescribed'} ·{' '}
                    {slot.withFood ? 'with food' : 'before/anytime'} · Status:{' '}
                    <Text
                      style={
                        isTaken
                          ? styles.statusTaken
                          : isSkipped
                            ? styles.statusSkipped
                            : styles.statusPending
                      }
                    >
                      {slot.status.toUpperCase()}
                    </Text>
                  </Text>
                </View>

                <View style={styles.doseActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${slot.medicineName} at ${slot.timeStr} as Taken`}
                    disabled={logDoseMutation.isPending}
                    onPress={() =>
                      handleDoseAction(
                        slot.itemId,
                        slot.scheduledIso,
                        'taken',
                        `${slot.medicineName} ${slot.strength ?? ''}`
                      )
                    }
                    style={[styles.takenBtn, isTaken && styles.takenBtnActive]}
                  >
                    <Text
                      style={[
                        styles.takenBtnText,
                        isTaken && styles.takenBtnTextActive,
                      ]}
                    >
                      {isTaken ? '✓ Taken' : 'Taken'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${slot.medicineName} at ${slot.timeStr} as Skipped`}
                    disabled={logDoseMutation.isPending}
                    onPress={() =>
                      handleDoseAction(
                        slot.itemId,
                        slot.scheduledIso,
                        'skipped',
                        `${slot.medicineName} ${slot.strength ?? ''}`
                      )
                    }
                    style={[styles.skipBtn, isSkipped && styles.skipBtnActive]}
                  >
                    <Text
                      style={[
                        styles.skipBtnText,
                        isSkipped && styles.skipBtnTextActive,
                      ]}
                    >
                      {isSkipped ? 'Skipped' : 'Skip'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Refill-Due Cards */}
      {refillDueItems.length > 0 && (
        <View style={styles.refillSection}>
          <Text style={styles.sectionTitle}>Refill Due Soon</Text>
          {refillDueItems.map(({ item, refill }) => (
            <View key={item.id} style={styles.refillCard}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.refillTitle}>
                  {item.medicine_name} {item.strength} — {refill.daysLeft} days
                  left
                </Text>
                <Text style={styles.refillSub}>
                  {refill.refillDate ? `Refill by ${refill.refillDate} · ` : ''}
                  Qty: {item.quantity_total ?? '—'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reorder ${item.medicine_name} ${item.strength ?? ''} and compare pharmacy prices`}
                onPress={() =>
                  handleReorderSingle(
                    item.medicine_name,
                    item.strength,
                    item.quantity_total
                  )
                }
                style={styles.reorderBtn}
              >
                <Text style={styles.reorderBtnText}>Reorder →</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming OPD Appointment Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Hospital OPD Token</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Book or view OPD appointments"
            onPress={() => router.push('/appointments')}
          >
            <Text style={styles.linkText}>All Hospitals & Tokens →</Text>
          </Pressable>
        </View>

        {nextAppt ? (
          <View style={styles.apptCard}>
            <View style={styles.tokenBadgeRow}>
              <Text style={styles.tokenBadge}>Token #{nextAppt.token_no}</Text>
              <Text style={styles.apptStatusBadge}>
                {nextAppt.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.apptTitle}>
              {nextAppt.hospitals?.name ?? 'Hospital OPD'}
            </Text>
            <Text style={styles.apptDept}>
              {nextAppt.departments?.name ?? 'OPD Department'}
            </Text>
            <Text style={styles.apptInstruction}>
              Token #{nextAppt.token_no} — report to{' '}
              {nextAppt.departments?.name ?? 'OPD'} on{' '}
              {nextAppt.appointment_date}
            </Text>
          </View>
        ) : (
          <Text style={styles.sectionSub}>No upcoming OPD tokens booked.</Text>
        )}
      </View>

      {/* Active Chronic Care Plan (Contract: do, dont, diet, follow_up_tests) */}
      {activeCarePlan && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Care Plan · {activeCarePlan.condition}
              </Text>
              <Text style={styles.sectionSub}>{activeCarePlan.summary}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open full Care Plan"
              onPress={() => router.push(carePlanHref as never)}
            >
              <Text style={styles.linkText}>Full Plan →</Text>
            </Pressable>
          </View>
          <MobileAiSafetyBanner feature="care_plan" />
          <Text style={styles.doseMeta}>
            Do: {activeCarePlan.do.join(' · ')}
          </Text>
          <Text style={styles.doseMeta}>
            Avoid: {activeCarePlan.dont.join(' · ')}
          </Text>
          <Text style={styles.doseMeta}>
            Eat more: {activeCarePlan.diet.eat_more.join(', ')} | Limit:{' '}
            {activeCarePlan.diet.limit.join(', ')}
          </Text>
          {activeCarePlan.follow_up_tests.length > 0 && (
            <Text style={styles.doseMeta}>
              Follow-up tests:{' '}
              {activeCarePlan.follow_up_tests
                .map((ft) => `${ft.test} (every ${ft.every_days}d)`)
                .join(' · ')}
            </Text>
          )}
        </View>
      )}

      {/* Complete Healthcare Quick-Action Grid */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Complete Healthcare Services</Text>
        <View style={styles.grid}>
          {[
            {
              title: 'Scan Prescription',
              sub: 'OCR + Review + Reminders',
              href: '/prescriptions/scan',
            },
            {
              title: 'Compare Rx Basket',
              sub: '1mg · Apollo · Jan Aushadhi',
              href: '/basket',
            },
            {
              title: 'Book OPD Token',
              sub: 'Govt (ORS) & Private OPDs',
              href: '/appointments',
            },
            {
              title: 'Chronic Care Plan',
              sub: 'Doctor-Reviewed Diet & Vitals',
              href: carePlanHref,
            },
            {
              title: 'Symptom Triage',
              sub: 'Urgency & Dept Guidance',
              href: '/triage',
            },
            {
              title: 'Upload Lab Report',
              sub: 'Plain-English + Lab Trends',
              href: '/reports/upload',
            },
            {
              title: 'Compare Lab Prices',
              sub: 'Healthians · Thyrocare · 1mg',
              href: '/labs-compare',
            },
            {
              title: 'PM-JAY Hospitals',
              sub: 'Ayushman Bharat Empanelled',
              href: '/schemes/pmjay',
            },
            {
              title: 'Daily Meal Log',
              sub: 'Nutrition & Calories Tracker',
              href: '/care/meals',
            },
            {
              title: 'Health Timeline',
              sub: 'Chronological Chart & Share',
              href: '/timeline',
            },
          ].map((action) => (
            <Pressable
              key={action.title}
              accessibilityRole="button"
              accessibilityLabel={`${action.title}: ${action.sub}`}
              onPress={() => router.push(action.href as never)}
              style={styles.gridCard}
            >
              <Text style={styles.gridTitle}>{action.title}</Text>
              <Text style={styles.gridSub}>{action.sub}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  sosBanner: {
    backgroundColor: '#DC2626',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#DC2626',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  sosBannerLeft: { flex: 1, gap: 4 },
  sosBadge: {
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sosTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  sosSub: { color: '#FEE2E2', fontSize: 12, lineHeight: 17 },
  sosCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosCircleText: { color: '#DC2626', fontSize: 18, fontWeight: '900' },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  greeting: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  subGreeting: { fontSize: 12, color: '#475569', marginTop: 2 },
  qrQuickBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  qrQuickBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  quickNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryLinkBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryLinkText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  alertBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#78350F' },
  alertSub: { fontSize: 12, color: '#92400E' },
  alertArrow: { fontSize: 12, fontWeight: '800', color: '#B45309' },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#64748B' },
  adherencePill: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  adherenceText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  doseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doseTime: {
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  doseName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  doseMeta: { fontSize: 12, color: '#64748B' },
  statusTaken: { color: '#059669', fontWeight: '700' },
  statusSkipped: { color: '#D97706', fontWeight: '700' },
  statusPending: { color: '#475569', fontWeight: '700' },
  doseActions: { flexDirection: 'row', gap: 6 },
  takenBtn: {
    borderWidth: 1,
    borderColor: '#0D9488',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  takenBtnActive: { backgroundColor: '#0D9488' },
  takenBtnText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  takenBtnTextActive: { color: '#FFFFFF' },
  skipBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  skipBtnActive: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  skipBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  skipBtnTextActive: { color: '#92400E', fontWeight: '700' },
  refillSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  refillCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  refillTitle: { fontSize: 14, fontWeight: '700', color: '#78350F' },
  refillSub: { fontSize: 12, color: '#92400E' },
  reorderBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  reorderBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  linkText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  apptCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  tokenBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenBadge: {
    backgroundColor: '#0F766E',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  apptStatusBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  apptTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  apptDept: { fontSize: 12, fontWeight: '600', color: '#334155' },
  apptInstruction: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '700',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  gridTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  gridSub: { fontSize: 11, color: '#64748B' },
});
