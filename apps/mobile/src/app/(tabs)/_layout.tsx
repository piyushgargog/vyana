import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CONSENT_VERSION,
  useConsent,
  useMyProfile,
  useSession,
} from '@vyana/shared';

function TabGlyph({ symbol, focused }: { symbol: string; focused: boolean }) {
  return (
    <View
      style={[
        styles.glyphCircle,
        focused ? styles.glyphFocused : styles.glyphIdle,
      ]}
    >
      <Text
        style={[
          styles.glyphText,
          focused ? styles.glyphTextFocused : styles.glyphTextIdle,
        ]}
      >
        {symbol}
      </Text>
    </View>
  );
}

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
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0D9488',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerStyle: {
          backgroundColor: '#0F766E',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency SOS 108"
            onPress={() => router.push('/sos')}
            style={styles.sosHeaderBtn}
          >
            <Text style={styles.sosHeaderBtnText}>SOS 108</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Vyana · व्यान',
          tabBarIcon: ({ focused }) => (
            <TabGlyph symbol="⌂" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: 'Meds',
          headerTitle: 'Medicines & Prescriptions',
          tabBarIcon: ({ focused }) => (
            <TabGlyph symbol="Rx" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          headerTitle: 'Lab Reports & Trends',
          tabBarIcon: ({ focused }) => (
            <TabGlyph symbol="📊" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Assistant',
          headerTitle: 'Vyana Health Assistant',
          tabBarIcon: ({ focused }) => (
            <TabGlyph symbol="✦" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Profile & DPDP Privacy',
          tabBarIcon: ({ focused }) => (
            <TabGlyph symbol="☺" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  glyphCircle: {
    width: 28,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphFocused: {
    backgroundColor: '#CCFBF1',
  },
  glyphIdle: {
    backgroundColor: 'transparent',
  },
  glyphText: {
    fontSize: 13,
    fontWeight: '800',
  },
  glyphTextFocused: {
    color: '#0F766E',
  },
  glyphTextIdle: {
    color: '#64748B',
  },
  sosHeaderBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 12,
  },
  sosHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
