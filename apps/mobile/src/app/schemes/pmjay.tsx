import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useHospitals } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';
import {
  Button,
  Card,
  CardHeader,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

const PMJAY_PORTAL_URL = 'https://hospitals.pmjay.gov.in/';

export default function PmjayHospitalsScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();
  const { data: hospitals, isLoading } = useHospitals();

  const openPortal = () => {
    Linking.openURL(PMJAY_PORTAL_URL).catch(() => {
      showToast('Could not open the PM-JAY hospital search', 'error');
    });
  };

  return (
    <Screen
      eyebrow="Schemes"
      title="PM-JAY Hospitals"
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
        Ayushman Bharat Pradhan Mantri Jan Arogya Yojana. Whether a hospital
        is on the scheme is listed on the official portal — Vyana does not
        keep its own empanelment list.
      </Text>

      <MobileAiSafetyBanner />

      <Card>
        <CardHeader title="Find an empanelled hospital" />
        <Text variant="footnote" tone="secondary">
          The National Health Authority keeps the list of empanelled
          hospitals. Search it by state and district.
        </Text>
        <Button
          title="Find an empanelled hospital"
          label="Find an empanelled hospital on the official PM-JAY portal"
          icon={
            <Symbol
              ios="arrow.up.right"
              android="open_in_new"
              size={14}
              color={T.color.white}
            />
          }
          onPress={openPortal}
        />
      </Card>

      <View style={styles.section}>
        <Text variant="title3" style={styles.sectionTitle}>
          Hospitals saved in Vyana
        </Text>
        {isLoading ? (
          <Card>
            <Text variant="footnote" tone="tertiary">
              Loading saved hospitals…
            </Text>
          </Card>
        ) : hospitals && hospitals.length > 0 ? (
          hospitals.map((h) => (
            <Card key={h.id}>
              <Text variant="headline">{h.name}</Text>
              <Text variant="footnote" tone="secondary">
                {[h.address, h.city].filter(Boolean).join(', ')}
              </Text>
              {h.phone ? (
                <Text variant="footnote" tone="secondary">
                  Phone: {h.phone}
                </Text>
              ) : null}
            </Card>
          ))
        ) : (
          <Card>
            <Text variant="footnote" tone="tertiary">
              No hospitals saved in Vyana yet.
            </Text>
          </Card>
        )}
      </View>

      <Card>
        <CardHeader title="National PM-JAY helpdesk" />
        <Text variant="footnote" tone="secondary">
          Toll-free helpline: 14555. Check scheme eligibility or claim
          status, or open the national portal.
        </Text>
        <Button
          title="Visit national portal (pmjay.gov.in)"
          variant="secondary"
          label="Visit National PM-JAY Portal"
          onPress={openPortal}
          style={styles.portalBtn}
        />
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneBtn: { minHeight: 44, justifyContent: 'center' },
  section: { gap: T.space.md },
  sectionTitle: { paddingHorizontal: T.space.xs },
  portalBtn: { alignSelf: 'flex-start' },
});
