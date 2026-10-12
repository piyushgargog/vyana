import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CONSENT_VERSION,
  useAcceptConsent,
  useConsent,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';

export default function MobileConsentScreen() {
  const router = useRouter();
  const { consentedVersion, grantLocalConsent, onboarded } = useVyanaMobile();
  const { data: remoteHasConsented } = useConsent(CONSENT_VERSION);
  const grantMutation = useAcceptConsent();

  const [agreedData, setAgreedData] = useState(true);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(true);

  const isConsented =
    Boolean(remoteHasConsented) || consentedVersion === CONSENT_VERSION;

  const handleAccept = async () => {
    try {
      await grantMutation.mutateAsync(CONSENT_VERSION);
    } catch {
      // Fallback to local state in demo/offline mode
    }
    grantLocalConsent(CONSENT_VERSION);
    if (!onboarded) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.badge}>DPDP Act 2023</Text>
          <Text style={styles.versionTag}>Version: {CONSENT_VERSION}</Text>
        </View>

        <Text style={styles.title}>Health Data & Privacy Consent</Text>

        {isConsented && (
          <View style={styles.activeBanner}>
            <Text style={styles.activeBannerText}>
              Consent active for version {CONSENT_VERSION}. You can export or
              delete all your data anytime from the Profile tab.
            </Text>
          </View>
        )}

        <View style={styles.pointCard}>
          <Text style={styles.pointTitle}>1. What We Store & Why</Text>
          <Text style={styles.pointBody}>
            Your profile, allergies, prescriptions, dose logs, lab reports,
            vitals, and OPD tokens are stored solely to power your health
            timeline, dose reminders, and doctor visits.
          </Text>
        </View>

        <View style={styles.pointCard}>
          <Text style={styles.pointTitle}>2. AI Redaction & Safety</Text>
          <Text style={styles.pointBody}>
            Phone numbers, emails, Aadhaar/PAN, and patient header blocks are
            stripped before any AI analysis. You always review extracted items
            before saving.
          </Text>
        </View>

        <View style={styles.pointCard}>
          <Text style={styles.pointTitle}>3. Right to Export & Erase</Text>
          <Text style={styles.pointBody}>
            You can download your complete health record as JSON or permanently
            delete your account and files in two taps from Profile.
          </Text>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedData }}
          accessibilityLabel="Consent to health data processing under DPDP Act 2023"
          onPress={() => setAgreedData((v) => !v)}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, agreedData && styles.checkboxChecked]}>
            {agreedData && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.checkText}>
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
            {agreedDisclaimer && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.checkText}>
            I understand Vyana is not a substitute for professional medical
            advice or emergency care.
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Accept Consent and Continue"
          disabled={!agreedData || !agreedDisclaimer || grantMutation.isPending}
          onPress={handleAccept}
          style={[
            styles.primaryBtn,
            (!agreedData || !agreedDisclaimer) && styles.primaryBtnDisabled,
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {grantMutation.isPending
              ? 'Recording Consent…'
              : 'I Consent & Continue →'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#CCFBF1',
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  versionTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  activeBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  activeBannerText: { fontSize: 12, color: '#065F46', fontWeight: '600' },
  pointCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  pointTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  pointBody: { fontSize: 12, color: '#475569', lineHeight: 18 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  checkMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  checkText: { flex: 1, fontSize: 13, color: '#1E293B', lineHeight: 19 },
  primaryBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
