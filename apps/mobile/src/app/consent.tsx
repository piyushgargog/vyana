import React, { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CONSENT_VERSION,
  useAcceptConsent,
  useConsent,
  useMyProfile,
  useSession,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  IconTile,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

const CONSENT_POINTS = [
  {
    icon: { ios: 'tray.full.fill' as const, android: 'inventory_2' },
    color: 'blue' as const,
    title: 'What we store and why',
    body: 'Your profile, allergies, prescriptions, dose logs, lab reports, vitals, and OPD tokens are stored solely to power your health timeline, dose reminders, and doctor visits.',
  },
  {
    icon: { ios: 'shield.fill' as const, android: 'shield' },
    color: 'green' as const,
    title: 'AI redaction and safety',
    body: 'Phone numbers, emails, Aadhaar/PAN, and patient header blocks are stripped before any AI analysis. You always review extracted items before saving.',
  },
  {
    icon: { ios: 'square.and.arrow.up.fill' as const, android: 'share' },
    color: 'orange' as const,
    title: 'Right to export and erase',
    body: 'You can download your complete health record as JSON or permanently delete your account and files in two taps from Profile.',
  },
];

export default function MobileConsentScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();
  const { user, loading: sessionLoading } = useSession();
  const { data: consentRecord } = useConsent(CONSENT_VERSION);
  const { data: profile } = useMyProfile();
  const grantMutation = useAcceptConsent();

  const [agreedData, setAgreedData] = useState(true);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [sessionLoading, user, router]);

  const isConsented = Boolean(consentRecord);

  const handleAccept = async () => {
    setErrorMsg(null);
    try {
      await grantMutation.mutateAsync(CONSENT_VERSION);
      showToast(`DPDP Consent (${CONSENT_VERSION}) recorded`, 'success');
      if (!profile?.onboarded) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to record consent'
      );
    }
  };

  const canAccept = agreedData && agreedDisclaimer;

  return (
    <Screen
      eyebrow="DPDP Act 2023"
      title="Health data consent"
      trailing={<Pill text={`v${CONSENT_VERSION}`} tone="neutral" />}
    >
      {errorMsg && (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text variant="footnote" tone="danger" style={styles.errorText}>
            {errorMsg}
          </Text>
        </View>
      )}

      {isConsented && (
        <Card style={styles.activeBanner}>
          <Text variant="footnote" tone="ok" style={styles.activeBannerText}>
            Consent active for version {CONSENT_VERSION}. You can export or
            delete all your data anytime from the Profile tab.
          </Text>
        </Card>
      )}

      <ListGroup header="What you're agreeing to">
        {CONSENT_POINTS.map((point) => (
          <ListRow
            key={point.title}
            icon={
              <IconTile
                ios={point.icon.ios}
                android={point.icon.android}
                color={point.color}
              />
            }
            title={point.title}
            subtitle={point.body}
          />
        ))}
      </ListGroup>

      <Card>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedData }}
          accessibilityLabel="Consent to health data processing under DPDP Act 2023"
          onPress={() => setAgreedData((v) => !v)}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, agreedData && styles.checkboxChecked]}>
            {agreedData && (
              <Symbol
                ios="checkmark"
                android="check"
                size={14}
                color={T.color.white}
              />
            )}
          </View>
          <Text variant="subhead" style={styles.checkText}>
            I consent to Vyana storing and processing my health data under
            Consent Version {CONSENT_VERSION}.
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedDisclaimer }}
          accessibilityLabel="Acknowledge medical advice disclaimer"
          onPress={() => setAgreedDisclaimer((v) => !v)}
          style={styles.checkRow}
        >
          <View
            style={[
              styles.checkbox,
              agreedDisclaimer && styles.checkboxChecked,
            ]}
          >
            {agreedDisclaimer && (
              <Symbol
                ios="checkmark"
                android="check"
                size={14}
                color={T.color.white}
              />
            )}
          </View>
          <Text variant="subhead" style={styles.checkText}>
            I understand Vyana is not a substitute for professional medical
            advice or emergency care.
          </Text>
        </Pressable>

        <Text variant="footnote" tone="tertiary" style={styles.legalNotice}>
          Read our complete{' '}
          <Text
            variant="footnote"
            tone="accent"
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://vyanahealth.app/privacy')}
          >
            Privacy Policy
          </Text>{' '}
          and{' '}
          <Text
            variant="footnote"
            tone="accent"
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://vyanahealth.app/terms')}
          >
            Terms of Service
          </Text>
          .
        </Text>

        <Button
          title="I consent and continue"
          label="Accept consent and continue"
          disabled={!canAccept}
          loading={grantMutation.isPending}
          onPress={handleAccept}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    backgroundColor: T.color.dangerSoft,
    borderRadius: T.radius.row,
    padding: T.space.md,
  },
  errorText: {
    fontWeight: '600',
  },
  activeBanner: {
    backgroundColor: T.color.okSoft,
  },
  activeBannerText: {
    fontWeight: '600',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.space.md,
    minHeight: 44,
    paddingVertical: T.space.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: T.color.label3,
    backgroundColor: T.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: T.color.accent,
    borderColor: T.color.accent,
  },
  checkText: {
    flex: 1,
    lineHeight: 20,
  },
  legalNotice: {
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
