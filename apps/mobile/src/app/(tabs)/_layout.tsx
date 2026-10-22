import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { T } from '@/constants/theme';
import {
  CONSENT_VERSION,
  useConsent,
  useMyProfile,
  useSession,
} from '@vyana/shared';

export default function MobileTabsLayout() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { data: consentRecord, isLoading: consentLoading } =
    useConsent(CONSENT_VERSION);
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (consentLoading) return;
    if (consentRecord === null) {
      router.replace('/consent');
      return;
    }
    if (profileLoading || !profile) return;
    if (!profile.onboarded) {
      router.replace('/onboarding');
    }
  }, [
    sessionLoading,
    user,
    consentLoading,
    consentRecord,
    profileLoading,
    profile,
    router,
  ]);

  if (
    sessionLoading ||
    !user ||
    consentLoading ||
    profileLoading ||
    consentRecord === null ||
    !profile?.onboarded
  ) {
    return (
      <View style={styles.loadingScreen} accessibilityLabel="Loading your Vyana">
        <ActivityIndicator size="large" color={T.color.accent} accessibilityLabel="Loading your Vyana" />
        <Text variant="subhead" tone="secondary">
          Loading your Vyana…
        </Text>
      </View>
    );
  }

  // Native glass tab bar (Liquid Glass on iOS, native bottom bar on Android).
  // Every tab screen draws its own large title with SOS in the trailing slot (#130, #132).
  return (
    <NativeTabs
      iconColor={{ default: T.color.label3, selected: T.color.accent }}
      labelStyle={{
        default: { fontSize: 11, fontWeight: '600', color: T.color.label3 },
        selected: { fontSize: 11, fontWeight: '600', color: T.color.accent },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="meds">
        <NativeTabs.Trigger.Label>Medicines</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="pills.fill" md="medication" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <NativeTabs.Trigger.Label>Reports</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text.fill" md="lab_profile" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assistant">
        <NativeTabs.Trigger.Label>Ask</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.text.bubble.right.fill" md="forum" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: T.color.canvas,
  },

});
