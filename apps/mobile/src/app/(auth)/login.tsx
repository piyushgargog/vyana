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
import { getMyProfile } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.brandBadge}>Vyana · व्यान</Text>
        <Text style={styles.title}>Sign in to your companion</Text>
        <Text style={styles.subtitle}>
          Manage prescriptions, OPD tokens, lab trends, and emergency Medical ID.
        </Text>

        {errorMsg && (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            accessibilityLabel="Email Address"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="patient@vyana.test"
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
            placeholder="••••••••"
            style={styles.input}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign In"
          disabled={loading}
          onPress={handleLogin}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>
          Seeded Test Emails (enter SEED_PASSWORD above)
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
              <Text style={styles.demoBtnText}>{acct.label}</Text>
              <Text style={styles.demoEmailText}>{acct.email}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Create a new Vyana account"
          onPress={() => router.push('/(auth)/signup')}
          style={styles.switchLink}
        >
          <Text style={styles.switchLinkText}>
            New to Vyana? Create your account →
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
  primaryBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoBtn: {
    flex: 1,
    minWidth: 96,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  demoBtnText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  demoEmailText: { fontSize: 10, color: '#64748B' },
  switchLink: { alignItems: 'center', paddingTop: 6 },
  switchLinkText: { fontSize: 13, fontWeight: '700', color: '#0F766E' },
});
