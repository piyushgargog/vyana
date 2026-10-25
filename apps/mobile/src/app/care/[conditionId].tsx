import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
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
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Symbol,
  Text,
  TextField,
} from '@/components/ui';
import { T } from '@/constants/theme';

const VITAL_TYPES = [
  'sugar_fasting',
  'sugar_random',
  'bp',
  'heart_rate',
  'weight',
  'spo2',
] as const;

function vitalLabel(vt: VitalType): string {
  switch (vt) {
    case 'sugar_fasting':
      return 'Fasting Sugar';
    case 'sugar_random':
      return 'Random Sugar';
    case 'bp':
      return 'Blood Pressure';
    case 'heart_rate':
      return 'Heart Rate';
    case 'weight':
      return 'Weight';
    case 'spo2':
      return 'SpO2';
    default:
      return vt;
  }
}

function vitalIcon(vt: VitalType): { ios: 'drop.fill' | 'heart.fill' | 'waveform.path.ecg' | 'scalemass.fill' | 'lungs.fill'; android: string } {
  switch (vt) {
    case 'sugar_fasting':
    case 'sugar_random':
      return { ios: 'drop.fill', android: 'water_drop' };
    case 'bp':
      return { ios: 'heart.fill', android: 'favorite' };
    case 'heart_rate':
      return { ios: 'waveform.path.ecg', android: 'monitor_heart' };
    case 'weight':
      return { ios: 'scalemass.fill', android: 'scale' };
    case 'spo2':
      return { ios: 'lungs.fill', android: 'air' };
    default:
      return { ios: 'heart.fill', android: 'favorite' };
  }
}

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
    <Screen
      eyebrow="Care plan"
      title={activePlan?.condition || 'Chronic Care Plan'}
    >
      {/* Plan Status Badges */}
      {isDoctorApproved ? (
        <Card>
          <Pill text="Doctor reviewed and approved" tone="ok" />
          <Text variant="footnote" tone="secondary">
            Approved by your doctor. Follow this plan as advised.
          </Text>
        </Card>
      ) : isPatientGenerated ? (
        <Card>
          <Pill text="Patient generated — not reviewed by a doctor" tone="warn" />
          <Text variant="footnote" tone="secondary">
            Created from verified health guidelines. Please discuss these
            guidelines with your doctor.
          </Text>
        </Card>
      ) : null}

      {/* Plan Loading Skeleton */}
      {planLoading && <MobileSkeletonCard lines={4} />}

      {/* If No Plan Exists: Button to Generate Plan */}
      {!activePlan && !planLoading && (
        <EmptyState
          ios="heart.text.square.fill"
          android="clinical_notes"
          title="No care plan active yet"
          body="Generate an evidence-based daily plan with diet, exercise, red flags, and follow-up test reminders from WHO and ICMR guidelines."
          action={
            <Button
              title="Generate care plan"
              icon={
                <Symbol
                  ios="sparkles"
                  android="auto_awesome"
                  size={18}
                  color={T.color.white}
                />
              }
              loading={generateMutation.isPending}
              label="Generate personalized care plan"
              onPress={handleGeneratePlan}
            />
          }
        />
      )}

      {/* Active Care Plan Details */}
      {activePlan && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader title="Summary" />
            <Text variant="body" tone="secondary">
              {activePlan.summary}
            </Text>
          </Card>

          {/* Do & Don't Guidance */}
          <Card>
            <CardHeader title="What to do" />
            {activePlan.do.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Symbol
                  ios="checkmark.circle.fill"
                  android="check_circle"
                  size={20}
                  color={T.color.ok}
                />
                <Text variant="body" style={styles.bulletText}>
                  {item}
                </Text>
              </View>
            ))}
          </Card>

          <Card>
            <CardHeader title="What to avoid" />
            {activePlan.dont.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Symbol
                  ios="xmark.circle.fill"
                  android="cancel"
                  size={20}
                  color={T.color.danger}
                />
                <Text variant="body" style={styles.bulletText}>
                  {item}
                </Text>
              </View>
            ))}
          </Card>

          {/* Diet Plan */}
          {activePlan.diet && (
            <Card>
              <CardHeader title="Diet and nutrition" />
              <View style={styles.dietBlock}>
                <Text variant="headline">Eat more</Text>
                <Text variant="body" tone="secondary">
                  {activePlan.diet.eat_more.join(' · ')}
                </Text>
              </View>
              <View style={styles.dietBlock}>
                <Text variant="headline">Limit or avoid</Text>
                <Text variant="body" tone="secondary">
                  {activePlan.diet.limit.join(' · ')}
                </Text>
              </View>
              {activePlan.diet.sample_day && (
                <View style={styles.sampleDayBox}>
                  <Text variant="footnote" tone="tertiary">
                    Sample day
                  </Text>
                  {activePlan.diet.sample_day.map((meal, idx) => (
                    <Text key={idx} variant="footnote" tone="secondary">
                      <Text variant="footnote" style={styles.strong}>
                        {meal.meal.toUpperCase()}:{' '}
                      </Text>
                      {meal.items.join(', ')}
                    </Text>
                  ))}
                </View>
              )}
            </Card>
          )}

          {/* Patient Daily Meal Log & Calorie Tracker */}
          <Card>
            <CardHeader
              title="Daily meal log"
              trailing={`${mealSummary.total} kcal`}
            />
            <Text variant="footnote" tone="tertiary">
              Today’s diet tracking ({mealDate})
            </Text>
            <Button
              title="Open full meal log"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/care/meals')}
              style={styles.fullLogBtn}
            />

            {mealSummary.unknown > 0 && (
              <View style={styles.noteRow}>
                <Symbol
                  ios="info.circle.fill"
                  android="info"
                  size={16}
                  color={T.color.warn}
                />
                <Text variant="footnote" tone="warn">
                  {mealSummary.unknown}{' '}
                  {mealSummary.unknown === 1 ? 'meal' : 'meals'} without
                  calories
                </Text>
              </View>
            )}

            {todayMeals.length > 0 && (
              <ListGroup>
                {todayMeals.map((m) => (
                  <ListRow
                    key={m.id}
                    icon={
                      <IconTile
                        ios="fork.knife"
                        android="restaurant"
                        color="accent"
                      />
                    }
                    title={m.description}
                    subtitle={m.meal.toUpperCase()}
                    value={
                      typeof m.calories === 'number'
                        ? `${m.calories} kcal`
                        : 'No calories'
                    }
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${m.meal} entry`}
                        disabled={deleteMealMutation.isPending}
                        onPress={() => handleDeleteMeal(m.id)}
                        style={styles.iconBtn}
                      >
                        <Symbol
                          ios="trash"
                          android="delete"
                          size={18}
                          color={T.color.danger}
                          label={`Delete ${m.meal} entry`}
                        />
                      </Pressable>
                    }
                  />
                ))}
              </ListGroup>
            )}

            {/* Add Meal Form */}
            <View style={styles.formBlock}>
              <Text variant="headline">Log today’s meal</Text>
              <View style={styles.chipRow}>
                {MEAL_TYPES.map((t) => {
                  const isSel = mealType === t;
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="button"
                      accessibilityLabel={`Pick meal ${t}`}
                      onPress={() => setMealType(t)}
                      style={[
                        styles.chip,
                        isSel && styles.chipActive,
                      ]}
                    >
                      <Text
                        variant="footnote"
                        tone={isSel ? 'white' : 'secondary'}
                        style={isSel && styles.chipTextActive}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextField
                accessibilityLabel="Meal description"
                placeholder="What did you eat? (e.g. 2 Roti, Sabzi)"
                placeholderTextColor={T.color.label3}
                value={mealDesc}
                onChangeText={(t) => {
                  setMealDesc(t);
                  if (mealError) setMealError(null);
                }}
                maxLength={MEAL_DESCRIPTION_MAX}
              />

              <TextField
                accessibilityLabel="Calories"
                placeholder="Calories in kcal (optional, 0–5000)"
                placeholderTextColor={T.color.label3}
                keyboardType="number-pad"
                value={mealCalories}
                onChangeText={(t) => {
                  setMealCalories(t);
                  if (mealError) setMealError(null);
                }}
              />

              {mealError && (
                <View style={styles.noteRow}>
                  <Symbol
                    ios="exclamationmark.triangle.fill"
                    android="warning"
                    size={16}
                    color={T.color.danger}
                  />
                  <Text variant="footnote" tone="danger">
                    {mealError}
                  </Text>
                </View>
              )}

              <Button
                title="Log meal"
                variant="secondary"
                loading={addMealMutation.isPending}
                label="Log meal entry"
                onPress={handleAddMeal}
              />
            </View>
          </Card>

          {/* Critical Red Flag Symptoms */}
          {activePlan.red_flags && activePlan.red_flags.length > 0 && (
            <Card style={styles.dangerCard}>
              <View style={styles.bulletRow}>
                <Symbol
                  ios="exclamationmark.triangle.fill"
                  android="warning"
                  size={22}
                  color={T.color.danger}
                />
                <Text variant="headline" tone="danger">
                  Critical red flags
                </Text>
              </View>
              <Text variant="footnote" tone="secondary">
                Seek immediate help or call 108
              </Text>
              {activePlan.red_flags.map((flag, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Symbol
                    ios="xmark"
                    android="close"
                    size={14}
                    color={T.color.danger}
                  />
                  <Text variant="body" style={styles.bulletText}>
                    {flag}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          {/* Follow-Up Tests */}
          {activePlan.follow_up_tests &&
            activePlan.follow_up_tests.length > 0 && (
              <ListGroup header="Follow-up tests">
                {activePlan.follow_up_tests.map((test, idx) => (
                  <ListRow
                    key={idx}
                    icon={
                      <IconTile
                        ios="flask.fill"
                        android="science"
                        color="blue"
                      />
                    }
                    title={test.test}
                    value={`Every ${test.every_days} days`}
                  />
                ))}
              </ListGroup>
            )}

          {/* Citations & Sources */}
          {activePlan.sources && activePlan.sources.length > 0 && (
            <ListGroup header="Verified medical sources">
              {activePlan.sources.map((src, idx) => (
                <ListRow
                  key={idx}
                  icon={
                    <IconTile ios="link" android="link" color="gray" />
                  }
                  title={src.title}
                  label={`Open source ${src.title}`}
                  onPress={() => Linking.openURL(src.url)}
                />
              ))}
            </ListGroup>
          )}

          {/* AI Banner */}
          <MobileAiSafetyBanner feature="care_plan" />
        </>
      )}

      {/* Vitals Logging & History Chart */}
      <Card>
        <CardHeader title="Track daily health vitals" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vitalRow}
        >
          {VITAL_TYPES.map((vt) => {
            const isSelected = selectedVital === vt;
            const icon = vitalIcon(vt);
            return (
              <Pressable
                key={vt}
                accessibilityRole="button"
                accessibilityLabel={`Select vital ${vitalLabel(vt)}`}
                onPress={() => setSelectedVital(vt)}
                style={[
                  styles.vitalChip,
                  isSelected && styles.vitalChipActive,
                ]}
              >
                <Symbol
                  ios={icon.ios}
                  android={icon.android}
                  size={16}
                  color={isSelected ? T.color.white : T.color.accent}
                />
                <Text
                  variant="footnote"
                  tone={isSelected ? 'white' : 'secondary'}
                  style={isSelected && styles.chipTextActive}
                >
                  {vitalLabel(vt)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.logRow}>
          <TextField
            accessibilityLabel={`Enter ${vitalLabel(selectedVital)} reading`}
            value={vitalVal}
            onChangeText={setVitalVal}
            placeholder={`Enter value (${VITAL_UNITS[selectedVital]})`}
            placeholderTextColor={T.color.label3}
            keyboardType="numeric"
            style={styles.logInput}
          />
          <Button
            title="Log vital"
            variant="secondary"
            size="sm"
            disabled={addVitalMutation.isPending || !vitalVal.trim()}
            loading={addVitalMutation.isPending}
            label="Log vital reading"
            onPress={handleLogVital}
          />
        </View>

        <MobileTrendChart
          title={vitalLabel(selectedVital)}
          unit={VITAL_UNITS[selectedVital]}
          points={vitalTrendPoints}
          refLow={selectedVital === 'sugar_fasting' ? 70 : null}
          refHigh={selectedVital === 'sugar_fasting' ? 100 : null}
        />
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneBtn: { minHeight: 44, justifyContent: 'center' },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  bulletText: { flex: 1 },
  strong: { fontWeight: '700' },
  dietBlock: { gap: T.space.xs },
  sampleDayBox: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.xs,
  },
  fullLogBtn: { alignSelf: 'flex-start' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
  },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: T.space.lg,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.fill,
  },
  chipActive: { backgroundColor: T.color.accent },
  chipTextActive: { fontWeight: '700' },
  formBlock: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.tile,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.md,
  },
  dangerCard: { backgroundColor: T.color.dangerSoft },
  vitalRow: { gap: T.space.sm, paddingVertical: T.space.xs },
  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
    minHeight: 44,
    paddingHorizontal: T.space.lg,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.fill,
  },
  vitalChipActive: { backgroundColor: T.color.accent },
  logRow: { flexDirection: 'row', gap: T.space.sm, alignItems: 'center' },
  logInput: { flex: 1 },
});
