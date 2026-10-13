import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Daily Meal Log</Text>
          <Text style={styles.sub}>
            Log your breakfast, lunch, dinner & snacks in alignment with your care plan
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

      {/* Date Navigation Strip */}
      <View style={styles.dateStrip}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          onPress={handlePrevDay}
          style={styles.dateNavBtn}
        >
          <Text style={styles.dateNavBtnText}>← Previous</Text>
        </Pressable>

        <View style={styles.dateDisplay}>
          <Text style={styles.dateDisplayText}>{selectedDate}</Text>
          {isToday && <Text style={styles.todayBadge}>TODAY</Text>}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          onPress={handleNextDay}
          style={styles.dateNavBtn}
        >
          <Text style={styles.dateNavBtnText}>Next →</Text>
        </Pressable>
      </View>

      {!isToday && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to today"
          onPress={handleSetToday}
          style={styles.jumpTodayBtn}
        >
          <Text style={styles.jumpTodayBtnText}>Return to Today</Text>
        </Pressable>
      )}

      {/* Calorie Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Total Calories Logged</Text>
            <Text style={styles.summaryValue}>
              {calorieSummary.total} <Text style={styles.summaryUnit}>kcal</Text>
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {meals.length} {meals.length === 1 ? 'meal' : 'meals'} recorded
            </Text>
          </View>
        </View>

        {calorieSummary.unknown > 0 && (
          <View style={styles.unknownNotice}>
            <Text style={styles.unknownNoticeText}>
              ℹ️ {calorieSummary.unknown}{' '}
              {calorieSummary.unknown === 1 ? 'meal' : 'meals'} without calories recorded
            </Text>
          </View>
        )}
      </View>

      {/* Add Meal Form Card */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Log a Meal</Text>

        {/* Meal Type Buttons */}
        <View style={styles.typeRow}>
          {MEAL_TYPES.map((type) => {
            const isSelected = mealType === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`Select meal type ${type}`}
                onPress={() => setMealType(type)}
                style={[styles.typeBtn, isSelected && styles.typeBtnActive]}
              >
                <Text style={[styles.typeBtnText, isSelected && styles.typeBtnTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Description Input */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>What did you eat?</Text>
          <TextInput
            accessibilityLabel="Meal description"
            placeholder="e.g. 2 Roti, Moong Dal, Cucumber Salad"
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              if (formError) setFormError(null);
            }}
            maxLength={MEAL_DESCRIPTION_MAX}
            style={styles.textInput}
          />
          <Text style={styles.charCounter}>
            {description.length}/{MEAL_DESCRIPTION_MAX}
          </Text>
        </View>

        {/* Calories Input */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Calories (kcal, optional):</Text>
          <TextInput
            accessibilityLabel="Meal calories"
            placeholder="e.g. 350 (0 to 5,000)"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            value={caloriesInput}
            onChangeText={(txt) => {
              setCaloriesInput(txt);
              if (formError) setFormError(null);
            }}
            style={styles.textInput}
          />
        </View>

        {/* Error message */}
        {formError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {formError}</Text>
          </View>
        )}

        {/* Submit Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save meal log"
          disabled={addMealMutation.isPending}
          onPress={handleAddMeal}
          style={[styles.submitBtn, addMealMutation.isPending && styles.btnDisabled]}
        >
          {addMealMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>+ Save to Daily Log</Text>
          )}
        </Pressable>
      </View>

      {/* Logged Meals List */}
      <View style={styles.listSection}>
        <Text style={styles.sectionHeader}>Meals on {selectedDate}</Text>

        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0D9488" />
            <Text style={styles.loadingText}>Loading meals…</Text>
          </View>
        )}

        {!isLoading && meals.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No meals logged for this date</Text>
            <Text style={styles.emptySub}>
              Use the form above to log what you ate for breakfast, lunch, dinner, or snack.
            </Text>
          </View>
        )}

        {meals.map((m: DbMealLog) => (
          <View key={m.id} style={styles.mealCard}>
            <View style={styles.mealCardTop}>
              <View style={styles.mealTypeBadge}>
                <Text style={styles.mealTypeBadgeText}>
                  {m.meal.toUpperCase()}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${m.meal} log: ${m.description}`}
                disabled={deleteMealMutation.isPending}
                onPress={() => handleDeleteMeal(m.id)}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteBtnText}>✕ Remove</Text>
              </Pressable>
            </View>

            <Text style={styles.mealDesc}>{m.description}</Text>

            <View style={styles.mealFooter}>
              <Text style={styles.calorieText}>
                {typeof m.calories === 'number' ? (
                  <Text style={styles.calorieHighlight}>{m.calories} kcal</Text>
                ) : (
                  <Text style={styles.calorieUnknown}>Calories not specified</Text>
                )}
              </Text>
              <Text style={styles.timeText}>
                {new Date(m.logged_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        ))}
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
  dateStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  dateNavBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  dateDisplay: { alignItems: 'center', gap: 2 },
  dateDisplayText: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  todayBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F766E',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  jumpTodayBtn: { alignSelf: 'center', paddingVertical: 4 },
  jumpTodayBtnText: { fontSize: 12, color: '#0F766E', fontWeight: '700' },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  summaryValue: { fontSize: 26, fontWeight: '900', color: '#0F766E' },
  summaryUnit: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  countBadgeText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  unknownNotice: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unknownNoticeText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  typeRow: { flexDirection: 'row', gap: 6 },
  typeBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: '#0F766E' },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  typeBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  fieldBlock: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
  },
  charCounter: { alignSelf: 'flex-end', fontSize: 10, color: '#94A3B8' },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  listSection: { gap: 10 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 17 },
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
  },
  mealCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealTypeBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mealTypeBadgeText: { fontSize: 10, fontWeight: '800', color: '#0F766E' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 11, color: '#B91C1C', fontWeight: '700' },
  mealDesc: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
  mealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calorieText: { fontSize: 12, color: '#475569' },
  calorieHighlight: { fontWeight: '700', color: '#0F766E' },
  calorieUnknown: { color: '#94A3B8', fontStyle: 'italic' },
  timeText: { fontSize: 11, color: '#94A3B8' },
});
