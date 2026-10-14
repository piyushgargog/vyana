import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  Screen,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

type SignupRole = 'patient' | 'doctor';

export default function MobileSignupScreen() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaMobile();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<SignupRole>('patient');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email address and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            role: selectedRole,
          },
        },
      });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      showToast('Account created! Please review DPDP consent.', 'success');
      router.replace('/consent');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Vyana" title="Create account">
      <Card>
        <Text variant="subhead" tone="secondary">
          Join as a patient, family caregiver, or doctor. Your data is protected
          under India&apos;s DPDP Act 2023.
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
            Full Name
          </Text>
          <TextInput
            accessibilityLabel="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

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
            placeholder="you@example.com"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Mobile Number (+91)
          </Text>
          <TextInput
            accessibilityLabel="Mobile Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98111 22334"
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
            placeholder="Minimum 8 characters"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Account Type
          </Text>
          <View style={styles.roleRow}>
            {(
              [
                { id: 'patient', label: 'Patient / Caregiver' },
                { id: 'doctor', label: 'Doctor' },
              ] as const
            ).map((item) => {
              const selected = selectedRole === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Select ${item.label} role`}
                  onPress={() => setSelectedRole(item.id)}
                  style={[
                    styles.roleChip,
                    selected && styles.roleChipActive,
                  ]}
                >
                  <Text
                    variant="footnote"
                    tone={selected ? 'accent' : 'secondary'}
                    style={selected ? styles.roleChipTextActive : undefined}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text variant="footnote" tone="tertiary" style={styles.legalNotice}>
          By creating an account, you acknowledge our{' '}
          <Text
            variant="footnote"
            tone="accent"
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://vyanahealth.app/terms')}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            variant="footnote"
            tone="accent"
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://vyanahealth.app/privacy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>

        <Button
          title="Continue to DPDP Consent"
          label="Continue to DPDP Consent"
          loading={loading}
          onPress={handleSignup}
        />

        <Button
          title="Already registered? Sign in"
          variant="plain"
          onPress={() => router.push('/(auth)/login')}
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
  roleRow: {
    flexDirection: 'row',
    gap: T.space.sm,
  },
  roleChip: {
    flex: 1,
    minHeight: 46,
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.space.sm,
  },
  roleChipActive: {
    backgroundColor: T.color.accentSoft,
    borderWidth: 1.5,
    borderColor: T.color.accent,
  },
  roleChipTextActive: {
    fontWeight: '700',
  },
  legalNotice: {
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
