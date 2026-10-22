import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useBasketCompare,
  useBasketJob,
  type BasketLine,
  type PharmacyBasket,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';
import {
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function BasketHeroScreen() {
  const router = useRouter();
  const { job_id: paramJobId } = useLocalSearchParams<{ job_id?: string }>();
  const { selectedBasketMedicines, showToast } = useVyanaMobile();

  const compareMutation = useBasketCompare();
  const jobId = paramJobId || compareMutation.data?.job_id;
  const { data: jobData } = useBasketJob(jobId);

  const activeItems = useMemo(
    () =>
      selectedBasketMedicines.map((m) => ({
        medicine: m.name,
        strength: m.strength,
        quantity: m.quantity || 1,
      })),
    [selectedBasketMedicines]
  );

  const handleStartBasketJob = useCallback(() => {
    if (activeItems.length === 0) return;
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
    if (paramJobId) return;
    if (activeItems.length === 0) return;
    startedRef.current = true;
    handleStartBasketJob();
  }, [handleStartBasketJob, activeItems.length, paramJobId]);

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

  const statusPill = (basket: PharmacyBasket) => {
    if (basket.status === 'pending') return null;
    if (basket.status === 'ok') return <Pill text="Prices confirmed" tone="ok" />;
    if (basket.status === 'partial') return <Pill text="Partial prices" tone="warn" />;
    return <Pill text="Unavailable" tone="neutral" />;
  };

  return (
    <Screen
      title="Prescription basket"
      eyebrow="Price comparison"
      trailing={
        <Button title="Done" variant="secondary" onPress={() => router.back()} label="Back to medicines" />
      }
    >
      {activeItems.length === 0 && !jobId ? (
        <Card>
          <View style={styles.emptyIconWrap}>
            <Symbol ios="basket.fill" android="shopping_basket" size={28} color={T.color.accent} />
          </View>
          <Text variant="headline" style={styles.center}>
            Your basket is empty
          </Text>
          <Text variant="subhead" tone="tertiary" style={styles.center}>
            Choose medicines from your active prescriptions or scan a new prescription
            to compare doorstep delivery prices across Tata 1mg, Apollo, PharmEasy and Netmeds.
          </Text>
          <Button
            title="View my medicines"
            onPress={() => router.push('/(tabs)/meds')}
            label="View my prescriptions"
          />
          <Button
            title="Scan prescription"
            variant="secondary"
            onPress={() => router.push('/prescriptions/scan')}
            label="Scan new prescription"
          />
        </Card>
      ) : (
        <>
          {/* Medicines being priced */}
          <Card>
            <CardHeader
              title="Medicines in basket"
              trailing={`${activeItems.length} item${activeItems.length === 1 ? '' : 's'}`}
            />
            <View style={styles.tagsRow}>
              {activeItems.map((item, idx) => (
                <Pill
                  key={idx}
                  text={`${item.medicine} ${item.strength || ''} ×${item.quantity}`.trim()}
                  tone="accent"
                />
              ))}
            </View>
            <Button
              title={isRunning ? 'Checking…' : 'Re-check prices'}
              variant="secondary"
              onPress={handleStartBasketJob}
              disabled={compareMutation.isPending || isRunning}
              loading={compareMutation.isPending || isRunning}
              label="Re-check live pharmacy prices"
              icon={<Symbol ios="arrow.clockwise" android="refresh" size={14} color={T.color.accentStrong} />}
            />
          </Card>

          {/* Live agent status */}
          {isRunning && (
            <Card>
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={T.color.accent} />
                <View style={{ flex: 1 }}>
                  <Text variant="callout" tone="accent" style={styles.strong}>
                    Checking pharmacies…
                  </Text>
                  <Text variant="footnote" tone="secondary">
                    Querying 1mg, PharmEasy, Netmeds, Apollo and Jan Aushadhi in parallel.
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Cheapest highlight */}
          {currentResult?.cheapest_source && (
            <Card>
              <View style={styles.statusRow}>
                <Symbol ios="checkmark.seal.fill" android="verified" size={28} color={T.color.ok} />
                <View style={{ flex: 1 }}>
                  <Pill text="Cheapest confirmed price" tone="ok" />
                  <Text variant="title3" style={styles.savingsSource}>
                    {formatSource(currentResult.cheapest_source)}
                  </Text>
                  {currentResult.savings_vs_highest !== null &&
                    currentResult.savings_vs_highest > 0 && (
                      <Text variant="footnote" tone="secondary">
                        Save ₹{currentResult.savings_vs_highest.toFixed(1)} vs the highest pharmacy
                      </Text>
                    )}
                </View>
              </View>
            </Card>
          )}

          {/* Jan Aushadhi generics */}
          {currentResult?.generic && (
            <Card>
              <CardHeader
                title="Jan Aushadhi generics"
                trailing={
                  currentResult.generic.total != null
                    ? `₹${currentResult.generic.total}`
                    : undefined
                }
              />
              <Text variant="footnote" tone="secondary">
                Government generic equivalents with up to 80% cost savings.
              </Text>
              <ListGroup>
                {currentResult.generic.lines.map((line: BasketLine, idx: number) => (
                  <ListRow
                    key={idx}
                    title={line.product_name || `${line.medicine} generic`}
                    subtitle={line.pack_size || 'Standard pack'}
                    value={line.unit_price != null ? `₹${line.unit_price}` : '—'}
                  />
                ))}
              </ListGroup>
              <Button
                title="Find nearest Jan Aushadhi store"
                variant="secondary"
                onPress={() => Linking.openURL('https://janaushadhi.gov.in')}
                label="Find nearest Jan Aushadhi Kendra store"
              />
            </Card>
          )}

          {/* Pharmacy comparison, grouped per pharmacy */}
          <Text variant="title3" accessibilityRole="header" style={styles.sectionTitle}>
            Pharmacy comparison
          </Text>

          {currentResult ? (
            currentResult.baskets.map((basket: PharmacyBasket, idx: number) => {
              const isCheapest =
                currentResult.cheapest_source === basket.source &&
                basket.status === 'ok';
              const isPending = basket.status === 'pending';

              return (
                <View key={idx} style={styles.pharmacySection}>
                  <View style={styles.pharmacyHeader}>
                    <View style={styles.pharmacyTitleRow}>
                      <Text variant="headline">{formatSource(basket.source)}</Text>
                      {isCheapest && <Pill text="Cheapest" tone="ok" />}
                      {statusPill(basket)}
                    </View>
                    {isPending ? (
                      <View style={styles.spinnerRow}>
                        <ActivityIndicator size="small" color={T.color.accent} />
                        <Text variant="footnote" tone="accent">
                          Checking…
                        </Text>
                      </View>
                    ) : (
                      <Text variant="title3">
                        {basket.total !== null ? `₹${basket.total.toFixed(1)}` : '—'}
                      </Text>
                    )}
                  </View>

                  {basket.missing && basket.missing.length > 0 && (
                    <Text variant="footnote" tone="warn" style={styles.missingText}>
                      Not available here: {basket.missing.join(', ')}
                    </Text>
                  )}

                  {basket.lines && basket.lines.length > 0 && (
                    <ListGroup>
                      {basket.lines.map((l: BasketLine, lIdx: number) => {
                        const unconfirmed = !l.price_verified;
                        return (
                          <ListRow
                            key={lIdx}
                            title={l.product_name || `${l.medicine} ${l.strength || ''}`.trim()}
                            subtitle={`${l.pack_size || 'Pack'} · Qty ${l.quantity}`}
                            value={l.unit_price !== null ? `₹${l.unit_price}` : '—'}
                            trailing={
                              unconfirmed ? (
                                <Pill text="Unconfirmed" tone="warn" />
                              ) : l.in_stock === false ? (
                                <Pill text="Out of stock" tone="danger" />
                              ) : undefined
                            }
                          />
                        );
                      })}
                    </ListGroup>
                  )}

                  {basket.checkout_url && basket.status !== 'pending' && (
                    <Button
                      title={`Order on ${formatSource(basket.source)}`}
                      variant={isCheapest ? 'primary' : 'secondary'}
                      onPress={() =>
                        handleOpenCheckout(basket.checkout_url, formatSource(basket.source))
                      }
                      label={`Order prescription on ${formatSource(basket.source)}`}
                      icon={
                        <Symbol
                          ios="arrow.up.right"
                          android="open_in_new"
                          size={14}
                          color={isCheapest ? T.color.white : T.color.accentStrong}
                        />
                      }
                    />
                  )}
                </View>
              );
            })
          ) : (
            <Card>
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={T.color.accent} />
                <Text variant="subhead" tone="secondary" style={{ flex: 1 }}>
                  Comparing medicine prices across 4 online pharmacies…
                </Text>
              </View>
            </Card>
          )}
        </>
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: T.radius.tile,
    borderCurve: 'continuous',
    backgroundColor: T.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.md },
  strong: { fontWeight: '700' },
  savingsSource: { marginTop: T.space.xs },
  sectionTitle: { paddingHorizontal: T.space.xs, marginTop: T.space.sm },
  pharmacySection: { gap: T.space.sm },
  pharmacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: T.space.sm,
    paddingHorizontal: T.space.xs,
  },
  pharmacyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  spinnerRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.xs },
  missingText: { paddingHorizontal: T.space.xs },
});
