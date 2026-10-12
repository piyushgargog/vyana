import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useBasketJob,
  useCheckInteractions,
  useCompareMedicine,
  usePrescriptions,
  useSetItemActive,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  computeItemRefill,
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function MobileMedsTab() {
  const router = useRouter();
  const { setSelectedBasketMedicines, showToast } = useVyanaMobile();

  const { data: rxList = [], isLoading: rxLoading } = usePrescriptions();
  const toggleMutation = useSetItemActive();
  const compareSingleMutation = useCompareMedicine();
  const interactionsMutation = useCheckInteractions();

  const [singleMedQuery, setSingleMedQuery] = useState('');
  const [singleStrength, setSingleStrength] = useState('');
  const [singleJobId, setSingleJobId] = useState<string | null>(null);
  const { data: singleJobData } = useBasketJob(singleJobId);

  const allActiveMedNames = rxList
    .flatMap((rx) => rx.prescription_items.filter((i) => i.active))
    .map((i) => i.medicine_name);

  const handleOrderWholeRx = (rxId: string) => {
    const rx = rxList.find((r) => r.id === rxId);
    if (!rx) return;
    const basketItems = rx.prescription_items
      .filter((i) => i.active)
      .map((i) => ({
        name: i.medicine_name,
        strength: i.strength ?? undefined,
        quantity:
          i.quantity_total && i.quantity_total > 0 ? i.quantity_total : 30,
      }));
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
        nextActive ? 'Medicine marked active' : 'Medicine paused',
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
    try {
      await interactionsMutation.mutateAsync({});
      showToast('Checked drug-drug interactions', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Interaction check failed',
        'error'
      );
    }
  };

  const handleSingleMedicineSearch = async () => {
    if (!singleMedQuery.trim()) return;
    try {
      const res = await compareSingleMutation.mutateAsync({
        medicine: singleMedQuery.trim(),
        strength: singleStrength.trim() || undefined,
      });
      setSingleJobId(res.job_id);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Price lookup failed',
        'error'
      );
    }
  };

  const singleResult = singleJobData ?? compareSingleMutation.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Action Bar */}
      <View style={styles.topActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan a new prescription"
          onPress={() => router.push('/prescriptions/scan')}
          style={styles.scanBtn}
        >
          <Text style={styles.scanBtnText}>+ Scan Prescription (OCR)</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compare full prescription basket across pharmacies"
          onPress={() => router.push('/basket')}
          style={styles.basketBtn}
        >
          <Text style={styles.basketBtnText}>Compare Full Basket →</Text>
        </Pressable>
      </View>

      {/* Drug Interaction Checker Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Drug–Drug Interaction Check</Text>
            <Text style={styles.cardSub}>
              Checks active medicines ({allActiveMedNames.join(', ') || 'None'})
              against a reviewed list of known interactions and trusted medicine
              sites (MedlinePlus, NIH, NHS)
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check drug interactions for active medicines"
            disabled={interactionsMutation.isPending}
            onPress={handleCheckInteractions}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>
              {interactionsMutation.isPending ? 'Checking…' : 'Check Now'}
            </Text>
          </Pressable>
        </View>

        {interactionsMutation.data && (
          <View style={styles.interactionResults}>
            <MobileAiSafetyBanner feature="interactions" />
            {interactionsMutation.data.interactions.length === 0 ? (
              <View style={styles.safeBox}>
                <Text style={styles.safeText}>
                  No interaction found in:{' '}
                  {interactionsMutation.data.sources_checked
                    .map((s) => s.title)
                    .join(', ') || 'checked clinical sources'}
                </Text>
              </View>
            ) : (
              interactionsMutation.data.interactions.map((inter, idx) => (
                <View key={idx} style={styles.interactionCard}>
                  <View style={styles.headerRow}>
                    <Text style={styles.interactionPair}>
                      {inter.medicine_a} + {inter.medicine_b}
                    </Text>
                    <Text style={styles.severityBadge}>
                      Severity: {inter.severity.toUpperCase()}
                    </Text>
                  </View>
                  {inter.layer && (
                    <Text style={styles.interactionSources}>
                      {inter.layer === 'table'
                        ? 'From the reviewed list'
                        : 'From a trusted source'}
                    </Text>
                  )}
                  <Text style={styles.interactionEffect}>{inter.effect}</Text>
                  <Text style={styles.interactionAdvice}>
                    Guidance: {inter.advice}
                  </Text>
                  <Text style={styles.interactionQuote}>
                    Verbatim Evidence: &ldquo;{inter.quote}&rdquo;
                  </Text>
                  <Text style={styles.interactionSources}>
                    Sources:{' '}
                    {inter.sources
                      .map((s) => `${s.title} (${s.url})`)
                      .join(' · ')}
                  </Text>
                </View>
              ))
            )}
            {interactionsMutation.data.not_checked &&
              interactionsMutation.data.not_checked.length > 0 && (
                <Text style={styles.cardSub}>
                  Not checked:{' '}
                  {interactionsMutation.data.not_checked.join(', ')}
                </Text>
              )}
          </View>
        )}
      </View>

      {/* Prescriptions List */}
      {rxLoading ? (
        <View style={styles.card}>
          <Text style={styles.cardSub}>Loading prescriptions…</Text>
        </View>
      ) : rxList.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No Prescriptions Yet</Text>
          <Text style={styles.cardSub}>
            Scan a prescription image or receive an e-prescription from your
            doctor to see your medicines here.
          </Text>
        </View>
      ) : (
        rxList.map((rx) => (
          <View key={rx.id} style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                {rx.notes && <Text style={styles.rxHospital}>{rx.notes}</Text>}
                <Text style={styles.cardTitle}>
                  {rx.diagnosis || 'Prescription'}
                </Text>
                <Text style={styles.cardSub}>
                  {rx.doctor_name ? `Prescribed by ${rx.doctor_name} · ` : ''}
                  {rx.issued_on ? `Issued ${rx.issued_on}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View details of prescription ${rx.diagnosis ?? rx.id}`}
                onPress={() => router.push(`/prescriptions/${rx.id}`)}
                style={styles.detailChip}
              >
                <Text style={styles.detailChipText}>Details →</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Order all medicines in prescription ${rx.diagnosis ?? rx.id}`}
              onPress={() => handleOrderWholeRx(rx.id)}
              style={styles.orderWholeBtn}
            >
              <Text style={styles.orderWholeBtnText}>
                Order All{' '}
                {rx.prescription_items.filter((i) => i.active).length} Medicines
                (Compare Full Basket) →
              </Text>
            </Pressable>

            {rx.prescription_items.map((item) => {
              const refill = computeItemRefill(item);
              return (
                <View key={item.id} style={styles.medItemRow}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.medNameRow}>
                      <Text style={styles.medName}>
                        {item.medicine_name} {item.strength}
                      </Text>
                      {refill.needsRefillSoon && refill.daysLeft !== null && (
                        <Text style={styles.refillSoonBadge}>
                          Refill due: {refill.daysLeft}d left
                        </Text>
                      )}
                    </View>
                    <Text style={styles.medGeneric}>
                      Form: {item.form || 'tablet'} · {item.dose} (
                      {item.frequency})
                    </Text>
                    <Text style={styles.medMeta}>
                      Qty: {item.quantity_total ?? '—'}
                      {refill.daysLeft !== null
                        ? ` · ${refill.daysLeft} days left`
                        : ''}{' '}
                      · {item.active ? 'Active' : 'Paused'}
                    </Text>
                  </View>

                  <View style={styles.medItemActions}>
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
                      style={styles.reorderSmallBtn}
                    >
                      <Text style={styles.reorderSmallText}>Reorder</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: item.active }}
                      accessibilityLabel={`Toggle ${item.medicine_name} active status`}
                      disabled={toggleMutation.isPending}
                      onPress={() => handleToggleItem(item.id, !item.active)}
                      style={[
                        styles.toggleBtn,
                        !item.active && styles.toggleBtnPaused,
                      ]}
                    >
                      <Text style={styles.toggleBtnText}>
                        {item.active ? 'Active' : 'Paused'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}

      {/* Single-Medicine Quick Price Lookup */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Single-Medicine Quick Price Lookup</Text>
        <Text style={styles.cardSub}>
          Search any individual medicine to compare across 1mg, PharmEasy,
          Apollo, Netmeds & Jan Aushadhi
        </Text>

        <View style={styles.searchRow}>
          <View style={{ flex: 2 }}>
            <Text style={styles.inputLabel}>Medicine Name</Text>
            <TextInput
              accessibilityLabel="Medicine Name"
              value={singleMedQuery}
              onChangeText={setSingleMedQuery}
              placeholder="Enter medicine name"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Strength</Text>
            <TextInput
              accessibilityLabel="Medicine Strength"
              value={singleStrength}
              onChangeText={setSingleStrength}
              placeholder="Optional"
              style={styles.input}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compare single medicine price"
          disabled={compareSingleMutation.isPending || !singleMedQuery.trim()}
          onPress={handleSingleMedicineSearch}
          style={styles.outlineBtnFull}
        >
          <Text style={styles.outlineBtnText}>
            {compareSingleMutation.isPending
              ? 'Checking pharmacies…'
              : 'Compare Single Medicine'}
          </Text>
        </Pressable>

        {singleResult && (
          <View style={styles.singleResultWrap}>
            {singleResult.baskets.map((b) => (
              <View key={b.source} style={styles.singlePharmacyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.singlePharmName}>
                    {b.source.toUpperCase()} ·{' '}
                    {b.status === 'pending'
                      ? 'Agent is checking…'
                      : b.total !== null
                        ? `₹${b.total}`
                        : 'Unavailable'}
                  </Text>
                  {b.lines[0] && !b.lines[0].price_verified && (
                    <Text style={styles.unverifiedLabel}>
                      price not confirmed
                    </Text>
                  )}
                </View>
                <Text style={styles.singleTotal}>
                  {b.total !== null ? `₹${b.total}` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  topActions: { flexDirection: 'row', gap: 10 },
  scanBtn: {
    flex: 1,
    backgroundColor: '#0D9488',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  scanBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  basketBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  basketBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  rxHospital: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  outlineBtnFull: {
    borderWidth: 1,
    borderColor: '#0D9488',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#0F766E', fontSize: 12, fontWeight: '700' },
  interactionResults: { gap: 10 },
  safeBox: {
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  safeText: { fontSize: 12, color: '#065F46', fontWeight: '600' },
  interactionCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  interactionPair: { fontSize: 14, fontWeight: '700', color: '#991B1B' },
  severityBadge: {
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  interactionEffect: { fontSize: 12, color: '#7F1D1D', fontWeight: '600' },
  interactionAdvice: { fontSize: 12, color: '#991B1B' },
  interactionQuote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#7F1D1D',
    marginTop: 2,
  },
  interactionSources: { fontSize: 11, color: '#991B1B', fontWeight: '600' },
  detailChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailChipText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  orderWholeBtn: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  orderWholeBtnText: { color: '#0F766E', fontSize: 13, fontWeight: '700' },
  medItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  medNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  medName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  refillSoonBadge: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  medGeneric: { fontSize: 12, color: '#475569' },
  medMeta: { fontSize: 11, color: '#64748B' },
  medItemActions: { gap: 6, alignItems: 'flex-end' },
  reorderSmallBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reorderSmallText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  toggleBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleBtnPaused: { backgroundColor: '#F1F5F9' },
  toggleBtnText: { fontSize: 10, fontWeight: '700', color: '#0F766E' },
  searchRow: { flexDirection: 'row', gap: 8 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  singleResultWrap: { gap: 6, paddingTop: 6 },
  singlePharmacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  singlePharmName: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  unverifiedLabel: { fontSize: 11, color: '#B45309', fontWeight: '700' },
  singleTotal: { fontSize: 13, fontWeight: '800', color: '#0F766E' },
});
