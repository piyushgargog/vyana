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
        <ActivityIndicator size="large" color={T.color.accent} accessibilityLabel="Loading your Vyana" />
        <Text variant="subhead" tone="secondary">
          Loading your Vyana…
        </Text>
      </View>
    );
  }

  // Native glass tab bar (Liquid Glass on iOS, native bottom bar on Android). The glass lives
  // only here, on the bar (#487): on iOS the system material itself turns solid when the person
  // asks for reduced transparency, and on Android the bar gets the solid surface colour instead.
  // Every tab screen draws its own large title with SOS in the trailing slot (#130, #132).
  //
  // A re-tap of the tab you are already on scrolls its root to the top: the trigger hears the
  // press, and the screen registered its scroll view under its pathname (`Screen`).
  const retap = (path: string) => () => {
    if (pathname === path) {
      scrollScreenToTop(path);
    }
  };

  // Every tab's icon is the outline glyph unselected and the filled glyph selected (#486),
  // on Android as on iOS. Material Symbols ships both variants for home, the chat bubble and
  // person, so those swap; `medication` and `lab_profile` have no filled variant anywhere in
  // the set (checked against the expo-symbols catalog), so Medicines and Reports keep their
  // single glyph and take the selected tint — the only two tabs where Android cannot swap.
  return (
    <NativeTabs
      labelVisibilityMode="labeled"
      backgroundColor={reduceTransparency ? themeColors.surface : undefined}
      iconColor={{ default: T.color.label3, selected: T.color.accent }}
      labelStyle={{
        default: { fontSize: T.text.caption2.fontSize, fontWeight: '600', color: T.color.label3 },
        selected: { fontSize: T.text.caption2.fontSize, fontWeight: '600', color: T.color.accent },
      }}
    >
      <NativeTabs.Trigger name="index" listeners={{ tabPress: retap('/') }}>
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home_filled' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="meds" listeners={{ tabPress: retap('/meds') }}>
        <NativeTabs.Trigger.Label>Medicines</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'pills', selected: 'pills.fill' }} md="medication" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports" listeners={{ tabPress: retap('/reports') }}>
        <NativeTabs.Trigger.Label>Reports</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          md="lab_profile"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assistant" listeners={{ tabPress: retap('/assistant') }}>
        <NativeTabs.Trigger.Label>Ask</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'bubble.left.and.text.bubble.right',
            selected: 'bubble.left.and.text.bubble.right.fill',
          }}
          md={{ default: 'chat_bubble_outline', selected: 'chat_bubble' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" listeners={{ tabPress: retap('/profile') }}>
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'person_outline', selected: 'person' }}
        />
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
