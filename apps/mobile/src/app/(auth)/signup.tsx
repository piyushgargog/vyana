import React, { useEffect, useState } from 'react';
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
  RESEND_CONFIRMATION_COOLDOWN_SECONDS,
  resendConfirmationLabel,
  resendSignupConfirmation,
  signupConfirmationUrl,
  submitSignup,
  type SignupRole,
} from '@/components/signup-flow';
import {
  Button,
  Card,
  Screen,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

export default function MobileSignupScreen() {
  const router = useRouter();
  const { supabase, baseUrl, showToast } = useVyanaMobile();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<SignupRole>('patient');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendSending, setResendSending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  // Starts at 0 and is set in the resend handlers and the interval (same
  // pattern as the web form, where the clock cannot be read during render).
  const [now, setNow] = useState(0);

  const confirmationUrl = signupConfirmationUrl(baseUrl);
  const resendSeconds =
    resendAvailableAt === null
      ? 0
      : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  useEffect(() => {
    if (!pendingEmail || resendAvailableAt === null) return;
    if (resendAvailableAt <= Date.now()) return;

    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= resendAvailableAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingEmail, resendAvailableAt]);

  const startResendCooldown = () => {
    setNow(Date.now());
    setResendAvailableAt(
      Date.now() + RESEND_CONFIRMATION_COOLDOWN_SECONDS * 1000,
    );
  };

  const handleSignup = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email address and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await submitSignup(
        supabase.auth,
        {
          email,
          password,
          fullName,
          phone,
          role: selectedRole,
        },
        confirmationUrl,
      );

      if (result.status === 'error') {
        setErrorMsg(result.message);
        return;
      }

      if (result.status === 'confirmation') {
        setPendingEmail(result.email);
        setResendMessage(null);
        setResendError(null);
        startResendCooldown();
        return;
      }

      showToast('Account created! Please review DPDP consent.', 'success');
      router.replace('/consent');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || resendSeconds > 0) return;
    setResendSending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      const result = await resendSignupConfirmation(
        supabase.auth,
        pendingEmail,
        confirmationUrl,
      );
      if (result.status === 'error') {
        setResendError(result.message);
        return;
      }

      setResendMessage(
        `Another confirmation email was sent to ${result.email}. Use the newest email.`,
      );
      startResendCooldown();
    } finally {
      setResendSending(false);
    }
  };

  const resetPendingConfirmation = () => {
    setPendingEmail(null);
    setResendMessage(null);
    setResendError(null);
    setResendAvailableAt(null);
  };

  return (
    <Screen
      eyebrow="Vyana"
      title={pendingEmail ? 'Check your inbox' : 'Create account'}
    >
      <Card>
        {pendingEmail ? (
          <>
            <Text variant="subhead" tone="secondary">
              We sent a confirmation email to{' '}
              <Text variant="subhead" style={styles.pendingEmail}>
                {pendingEmail}
              </Text>
              . Open it and choose “Confirm Email Address” to finish creating
              your account.
            </Text>
            <Text variant="footnote" tone="tertiary">
              The link expires. If you send another email, use the newest one.
              Check your spam or promotions folder if you do not see the
              email.
            </Text>

            {resendMessage && (
              <View accessibilityRole="text" style={styles.successBox}>
                <Text variant="footnote" tone="ok" style={styles.successText}>
                  {resendMessage}
                </Text>
              </View>
            )}

            {resendError && (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text variant="footnote" tone="danger" style={styles.errorText}>
                  {resendError}
                </Text>
              </View>
            )}

            <Button
              title={resendConfirmationLabel(resendSeconds)}
              label={resendConfirmationLabel(resendSeconds)}
              loading={resendSending}
              disabled={resendSeconds > 0}
              onPress={handleResend}
            />

            <Button
              title="Use a different email"
              variant="plain"
              onPress={resetPendingConfirmation}
            />

            <Button
              title="Already confirmed? Sign in"
              variant="plain"
              onPress={() => router.push('/(auth)/login')}
            />
          </>
        ) : (
          <>
            <Text variant="subhead" tone="secondary">
              Join as a patient, family caregiver, or doctor. Your data is
              protected under India&apos;s DPDP Act 2023.
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
          </>
        )}
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
  successBox: {
    backgroundColor: T.color.okSoft,
    borderRadius: T.radius.row,
    padding: T.space.md,
  },
  successText: {
    fontWeight: '600',
  },
  pendingEmail: {
    fontWeight: '700',
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
