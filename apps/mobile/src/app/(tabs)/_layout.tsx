import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { Symbol, Text } from '@/components/ui';
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
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={T.color.accent} />
      </View>
    );
  }

  // SF Symbols on iOS, Material Symbols on Android (ADR-066). The native glass tab bar replaces this once every
  // tab screen draws its own large title (#130).
  const icon = (ios: Parameters<typeof Symbol>[0]['ios'], android: string) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return <Symbol ios={ios} android={android} size={24} color={color} />;
    };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: T.color.accent,
        tabBarInactiveTintColor: T.color.label3,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        headerStyle: styles.header,
        headerShadowVisible: false,
        headerTintColor: T.color.label,
        headerTitleStyle: styles.headerTitle,
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency SOS: call 108"
            onPress={() => router.push('/sos')}
            style={styles.sosHeaderBtn}
          >
            <Text variant="footnote" tone="danger" style={styles.sosText}>
              SOS
            </Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', headerTitle: 'Today', tabBarIcon: icon('house.fill', 'home') }} />
      <Tabs.Screen name="meds" options={{ title: 'Medicines', headerTitle: 'Medicines', tabBarIcon: icon('pills.fill', 'medication') }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', headerTitle: 'Reports', tabBarIcon: icon('doc.text.fill', 'lab_profile') }} />
      <Tabs.Screen name="assistant" options={{ title: 'Ask', headerTitle: 'Ask Vyana', tabBarIcon: icon('bubble.left.and.text.bubble.right.fill', 'forum') }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', headerTitle: 'Me', tabBarIcon: icon('person.crop.circle.fill', 'account_circle') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.canvas,
  },
  tabBar: {
    backgroundColor: 'rgba(249,249,249,0.94)',
    borderTopColor: T.color.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  header: { backgroundColor: T.color.canvas },
  headerTitle: { fontWeight: '600', fontSize: 17, color: T.color.label },
  sosHeaderBtn: {
    backgroundColor: T.color.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: T.radius.pill,
    marginRight: 16,
  },
  sosText: { fontWeight: '700' },
});
