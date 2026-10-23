import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { planMealLabel, planStrings } from '@/components/plan-strings';
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

  // The screen's headings and chrome follow the plan's own language (issue #489);
  // the plan's content text is the server's and is rendered exactly as it arrives.
  const S = planStrings(activePlan?.language);
  const vitalLabel = (vt: VitalType): string => S.vitalTypes[vt] ?? vt;

  const handleGeneratePlan = async () => {
    if (!conditionId) return;
    try {
      await generateMutation.mutateAsync({ condition_id: conditionId });
      showToast(S.generatedToast, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : S.generateFailed,
        'error'
      );
    }
  };

  const handleLogVital = async () => {
    const parsed = parseFloat(vitalVal);
    if (isNaN(parsed) || parsed <= 0) {
      showToast(S.vitalInvalid, 'warning');
      return;
    }
    try {
      await addVitalMutation.mutateAsync({
        type: selectedVital,
        value: parsed,
        unit: VITAL_UNITS[selectedVital],
      });
      setVitalVal('');
      showToast(S.vitalLogged(vitalLabel(selectedVital)), 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : S.vitalLogFailed,
        'error'
      );
    }
  };

  const handleAddMeal = async () => {
    setMealError(null);
    const desc = mealDesc.trim();
    if (!desc) {
      setMealError(S.mealEmptyError);
      showToast(S.mealEmptyError, 'warning');
      return;
    }
    if (desc.length > MEAL_DESCRIPTION_MAX) {
      setMealError(S.mealTooLong(MEAL_DESCRIPTION_MAX));
      showToast(S.mealTooLong(MEAL_DESCRIPTION_MAX), 'warning');
      return;
    }

    let cals: number | null = null;
    if (mealCalories.trim()) {
      const parsed = Number(mealCalories.trim());
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > MEAL_CALORIES_MAX) {
        setMealError(S.caloriesRange(MEAL_CALORIES_MAX));
        showToast(S.caloriesRange(MEAL_CALORIES_MAX), 'warning');
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
      showToast(S.mealLogged, 'success');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : S.mealLogFailed;
      setMealError(msg);
      showToast(msg, 'error');
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      await deleteMealMutation.mutateAsync(id);
      showToast(S.mealRemoved, 'info');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : S.mealRemoveFailed;
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
      eyebrow={S.eyebrow}
      title={activePlan?.condition || S.noPlanTitle}
    >
      {/* Plan Status Badges */}
      {isDoctorApproved ? (
        <Card>
          <Pill text={S.approvedBadge} tone="ok" />
          <Text variant="footnote" tone="secondary">
            {S.approvedNote}
          </Text>
        </Card>
      ) : isPatientGenerated ? (
        <Card>
          <Pill text={S.generatedBadge} tone="warn" />
          <Text variant="footnote" tone="secondary">
            {S.generatedNote}
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
          title={S.emptyTitle}
          body={S.emptyBody}
          action={
            <Button
              title={S.generate}
              icon={
                <Symbol
                  ios="sparkles"
                  android="auto_awesome"
                  size={18}
                  color={T.color.white}
                />
              }
              loading={generateMutation.isPending}
              label={S.generateLabel}
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
            <CardHeader title={S.summary} />
            <Text variant="body" tone="secondary">
              {activePlan.summary}
            </Text>
          </Card>

          {/* Do & Don't Guidance */}
          <Card>
            <CardHeader title={S.whatToDo} />
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
            <CardHeader title={S.whatToAvoid} />
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
              <CardHeader title={S.diet} />
              <View style={styles.dietBlock}>
                <Text variant="headline">{S.eatMore}</Text>
                <Text variant="body" tone="secondary">
                  {activePlan.diet.eat_more.join(' · ')}
                </Text>
              </View>
              <View style={styles.dietBlock}>
                <Text variant="headline">{S.limit}</Text>
                <Text variant="body" tone="secondary">
                  {activePlan.diet.limit.join(' · ')}
                </Text>
              </View>
              {activePlan.diet.sample_day && (
                <View style={styles.sampleDayBox}>
                  <Text variant="footnote" tone="tertiary">
                    {S.sampleDay}
                  </Text>
                  {activePlan.diet.sample_day.map((meal, idx) => (
                    <Text key={idx} variant="footnote" tone="secondary">
                      <Text variant="footnote" style={styles.strong}>
                        {S.mealTypes[meal.meal]}:{' '}
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
              title={S.mealLog}
              trailing={`${mealSummary.total} kcal`}
            />
            <Text variant="footnote" tone="tertiary">
              {S.todayTracking(mealDate)}
            </Text>
            <Button
              title={S.openMealLog}
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
                  {S.mealsWithoutCalories(mealSummary.unknown)}
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
                    subtitle={planMealLabel(S, m.meal)}
                    value={
                      typeof m.calories === 'number'
                        ? `${m.calories} kcal`
                        : S.noCalories
                    }
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={S.deleteMeal(planMealLabel(S, m.meal))}
                        disabled={deleteMealMutation.isPending}
                        onPress={() => handleDeleteMeal(m.id)}
                        style={styles.iconBtn}
                      >
                        <Symbol
                          ios="trash"
                          android="delete"
                          size={18}
                          color={T.color.danger}
                          label={S.deleteMeal(planMealLabel(S, m.meal))}
                        />
                      </Pressable>
                    }
                  />
                ))}
              </ListGroup>
            )}

            {/* Add Meal Form */}
            <View style={styles.formBlock}>
              <Text variant="headline">{S.logMealTitle}</Text>
              <View style={styles.chipRow}>
                {MEAL_TYPES.map((t) => {
                  const isSel = mealType === t;
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="button"
                      accessibilityLabel={S.pickMeal(S.mealTypes[t])}
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
                        {S.mealTypes[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                accessibilityLabel={S.mealDescriptionLabel}
                placeholder={S.mealPlaceholder}
                placeholderTextColor={T.color.label3}
                value={mealDesc}
                onChangeText={(t) => {
                  setMealDesc(t);
                  if (mealError) setMealError(null);
                }}
                maxLength={MEAL_DESCRIPTION_MAX}
                style={styles.input}
              />

              <TextInput
                accessibilityLabel={S.caloriesLabel}
                placeholder={S.caloriesPlaceholder}
                placeholderTextColor={T.color.label3}
                keyboardType="number-pad"
                value={mealCalories}
                onChangeText={(t) => {
                  setMealCalories(t);
                  if (mealError) setMealError(null);
                }}
                style={styles.input}
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
                title={S.logMeal}
                variant="secondary"
                loading={addMealMutation.isPending}
                label={S.logMealLabel}
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
                  {S.redFlags}
                </Text>
              </View>
              <Text variant="footnote" tone="secondary">
                {S.redFlagsNote}
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
              <ListGroup header={S.followUpTests}>
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
                    value={S.everyDays(test.every_days)}
                  />
                ))}
              </ListGroup>
            )}

          {/* Citations & Sources */}
          {activePlan.sources && activePlan.sources.length > 0 && (
            <ListGroup header={S.sources}>
              {activePlan.sources.map((src, idx) => (
                <ListRow
                  key={idx}
                  icon={
                    <IconTile ios="link" android="link" color="gray" />
                  }
                  title={src.title}
                  label={S.openSource(src.title)}
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
        <CardHeader title={S.vitalsTitle} />
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
                accessibilityLabel={S.selectVital(vitalLabel(vt))}
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
          <TextInput
            accessibilityLabel={S.enterVital(vitalLabel(selectedVital))}
            value={vitalVal}
            onChangeText={setVitalVal}
            placeholder={S.enterValue(VITAL_UNITS[selectedVital])}
            placeholderTextColor={T.color.label3}
            keyboardType="numeric"
            style={[styles.input, styles.logInput]}
          />
          <Button
            title={S.logVital}
            variant="secondary"
            size="sm"
            disabled={addVitalMutation.isPending || !vitalVal.trim()}
            loading={addVitalMutation.isPending}
            label={S.logVitalLabel}
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
  input: {
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.md,
    fontSize: 16,
    color: T.color.label,
  },
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
