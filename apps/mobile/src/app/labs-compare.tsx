import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PriceQuote,
  SourceStatus,
  useCompareLabTest,
  useLabsJob,
  useMyProfile,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
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
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

const POPULAR_TESTS = [
  'HbA1c',
  'Lipid Profile',
  'Complete Blood Count (CBC)',
  'Thyroid Profile (T3, T4, TSH)',
  'Liver Function Test (LFT)',
  'Kidney Function Test (KFT)',
  'Vitamin D3',
];

const CITIES = ['Delhi', 'Gurgaon', 'Noida', 'Mumbai', 'Bengaluru'];

const LAB_LABELS: Record<string, string> = {
  healthians: 'Healthians',
  redcliffe: 'Redcliffe Labs',
  thyrocare: 'Thyrocare',
  '1mg_labs': 'Tata 1mg Labs',
};

export default function LabsCompareScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  // A report's follow-up test can open this screen with ?test_name=...; otherwise nothing is searched until the user taps Search.
  const { test_name: testFromLink } = useLocalSearchParams<{ test_name?: string }>();
  const { data: profile } = useMyProfile();
  const [testName, setTestName] = useState(testFromLink ?? '');
  // No city is chosen for the user: it is theirs from the profile, or they pick one.
  const [cityChoice, setCityChoice] = useState<string | null>(null);
  const city = cityChoice ?? profile?.city?.trim() ?? '';

  const compareMutation = useCompareLabTest();
  const jobId = compareMutation.data?.job_id;

  const { data: jobData } = useLabsJob(jobId);

  const currentResult = jobData ?? compareMutation.data;
  const isRunning =
    compareMutation.isPending || (currentResult && currentResult.status === 'running');

  // Only a test the user came here for starts a search by itself (once). An agent run costs money, so the
  // screen never searches for a test nobody asked for.
  const autoStarted = useRef(false);
  const { mutate: compareLab } = compareMutation;
  useEffect(() => {
    if (autoStarted.current || !testFromLink || !city) return;
    autoStarted.current = true;
    compareLab(
      { test_name: testFromLink, city },
      { onError: (err) => showToast(err.message || 'Could not fetch lab prices', 'error') }
    );
  }, [testFromLink, city, compareLab, showToast]);

  const handleSearch = () => {
    const trimmed = testName.trim();
    if (!trimmed) {
      showToast('Please enter a test name', 'warning');
      return;
    }
    if (!city) {
      showToast('Choose your city first', 'warning');
      return;
    }
    compareMutation.mutate(
      { test_name: trimmed, city },
      {
        onError: (err) => {
          showToast(err.message || 'Could not fetch lab prices', 'error');
        },
      }
    );
  };

  const handleSelectPreset = (preset: string) => {
    setTestName(preset);
    if (!city) {
      showToast('Choose your city, then tap Search', 'info');
      return;
    }
    compareMutation.mutate(
      { test_name: preset, city },
      {
        onError: (err) => {
          showToast(err.message || 'Could not fetch lab prices', 'error');
        },
      }
    );
  };

  const handleOpenLab = (url: string | null | undefined, labName: string) => {
    if (!url) {
      showToast(`No online booking page available for ${labName}`, 'info');
      return;
    }
    Linking.openURL(url).catch(() => {
      showToast(`Could not open booking page for ${labName}`, 'error');
    });
  };

  const quotes = useMemo(() => {
    if (!currentResult?.quotes) return [];
    return [...currentResult.quotes].sort((a, b) => {
      // Confirmed prices first
      if (a.price_verified && !b.price_verified) return -1;
      if (!a.price_verified && b.price_verified) return 1;
      return (a.price ?? Infinity) - (b.price ?? Infinity);
    });
  }, [currentResult]);

  const cheapestQuote = currentResult?.cheapest;
  const sources = currentResult?.sources ?? [];

  return (
    <Screen
      eyebrow="Labs"
      title="Compare Diagnostic Labs"
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
        Live home-sample collection prices across Healthians, Redcliffe,
        Thyrocare and 1mg Labs.
      </Text>

      {/* Search & City Filter Card */}
      <Card>
        <CardHeader title="Find a lab test" />
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Lab test name"
            placeholder="e.g. HbA1c, Vitamin D, Lipid Profile"
            placeholderTextColor={T.color.label3}
            value={testName}
            onChangeText={setTestName}
            style={[styles.input, styles.searchInput]}
          />
          <Button
            title="Search"
            loading={isRunning}
            label="Search lab prices"
            onPress={handleSearch}
          />
        </View>

        {/* City Filter */}
        <View style={styles.filterBlock}>
          <Text variant="footnote" tone="secondary">
            City
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {CITIES.map((c) => {
              const isSelected = city === c;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter city ${c}`}
                  onPress={() => setCityChoice(c)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                >
                  <Text
                    variant="footnote"
                    tone={isSelected ? 'white' : 'secondary'}
                    style={isSelected && styles.chipTextActive}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Popular Presets */}
        <View style={styles.filterBlock}>
          <Text variant="footnote" tone="secondary">
            Common tests
          </Text>
          <View style={styles.presetWrap}>
            {POPULAR_TESTS.map((preset) => {
              const isSelected =
                testName.toLowerCase() === preset.toLowerCase();
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityLabel={`Select test ${preset}`}
                  onPress={() => handleSelectPreset(preset)}
                  style={[
                    styles.chip,
                    styles.presetChip,
                    isSelected && styles.chipSelected,
                  ]}
                >
                  <Text
                    variant="footnote"
                    tone={isSelected ? 'accent' : 'secondary'}
                    style={isSelected && styles.chipTextActive}
                  >
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      {/* Progress & Diagnostics Source Agent Status */}
      {sources.length > 0 && (
        <Card>
          <CardHeader
            title="Where we are checking"
            trailing={isRunning ? 'Checking…' : undefined}
          />
          <ListGroup>
            {sources.map((s: SourceStatus) => {
              const label = LAB_LABELS[s.source] ?? s.source;
              const isPending = s.status === 'pending';
              const isOk = s.status === 'ok';
              return (
                <ListRow
                  key={s.source}
                  icon={
                    <IconTile
                      ios="flask.fill"
                      android="science"
                      color="blue"
                    />
                  }
                  title={label}
                  subtitle={
                    isPending
                      ? 'Fetching latest rate…'
                      : isOk
                        ? 'Quote received'
                        : s.status === 'timeout'
                          ? 'Provider timeout'
                          : 'Test not listed'
                  }
                  trailing={
                    isPending ? (
                      <ActivityIndicator
                        size="small"
                        color={T.color.accent}
                      />
                    ) : isOk ? (
                      <Pill text="Checked" tone="ok" />
                    ) : (
                      <Pill text={s.status} tone="neutral" />
                    )
                  }
                />
              );
            })}
          </ListGroup>
        </Card>
      )}

      {/* Comparison Results */}
      <View style={styles.resultsHeader}>
        <Text variant="headline" style={styles.resultsTitle}>
          Quotes for &quot;{currentResult?.query ?? testName}&quot;
          {city ? ` (${city})` : ''}
        </Text>
        <Text variant="footnote" tone="tertiary">
          {quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'}
        </Text>
      </View>

      {currentResult && quotes.length === 0 && !isRunning && (
        <EmptyState
          ios="flask.fill"
          android="science"
          title="No quotes available"
          body={`We could not find verified quotes for this test name in ${city}. Try one of the popular tests above or check your spelling.`}
        />
      )}

      {quotes.map((quote: PriceQuote, idx: number) => {
        const isCheapest =
          cheapestQuote &&
          quote.source === cheapestQuote.source &&
          quote.price === cheapestQuote.price &&
          quote.price_verified;
        const isVerified = quote.price_verified === true;
        const labName = LAB_LABELS[quote.source] ?? quote.source;
        const hasDiscount =
          typeof quote.mrp === 'number' &&
          typeof quote.price === 'number' &&
          quote.mrp > quote.price;
        const discountPct =
          hasDiscount && quote.mrp && quote.price
            ? Math.round(((quote.mrp - quote.price) / quote.mrp) * 100)
            : null;

        return (
          <Card
            key={`${quote.source}-${idx}`}
            style={isCheapest ? styles.cheapestCard : undefined}
          >
            {isCheapest && (
              <Pill text="Lowest verified price" tone="accent" />
            )}
            <View style={styles.quoteTop}>
              <View style={styles.quoteTitles}>
                <Text
                  variant="caption"
                  tone="accent"
                  style={styles.labEyebrow}
                >
                  {labName}
                </Text>
                <Text variant="headline" numberOfLines={2}>
                  {quote.product_name}
                </Text>
              </View>
              <View style={styles.priceColumn}>
                {quote.price !== null ? (
                  <Text variant="title2" tone={isCheapest ? 'accent' : 'label'}>
                    ₹{quote.price}
                  </Text>
                ) : (
                  <Text variant="headline" tone="tertiary">
                    N/A
                  </Text>
                )}
                {hasDiscount && (
                  <View style={styles.mrpRow}>
                    <Text variant="footnote" tone="tertiary" style={styles.mrp}>
                      ₹{quote.mrp}
                    </Text>
                    {discountPct ? (
                      <Text variant="footnote" tone="danger">
                        {discountPct}% off
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.metaRow}>
              <Pill
                text={
                  isVerified
                    ? 'Price verified on live portal'
                    : 'Price not confirmed'
                }
                tone={isVerified ? 'ok' : 'warn'}
              />
              <Text variant="caption" tone="tertiary">
                Fetched {new Date(quote.fetched_at).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.noteRow}>
                <Symbol
                  ios="house.fill"
                  android="home"
                  size={16}
                  color={T.color.label2}
                />
                <Text variant="footnote" tone="secondary">
                  Free home sample collection
                </Text>
              </View>
              <Button
                title={`Book on ${labName}`}
                variant="secondary"
                size="sm"
                icon={
                  <Symbol
                    ios="arrow.up.right"
                    android="open_in_new"
                    size={14}
                    color={T.color.accentStrong}
                  />
                }
                label={`Book test on ${labName}`}
                onPress={() => handleOpenLab(quote.product_url, labName)}
              />
            </View>
          </Card>
        );
      })}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneBtn: { minHeight: 44, justifyContent: 'center' },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: T.space.xs,
  },
  resultsTitle: { flex: 1, marginRight: T.space.sm },
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
  searchRow: { flexDirection: 'row', gap: T.space.sm, alignItems: 'center' },
  searchInput: { flex: 1 },
  filterBlock: { gap: T.space.sm },
  chipScroll: { gap: T.space.sm, paddingVertical: T.space.xs },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: T.space.lg,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.fill,
  },
  chipActive: { backgroundColor: T.color.accent },
  chipSelected: {
    backgroundColor: T.color.accentSoft,
    borderWidth: 1,
    borderColor: T.color.accent,
  },
  chipTextActive: { fontWeight: '700' },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  presetChip: { minHeight: 40 },
  cheapestCard: {
    borderWidth: 2,
    borderColor: T.color.accent,
    backgroundColor: T.color.accentSoft,
  },
  quoteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  quoteTitles: { flex: 1, gap: T.space.xs },
  labEyebrow: { textTransform: 'uppercase', fontWeight: '700' },
  priceColumn: { alignItems: 'flex-end', gap: T.space.xs },
  mrpRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.xs },
  mrp: { textDecorationLine: 'line-through' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: T.space.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: T.space.sm,
    flexWrap: 'wrap',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.xs,
  },
});
