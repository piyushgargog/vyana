import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { scrollScreenToTop } from '@/components/ui/screen-scroll';
import { T, useThemeColors } from '@/constants/theme';
import { useReduceTransparency } from '@/hooks/use-accessibility-setting';
import {
  CONSENT_VERSION,
  useConsent,
  useMyProfile,
  useSession,
} from '@vyana/shared';

export default function MobileTabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const reduceTransparency = useReduceTransparency();
  const themeColors = useThemeColors();
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
        <ActivityIndicator
          size="large"
          color={T.color.accent}
          accessibilityLabel="Loading your Vyana"
        />
        <Text variant="subhead" tone="secondary">
          Loading your Vyana…
        </Text>
      </View>
    );
  }

  // Re-tapping a tab returns it to its top: each tab screen registers
  // its own scroll-to-top with the frame's registry (see screen-scroll).
  function retap(path: string) {
    if (pathname === path) scrollScreenToTop(path);
  }

  return (
    <NativeTabs
      labelStyle={{ color: themeColors.label2 }}
      tintColor={themeColors.accent}
      minimizeBehavior="onScrollDown"
      disableTransparentTint={reduceTransparency}
    >
      <NativeTabs.Trigger name="index" onPress={() => retap('/')}>
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="house"
          sfSelected="house.fill"
          md="home"
          mdSelected="home_filled"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="meds" onPress={() => retap('/meds')}>
        <NativeTabs.Trigger.Label>Medicines</NativeTabs.Trigger.Label>
        {/* 'medication' has no filled variant in the set, so it stays
            the same glyph when selected. */}
        <NativeTabs.Trigger.Icon
          sf="pills"
          sfSelected="pills.fill"
          md="medication"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports" onPress={() => retap('/reports')}>
        <NativeTabs.Trigger.Label>Reports</NativeTabs.Trigger.Label>
        {/* 'lab_profile' has no filled variant in the set, so it stays
            the same glyph when selected. */}
        <NativeTabs.Trigger.Icon
          sf="doc.text"
          sfSelected="doc.text.fill"
          md="lab_profile"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assistant" onPress={() => retap('/assistant')}>
        <NativeTabs.Trigger.Label>Ask</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="bubble.left.and.text.bubble.right"
          sfSelected="bubble.left.and.text.bubble.right.fill"
          md="chat_bubble_outline"
          mdSelected="chat_bubble"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" onPress={() => retap('/profile')}>
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="person.crop.circle"
          sfSelected="person.crop.circle.fill"
          md="person_outline"
          mdSelected="person"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: T.color.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.md,
  },

});
