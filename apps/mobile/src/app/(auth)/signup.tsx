import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVyanaMobile, type MobileRole } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

export default function MobileSignupScreen() {
  const router = useRouter();
  const {
    supabase,
    hasLiveSupabaseEnv,
    setRole,
    updateLocalProfile,
    setOnboarded,
    showToast,
  } = useVyanaMobile();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<MobileRole>('patient');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      if (hasLiveSupabaseEnv && email.trim() && password) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: selectedRole,
            },
          },
        });
        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }
      }

      setRole(selectedRole);
      updateLocalProfile({
        full_name: fullName.trim() || 'Vyana Patient',
        phone: phone.trim() || '+91 98111 22334',
        role: selectedRole,
      });
      setOnboarded(false);
      showToast('Account created! Please review DPDP consent.', 'success');
      router.push('/consent');
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
          Join as a patient or caregiver. Your data is protected under India&apos;s DPDP Act 2023.
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
            placeholder="Asha Devi"
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
            placeholder="asha.devi@example.com"
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
          <Text style={styles.label}>Select Your Role</Text>
          <View style={styles.roleRow}>
            {(['patient', 'caregiver', 'doctor'] as const).map((r) => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedRole === r }}
                accessibilityLabel={`Select ${r} role`}
                onPress={() => setSelectedRole(r)}
                style={[
                  styles.roleChip,
                  selectedRole === r && styles.roleChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    selectedRole === r && styles.roleChipTextActive,
                  ]}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

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
});
