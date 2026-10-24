import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  pharmacySearchLinks,
  useCheckInteractions,
  usePrescriptions,
  useSetItemActive,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { InteractionCard } from '@/components/interaction-card';
import {
  computeItemRefill,
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
  MobileSkeletonCard,
} from '@/components/ui-primitives';
import { ErrorState, Screen, SosPill, Text } from '@/components/ui';
import { T } from '@/constants/theme';

export default function MobileMedsTab() {
  const router = useRouter();
  const { setSelectedBasketMedicines, showToast } = useVyanaMobile();

  const { data: rxList = [], isLoading: rxLoading, isError: rxError, refetch: refetchRx } = usePrescriptions();
  const toggleMutation = useSetItemActive();
  const interactionsMutation = useCheckInteractions();

  const [singleMedQuery, setSingleMedQuery] = useState('');
  const [singleStrength, setSingleStrength] = useState('');

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

  const singleQuery = [singleMedQuery.trim(), singleStrength.trim()]
    .filter(Boolean)
    .join(' ');
  const singleLinks = pharmacySearchLinks(singleQuery);

  const handleOpenPharmacy = (url: string, name: string) => {
    Linking.openURL(url).catch(() => {
      showToast(`Could not open ${name}`, 'error');
    });
  };

  return (
    <Screen
      title="Medicines"
      trailing={<SosPill />}
    >
      {/* Top Action Bar */}
      <View style={styles.topActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan a new prescription"
          onPress={() => router.push('/prescriptions/scan')}
          style={styles.scanBtn}
        >
          <Text variant="footnote" tone="white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={11 / T.text.footnote.fontSize} style={styles.scanBtnText}>
            + Scan Prescription (OCR)
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compare medicine prices on the pharmacy sites"
          onPress={() => router.push('/basket')}
          style={styles.basketBtn}
        >
          <Text variant="footnote" tone="white" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={11 / T.text.footnote.fontSize} style={styles.basketBtnText}>
            Compare Medicine Prices →
          </Text>
        </Pressable>
      </View>

      {/* Drug Interaction Checker Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="headline">Drug–Drug Interaction Check</Text>
            <Text variant="caption" tone="tertiary" style={styles.cardSub}>
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
            <Text variant="caption" style={styles.outlineBtnText}>
              {interactionsMutation.isPending ? 'Checking…' : 'Check Now'}
            </Text>
          </Pressable>
        </View>

        {interactionsMutation.data && (
          <View style={styles.interactionResults}>
            <MobileAiSafetyBanner feature="interactions" />
            {interactionsMutation.data.interactions.length === 0 ? (
              <View style={styles.safeBox}>
                <Text variant="caption" style={styles.safeText}>
                  No interaction found in:{' '}
                  {interactionsMutation.data.sources_checked
                    .map((s) => s.title)
                    .join(', ') || 'checked clinical sources'}
                </Text>
              </View>
            ) : (
              interactionsMutation.data.interactions.map((inter, idx) => (
                <InteractionCard key={idx} interaction={inter} />
              ))
            )}
            {interactionsMutation.data.not_checked &&
              interactionsMutation.data.not_checked.length > 0 && (
                <Text variant="caption" tone="tertiary" style={styles.cardSub}>
                  Not checked:{' '}
                  {interactionsMutation.data.not_checked.join(', ')}
                </Text>
              )}
          </View>
        )}
      </View>

      {/* Prescriptions List */}
      {rxLoading ? (
        <MobileSkeletonCard lines={3} />
      ) : rxError ? (
        <View style={styles.card}>
          <ErrorState onRetry={() => refetchRx()} />
        </View>
      ) : rxList.length === 0 ? (
        <View style={styles.card}>
          <Text variant="headline">No Prescriptions Yet</Text>
          <Text variant="caption" tone="tertiary" style={styles.cardSub}>
            Scan a prescription image or receive an e-prescription from your
            doctor to see your medicines here.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan a prescription now"
            onPress={() => router.push('/prescriptions/scan')}
            style={[styles.orderWholeBtn, { marginTop: T.space.md }]}
          >
            <Text variant="footnote" style={styles.orderWholeBtnText}>
              + Scan Prescription Now
            </Text>
          </Pressable>
        </View>
      ) : (
        rxList.map((rx) => (
          <View key={rx.id} style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                {/* The title is the condition; the prescription's instruction reads
                    as a normal sentence under it (issue #489) — it used to sit above
                    the title as an uppercase eyebrow, a heading for nothing. */}
                <Text variant="headline">
                  {rx.diagnosis || 'Prescription'}
                </Text>
                <Text variant="caption" tone="tertiary" style={styles.cardSub}>
                  {rx.doctor_name ? `Prescribed by ${rx.doctor_name} · ` : ''}
                  {rx.issued_on ? `Issued ${rx.issued_on}` : ''}
                </Text>
                {rx.notes && (
                  <Text variant="footnote" tone="secondary" style={styles.cardSub}>
                    {rx.notes}
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View details of prescription ${rx.diagnosis ?? rx.id}`}
                onPress={() => router.push(`/prescriptions/${rx.id}`)}
                style={styles.detailChip}
              >
                <Text variant="caption" style={styles.detailChipText}>
                  Details →
                </Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Order all medicines in prescription ${rx.diagnosis ?? rx.id}`}
              onPress={() => handleOrderWholeRx(rx.id)}
              style={styles.orderWholeBtn}
            >
              <Text variant="footnote" style={styles.orderWholeBtnText}>
                Look Up All{' '}
                {rx.prescription_items.filter((i) => i.active).length} Medicines
                →
              </Text>
            </Pressable>

            {rx.prescription_items.map((item) => {
              const refill = computeItemRefill(item);
              return (
                <View key={item.id} style={styles.medItemRow}>
                  <View style={{ flex: 1, gap: T.space.xs }}>
                    <View style={styles.medNameRow}>
                      <Text variant="subhead" style={styles.medName}>
                        {item.medicine_name} {item.strength}
                      </Text>
                      {refill.needsRefillSoon && refill.daysLeft !== null && (
                        <Text variant="caption" style={styles.refillSoonBadge}>
                          Refill due: {refill.daysLeft}d left
                        </Text>
                      )}
                    </View>
                    <Text variant="caption" tone="secondary">
                      Form: {item.form || 'tablet'} · {item.dose} (
                      {item.frequency})
                    </Text>
                    <Text variant="caption" tone="tertiary">
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
                      accessibilityLabel={`Look up ${item.medicine_name} on the pharmacy sites`}
                      onPress={() =>
                        handleReorderSingle(
                          item.medicine_name,
                          item.strength,
                          item.quantity_total
                        )
                      }
                      style={styles.itemActionBtn}
                    >
                      <Text variant="caption" style={styles.itemActionText}>
                        Look up
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: item.active }}
                      accessibilityLabel={`Toggle ${item.medicine_name} active status`}
                      disabled={toggleMutation.isPending}
                      onPress={() => handleToggleItem(item.id, !item.active)}
                      style={styles.itemActionBtn}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: item.active ? T.color.ok : T.color.label3 },
                        ]}
                      />
                      <Text variant="caption" style={styles.itemActionText}>
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

      {/* Single-medicine lookup on the pharmacy sites */}
      <View style={styles.card}>
        <Text variant="headline">Look Up a Medicine</Text>
        <Text variant="caption" tone="tertiary" style={styles.cardSub}>
          Look any medicine up on the pharmacy sites themselves. Prices are
          on the shop&apos;s own page; Vyana does not show or check prices.
        </Text>

        <View style={styles.searchRow}>
          <View style={{ flex: 2 }}>
            <Text variant="caption" style={styles.inputLabel}>
              Medicine Name
            </Text>
            <TextInput
              accessibilityLabel="Medicine Name"
              value={singleMedQuery}
              onChangeText={setSingleMedQuery}
              placeholder="Enter medicine name"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={styles.inputLabel}>
              Strength
            </Text>
            <TextInput
              accessibilityLabel="Medicine Strength"
              value={singleStrength}
              onChangeText={setSingleStrength}
              placeholder="Optional"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>
        </View>

        {singleLinks.length > 0 && (
          <View style={styles.singleResultWrap}>
            {singleLinks.map((link) => (
              <Pressable
                key={link.id}
                accessibilityRole="button"
                accessibilityLabel={`Search on ${link.name} for ${singleQuery}`}
                onPress={() => handleOpenPharmacy(link.url, link.name)}
                style={styles.outlineBtnFull}
              >
                <Text variant="caption" style={styles.outlineBtnText}>
                  Search on {link.name} →
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topActions: { flexDirection: 'row', gap: T.space.sm },
  scanBtn: {
    flex: 1,
    backgroundColor: T.color.accent,
    paddingVertical: T.space.md,
    paddingHorizontal: T.space.md,
    borderRadius: T.radius.row,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  scanBtnText: { fontWeight: '700' },
  basketBtn: {
    flex: 1,
    backgroundColor: T.color.label,
    paddingVertical: T.space.md,
    paddingHorizontal: T.space.md,
    borderRadius: T.radius.row,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  basketBtnText: { fontWeight: '700' },
  card: {
    backgroundColor: T.color.surface,
    borderRadius: T.radius.card,
    padding: T.space.lg,
    borderWidth: 1,
    borderColor: T.color.separator,
    gap: T.space.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  cardSub: { marginTop: T.space.xs / 2 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: T.color.accent,
    paddingHorizontal: T.space.md,
    borderRadius: T.radius.row,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineBtnFull: {
    borderWidth: 1,
    borderColor: T.color.accent,
    borderRadius: T.radius.row,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  outlineBtnText: { color: T.color.accentStrong, fontWeight: '700' },
  interactionResults: { gap: T.space.sm },
  safeBox: {
    backgroundColor: T.color.okSoft,
    padding: T.space.md,
    borderRadius: T.radius.row,
    borderWidth: 1,
    borderColor: T.color.separator,
  },
  safeText: { color: T.color.ok, fontWeight: '600' },
  detailChip: {
    backgroundColor: T.color.fill,
    paddingHorizontal: T.space.sm,
    borderRadius: T.radius.row,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailChipText: { fontWeight: '700', color: T.color.label },
  orderWholeBtn: {
    backgroundColor: T.color.accentSoft,
    borderColor: T.color.accent,
    borderWidth: 1,
    borderRadius: T.radius.row,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: T.space.md,
  },
  orderWholeBtnText: { color: T.color.accentStrong, fontWeight: '700' },
  medItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: T.space.sm,
    borderTopWidth: 1,
    borderTopColor: T.color.fill,
    gap: T.space.sm,
  },
  medNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: T.space.xs + 2,
  },
  medName: { fontWeight: '700' },
  refillSoonBadge: {
    backgroundColor: T.color.warnSoft,
    color: T.color.warn,
    fontWeight: '700',
    paddingHorizontal: T.space.sm - 1,
    paddingVertical: T.space.xs / 2,
    borderRadius: T.radius.pill,
    overflow: 'hidden',
  },
  medItemActions: { gap: T.space.xs, alignItems: 'flex-end' },
  // One action style for the whole list (issue #489): "Look up" used to be a solid
  // blue button and "Active/Paused" a soft pill, though both act on the same item.
  itemActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.xs,
    minWidth: 104,
    minHeight: 44,
    paddingHorizontal: T.space.md,
    backgroundColor: T.color.fill,
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
  },
  itemActionText: { fontWeight: '700', color: T.color.accentStrong },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  searchRow: { flexDirection: 'row', gap: T.space.sm },
  inputLabel: {
    fontWeight: '700',
    color: T.color.label2,
    marginBottom: T.space.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    paddingHorizontal: T.space.sm,
    paddingVertical: T.space.sm,
    minHeight: 44,
    ...T.text.footnote,
    color: T.color.label,
  },
  singleResultWrap: { gap: T.space.xs, paddingTop: T.space.xs },
  singlePharmacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: T.color.fill,
    padding: T.space.sm,
    borderRadius: T.radius.row,
  },
  singlePharmName: { fontWeight: '700' },
  unverifiedLabel: { color: T.color.warn, fontWeight: '700' },
  singleTotal: { fontWeight: '800', color: T.color.accentStrong },
});
