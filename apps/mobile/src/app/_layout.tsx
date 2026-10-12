import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { MobileAppProviders } from '@/components/providers';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <MobileAppProviders>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0F766E' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/login" options={{ title: 'Sign In · Vyana' }} />
          <Stack.Screen name="(auth)/signup" options={{ title: 'Create Account · Vyana' }} />
          <Stack.Screen name="consent" options={{ title: 'DPDP Health Data Consent' }} />
          <Stack.Screen name="onboarding" options={{ title: 'Complete Onboarding' }} />
        </Stack>
      </ThemeProvider>
    </MobileAppProviders>
  );
}
