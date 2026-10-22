import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { T } from '@/constants/theme';
import {
  useCheckInteractions,
  usePrescription,
  useSetItemActive,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  computeItemRefill,
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setSelectedBasketMedicines, showToast } = useVyanaMobile();

  const { data: prescription, isLoading } = usePrescription(id);
  const toggleMutation = useSetItemActive();
  const interactionsMutation = useCheckInteractions();

  const handleOrderWholeRx = () => {
    if (!prescription) return;
    const basketItems = prescription.prescription_items
      .filter((i) => i.active)
      .map((i) => ({
        name: i.medicine_name,
        strength: i.strength ?? undefined,
        quantity:
          i.quantity_total && i.quantity_total > 0 ? i.quantity_total : 30,
      }));

    if (basketItems.length === 0) {
      showToast('No active medicines in this prescription', 'warning');
      return;
    }

    setSelectedBasketMedicines(basketItems);
    router.push('/basket');
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

  const handleToggleItem = async (itemId: string, nextActive: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: itemId, active: nextActive });
      showToast(
        nextActive ? 'Medicine activated' : 'Medicine paused',
        'info'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not update medicine',
        'error'
      );
    }
  };

  const handleCheckInteractions = async () => {
    if (!id) return;
    try {
      await interactionsMutation.mutateAsync({ prescription_id: id });
      showToast('Checked interactions for this prescription', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Interaction check failed',
        'error'
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={T.color.accent} />
        <Text style={styles.loadingText}>Loading prescription…</Text>
      </View>
    );
  }

  if (!prescription) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundTitle}>Prescription Not Found</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Back to Medicines</Text>
        </Pressable>
      </View>
    );
  }

  const items = prescription.prescription_items ?? [];
  const now = new Date();
  const interactionsData = interactionsMutation.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {prescription.doctor_name
              ? `Prescription · ${prescription.doctor_name}`
              : 'Prescription Details'}
          </Text>
          <Text style={styles.headerSub}>
            Issued on {prescription.issued_on || '—'} · Source:{' '}
            {prescription.source === 'doctor'
              ? 'Doctor e-Rx'
              : 'Scanned Paper Rx'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      {/* Diagnosis & Action Banner */}
      <View style={styles.overviewCard}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Diagnosis</Text>
          <Text style={styles.metaValue}>
            {prescription.diagnosis || 'General Consultation'}
          </Text>
        </View>

        {prescription.notes && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Doctor Notes</Text>
            <Text style={styles.metaValue}>{prescription.notes}</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compare full prescription basket across pharmacies"
            onPress={handleOrderWholeRx}
            style={styles.orderWholeBtn}
          >
            <Text style={styles.orderWholeBtnText}>
              🛒 Order Whole Rx on 1mg / PharmEasy
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check drug interactions for this prescription"
            disabled={interactionsMutation.isPending}
            onPress={handleCheckInteractions}
            style={styles.interactionsBtn}
          >
            <Text style={styles.interactionsBtnText}>
              {interactionsMutation.isPending
                ? 'Checking…'
                : 'Check Drug Interactions'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Interactions Result Card */}
      {interactionsData && (
        <View style={styles.interactionsCard}>
          <Text style={styles.interactionsTitle}>Drug Interaction Analysis</Text>
          <MobileAiSafetyBanner feature="interactions" />

          {interactionsData.interactions.length === 0 ? (
            <View style={styles.noInteractionsBox}>
              <Text style={styles.noInteractionsText}>
                No interaction found in:{' '}
                {interactionsData.sources_checked.map((s) => s.title).join(', ') ||
                  'checked clinical sources'}
              </Text>
            </View>
          ) : (
            interactionsData.interactions.map((inter, i) => (
              <View key={i} style={styles.interactionRow}>
                <View style={styles.interBadgeRow}>
                  <Text
                    style={[
                      styles.interBadge,
                      inter.severity === 'major'
                        ? styles.interMajor
                        : inter.severity === 'moderate'
                          ? styles.interModerate
                          : styles.interMinor,
                    ]}
                  >
                    {inter.severity.toUpperCase()}
                  </Text>
                  <Text style={styles.interNames}>
                    {inter.medicine_a} + {inter.medicine_b}
                  </Text>
                </View>

              {inter.layer && (
                <Text style={styles.interLayer}>
                  {inter.layer === 'table'
                    ? 'From the reviewed list'
                    : 'From a trusted source'}
                </Text>
              )}

              {inter.effect ? (
                <Text style={styles.interEffect}>{inter.effect}</Text>
              ) : null}

              <Text style={styles.interAdvice}>Guidance: {inter.advice}</Text>

              {inter.quote ? (
                <Text style={styles.interQuote}>
                  Verbatim Evidence: &ldquo;{inter.quote}&rdquo;
                </Text>
              ) : null}

              {inter.sources && inter.sources.length > 0 && (
                <Text style={styles.interSources}>
                  Sources:{' '}
                  {inter.sources
                    .map((s) => `${s.title} (${s.url})`)
                    .join(' · ')}
                </Text>
              )}
            </View>
          ))
        )}

        {interactionsData.not_checked &&
          interactionsData.not_checked.length > 0 && (
            <Text style={styles.notCheckedText}>
              Not checked: {interactionsData.not_checked.join(', ')}
            </Text>
          )}
      </View>
    )}

      {/* Prescribed Items */}
      <Text style={styles.sectionTitle}>Prescribed Medicines ({items.length})</Text>

      {items.map((item) => {
        const refill = computeItemRefill(item, now);
        return (
          <View
            key={item.id}
            style={[
              styles.itemCard,
              !item.active && styles.itemCardPaused,
            ]}
          >

            <View style={styles.itemHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>
                  {item.medicine_name} {item.strength || ''}
                </Text>
                <Text style={styles.medSchedule}>
                  {item.dose ? `${item.dose} · ` : ''}{item.frequency} (
                  {(item.times ?? []).join(', ') || 'as scheduled'}) ·{' '}
                  {item.with_food ? `${item.with_food} food` : 'food timing not specified'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  item.active ? 'Pause medicine' : 'Activate medicine'
                }
                onPress={() => handleToggleItem(item.id, !item.active)}
                style={[
                  styles.toggleBtn,
                  item.active ? styles.toggleActive : styles.togglePaused,
                ]}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    item.active
                      ? styles.toggleBtnTextActive
                      : styles.toggleBtnTextPaused,
                  ]}
                >
                  {item.active ? 'Active' : 'Paused'}
                </Text>
              </Pressable>
            </View>

            {/* Refill status badge */}
            <View style={styles.refillRow}>
              <Text
                style={[
                  styles.refillText,
                  refill.needsRefillSoon
                    ? styles.refillDueText
                    : styles.refillOkText,
                ]}
              >
                {refill.daysLeft == null
                  ? 'Refill: days left not known'
                  : refill.needsRefillSoon
                    ? `⚠ Refill Due: ~${refill.daysLeft} days remaining`
                    : `Refill: ~${refill.daysLeft} days remaining`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reorder ${item.medicine_name}`}
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

            {item.instructions && (
              <Text style={styles.instructionsText}>
                Instructions: {item.instructions}
              </Text>
            )}
          </View>
        );
      })}

      <MobileAiSafetyBanner feature="prescriptions" />
      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.color.canvas },
  content: { padding: 16, gap: 14 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: { fontSize: 13, color: T.color.label2 },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  notFoundTitle: { fontSize: 16, fontWeight: '700', color: T.color.label },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: T.color.label },
  headerSub: { fontSize: 12, color: T.color.label2 },
  backBtn: {
    backgroundColor: T.color.accentStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  backBtnText: { color: T.color.white, fontWeight: '700', fontSize: 12 },
  overviewCard: {
    backgroundColor: T.color.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: T.color.separator,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: T.color.separator,
  },
  metaLabel: { fontSize: 12, color: T.color.label2, fontWeight: '500' },
  metaValue: { fontSize: 13, color: T.color.label, fontWeight: '700', flex: 1, textAlign: 'right' },
  actionRow: { gap: 8, marginTop: 4 },
  orderWholeBtn: {
    backgroundColor: T.color.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  orderWholeBtnText: { color: T.color.white, fontSize: 14, fontWeight: '700' },
  interactionsBtn: {
    backgroundColor: T.color.fill,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  interactionsBtnText: { color: T.color.label, fontSize: 13, fontWeight: '600' },
  interactionsCard: {
    backgroundColor: T.color.warnSoft,
    borderColor: T.color.separator,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  interactionsTitle: { fontSize: 14, fontWeight: '800', color: T.color.warn },
  noInteractionsBox: {
    backgroundColor: T.color.okSoft,
    borderColor: T.color.separator,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  noInteractionsText: { fontSize: 12, color: T.color.ok, fontWeight: '600' },
  interactionRow: {
    backgroundColor: T.color.surface,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  interBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  interBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: T.color.white,
  },
  interMajor: { backgroundColor: T.color.danger },
  interModerate: { backgroundColor: T.color.warn },
  interMinor: { backgroundColor: T.color.label3 },
  interNames: { fontSize: 13, fontWeight: '700', color: T.color.label },
  interLayer: { fontSize: 11, fontWeight: '700', color: T.color.accent },
  interEffect: { fontSize: 12, color: T.color.label, fontWeight: '500' },
  interAdvice: { fontSize: 12, color: T.color.label },
  interQuote: { fontSize: 11, color: T.color.label2, fontStyle: 'italic' },
  interSources: { fontSize: 11, color: T.color.label2 },
  notCheckedText: { fontSize: 11, color: T.color.warn, fontWeight: '600', paddingTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: T.color.label },
  itemCard: {
    backgroundColor: T.color.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: T.color.separator,
  },
  itemCardPaused: { opacity: 0.65 },
  itemCardReview: { borderColor: T.color.warn, borderWidth: 2 },
  reviewBanner: {
    backgroundColor: T.color.warnSoft,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  reviewBannerText: { fontSize: 11, fontWeight: '800', color: T.color.warn },
  reviewEvidenceText: { fontSize: 11, color: T.color.warn, fontStyle: 'italic' },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  medName: { fontSize: 16, fontWeight: '700', color: T.color.label },
  medSchedule: { fontSize: 12, color: T.color.label2 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleActive: { backgroundColor: T.color.okSoft },
  togglePaused: { backgroundColor: T.color.fill },
  toggleBtnText: { fontSize: 11, fontWeight: '700' },
  toggleBtnTextActive: { color: T.color.ok },
  toggleBtnTextPaused: { color: T.color.label2 },
  refillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  refillText: { fontSize: 12, fontWeight: '600' },
  refillDueText: { color: T.color.dangerText },
  refillOkText: { color: T.color.accent },
  reorderBtn: {
    backgroundColor: T.color.accentStrong,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reorderBtnText: { color: T.color.white, fontSize: 12, fontWeight: '700' },
  instructionsText: { fontSize: 12, color: T.color.label2, fontStyle: 'italic' },
});
