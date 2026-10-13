import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { MobileAppProviders } from '@/components/providers';
import { useReminderSync } from '@/lib/useReminderSync';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const colorScheme = useColorScheme();

  // Keeps phone's dose & follow-up test reminders in sync with patient records
  useReminderSync();

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
          name="labs/compare"
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
          name="pmjay"
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
        <Stack.Screen
          name="meals"
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
