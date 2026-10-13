import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  parseCarePlanJson,
  useAddVital,
  useCarePlan,
  useGenerateCarePlan,
  useVitals,
  VITAL_UNITS,
  type CarePlan as CarePlanType,
  type VitalType,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
  MobileTrendChart,
} from '@/components/ui-primitives';

export default function ConditionCarePlanScreen() {
  const { conditionId } = useLocalSearchParams<{ conditionId: string }>();
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const { data: dbPlan, isLoading: planLoading } = useCarePlan(conditionId);
  const generateMutation = useGenerateCarePlan();

  const [selectedVital, setSelectedVital] =
    useState<VitalType>('sugar_fasting');
  const [vitalVal, setVitalVal] = useState('');
  const { data: vitals = [] } = useVitals(selectedVital, 30);
  const addVitalMutation = useAddVital();

  const activePlan: CarePlanType | null =
    parseCarePlanJson(dbPlan?.plan_json) ??
    (generateMutation.data ? generateMutation.data.plan : null);

  const handleGeneratePlan = async () => {
    if (!conditionId) return;
    try {
      await generateMutation.mutateAsync({ condition_id: conditionId });
      showToast('Generated evidence-based care plan', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not generate care plan',
        'error'
      );
    }
  };

  const handleLogVital = async () => {
    const parsed = parseFloat(vitalVal);
    if (isNaN(parsed) || parsed <= 0) {
      showToast('Please enter a valid vital reading', 'warning');
      return;
    }
    try {
      await addVitalMutation.mutateAsync({
        type: selectedVital,
        value: parsed,
        unit: VITAL_UNITS[selectedVital],
      });
      setVitalVal('');
      showToast(
        `Logged ${selectedVital.replace('_', ' ')} reading`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not log vital',
        'error'
      );
    }
  };

  const vitalTrendPoints = vitals.map((v) => ({
    date: (v.measured_at || '').slice(5, 10) || 'Recent',
    value: v.value,
  }));

  const isDoctorApproved = dbPlan?.status === 'approved';
  const isPatientGenerated =
    dbPlan?.status === 'patient_generated' || Boolean(generateMutation.data);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {activePlan?.condition || 'Chronic Care Plan'}
          </Text>
          <Text style={styles.headerSub}>
            Evidence-based daily guidance & vital tracking
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Done</Text>
        </Pressable>
      </View>

      {/* Plan Status Badges */}
      {isDoctorApproved ? (
        <View style={styles.doctorBadgeCard}>
          <Text style={styles.doctorBadgeTitle}>✓ DOCTOR REVIEWED & APPROVED</Text>
          <Text style={styles.doctorBadgeSub}>
            Approved by Dr. Ananya Kapoor · Follow this plan as advised.
          </Text>
        </View>
      ) : isPatientGenerated ? (
        <View style={styles.patientBadgeCard}>
          <Text style={styles.patientBadgeTitle}>
            ⚠ PATIENT GENERATED · NOT REVIEWED BY A DOCTOR
          </Text>
          <Text style={styles.patientBadgeSub}>
            Created from verified health guidelines. Please discuss these
            guidelines with your doctor.
          </Text>
        </View>
      ) : null}

      {/* If No Plan Exists: Button to Generate Plan */}
      {!activePlan && !planLoading && (
        <View style={styles.noPlanCard}>
          <Text style={styles.noPlanTitle}>No Care Plan Active Yet</Text>
          <Text style={styles.noPlanSub}>
            Generate an evidence-based daily plan with diet, exercise, red flags,
            and follow-up test reminders from WHO & ICMR guidelines.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Generate personalized care plan"
            disabled={generateMutation.isPending}
            onPress={handleGeneratePlan}
            style={styles.generatePlanBtn}
          >
            {generateMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.generatePlanBtnText}>
                ✨ Generate Evidence-Based Care Plan
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Active Care Plan Details */}
      {activePlan && (
        <View style={styles.planContainer}>
          {/* Summary */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summaryText}>{activePlan.summary}</Text>
          </View>

          {/* Do & Don't Guidance */}
          <View style={styles.doDontRow}>
            <View style={styles.doCard}>
              <Text style={styles.doTitle}>✓ What to Do</Text>
              {activePlan.do.map((item, i) => (
                <Text key={i} style={styles.doText}>
                  • {item}
                </Text>
              ))}
            </View>

            <View style={styles.dontCard}>
              <Text style={styles.dontTitle}>✕ What to Avoid</Text>
              {activePlan.dont.map((item, i) => (
                <Text key={i} style={styles.dontText}>
                  • {item}
                </Text>
              ))}
            </View>
          </View>

          {/* Diet Plan */}
          {activePlan.diet && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Diet & Nutrition</Text>

              <View style={styles.dietSubBlock}>
                <Text style={styles.dietSubTitle}>Eat More:</Text>
                <Text style={styles.dietItemsText}>
                  {activePlan.diet.eat_more.join(' · ')}
                </Text>
              </View>

              <View style={styles.dietSubBlock}>
                <Text style={styles.dietSubTitle}>Limit / Avoid:</Text>
                <Text style={styles.dietItemsText}>
                  {activePlan.diet.limit.join(' · ')}
                </Text>
              </View>

              {activePlan.diet.sample_day && (
                <View style={styles.sampleDayBox}>
                  <Text style={styles.sampleDayTitle}>Sample Day Routine:</Text>
                  {activePlan.diet.sample_day.map((meal, idx) => (
                    <Text key={idx} style={styles.mealRow}>
                      <Text style={styles.mealName}>
                        {meal.meal.toUpperCase()}:
                      </Text>{' '}
                      {meal.items.join(', ')}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Critical Red Flag Symptoms */}
          {activePlan.red_flags && activePlan.red_flags.length > 0 && (
            <View style={styles.redFlagsCard}>
              <Text style={styles.redFlagsTitle}>
                🚨 Critical Red Flags (Seek Immediate Help / Call 108)
              </Text>
              {activePlan.red_flags.map((flag, idx) => (
                <Text key={idx} style={styles.redFlagText}>
                  • {flag}
                </Text>
              ))}
            </View>
          )}

          {/* Follow-Up Tests */}
          {activePlan.follow_up_tests &&
            activePlan.follow_up_tests.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Recommended Follow-Up Tests
                </Text>
                {activePlan.follow_up_tests.map((test, idx) => (
                  <View key={idx} style={styles.testRow}>
                    <Text style={styles.testName}>{test.test}</Text>
                    <Text style={styles.testFreq}>
                      Every {test.every_days} days
                    </Text>
                  </View>
                ))}
              </View>
            )}

          {/* Citations & Sources */}
          {activePlan.sources && activePlan.sources.length > 0 && (
            <View style={styles.sourcesCard}>
              <Text style={styles.sourcesTitle}>Verified Medical Sources</Text>
              {activePlan.sources.map((src, idx) => (
                <Pressable
                  key={idx}
                  accessibilityRole="button"
                  accessibilityLabel={`Open source ${src.title}`}
                  onPress={() => Linking.openURL(src.url)}
                  style={styles.sourceLink}
                >
                  <Text style={styles.sourceLinkText}>
                    🔗 {src.title} ↗
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* AI Banner */}
          <MobileAiSafetyBanner feature="care_plan" />
        </View>
      )}

      {/* Vitals Logging & History Chart */}
      <View style={styles.vitalsSection}>
        <Text style={styles.sectionTitle}>Track Daily Health Vitals</Text>

        {/* Vital Type Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vitalTypeRow}
        >
          {(
            [
              'sugar_fasting',
              'sugar_random',
              'bp',
              'heart_rate',
              'weight',
              'spo2',
            ] as const
          ).map((vt) => {
            const isSelected = selectedVital === vt;
            return (
              <Pressable
                key={vt}
                accessibilityRole="button"
                accessibilityLabel={`Select vital ${vt}`}
                onPress={() => setSelectedVital(vt)}
                style={[
                  styles.vitalPill,
                  isSelected && styles.vitalPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.vitalPillText,
                    isSelected && styles.vitalPillTextSelected,
                  ]}
                >
                  {vt === 'sugar_fasting'
                    ? 'Fasting Sugar'
                    : vt === 'sugar_random'
                      ? 'Random Sugar'
                      : vt === 'bp'
                        ? 'Blood Pressure'
                        : vt === 'heart_rate'
                          ? 'Heart Rate'
                          : vt === 'weight'
                            ? 'Weight'
                            : 'SpO2'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Log Reading Form */}
        <View style={styles.logVitalBox}>
          <TextInput
            accessibilityLabel={`Enter ${selectedVital} reading`}
            value={vitalVal}
            onChangeText={setVitalVal}
            placeholder={`Enter value (${VITAL_UNITS[selectedVital]})`}
            keyboardType="numeric"
            style={styles.vitalInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log vital reading"
            disabled={addVitalMutation.isPending || !vitalVal.trim()}
            onPress={handleLogVital}
            style={styles.logVitalBtn}
          >
            <Text style={styles.logVitalBtnText}>+ Log Vital</Text>
          </Pressable>
        </View>

        {/* Trend Chart */}
        <MobileTrendChart
          title={
            selectedVital === 'sugar_fasting'
              ? 'Fasting Blood Sugar'
              : selectedVital === 'sugar_random'
                ? 'Random Blood Sugar'
                : selectedVital === 'bp'
                  ? 'Blood Pressure'
                  : selectedVital === 'heart_rate'
                    ? 'Heart Rate'
                    : selectedVital === 'weight'
                      ? 'Weight'
                      : 'SpO2'
          }
          unit={VITAL_UNITS[selectedVital]}
          points={vitalTrendPoints}
          refLow={selectedVital === 'sugar_fasting' ? 70 : null}
          refHigh={selectedVital === 'sugar_fasting' ? 100 : null}
        />
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
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 13, color: '#64748B' },
  backBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  doctorBadgeCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  doctorBadgeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 1,
  },
  doctorBadgeSub: { fontSize: 12, color: '#047857' },
  patientBadgeCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  patientBadgeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 1,
  },
  patientBadgeSub: { fontSize: 12, color: '#78350F' },
  noPlanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noPlanTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  noPlanSub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  generatePlanBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  generatePlanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  planContainer: { gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  summaryText: { fontSize: 14, color: '#334155', lineHeight: 21 },
  doDontRow: { gap: 12 },
  doCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  doTitle: { fontSize: 14, fontWeight: '800', color: '#166534' },
  doText: { fontSize: 13, color: '#14532D', lineHeight: 18 },
  dontCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  dontTitle: { fontSize: 14, fontWeight: '800', color: '#991B1B' },
  dontText: { fontSize: 13, color: '#7F1D1D', lineHeight: 18 },
  dietSubBlock: { gap: 2 },
  dietSubTitle: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  dietItemsText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  sampleDayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    marginTop: 4,
  },
  sampleDayTitle: { fontSize: 12, fontWeight: '700', color: '#475569' },
  mealRow: { fontSize: 12, color: '#334155' },
  mealName: { fontWeight: '700', color: '#0F172A' },
  redFlagsCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  redFlagsTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  redFlagText: { fontSize: 12, color: '#7F1D1D', lineHeight: 17 },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  testName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  testFreq: { fontSize: 12, fontWeight: '700', color: '#0D9488' },
  sourcesCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  sourcesTitle: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  sourceLink: { paddingVertical: 2 },
  sourceLinkText: { fontSize: 12, color: '#0F766E', fontWeight: '600' },
  vitalsSection: { gap: 12, marginTop: 4 },
  vitalTypeRow: { gap: 8, paddingBottom: 4 },
  vitalPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  vitalPillSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  vitalPillText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  vitalPillTextSelected: { color: '#FFFFFF' },
  logVitalBox: { flexDirection: 'row', gap: 10 },
  vitalInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  logVitalBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    justifyContent: 'center',
  },
  logVitalBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
