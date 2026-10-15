import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { MobileAppProviders } from '@/components/providers';
import { onNotificationTap } from '@/lib/notifications';
import { useReminderSync } from '@/lib/useReminderSync';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F766E' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="(auth)/login"
          options={{ title: 'Sign In · Vyana' }}
        />
        <Stack.Screen
          name="(auth)/signup"
          options={{ title: 'Create Account · Vyana' }}
        />
        <Stack.Screen
          name="consent"
          options={{ title: 'DPDP Health Data Consent' }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ title: 'Complete Onboarding' }}
        />
        <Stack.Screen
          name="sos"
          options={{
            presentation: 'modal',
            title: 'Emergency SOS · 108 / 112',
          }}
        />
        <Stack.Screen
          name="medical-id"
          options={{
            presentation: 'modal',
            title: 'Emergency Medical ID',
          }}
        />
        <Stack.Screen
          name="basket"
          options={{
            title: 'Prescription Basket · Home Delivery',
          }}
        />
        <Stack.Screen
          name="timeline"
          options={{
            title: 'Health Timeline',
          }}
        />
        <Stack.Screen
          name="triage"
          options={{
            title: 'Symptom Triage',
          }}
        />
        <Stack.Screen
          name="caregiver/index"
          options={{
            title: 'Caregiver Circle & Dashboard',
          }}
        />
        <Stack.Screen
          name="caregiver/invite"
          options={{
            title: 'Invite Caregiver',
          }}
        />
        <Stack.Screen
          name="caregiver/enter-code"
          options={{
            title: 'Enter Caregiver Code',
          }}
        />
        <Stack.Screen
          name="prescriptions/scan"
          options={{
            title: 'Scan Prescription',
          }}
        />
        <Stack.Screen
          name="prescriptions/[id]"
          options={{
            title: 'Prescription Details',
          }}
        />
        <Stack.Screen
          name="appointments/index"
          options={{
            title: 'Hospital OPD Appointments',
          }}
        />
        <Stack.Screen
          name="appointments/book"
          options={{
            title: 'Book OPD Token',
          }}
        />
        <Stack.Screen
          name="reports/upload"
          options={{
            title: 'Upload Lab Report',
          }}
        />
        <Stack.Screen
          name="reports/[id]"
          options={{
            title: 'Lab Report Details',
          }}
        />
        <Stack.Screen
          name="care/[conditionId]"
          options={{
            title: 'Care Plan & Vitals',
          }}
        />
        <Stack.Screen
          name="labs-compare"
          options={{
            title: 'Compare Lab Prices',
          }}
        />
        <Stack.Screen
          name="alerts"
          options={{
            title: 'CDSCO Drug Quality Alerts',
          }}
        />
        <Stack.Screen
          name="schemes/pmjay"
          options={{
            title: 'PM-JAY Empanelled Hospitals',
          }}
        />
        <Stack.Screen
          name="care/meals"
          options={{
            title: 'Daily Meal Log',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <MobileAppProviders>
      <RootNavigator />
    </MobileAppProviders>
  );
}
