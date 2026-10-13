import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.brandBadge}>Vyana · व्यान</Text>
        <Text style={styles.title}>Create your Vyana account</Text>
        <Text style={styles.subtitle}>
          Join as a patient, family caregiver, or doctor. Your data is protected
          under India&apos;s DPDP Act 2023.
        </Text>

        {errorMsg && (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            accessibilityLabel="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            accessibilityLabel="Email Address"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Mobile Number (+91)</Text>
          <TextInput
            accessibilityLabel="Mobile Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98111 22334"
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 8 characters"
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Account Type</Text>
          <View style={styles.roleRow}>
            {(
              [
                { id: 'patient', label: 'Patient / Caregiver' },
                { id: 'doctor', label: 'Doctor' },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedRole === item.id }}
                accessibilityLabel={`Select ${item.label} role`}
                onPress={() => setSelectedRole(item.id)}
                style={[
                  styles.roleChip,
                  selectedRole === item.id && styles.roleChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    selectedRole === item.id && styles.roleChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.legalNotice}>
          By creating an account, you acknowledge our{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://vyanahealth.app/terms')}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://vyanahealth.app/privacy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to DPDP Consent"
          disabled={loading}
          onPress={handleSignup}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? 'Creating account…' : 'Continue to DPDP Consent →'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Sign in to existing account"
          onPress={() => router.push('/(auth)/login')}
          style={styles.switchLink}
        >
          <Text style={styles.switchLinkText}>
            Already registered? Sign in →
          </Text>
        </Pressable>
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#475569', lineHeight: 19 },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: '#991B1B', fontSize: 12, fontWeight: '600' },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  roleChipActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  roleChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  roleChipTextActive: { color: '#0F766E', fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  switchLink: { alignItems: 'center', paddingTop: 6 },
  switchLinkText: { fontSize: 13, fontWeight: '700', color: '#0F766E' },
  legalNotice: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  legalLink: {
    color: '#0F766E',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
