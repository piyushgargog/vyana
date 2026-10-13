import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useBasketCompare,
  useBasketJob,
  type BasketLine,
  type PharmacyBasket,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function BasketHeroScreen() {
  const router = useRouter();
  const { selectedBasketMedicines, showToast } = useVyanaMobile();

  const compareMutation = useBasketCompare();
  const jobId = compareMutation.data?.job_id;
  const { data: jobData } = useBasketJob(jobId);

  // Default demo items if none selected from Rx
  const activeItems = useMemo(
    () =>
      selectedBasketMedicines.length > 0
        ? selectedBasketMedicines.map((m) => ({
            medicine: m.name,
            strength: m.strength,
            quantity: m.quantity || 1,
          }))
        : [
            { medicine: 'Metformin', strength: '500 mg', quantity: 1 },
            { medicine: 'Telma', strength: '40 mg', quantity: 1 },
            { medicine: 'Dolo', strength: '650 mg', quantity: 1 },
          ],
    [selectedBasketMedicines]
  );

  const handleStartBasketJob = useCallback(() => {
    compareMutation.mutate(
      { items: activeItems },
      {
        onSuccess: () => {
          showToast('Live pharmacy agents dispatched', 'info');
        },
        onError: (err) => {
          showToast(
            err instanceof Error ? err.message : 'Could not price basket',
            'error'
          );
        },
      }
    );
  }, [compareMutation, activeItems, showToast]);

  const startedRef = React.useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    handleStartBasketJob();
  }, [handleStartBasketJob]);

  const currentResult = jobData ?? compareMutation.data;
  const isRunning = currentResult?.status === 'running';

  const formatSource = (source: string) => {
    switch (source) {
      case '1mg':
        return 'Tata 1mg';
      case 'pharmeasy':
        return 'PharmEasy';
      case 'netmeds':
        return 'Netmeds';
      case 'apollo':
        return 'Apollo Pharmacy';
      default:
        return source.toUpperCase();
    }
  };

  const handleOpenCheckout = (url: string | null, source: string) => {
    if (!url) {
      showToast(`No direct checkout link available for ${source}`, 'warning');
      return;
    }
    Linking.openURL(url).catch(() => {
      showToast(`Could not open ${source} checkout`, 'error');
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Prescription Basket</Text>
          <Text style={styles.headerSub}>
            Multi-pharmacy price comparison & doorstep delivery handoff
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to medicines"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>

      {/* Hero Basket Items Being Priced */}
      <View style={styles.itemsSummaryCard}>
        <View style={styles.itemsHeader}>
          <Text style={styles.itemsTitle}>
            Medicines in Basket ({activeItems.length})
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Re-check live pharmacy prices"
            disabled={compareMutation.isPending || isRunning}
            onPress={handleStartBasketJob}
            style={styles.refreshBtn}
          >
            <Text style={styles.refreshBtnText}>
              {isRunning ? 'Checking…' : '↻ Re-check'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.tagsRow}>
          {activeItems.map((item, idx) => (
            <View key={idx} style={styles.itemPill}>
              <Text style={styles.itemPillText}>
                {item.medicine} {item.strength || ''} (×{item.quantity})
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Live Agent Status Notice */}
      {isRunning && (
        <View style={styles.agentRunningCard}>
          <ActivityIndicator size="small" color="#0D9488" />
          <View style={{ flex: 1 }}>
            <Text style={styles.agentRunningTitle}>
              TinyFish Agents Checking Pharmacies in Parallel…
            </Text>
            <Text style={styles.agentRunningSub}>
              Querying 1mg, PharmEasy, Netmeds, Apollo and Jan Aushadhi.
            </Text>
          </View>
        </View>
      )}

      {/* Savings & Cheapest Source Highlight */}
      {currentResult && currentResult.cheapest_source && (
        <View style={styles.savingsCard}>
          <View style={styles.savingsLeft}>
            <Text style={styles.savingsBadge}>BEST PRICE FOUND</Text>
            <Text style={styles.savingsSource}>
              {formatSource(currentResult.cheapest_source)}
            </Text>
            {currentResult.savings_vs_highest !== null &&
              currentResult.savings_vs_highest > 0 && (
                <Text style={styles.savingsAmount}>
                  Save ₹{currentResult.savings_vs_highest.toFixed(1)} vs highest pharmacy
                </Text>
              )}
          </View>
          <View style={styles.bestPriceCircle}>
            <Text style={styles.bestPriceCheck}>✓</Text>
          </View>
        </View>
      )}

      {/* Jan Aushadhi Generic Basket Section */}
      {currentResult?.generic && (
        <View style={styles.genericCard}>
          <View style={styles.genericHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.genericBadge}>JAN AUSHADHI KENDRA</Text>
              <Text style={styles.genericTitle}>Pradhan Mantri Generic Basket</Text>
              <Text style={styles.genericSub}>
                Government generic equivalents with up to 80% cost savings
              </Text>
            </View>
            <View style={styles.genericTotalBox}>
              <Text style={styles.genericTotalVal}>
                ₹{currentResult.generic.total ?? '—'}
              </Text>
              <Text style={styles.genericTotalLabel}>Generic Total</Text>
            </View>
          </View>

          <View style={styles.linesList}>
            {currentResult.generic.lines.map((line: BasketLine, idx: number) => (
              <View key={idx} style={styles.genericLineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.genericMedName}>
                    {line.product_name || `${line.medicine} Generic`}
                  </Text>
                  <Text style={styles.genericPackSize}>
                    {line.pack_size || 'Standard pack'}
                  </Text>
                </View>
                <Text style={styles.genericLinePrice}>
                  ₹{line.unit_price ?? '—'}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find nearest Jan Aushadhi Kendra store"
            onPress={() => Linking.openURL('https://janaushadhi.gov.in')}
            style={styles.findKendraBtn}
          >
            <Text style={styles.findKendraBtnText}>
              Find Nearest Jan Aushadhi Store ↗
            </Text>
          </Pressable>
        </View>
      )}

      {/* Commercial Pharmacy Baskets List */}
      <Text style={styles.sectionTitle}>Pharmacy Comparison</Text>

      {currentResult ? (
        currentResult.baskets.map((basket: PharmacyBasket, idx: number) => {
          const isCheapest =
            currentResult.cheapest_source === basket.source &&
            basket.status === 'ok';
          const isPending = basket.status === 'pending';

          return (
            <View
              key={idx}
              style={[
                styles.pharmacyCard,
                isCheapest && styles.pharmacyCardCheapest,
              ]}
            >
              {/* Header */}
              <View style={styles.pharmacyHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.pharmacyTitleRow}>
                    <Text style={styles.pharmacyName}>
                      {formatSource(basket.source)}
                    </Text>
                    {isCheapest && (
                      <Text style={styles.cheapestBadge}>CHEAPEST</Text>
                    )}
                  </View>
                  <Text style={styles.pharmacyStatus}>
                    Status:{' '}
                    <Text
                      style={[
                        styles.statusBold,
                        basket.status === 'ok'
                          ? styles.statusOk
                          : basket.status === 'partial'
                            ? styles.statusWarning
                            : styles.statusMuted,
                      ]}
                    >
                      {basket.status.toUpperCase()}
                    </Text>
                  </Text>
                </View>

                {isPending ? (
                  <View style={styles.spinnerRow}>
                    <ActivityIndicator size="small" color="#0D9488" />
                    <Text style={styles.spinnerText}>Checking…</Text>
                  </View>
                ) : (
                  <View style={styles.totalBox}>
                    <Text style={styles.totalVal}>
                      {basket.total !== null ? `₹${basket.total.toFixed(1)}` : '—'}
                    </Text>
                    <Text style={styles.totalLabel}>Verified Total</Text>
                  </View>
                )}
              </View>

              {/* Missing Items Alert */}
              {basket.missing && basket.missing.length > 0 && (
                <View style={styles.missingBox}>
                  <Text style={styles.missingTitle}>
                    Not Available on this Pharmacy:
                  </Text>
                  <Text style={styles.missingList}>
                    {basket.missing.join(', ')}
                  </Text>
                </View>
              )}

              {/* Items in Basket */}
              {basket.lines && basket.lines.length > 0 && (
                <View style={styles.linesList}>
                  {basket.lines.map((l: BasketLine, lIdx: number) => {
                    const unconfirmed = !l.price_verified;
                    return (
                      <View key={lIdx} style={styles.lineRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lineMedName}>
                            {l.product_name || `${l.medicine} ${l.strength || ''}`}
                          </Text>
                          <Text style={styles.linePack}>
                            {l.pack_size || 'Pack'} · Qty: {l.quantity}
                          </Text>
                          {unconfirmed && (
                            <Text style={styles.unconfirmedBadge}>
                              ⚠ Price not confirmed on live page (excluded from total)
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={[
                              styles.linePrice,
                              unconfirmed && styles.linePriceUnconfirmed,
                            ]}
                          >
                            {l.unit_price !== null ? `₹${l.unit_price}` : '—'}
                          </Text>
                          {l.in_stock === false && (
                            <Text style={styles.outOfStockText}>
                              Out of stock
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Order Handoff Button */}
              {basket.checkout_url && basket.status !== 'pending' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Order prescription on ${formatSource(basket.source)}`}
                  onPress={() =>
                    handleOpenCheckout(basket.checkout_url, formatSource(basket.source))
                  }
                  style={[
                    styles.orderBtn,
                    isCheapest ? styles.orderBtnCheapest : styles.orderBtnDefault,
                  ]}
                >
                  <Text
                    style={[
                      styles.orderBtnText,
                      isCheapest
                        ? styles.orderBtnTextCheapest
                        : styles.orderBtnTextDefault,
                    ]}
                  >
                    Order on {formatSource(basket.source)} →
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })
      ) : (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#0D9488" />
          <Text style={styles.loadingCardText}>
            Comparing medicine prices across 4 online pharmacies…
          </Text>
        </View>
      )}

      <MobileAiSafetyBanner feature="prescriptions_basket" />
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
  closeBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  itemsSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  refreshBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  refreshBtnText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemPill: {
    backgroundColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  itemPillText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  agentRunningCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentRunningTitle: { fontSize: 13, fontWeight: '700', color: '#0F766E' },
  agentRunningSub: { fontSize: 12, color: '#115E59' },
  savingsCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savingsLeft: { gap: 2 },
  savingsBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 1,
  },
  savingsSource: { fontSize: 18, fontWeight: '800', color: '#047857' },
  savingsAmount: { fontSize: 13, fontWeight: '600', color: '#065F46' },
  bestPriceCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestPriceCheck: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  genericCard: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  genericHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  genericBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#854D0E',
    letterSpacing: 1,
  },
  genericTitle: { fontSize: 16, fontWeight: '800', color: '#713F12' },
  genericSub: { fontSize: 12, color: '#854D0E' },
  genericTotalBox: { alignItems: 'flex-end' },
  genericTotalVal: { fontSize: 22, fontWeight: '900', color: '#713F12' },
  genericTotalLabel: { fontSize: 10, fontWeight: '600', color: '#854D0E' },
  genericLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF08A',
  },
  genericMedName: { fontSize: 13, fontWeight: '600', color: '#713F12' },
  genericPackSize: { fontSize: 11, color: '#854D0E' },
  genericLinePrice: { fontSize: 13, fontWeight: '700', color: '#713F12' },
  findKendraBtn: {
    backgroundColor: '#854D0E',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  findKendraBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  pharmacyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pharmacyCardCheapest: {
    borderColor: '#059669',
    borderWidth: 2,
    shadowColor: '#059669',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  pharmacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pharmacyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pharmacyName: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  cheapestBadge: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pharmacyStatus: { fontSize: 12, color: '#64748B' },
  statusBold: { fontWeight: '700' },
  statusOk: { color: '#059669' },
  statusWarning: { color: '#D97706' },
  statusMuted: { color: '#94A3B8' },
  spinnerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spinnerText: { fontSize: 12, color: '#0D9488', fontWeight: '600' },
  totalBox: { alignItems: 'flex-end' },
  totalVal: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  totalLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  missingBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  missingTitle: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },
  missingList: { fontSize: 12, color: '#991B1B' },
  linesList: { gap: 6 },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  lineMedName: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  linePack: { fontSize: 11, color: '#64748B' },
  unconfirmedBadge: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 2,
  },
  linePrice: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  linePriceUnconfirmed: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  outOfStockText: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  orderBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  orderBtnCheapest: { backgroundColor: '#059669' },
  orderBtnDefault: { backgroundColor: '#0F766E' },
  orderBtnText: { fontSize: 14, fontWeight: '700' },
  orderBtnTextCheapest: { color: '#FFFFFF' },
  orderBtnTextDefault: { color: '#FFFFFF' },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingCardText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
