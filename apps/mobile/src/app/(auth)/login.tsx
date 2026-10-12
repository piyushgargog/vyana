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

export default function MobileLoginScreen() {
  const router = useRouter();
  const { supabase, hasLiveSupabaseEnv, setRole, showToast } = useVyanaMobile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<MobileRole>('patient');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      if (hasLiveSupabaseEnv && email.trim() && password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }
      }
      setRole(selectedRole);
      showToast(`Signed in as ${selectedRole}`, 'success');
      router.replace('/(tabs)');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoRole: MobileRole) => {
    setRole(demoRole);
    showToast(`Signed in with ${demoRole} demo account`, 'success');
    router.replace('/(tabs)');
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
            placeholder="asha.devi@example.com"
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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Account Role</Text>
          <View style={styles.roleRow}>
            {(['patient', 'caregiver'] as const).map((r) => (
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
                  {r === 'patient' ? 'Patient' : 'Caregiver'}
                </Text>
              </Pressable>
            ))}
          </View>
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

        <Text style={styles.sectionLabel}>Instant Demo Profiles</Text>
        <View style={styles.demoRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in as Demo Patient Asha Devi"
            onPress={() => handleQuickDemo('patient')}
            style={styles.demoBtn}
          >
            <Text style={styles.demoBtnText}>Patient: Asha Devi</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in as Demo Caregiver Rohit Verma"
            onPress={() => handleQuickDemo('caregiver')}
            style={styles.demoBtn}
          >
            <Text style={styles.demoBtnText}>Caregiver: Rohit</Text>
          </Pressable>
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
  roleRow: { flexDirection: 'row', gap: 10 },
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
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  demoRow: { flexDirection: 'row', gap: 10 },
  demoBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  demoBtnText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  switchLink: { alignItems: 'center', paddingTop: 6 },
  switchLinkText: { fontSize: 13, fontWeight: '700', color: '#0F766E' },
});
