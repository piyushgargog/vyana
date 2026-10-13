import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAcceptCareInvite } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

export default function CaregiverEnterCodeScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();
  const acceptMutation = useAcceptCareInvite();

  const [code, setCode] = useState('');
  const [relation, setRelation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLinkPatient = async () => {
    setErrorMessage(null);
    const cleanCode = code.trim().replace(/\s+/g, '');
    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter a 6-digit invite code');
      showToast('Please enter a 6-digit code', 'error');
      return;
    }

    try {
      const result = await acceptMutation.mutateAsync({
        code: cleanCode,
        relation: relation.trim() || undefined,
      });

      if (!result) {
        // As specified by backend and Issue #32:
        // accept_care_invite returns null for a wrong or expired code.
        const msg = 'invalid or expired code';
        setErrorMessage(msg);
        showToast(msg, 'error');
        return;
      }

      showToast('Patient linked to your Caregiver Circle!', 'success');
      router.replace('/caregiver');
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      // As specified by backend and Issue #32:
      // After 5 wrong tries in 15 minutes it raises "too many attempts, try again in 15 minutes"
      const displayMsg = rawMsg.toLowerCase().includes('too many attempts')
        ? 'too many attempts, try again in 15 minutes'
        : rawMsg;
      setErrorMessage(displayMsg);
      showToast(displayMsg, 'error');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Enter Caregiver Code</Text>
          <Text style={styles.headerSub}>
            Link to a family member using the 6-digit code they shared
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to caregiver circle"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      {/* Main Intake Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Link Patient to Monitor</Text>
        <Text style={styles.cardSub}>
          Enter the 6-digit invite code generated on the patient&apos;s phone. Invite codes expire after 24 hours.
        </Text>

        <Text style={styles.label}>6-Digit Invite Code *</Text>
        <TextInput
          accessibilityLabel="6-digit caregiver invite code"
          keyboardType="numeric"
          maxLength={6}
          value={code}
          onChangeText={(val) => {
            setCode(val);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="e.g. 482195"
          placeholderTextColor="#94A3B8"
          style={styles.codeInput}
        />

        <Text style={styles.label}>Your Relationship to Patient (Optional)</Text>
        <TextInput
          accessibilityLabel="Relationship to patient"
          value={relation}
          onChangeText={setRelation}
          placeholder="e.g. Son, Daughter, Spouse, Guardian"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />

        {/* Error Message Box */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Link Patient"
          disabled={acceptMutation.isPending || code.trim().length !== 6}
          onPress={handleLinkPatient}
          style={[
            styles.submitBtn,
            (acceptMutation.isPending || code.trim().length !== 6) &&
              styles.submitBtnDisabled,
          ]}
        >
          {acceptMutation.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Linking Patient…</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>Link Patient</Text>
          )}
        </Pressable>
      </View>

      {/* Privacy Guidance */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What happens after linking?</Text>
        <Text style={styles.infoText}>
          You will have read-only access to view the patient&apos;s daily medicine schedule, dose adherence records, and approved care plans. You will also receive immediate push notifications if they miss a scheduled medicine dose by more than 60 minutes.
        </Text>
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  backBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backBtnText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 4 },
  codeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#0D9488',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 4,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  infoCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: 6,
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#0F766E' },
  infoText: { fontSize: 12, color: '#115E59', lineHeight: 17 },
});
