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
  MEAL_CALORIES_MAX,
  MEAL_DESCRIPTION_MAX,
  MEAL_TYPES,
  parseCarePlanJson,
  totalCalories,
  useAddMeal,
  useAddVital,
  useCarePlan,
  useDeleteMeal,
  useGenerateCarePlan,
  useMeals,
  useVitals,
  VITAL_UNITS,
  type CarePlan as CarePlanType,
  type MealType,
  type VitalType,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
  MobileSkeletonCard,
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

  // Meal Log in Care Plan
  const [mealDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mealDesc, setMealDesc] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [mealError, setMealError] = useState<string | null>(null);

  const { data: todayMeals = [] } = useMeals(mealDate);
  const addMealMutation = useAddMeal();
  const deleteMealMutation = useDeleteMeal();
  const mealSummary = totalCalories(todayMeals);

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

  const handleAddMeal = async () => {
    setMealError(null);
    const desc = mealDesc.trim();
    if (!desc) {
      setMealError('Say what you ate');
      showToast('Say what you ate', 'warning');
      return;
    }
    if (desc.length > MEAL_DESCRIPTION_MAX) {
      setMealError(`Keep it under ${MEAL_DESCRIPTION_MAX} characters`);
      showToast(`Keep it under ${MEAL_DESCRIPTION_MAX} characters`, 'warning');
      return;
    }

    let cals: number | null = null;
    if (mealCalories.trim()) {
      const parsed = Number(mealCalories.trim());
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > MEAL_CALORIES_MAX) {
        setMealError(`Calories must be a whole number from 0 to ${MEAL_CALORIES_MAX}`);
        showToast(`Calories must be a whole number from 0 to ${MEAL_CALORIES_MAX}`, 'warning');
        return;
      }
      cals = parsed;
    }

    try {
      await addMealMutation.mutateAsync({
        meal: mealType,
        description: desc,
        calories: cals,
      });
      setMealDesc('');
      setMealCalories('');
      setMealError(null);
      showToast('Meal logged in care plan', 'success');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Could not log meal';
      setMealError(msg);
      showToast(msg, 'error');
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      await deleteMealMutation.mutateAsync(id);
      showToast('Meal entry removed', 'info');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Could not remove meal';
      showToast(msg, 'error');
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
            Approved by your doctor. Follow this plan as advised.
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

      {/* Plan Loading Skeleton */}
      {planLoading && (
        <MobileSkeletonCard lines={4} />
      )}

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

          {/* Patient Daily Meal Log & Calorie Tracker */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Daily Meal Log & Calories</Text>
                <Text style={styles.sectionSub}>
                  Today&apos;s diet tracking ({mealDate})
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open dedicated meal log screen"
                onPress={() => router.push('/care/meals')}
                style={styles.openMealsBtn}
              >
                <Text style={styles.openMealsBtnText}>Full Log →</Text>
              </Pressable>
            </View>

            {/* Calorie Stats */}
            <View style={styles.calorieStatBox}>
              <View style={styles.calorieRow}>
                <Text style={styles.calorieTotalText}>
                  {mealSummary.total}{' '}
                  <Text style={styles.calorieUnitText}>kcal logged</Text>
                </Text>
                <Text style={styles.calorieMealsCount}>
                  {todayMeals.length} {todayMeals.length === 1 ? 'meal' : 'meals'}
                </Text>
              </View>
              {mealSummary.unknown > 0 && (
                <Text style={styles.calorieUnknownNote}>
                  ℹ️ {mealSummary.unknown}{' '}
                  {mealSummary.unknown === 1 ? 'meal' : 'meals'} without calories
                </Text>
              )}
            </View>

            {/* Today's Meals List */}
            {todayMeals.length > 0 && (
              <View style={styles.todayMealsList}>
                {todayMeals.map((m) => (
                  <View key={m.id} style={styles.inlineMealItem}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inlineMealHeader}>
                        <Text style={styles.inlineMealBadge}>
                          {m.meal.toUpperCase()}
                        </Text>
                        <Text style={styles.inlineMealCals}>
                          {typeof m.calories === 'number'
                            ? `${m.calories} kcal`
                            : 'calories unrecorded'}
                        </Text>
                      </View>
                      <Text style={styles.inlineMealDesc}>{m.description}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${m.meal}`}
                      disabled={deleteMealMutation.isPending}
                      onPress={() => handleDeleteMeal(m.id)}
                      style={styles.inlineDeleteBtn}
                    >
                      <Text style={styles.inlineDeleteText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Add Meal Form */}
            <View style={styles.inlineMealForm}>
              <Text style={styles.inlineFormTitle}>Log Today&apos;s Meal</Text>
              <View style={styles.mealTypeRow}>
                {MEAL_TYPES.map((t) => {
                  const isSel = mealType === t;
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="button"
                      accessibilityLabel={`Pick meal ${t}`}
                      onPress={() => setMealType(t)}
                      style={[styles.miniTypeBtn, isSel && styles.miniTypeBtnActive]}
                    >
                      <Text
                        style={[
                          styles.miniTypeBtnText,
                          isSel && styles.miniTypeBtnTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                accessibilityLabel="Meal description"
                placeholder="What did you eat? (e.g. 2 Roti, Sabzi)"
                placeholderTextColor="#94A3B8"
                value={mealDesc}
                onChangeText={(t) => {
                  setMealDesc(t);
                  if (mealError) setMealError(null);
                }}
                maxLength={MEAL_DESCRIPTION_MAX}
                style={styles.inlineInput}
              />

              <TextInput
                accessibilityLabel="Calories"
                placeholder="Calories in kcal (optional, 0–5000)"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={mealCalories}
                onChangeText={(t) => {
                  setMealCalories(t);
                  if (mealError) setMealError(null);
                }}
                style={styles.inlineInput}
              />

              {mealError && (
                <Text style={styles.inlineErrorText}>⚠️ {mealError}</Text>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log meal entry"
                disabled={addMealMutation.isPending}
                onPress={handleAddMeal}
                style={[
                  styles.inlineAddBtn,
                  addMealMutation.isPending && styles.btnDisabled,
                ]}
              >
                {addMealMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.inlineAddBtnText}>+ Log Meal</Text>
                )}
              </Pressable>
            </View>
          </View>

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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
  },
  openMealsBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  openMealsBtnText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  calorieStatBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  calorieTotalText: { fontSize: 18, fontWeight: '800', color: '#0F766E' },
  calorieUnitText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  calorieMealsCount: { fontSize: 12, fontWeight: '600', color: '#475569' },
  calorieUnknownNote: { fontSize: 11, color: '#92400E', fontWeight: '600' },
  todayMealsList: { gap: 8, paddingTop: 4 },
  inlineMealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  inlineMealHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineMealBadge: {
    backgroundColor: '#CCFBF1',
    color: '#0F766E',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inlineMealCals: { fontSize: 11, fontWeight: '600', color: '#475569' },
  inlineMealDesc: { fontSize: 13, color: '#0F172A', marginTop: 2, fontWeight: '500' },
  inlineDeleteBtn: { padding: 4 },
  inlineDeleteText: { fontSize: 12, color: '#B91C1C', fontWeight: '700' },
  inlineMealForm: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  inlineFormTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  mealTypeRow: { flexDirection: 'row', gap: 6 },
  miniTypeBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  miniTypeBtnActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  miniTypeBtnText: { fontSize: 11, fontWeight: '600', color: '#475569', textTransform: 'capitalize' },
  miniTypeBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  inlineInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#0F172A',
  },
  inlineErrorText: { fontSize: 11, color: '#B91C1C', fontWeight: '600' },
  inlineAddBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 2,
  },
  inlineAddBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
