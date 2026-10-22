import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { labSearchLinks } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';
import { Button, Card, CardHeader, Screen, Symbol, Text } from '@/components/ui';
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

export default function LabsCompareScreen() {
  const { showToast } = useVyanaMobile();

  // A report's test can open this screen with ?test_name=...; otherwise the person types or picks a test.
  const { test_name: testFromLink } = useLocalSearchParams<{ test_name?: string }>();
  const [testName, setTestName] = useState(testFromLink ?? '');

  const links = useMemo(() => labSearchLinks(testName), [testName]);

  const handleOpenLab = (url: string, labName: string) => {
    Linking.openURL(url).catch(() => {
      showToast(`Could not open ${labName}`, 'error');
    });
  };

  return (
    <Screen
      eyebrow="Labs"
      title="Compare lab tests"
    >
      <Text variant="subhead" tone="secondary">
        Look a test up on the lab sites themselves. Vyana does not show or
        check prices.
      </Text>

      <Card>
        <CardHeader title="Find a lab test" />
        <TextInput
          accessibilityLabel="Lab test name"
          placeholder="e.g. HbA1c, Vitamin D, Lipid Profile"
          placeholderTextColor={T.color.label3}
          value={testName}
          onChangeText={setTestName}
          style={styles.input}
        />

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
                  onPress={() => setTestName(preset)}
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

      {links.length > 0 && (
        <Card>
          <CardHeader title={`Look up “${testName.trim()}”`} />
          <View style={styles.buttonsWrap}>
            {links.map((link) => (
              <Button
                key={link.id}
                title={
                  link.searchesTest
                    ? `Search on ${link.name}`
                    : `Open ${link.name}`
                }
                variant="secondary"
                label={
                  link.searchesTest
                    ? `Search on ${link.name} for ${testName.trim()}`
                    : `Open ${link.name}`
                }
                icon={
                  <Symbol
                    ios="arrow.up.right"
                    android="open_in_new"
                    size={14}
                    color={T.color.accentStrong}
                  />
                }
                onPress={() => handleOpenLab(link.url, link.name)}
              />
            ))}
          </View>
          <Text variant="footnote" tone="tertiary">
            Prices are on the lab&apos;s own page. Vyana does not show or
            check prices. Two labs open their home page, where you search for
            the test there.
          </Text>
        </Card>
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    minHeight: 44,
  },
  filterBlock: { gap: T.space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: T.space.lg,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.fill,
  },
  chipSelected: {
    backgroundColor: T.color.accentSoft,
    borderWidth: 1,
    borderColor: T.color.accent,
  },
  chipTextActive: { fontWeight: '700' },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  presetChip: { minHeight: 44 },
  buttonsWrap: { gap: T.space.sm },
});
