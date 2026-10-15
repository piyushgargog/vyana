import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getMyProfile } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  Screen,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

const SEEDED_TEST_EMAILS = [
  { label: 'Patient', email: 'patient@vyana.test' },
  { label: 'Caregiver', email: 'caregiver@vyana.test' },
  { label: 'Doctor', email: 'doctor@vyana.test' },
] as const;

export default function MobileLoginScreen() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaMobile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email address and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const profile = await getMyProfile(supabase);
      showToast(
        `Signed in as ${profile.full_name || email.trim()}`,
        'success'
      );

      if (!profile.onboarded) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Vyana" title="Sign in">
      <Card>
        <Text variant="subhead" tone="secondary">
          Manage prescriptions, OPD tokens, lab trends, and emergency Medical ID.
        </Text>

        {errorMsg && (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text variant="footnote" tone="danger" style={styles.errorText}>
              {errorMsg}
            </Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Email Address
          </Text>
          <TextInput
            accessibilityLabel="Email Address"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="patient@vyana.test"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Password
          </Text>
          <TextInput
            accessibilityLabel="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

        <Button
          title="Sign In"
          label="Sign In"
          loading={loading}
          onPress={handleLogin}
        />

        {__DEV__ && (
          <View style={styles.devSection}>
            <View style={styles.divider} />
            <Text variant="sectionHeader" tone="tertiary">
              Seeded test emails (enter seed password above)
            </Text>
            <View style={styles.demoRow}>
              {SEEDED_TEST_EMAILS.map((acct) => (
                <Pressable
                  key={acct.email}
                  accessibilityRole="button"
                  accessibilityLabel={`Fill email ${acct.email}`}
                  onPress={() => setEmail(acct.email)}
                  style={styles.demoBtn}
                >
                  <Text variant="footnote" style={styles.demoBtnText}>
                    {acct.label}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {acct.email}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Button
          title="New to Vyana? Create your account"
          variant="plain"
          onPress={() => router.push('/(auth)/signup')}
        />
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    backgroundColor: T.color.dangerSoft,
    borderRadius: T.radius.row,
    padding: T.space.md,
  },
  errorText: {
    fontWeight: '600',
  },
  fieldGroup: {
    gap: T.space.xs,
  },
  label: {
    fontWeight: '700',
  },
  input: {
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    paddingHorizontal: T.space.lg,
    minHeight: 46,
    ...T.text.body,
    color: T.color.label,
  },
  devSection: {
    gap: T.space.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.color.separator,
  },
  demoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.space.sm,
  },
  demoBtn: {
    flex: 1,
    minWidth: 96,
    minHeight: 44,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    paddingVertical: T.space.sm,
    paddingHorizontal: T.space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtnText: {
    fontWeight: '700',
  },
});
