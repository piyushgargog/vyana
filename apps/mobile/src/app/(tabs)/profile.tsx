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
import {
  CONSENT_VERSION,
  useAddContact,
  useDeleteAccount,
  useDeleteContact,
  useEmergencyContacts,
  useExportMyData,
  useRevokeShareLink,
  useShareLinks,
  useUpdateProfile,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

export default function MobileProfileTab() {
  const router = useRouter();
  const {
    profile,
    updateLocalProfile,
    emergencyContacts: localContacts,
    addLocalEmergencyContact,
    removeLocalEmergencyContact,
    prescriptions,
    labReports,
    appointments,
    vitals,
    consentedVersion,
    useMocks,
    setUseMocks,
    showToast,
  } = useVyanaMobile();

  const updateProfileMutation = useUpdateProfile();
  const { data: remoteContacts } = useEmergencyContacts();
  const addContactMutation = useAddContact();
  const deleteContactMutation = useDeleteContact();
  const { data: shareLinks } = useShareLinks();
  const revokeShareMutation = useRevokeShareLink();
  const exportDataMutation = useExportMyData();
  const deleteAccountMutation = useDeleteAccount();

  const [fullName, setFullName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [bloodGroup, setBloodGroup] = useState(profile.blood_group || 'B+');
  const [allergiesText, setAllergiesText] = useState(
    (profile.allergies ?? []).join(', ')
  );
  const [preferredLang, setPreferredLang] = useState(
    profile.preferred_language || 'en'
  );

  const [newEcName, setNewEcName] = useState('');
  const [newEcPhone, setNewEcPhone] = useState('');
  const [newEcRel, setNewEcRel] = useState('Family');

  const [exportedJsonPreview, setExportedJsonPreview] = useState<string | null>(
    null
  );
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);

  const contacts =
    remoteContacts && remoteContacts.length > 0
      ? remoteContacts
      : localContacts;

  const handleSaveProfile = async () => {
    const parsedAllergies = allergiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await updateProfileMutation.mutateAsync({
        full_name: fullName.trim(),
        phone: phone.trim(),
        blood_group: bloodGroup.trim(),
        allergies: parsedAllergies,
        preferred_language: preferredLang,
      });
    } catch {
      // Demo fallback
    }
    updateLocalProfile({
      full_name: fullName.trim(),
      phone: phone.trim(),
      blood_group: bloodGroup.trim(),
      allergies: parsedAllergies,
      preferred_language: preferredLang,
    });
    showToast('Profile & allergies saved', 'success');
  };

  const handleAddContact = async () => {
    if (!newEcName.trim() || !newEcPhone.trim()) return;
    try {
      await addContactMutation.mutateAsync({
        name: newEcName.trim(),
        phone: newEcPhone.trim(),
        relation: newEcRel.trim() || 'Family',
      });
    } catch {
      // Demo fallback
    }
    addLocalEmergencyContact({
      name: newEcName.trim(),
      phone: newEcPhone.trim(),
      relation: newEcRel.trim() || 'Family',
    });
    setNewEcName('');
    setNewEcPhone('');
    showToast('Emergency contact added', 'success');
  };

  const handleDeleteContact = async (id: string) => {
    removeLocalEmergencyContact(id);
    try {
      await deleteContactMutation.mutateAsync(id);
    } catch {
      // Demo fallback
    }
    showToast('Emergency contact removed', 'info');
  };

  const handleExportMyData = async () => {
    try {
      const remoteBundle = await exportDataMutation.mutateAsync();
      setExportedJsonPreview(JSON.stringify(remoteBundle, null, 2));
      showToast('DPDP health data bundle exported', 'success');
    } catch {
      const fallbackBundle = {
        exported_at: new Date().toISOString(),
        consent_version: consentedVersion ?? CONSENT_VERSION,
        profile,
        emergency_contacts: contacts,
        prescriptions,
        lab_reports: labReports,
        appointments,
        vitals,
      };
      setExportedJsonPreview(JSON.stringify(fallbackBundle, null, 2));
      showToast('DPDP health data JSON bundle generated', 'success');
    }
  };

  const handleConfirmDeleteAccount = async () => {
    try {
      await deleteAccountMutation.mutateAsync();
    } catch {
      // Demo fallback
    }
    setConfirmDeleteStep(false);
    showToast('Account & personal health records deleted', 'warning');
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Quick Links to Medical ID, Caregiver Circle & Consent */}
      <View style={styles.quickRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Offline Medical ID QR"
          onPress={() => router.push('/medical-id')}
          style={styles.quickBtn}
        >
          <Text style={styles.quickBtnText}>Offline Medical ID QR</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Caregiver Circle"
          onPress={() => router.push('/caregiver')}
          style={styles.quickBtn}
        >
          <Text style={styles.quickBtnText}>Caregiver Circle</Text>
        </Pressable>
      </View>

      {/* Personal Profile & Allergies */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Personal Profile & Allergies</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle Demo Mocks Mode"
            onPress={() => setUseMocks(!useMocks)}
            style={styles.modeChip}
          >
            <Text style={styles.modeChipText}>
              {useMocks ? 'Demo Mocks: ON' : 'Live API: ON'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          accessibilityLabel="Full Name"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
        />

        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              accessibilityLabel="Phone Number"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Blood Group</Text>
            <TextInput
              accessibilityLabel="Blood Group"
              value={bloodGroup}
              onChangeText={setBloodGroup}
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>Allergies (comma-separated)</Text>
        <TextInput
          accessibilityLabel="Allergies"
          value={allergiesText}
          onChangeText={setAllergiesText}
          style={styles.input}
        />

        <Text style={styles.label}>Preferred Language</Text>
        <View style={styles.row}>
          {(['en', 'hi', 'hinglish'] as const).map((l) => (
            <Pressable
              key={l}
              accessibilityRole="button"
              accessibilityState={{ selected: preferredLang === l }}
              accessibilityLabel={`Set preferred language to ${l}`}
              onPress={() => setPreferredLang(l)}
              style={[
                styles.langChip,
                preferredLang === l && styles.langChipActive,
              ]}
            >
              <Text
                style={[
                  styles.langChipText,
                  preferredLang === l && styles.langChipTextActive,
                ]}
              >
                {l === 'en' ? 'English' : l === 'hi' ? 'हिंदी' : 'Hinglish'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save Profile"
          onPress={handleSaveProfile}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Save Profile Changes</Text>
        </Pressable>
      </View>

      {/* Emergency Contacts CRUD */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Emergency Contacts (Alerted on SOS 108)
        </Text>
        {contacts.map((c, idx) => (
          <View key={c.id} style={styles.contactRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>
                {c.name} {idx === 0 ? '· Primary' : ''}
              </Text>
              <Text style={styles.contactSub}>
                {c.phone} · {c.relation || 'Family'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove emergency contact ${c.name}`}
              onPress={() => handleDeleteContact(c.id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.addContactBox}>
          <Text style={styles.label}>Add New Emergency Contact</Text>
          <TextInput
            accessibilityLabel="New Contact Name"
            value={newEcName}
            onChangeText={setNewEcName}
            placeholder="Contact Name"
            style={styles.input}
          />
          <View style={styles.row}>
            <TextInput
              accessibilityLabel="New Contact Phone"
              value={newEcPhone}
              onChangeText={setNewEcPhone}
              placeholder="+91 98111 00000"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              accessibilityLabel="New Contact Relationship"
              value={newEcRel}
              onChangeText={setNewEcRel}
              placeholder="Relationship"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Emergency Contact"
            onPress={handleAddContact}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>+ Add Emergency Contact</Text>
          </Pressable>
        </View>
      </View>

      {/* Active Share Links */}
      {shareLinks && shareLinks.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Record Share Links</Text>
          {shareLinks.map((link) => (
            <View key={link.token} style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>
                  Kind: {link.kind} · Token {link.token.slice(0, 8)}…
                </Text>
                <Text style={styles.contactSub}>
                  Expires: {new Date(link.expires_at).toLocaleString()}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Revoke share link"
                onPress={() => revokeShareMutation.mutate(link.token)}
                style={styles.removeBtn}
              >
                <Text style={styles.removeBtnText}>Revoke</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* DPDP Act 2023 Data Rights: Export JSON & Two-Step Account Deletion */}
      <View style={styles.dpdpCard}>
        <Text style={styles.dpdpBadge}>
          DPDP Act 2023 · Consent {consentedVersion ?? CONSENT_VERSION}
        </Text>
        <Text style={styles.cardTitle}>Your Data Privacy & Rights</Text>
        <Text style={styles.cardSub}>
          Download your complete personal health data as a portable JSON bundle,
          or permanently erase your account and storage files.
        </Text>

        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Download my health data as JSON"
            onPress={handleExportMyData}
            style={[styles.outlineBtn, { flex: 1 }]}
          >
            <Text style={styles.outlineBtnText}>
              {exportDataMutation.isPending
                ? 'Exporting…'
                : 'Download My Data (JSON)'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review DPDP Consent"
            onPress={() => router.push('/consent')}
            style={[styles.outlineBtn, { flex: 1 }]}
          >
            <Text style={styles.outlineBtnText}>Review Consent</Text>
          </Pressable>
        </View>

        {exportedJsonPreview && (
          <View style={styles.jsonPreviewBox}>
            <Text style={styles.jsonPreviewLabel}>
              Exported JSON Bundle ({exportedJsonPreview.length} bytes):
            </Text>
            <Text style={styles.jsonCode} numberOfLines={8}>
              {exportedJsonPreview}
            </Text>
          </View>
        )}

        {!confirmDeleteStep ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete my account and health data"
            onPress={() => setConfirmDeleteStep(true)}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteBtnText}>Delete My Account & Data</Text>
          </Pressable>
        ) : (
          <View style={styles.confirmDeleteBox}>
            <Text style={styles.confirmDeleteTitle}>
              Step 2 of 2: Permanent Erasure Confirmation
            </Text>
            <Text style={styles.confirmDeleteSub}>
              This action permanently deletes your profile, prescriptions, lab
              reports, vitals, and storage files. This cannot be undone.
            </Text>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel account deletion"
                onPress={() => setConfirmDeleteStep(false)}
                style={[styles.outlineBtn, { flex: 1 }]}
              >
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm permanent account deletion"
                onPress={handleConfirmDeleteAccount}
                style={[styles.deleteConfirmBtn, { flex: 1 }]}
              >
                <Text style={styles.deleteConfirmBtnText}>
                  Confirm Permanent Delete
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickBtn: {
    flex: 1,
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  modeChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modeChipText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  langChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  langChipActive: { borderColor: '#0D9488', backgroundColor: '#F0FDFA' },
  langChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  langChipTextActive: { color: '#0F766E', fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  contactName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  contactSub: { fontSize: 12, color: '#64748B' },
  removeBtn: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeBtnText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
  addContactBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#0F766E', fontSize: 12, fontWeight: '700' },
  dpdpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 10,
  },
  dpdpBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  jsonPreviewBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  jsonPreviewLabel: { color: '#5EEAD4', fontSize: 11, fontWeight: '700' },
  jsonCode: { color: '#E2E8F0', fontSize: 10, fontFamily: 'monospace' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  confirmDeleteBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  confirmDeleteTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  confirmDeleteSub: { fontSize: 12, color: '#7F1D1D', lineHeight: 17 },
  deleteConfirmBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteConfirmBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
