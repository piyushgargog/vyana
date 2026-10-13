import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCareInvite } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

export default function CaregiverInviteScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();
  const inviteMutation = useCareInvite();
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const handleGenerateCode = async () => {
    try {
      const code = await inviteMutation.mutateAsync();
      setInviteCode(code);
      showToast('New 6-digit caregiver invite code generated', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not generate invite code',
        'error'
      );
    }
  };

  const handleShareCode = async () => {
    if (!inviteCode) return;
    try {
      await Share.share({
        message: `Vyana Caregiver Invite Code: ${inviteCode}\nUse this 6-digit code in the Vyana app to link and view medication schedules and emergency alerts (valid for 24 hours).`,
        title: 'Vyana Caregiver Invite Code',
      });
    } catch {
      showToast(`Caregiver Code: ${inviteCode}`, 'info');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Navigation */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Invite a Caregiver</Text>
          <Text style={styles.headerSub}>
            Share a secure, temporary 6-digit code with your family member
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

      {/* Main Code Generation Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Temporary Caregiver Code</Text>
        <Text style={styles.cardSub}>
          When your caregiver enters this code on their Vyana app, they will be securely linked to your health circle for medication monitoring and emergency escalation.
        </Text>

        {inviteCode ? (
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>6-Digit Invite Code</Text>
            <Text
              accessibilityLabel={`Invite code ${inviteCode}`}
              style={styles.codeDisplay}
            >
              {inviteCode.split('').join(' ')}
            </Text>
            <Text style={styles.expiryBadge}>
              ⏱ Valid for 24 hours · Single-use
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share invite code with caregiver"
              onPress={handleShareCode}
              style={styles.copyBtn}
            >
              <Text style={styles.copyBtnText}>📤 Share Code with Caregiver</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.generateBox}>
            <Text style={styles.generatePrompt}>
              Generate a code now to share with your family caregiver or guardian.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate 6-digit invite code"
              disabled={inviteMutation.isPending}
              onPress={handleGenerateCode}
              style={[
                styles.generateBtn,
                inviteMutation.isPending && styles.generateBtnDisabled,
              ]}
            >
              {inviteMutation.isPending ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.generateBtnText}>Generating Code…</Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>
                  Generate 6-Digit Code
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Access Permissions Explanation */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What your caregiver can see:</Text>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletCheck}>✓</Text>
          <Text style={styles.bulletText}>
            Today&apos;s scheduled medicines, dosage logs, and adherence rate
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletCheck}>✓</Text>
          <Text style={styles.bulletText}>
            Missed-dose push notifications if a dose is not logged within 60 minutes
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletCheck}>✓</Text>
          <Text style={styles.bulletText}>
            Approved disease care plans, follow-up tests, and dietary guidelines
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletCheck}>✓</Text>
          <Text style={styles.bulletText}>
            Emergency SOS trigger and offline medical summary
          </Text>
        </View>

        <Text style={[styles.infoTitle, { marginTop: 8 }]}>
          Privacy & Security Safeguards:
        </Text>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletShield}>🔒</Text>
          <Text style={styles.bulletText}>
            Read-only access: caregivers cannot change prescriptions or medical notes
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletShield}>🔒</Text>
          <Text style={styles.bulletText}>
            You can revoke access at any time from your Caregiver Circle
          </Text>
        </View>
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
  generateBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  generatePrompt: {
    fontSize: 13,
    color: '#0F766E',
    textAlign: 'center',
    lineHeight: 18,
  },
  generateBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  codeContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  codeLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  codeDisplay: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#0F766E',
    fontFamily: 'monospace',
    paddingVertical: 6,
  },
  expiryBadge: {
    fontSize: 11,
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    fontWeight: '700',
  },
  copyBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  copyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletCheck: { color: '#0D9488', fontSize: 13, fontWeight: '800' },
  bulletShield: { fontSize: 12 },
  bulletText: { flex: 1, fontSize: 12, color: '#475569', lineHeight: 17 },
});
