import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { Button, Card, CardHeader, Screen, Symbol, Text } from '@/components/ui';
import { PMJAY_PORTAL_URL } from '@/constants/pmjay';
import { T } from '@/constants/theme';

export default function PmjayHospitalsScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const handleOpenPmjayPortal = () => {
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
        Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY).
      </Text>

      <Card>
        <CardHeader title="Official hospital search" />
        <Text variant="footnote" tone="secondary">
          Whether you are eligible and which hospitals are empanelled are
          checked on the official portal. Vyana does not show a hospital list
          for this scheme. Open the portal to look it up yourself.
        </Text>
        <Button
          title="Open hospitals.pmjay.gov.in"
          label="Open the official PM-JAY hospital search portal"
          icon={
            <Symbol
              ios="arrow.up.right"
              android="open_in_new"
              size={16}
              color={T.color.white}
            />
          }
          onPress={handleOpenPmjayPortal}
          style={styles.portalBtn}
        />
      </Card>

      <Card>
        <CardHeader title="National PM-JAY helpdesk" />
        <Text variant="footnote" tone="secondary">
          Toll-free helpline: 14555.
        </Text>
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneBtn: { minHeight: 44, justifyContent: 'center' },
  portalBtn: { alignSelf: 'flex-start' },
});
