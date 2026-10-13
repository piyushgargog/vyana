import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  buildMedicalIdQr,
  useActiveItems,
  useCreateShareLink,
  useEmergencyContacts,
  useMyProfile,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileDisclaimerFooter,
  MobileQrGrid,
} from '@/components/ui-primitives';

export default function MedicalIdScreen() {
  const router = useRouter();
  const { baseUrl, showToast } = useVyanaMobile();

  const { data: profile } = useMyProfile();
  const { data: activeItems = [] } = useActiveItems();
  const { data: contacts = [] } = useEmergencyContacts();
  const createShareMutation = useCreateShareLink();

  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const primaryContact = useMemo(
    () =>
      contacts[0]
        ? { name: contacts[0].name, phone: contacts[0].phone }
        : null,
    [contacts]
  );

  const qrData = useMemo(() => {
    const p = {
      full_name: profile?.full_name ?? null,
      blood_group: profile?.blood_group ?? null,
      allergies: profile?.allergies ?? [],
    };
    const m = activeItems.map((item) => ({
      medicine_name: item.medicine_name,
      strength: item.strength,
    }));
    return buildMedicalIdQr(p, m, primaryContact, shareUrl ?? undefined);
  }, [profile, activeItems, primaryContact, shareUrl]);

  const handleCreateShareLink = async () => {
    try {
      const res = await createShareMutation.mutateAsync({
        kind: 'medical_id',
        ttl_hours: 24,
      });
      const fullUrl = res.url || `${baseUrl}/share/${res.token}`;
      setShareUrl(fullUrl);
      showToast('24-Hour Doctor Share Link Generated', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not generate share link',
        'error'
      );
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    showToast('Share link ready to share with your doctor', 'info');
  };

  const handleOpenLink = () => {
    if (!shareUrl) return;
    Linking.openURL(shareUrl).catch(() => {
      showToast('Could not open browser', 'error');
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Emergency Medical ID</Text>
          <Text style={styles.headerSub}>Offline QR Code for First Responders</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Done</Text>
        </Pressable>
      </View>

      {/* Offline Medical ID Summary */}
      <View style={styles.offlineBadgeCard}>
        <Text style={styles.offlineBadgeTitle}>OFFLINE SCANNABLE MEDICAL ID</Text>
        <Text style={styles.offlineBadgeText}>
          Self-contained offline QR code. Any phone camera or first responder can scan to read your blood group, allergies, active medicines, and emergency contacts without internet.
        </Text>
      </View>

      {/* QR Code Container */}
      <View style={styles.qrContainer}>
        <MobileQrGrid
          data={qrData}
          size={270}
          label="Offline Emergency Medical ID QR Code"
        />
        <Text style={styles.qrCaption}>
          Scan with phone camera or QR scanner · Or use 24h Share Link below
        </Text>
      </View>

      {/* Patient Emergency Details Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Patient Name</Text>
          <Text style={styles.infoValue}>{profile?.full_name || '—'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Blood Group</Text>
          <View style={styles.bloodBadge}>
            <Text style={styles.bloodBadgeText}>{profile?.blood_group || '—'}</Text>
          </View>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>Known Drug Allergies</Text>
          <Text style={styles.allergyText}>
            {(profile?.allergies ?? []).length > 0
              ? (profile?.allergies ?? []).join(', ')
              : 'No known drug allergies recorded'}
          </Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>Active Medicines</Text>
          {activeItems.length === 0 ? (
            <Text style={styles.infoValueSub}>No active medicines</Text>
          ) : (
            activeItems.map((item) => (
              <Text key={item.id} style={styles.medItemText}>
                • {item.medicine_name} {item.strength || ''} ({item.dose || '1 dose'})
              </Text>
            ))
          )}
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>Primary Emergency Contact</Text>
          {primaryContact ? (
            <Text style={styles.contactText}>
              {primaryContact.name}: {primaryContact.phone}
            </Text>
          ) : (
            <Text style={styles.infoValueSub}>
              None recorded. Add in Profile tab.
            </Text>
          )}
        </View>
      </View>

      {/* Full-Record Share Link Section */}
      <View style={styles.actionCard}>
        <Text style={styles.actionCardTitle}>Create Full-Record Doctor Link</Text>
        <Text style={styles.actionCardSub}>
          Generates a 24-hour expiring link to your full medical summary for doctors
          and hospitals.
        </Text>

        {shareUrl ? (
          <View style={styles.shareBox}>
            <Text style={styles.shareLinkTitle}>Active 24h Expiring Link:</Text>
            <Text style={styles.shareLinkUrl} numberOfLines={2}>
              {shareUrl}
            </Text>
            <View style={styles.shareActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy share link"
                onPress={handleCopyLink}
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>Copy Link</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open share page in browser"
                onPress={handleOpenLink}
                style={styles.openWebBtn}
              >
                <Text style={styles.openWebBtnText}>Preview Page ↗</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Generate 24-hour doctor share link"
            disabled={createShareMutation.isPending}
            onPress={handleCreateShareLink}
            style={styles.generateBtn}
          >
            <Text style={styles.generateBtnText}>
              {createShareMutation.isPending
                ? 'Generating Link…'
                : 'Create Full-Record Link (24h)'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Save for Lock Screen Guidance */}
      <View style={styles.lockScreenCard}>
        <Text style={styles.lockScreenTitle}>Lock Screen Wallpaper</Text>
        <Text style={styles.lockScreenText}>
          Take a screenshot of this QR screen and set it as your lock screen
          wallpaper. In an emergency, first responders can scan your phone without
          unlocking it.
        </Text>
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 13, color: '#64748B' },
  backBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  offlineBadgeCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  offlineBadgeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 1,
  },
  offlineBadgeText: { fontSize: 12, color: '#047857', lineHeight: 17 },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  qrCaption: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoCol: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  infoValueSub: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },
  bloodBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bloodBadgeText: { color: '#B91C1C', fontSize: 15, fontWeight: '800' },
  allergyText: { fontSize: 14, fontWeight: '600', color: '#B91C1C' },
  medItemText: { fontSize: 13, color: '#1E293B' },
  contactText: { fontSize: 14, fontWeight: '700', color: '#0F766E' },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionCardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  actionCardSub: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  generateBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  generateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  shareBox: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  shareLinkTitle: { fontSize: 11, fontWeight: '700', color: '#115E59' },
  shareLinkUrl: { fontSize: 12, color: '#0F766E', fontWeight: '600' },
  shareActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  copyBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  openWebBtn: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openWebBtnText: { color: '#0F766E', fontSize: 12, fontWeight: '700' },
  lockScreenCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  lockScreenTitle: { fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  lockScreenText: { fontSize: 12, color: '#1D4ED8', lineHeight: 16 },
});
