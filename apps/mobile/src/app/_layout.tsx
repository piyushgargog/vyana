import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { MobileAppProviders } from '@/components/providers';
import { T } from '@/constants/theme';
import { WelcomeSplash } from '@/components/welcome-splash';
import { startHealthBackgroundSync } from '@/lib/health-background';
import { onNotificationTap } from '@/lib/notifications';
import { useReminderSync } from '@/lib/useReminderSync';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The background health sync's task must be defined in a file loaded at start (#448)
startHealthBackgroundSync();

function RootNavigator() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Keeps phone's dose & follow-up test reminders in sync with patient records
  useReminderSync();

  // Handles notification taps: caregiver alerts, missed doses, dose reminders, refills, and follow-up tests
  useEffect(() => {
    const unsubscribe = onNotificationTap((data) => {
      if (
        data.kind === 'caregiver_alert' ||
        data.type === 'missed_dose' ||
        data.patient_id
      ) {
        if (data.patient_id) {
          router.push(`/caregiver?patient_id=${encodeURIComponent(data.patient_id)}`);
        } else {
          router.push('/caregiver');
        }
      } else if (data.kind === 'dose') {
        router.push('/(tabs)');
      } else if (data.kind === 'refill') {
        router.push('/(tabs)/meds');
      } else if (data.kind === 'follow_up') {
        router.push('/(tabs)/reports');
      }
    });
    return unsubscribe;
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Lifts the whole screen above the keyboard, so no input is ever covered (Android is edge-to-edge) */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          // One way back and one title (#332): the bar carries only the back arrow,
          // on the canvas colour; every pushed screen shows its own large title.
          headerTitle: '',
          headerStyle: { backgroundColor: T.color.canvas },
          headerTintColor: T.color.accentStrong,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="(auth)/login"
        />
        <Stack.Screen
          name="(auth)/signup"
        />
        <Stack.Screen
          name="consent"
        />
        <Stack.Screen
          name="onboarding"
        />
        <Stack.Screen
          name="sos"
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="medical-id"
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="basket"
        />
        <Stack.Screen
          name="timeline"
        />
        <Stack.Screen
          name="blood"
        />
        <Stack.Screen
          name="triage"
        />
        <Stack.Screen
          name="caregiver/index"
        />
        <Stack.Screen
          name="caregiver/invite"
        />
        <Stack.Screen
          name="caregiver/enter-code"
        />
        <Stack.Screen
          name="prescriptions/scan"
        />
        <Stack.Screen
          name="prescriptions/[id]"
        />
        <Stack.Screen
          name="appointments/index"
        />
        <Stack.Screen
          name="appointments/book"
        />
        <Stack.Screen
          name="reports/upload"
        />
        <Stack.Screen
          name="reports/[id]"
        />
        <Stack.Screen
          name="care/[conditionId]"
        />
        <Stack.Screen
          name="labs-compare"
        />
        <Stack.Screen
          name="schemes/pmjay"
        />
        <Stack.Screen
          name="care/meals"
        />
      </Stack>
      </KeyboardAvoidingView>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // The welcome screen lets the native splash go once it is on screen (so no blank frame shows); this is only the safety net.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <KeyboardProvider>
      <MobileAppProviders>
        <RootNavigator />
        <WelcomeSplash />
      </MobileAppProviders>
    </KeyboardProvider>
  );
}
