import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { pharmacySearchLinks, useActiveItems } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  Pill,
  Screen,
  Symbol,
  Text,
  TextField,
} from '@/components/ui';
import { T } from '@/constants/theme';
import {
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

/** The four pharmacy searches for one medicine name, as buttons that open the shop's own site. */
function PharmacyButtons({ query }: { query: string }) {
  const { showToast } = useVyanaMobile();
  const links = useMemo(() => pharmacySearchLinks(query), [query]);
  if (links.length === 0) return null;
  return (
    <View style={styles.buttonsWrap}>
      {links.map((link) => (
        <Button
          key={link.id}
          title={`Search on ${link.name}`}
          variant="secondary"
          label={`Search on ${link.name} for ${query}`}
          icon={
            <Symbol
              ios="arrow.up.right"
              android="open_in_new"
              size={14}
              color={T.color.accentStrong}
            />
          }
          onPress={() =>
            Linking.openURL(link.url).catch(() =>
              showToast(`Could not open ${link.name}`, 'error')
            )
          }
        />
      ))}
    </View>
  );
}

export default function BasketScreen() {
  const router = useRouter();
  const { selectedBasketMedicines } = useVyanaMobile();
  const { data: activeItems, isLoading: itemsLoading } = useActiveItems();

  // Medicines chosen on the Meds tab come first; with no choice, every active medicine is listed.
  const medicines = useMemo(() => {
    const fromSelection = selectedBasketMedicines.map((m) =>
      m.strength ? `${m.name} ${m.strength}` : m.name
    );
    if (fromSelection.length > 0) return [...new Set(fromSelection)];
    return [
      ...new Set(
        (activeItems ?? []).map((m) =>
          m.strength ? `${m.medicine_name} ${m.strength}` : m.medicine_name
        )
      ),
    ];
  }, [selectedBasketMedicines, activeItems]);

  // The first medicine starts open so the four searches are visible at once.
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const open = openLabel ?? medicines[0] ?? null;

  const [other, setOther] = useState('');

  return (
    <Screen
      title="Compare medicine prices"
      eyebrow="Medicine prices"
    >
      {medicines.length === 0 ? (
        itemsLoading ? (
          <Card>
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={T.color.accent} />
              <Text variant="subhead" tone="secondary" style={{ flex: 1 }}>
                Loading your medicines…
              </Text>
            </View>
          </Card>
        ) : (
          <Card>
            <View style={styles.emptyIconWrap}>
              <Symbol ios="basket.fill" android="shopping_basket" size={28} color={T.color.accent} />
            </View>
            <Text variant="headline" style={styles.center}>
              No active medicines yet
            </Text>
            <Text variant="subhead" tone="tertiary" style={styles.center}>
              Add medicines from your prescriptions, then come back to look
              them up on the pharmacy sites.
            </Text>
            <Button
              title="View my medicines"
              onPress={() => router.push('/(tabs)/meds')}
              label="View my prescriptions"
            />
          </Card>
        )
      ) : (
        <Card>
          <CardHeader
            title="Your medicines"
            trailing={`${medicines.length} item${medicines.length === 1 ? '' : 's'}`}
          />
          <View style={styles.medicineList}>
            {medicines.map((label) => {
              const isOpen = open === label;
              return (
                <View key={label} style={styles.medicineBlock}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={`Show pharmacy searches for ${label}`}
                    onPress={() => setOpenLabel(isOpen ? '' : label)}
                    style={styles.medicineRow}
                  >
                    <Pill text={label} tone="accent" />
                    <Symbol
                      ios={isOpen ? 'chevron.up' : 'chevron.down'}
                      android={isOpen ? 'expand_less' : 'expand_more'}
                      size={16}
                      color={T.color.label3}
                    />
                  </Pressable>
                  {isOpen && <PharmacyButtons query={label} />}
                </View>
              );
            })}
          </View>
          <Text variant="footnote" tone="tertiary">
            Prices are on the shop&apos;s own page. Vyana does not show or
            check prices.
          </Text>
        </Card>
      )}

      <Card>
        <CardHeader title="Any other medicine" />
        <TextField
          accessibilityLabel="Any other medicine name"
          placeholder="Type a medicine name"
          placeholderTextColor={T.color.label3}
          value={other}
          onChangeText={setOther}
        />
        {other.trim().length > 0 && <PharmacyButtons query={other} />}
        <Text variant="footnote" tone="tertiary">
          Prices are on the shop&apos;s own page. Vyana does not show or check
          prices.
        </Text>
      </Card>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.md },
  medicineList: { gap: T.space.sm },
  medicineBlock: {
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    backgroundColor: T.color.surface,
    padding: T.space.md,
    gap: T.space.sm,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: T.space.sm,
  },
  buttonsWrap: { gap: T.space.sm },
});
