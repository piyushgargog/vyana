import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DbMealLog,
  MEAL_CALORIES_MAX,
  MEAL_DESCRIPTION_MAX,
  MEAL_TYPES,
  MealType,
  totalCalories,
  useAddMeal,
  useDeleteMeal,
  useMeals,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  ListGroup,
  ListRow,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function MealsScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString);

  // Form states
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [description, setDescription] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: meals = [], isLoading } = useMeals(selectedDate);
  const addMealMutation = useAddMeal();
  const deleteMealMutation = useDeleteMeal();

  const calorieSummary = useMemo(() => {
    return totalCalories(meals);
  }, [meals]);

  const handlePrevDay = () => {
    setSelectedDate((prev) => shiftDateString(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => shiftDateString(prev, 1));
  };

  const handleSetToday = () => {
    setSelectedDate(getTodayString());
  };

  const handleAddMeal = async () => {
    setFormError(null);
    const cleanDesc = description.trim();
    if (!cleanDesc) {
      setFormError('Say what you ate');
      showToast('Say what you ate', 'warning');
      return;
    }
    if (cleanDesc.length > MEAL_DESCRIPTION_MAX) {
      setFormError(`Keep it under ${MEAL_DESCRIPTION_MAX} characters`);
      showToast(`Keep it under ${MEAL_DESCRIPTION_MAX} characters`, 'warning');
      return;
    }

    let caloriesVal: number | null = null;
    if (caloriesInput.trim()) {
      const parsed = Number(caloriesInput.trim());
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > MEAL_CALORIES_MAX) {
        setFormError(`Calories must be a whole number from 0 to ${MEAL_CALORIES_MAX}`);
        showToast(`Calories must be a whole number from 0 to ${MEAL_CALORIES_MAX}`, 'warning');
        return;
      }
      caloriesVal = parsed;
    }

    try {
      await addMealMutation.mutateAsync({
        meal: mealType,
        description: cleanDesc,
        calories: caloriesVal,
      });
      setDescription('');
      setCaloriesInput('');
      setFormError(null);
      showToast('Meal logged successfully', 'success');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Could not log meal';
      setFormError(msg);
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

  const isToday = selectedDate === getTodayString();

  return (
    <Screen
      eyebrow="Care"
      title="Daily Meal Log"
      trailing={
        <Button
          title="Done"
          variant="plain"
          size="sm"
          label="Back"
          onPress={() => router.back()}
          style={styles.doneBtn}
        />
      }
    >
      <Text variant="subhead" tone="secondary">
        Log your breakfast, lunch, dinner and snacks in alignment with your
        care plan.
      </Text>

      <MobileAiSafetyBanner />

      {/* Date Navigation Strip */}
      <Card>
        <View style={styles.dateStrip}>
          <Button
            title="Previous"
            variant="plain"
            size="sm"
            icon={
              <Symbol
                ios="chevron.left"
                android="chevron_left"
                size={16}
                color={T.color.accentStrong}
              />
            }
            label="Previous day"
            onPress={handlePrevDay}
          />
          <View style={styles.dateDisplay}>
            <Text variant="headline">{selectedDate}</Text>
            {isToday && (
              <View style={styles.todayPill}>
                <Text variant="caption" tone="accent" style={styles.todayText}>
                  Today
                </Text>
              </View>
            )}
          </View>
          <Button
            title="Next"
            variant="plain"
            size="sm"
            icon={
              <Symbol
                ios="chevron.right"
                android="chevron_right"
                size={16}
                color={T.color.accentStrong}
              />
            }
            label="Next day"
            onPress={handleNextDay}
          />
        </View>
        {!isToday && (
          <Button
            title="Return to today"
            variant="plain"
            size="sm"
            label="Return to today"
            onPress={handleSetToday}
            style={styles.jumpToday}
          />
        )}
      </Card>

      {/* Calorie Summary Card */}
      <Card>
        <CardHeader
          title="Calories logged"
          trailing={`${meals.length} ${meals.length === 1 ? 'meal' : 'meals'}`}
        />
        <Text variant="title1" tone="accent">
          {calorieSummary.total}{' '}
          <Text variant="callout" tone="tertiary">
            kcal
          </Text>
        </Text>
        {calorieSummary.unknown > 0 && (
          <View style={styles.noteRow}>
            <Symbol
              ios="info.circle.fill"
              android="info"
              size={16}
              color={T.color.warn}
            />
            <Text variant="footnote" tone="warn">
              {calorieSummary.unknown}{' '}
              {calorieSummary.unknown === 1 ? 'meal' : 'meals'} without
              calories recorded
            </Text>
          </View>
        )}
      </Card>

      {/* Add Meal Form Card */}
      <Card>
        <CardHeader title="Log a meal" />

        {/* Meal Type Buttons */}
        <View style={styles.chipRow}>
          {MEAL_TYPES.map((type) => {
            const isSelected = mealType === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`Select meal type ${type}`}
                onPress={() => setMealType(type)}
                style={[styles.chip, isSelected && styles.chipActive]}
              >
                <Text
                  variant="footnote"
                  tone={isSelected ? 'white' : 'secondary'}
                  style={isSelected && styles.chipTextActive}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Description Input */}
        <View style={styles.fieldBlock}>
          <Text variant="subhead">What did you eat?</Text>
          <TextInput
            accessibilityLabel="Meal description"
            placeholder="e.g. 2 Roti, Moong Dal, Cucumber Salad"
            placeholderTextColor={T.color.label3}
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              if (formError) setFormError(null);
            }}
            maxLength={MEAL_DESCRIPTION_MAX}
            style={styles.input}
          />
          <Text variant="caption" tone="tertiary" style={styles.charCounter}>
            {description.length}/{MEAL_DESCRIPTION_MAX}
          </Text>
        </View>

        {/* Calories Input */}
        <View style={styles.fieldBlock}>
          <Text variant="subhead">Calories (kcal, optional)</Text>
          <TextInput
            accessibilityLabel="Meal calories"
            placeholder="e.g. 350 (0 to 5,000)"
            placeholderTextColor={T.color.label3}
            keyboardType="number-pad"
            value={caloriesInput}
            onChangeText={(txt) => {
              setCaloriesInput(txt);
              if (formError) setFormError(null);
            }}
            style={styles.input}
          />
        </View>

        {/* Error message */}
        {formError && (
          <View style={styles.noteRow}>
            <Symbol
              ios="exclamationmark.triangle.fill"
              android="warning"
              size={16}
              color={T.color.danger}
            />
            <Text variant="footnote" tone="danger">
              {formError}
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <Button
          title="Save to daily log"
          loading={addMealMutation.isPending}
          label="Save meal log"
          onPress={handleAddMeal}
        />
      </Card>

      {/* Logged Meals List */}
      {isLoading ? (
        <Card>
          <Text variant="subhead" tone="tertiary" style={styles.center}>
            Loading meals…
          </Text>
        </Card>
      ) : meals.length === 0 ? (
        <EmptyState
          ios="fork.knife"
          android="restaurant"
          title="No meals logged"
          body={`Use the form above to log what you ate on ${selectedDate}.`}
        />
      ) : (
        <ListGroup header={`Meals on ${selectedDate}`}>
          {meals.map((m: DbMealLog) => (
            <ListRow
              key={m.id}
              icon={
                <IconTile ios="fork.knife" android="restaurant" color="accent" />
              }
              title={m.description}
              subtitle={`${m.meal.toUpperCase()} · ${new Date(
                m.logged_at
              ).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}`}
              value={
                typeof m.calories === 'number'
                  ? `${m.calories} kcal`
                  : 'No calories'
              }
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${m.meal} log: ${m.description}`}
                  disabled={deleteMealMutation.isPending}
                  onPress={() => handleDeleteMeal(m.id)}
                  style={styles.iconBtn}
                >
                  <Symbol
                    ios="trash"
                    android="delete"
                    size={18}
                    color={T.color.danger}
                    label={`Delete ${m.meal} log`}
                  />
                </Pressable>
              }
            />
          ))}
        </ListGroup>
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneBtn: { minHeight: 44, justifyContent: 'center' },
  dateStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateDisplay: { alignItems: 'center', gap: T.space.xs },
  todayPill: {
    backgroundColor: T.color.accentSoft,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.sm,
    paddingVertical: 2,
  },
  todayText: { fontWeight: '700', textTransform: 'uppercase' },
  jumpToday: { alignSelf: 'center' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
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
  fieldBlock: { gap: T.space.xs },
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
  charCounter: { alignSelf: 'flex-end' },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
