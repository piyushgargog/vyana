import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CONSENT_VERSION,
  useAddContact,
  useConsent,
  useDeleteAccount,
  useDeleteContact,
  useEmergencyContacts,
  useExportMyData,
  useMyProfile,
  isShareLinkActive,
  useRevokeShareLink,
  useShareLinks,
  useUpdateProfile,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  IconTile,
  ListGroup,
  ListRow,
  Screen,
  Sheet,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

export default function MobileProfileTab() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaMobile();

  const { data: profile } = useMyProfile();
  const { data: consentRecord } = useConsent(CONSENT_VERSION);
  const updateProfileMutation = useUpdateProfile();
  const { data: contacts = [] } = useEmergencyContacts();
  const addContactMutation = useAddContact();
  const deleteContactMutation = useDeleteContact();
  const { data: allShareLinks = [] } = useShareLinks();
  const shareLinks = allShareLinks.filter((l) => isShareLinkActive(l));
  const revokeShareMutation = useRevokeShareLink();
  const exportDataMutation = useExportMyData();
  const deleteAccountMutation = useDeleteAccount();

  const [fullNameOverride, setFullName] = useState<string | null>(null);
  const [phoneOverride, setPhone] = useState<string | null>(null);
  const [bloodGroupOverride, setBloodGroup] = useState<string | null>(null);
  const [allergiesTextOverride, setAllergiesText] = useState<string | null>(null);
  const [preferredLangOverride, setPreferredLang] = useState<string | null>(null);

  const fullName = fullNameOverride ?? profile?.full_name ?? '';
  const phone = phoneOverride ?? profile?.phone ?? '';
  const bloodGroup = bloodGroupOverride ?? profile?.blood_group ?? 'B+';
  const allergiesText =
    allergiesTextOverride ?? (profile?.allergies ?? []).join(', ');
  const preferredLang =
    preferredLangOverride ?? profile?.preferred_language ?? 'en';

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newEcName, setNewEcName] = useState('');
  const [newEcPhone, setNewEcPhone] = useState('');
  const [newEcRel, setNewEcRel] = useState('Family');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const [exportedJsonPreview, setExportedJsonPreview] = useState<string | null>(
    null
  );

  const handleSaveProfile = async () => {
    const parsedAllergies = allergiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await updateProfileMutation.mutateAsync({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        blood_group: bloodGroup.trim() || null,
        allergies: parsedAllergies,
        preferred_language: preferredLang,
      });
      showToast('Profile & allergies saved', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not save profile',
        'error'
      );
    }
  };

  const handleAddContact = async () => {
    if (!newEcName.trim() || !newEcPhone.trim()) return;
    try {
      await addContactMutation.mutateAsync({
        name: newEcName.trim(),
        phone: newEcPhone.trim(),
        relation: newEcRel.trim() || 'Family',
      });
      setNewEcName('');
      setNewEcPhone('');
      setAddContactOpen(false);
      showToast('Emergency contact added', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not add contact',
        'error'
      );
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await deleteContactMutation.mutateAsync(id);
      showToast('Emergency contact removed', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not remove contact',
        'error'
      );
    }
  };

  const handleExportMyData = async () => {
    try {
      const remoteBundle = await exportDataMutation.mutateAsync();
      setExportedJsonPreview(JSON.stringify(remoteBundle, null, 2));
      showToast('DPDP health data bundle exported', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not export data',
        'error'
      );
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deletePassword) {
      showToast('Please enter your password to confirm deletion', 'warning');
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      if (userEmail) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: deletePassword,
        });
        if (reauthError) {
          showToast(`Authentication failed: ${reauthError.message}`, 'error');
          return;
        }
      }
      await deleteAccountMutation.mutateAsync();
      await supabase.auth.signOut();
      setDeleteOpen(false);
      setDeletePassword('');
      showToast('Account & personal health records deleted', 'warning');
      router.replace('/(auth)/login');
    } catch (err: unknown) {
      const errorObj = err as { status?: number; code?: string; message?: string };
      if (errorObj?.status === 403 || errorObj?.code === 'REAUTH_REQUIRED') {
        showToast('Recent login required (403). Please enter password again.', 'error');
      } else {
        showToast(
          err instanceof Error ? err.message : 'Could not delete account',
          'error'
        );
      }
    }
  };

  const handleSignOut = async () => {
    // Only this phone: the default (global) scope would also sign the account out on every other device.
    await supabase.auth.signOut({ scope: 'local' });
    showToast('Signed out', 'info');
    router.replace('/(auth)/login');
  };

  return (
    <Screen
      title="Me"
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS — Call 108 Ambulance"
          onPress={() => router.push('/sos')}
          style={styles.sosHeaderBtn}
        >
          <Text variant="footnote" tone="danger" style={styles.sosHeaderText}>
            SOS 108
          </Text>
        </Pressable>
      }
    >
      {/* Quick links */}
      <ListGroup header="Quick links">
        <ListRow
          icon={<IconTile ios="qrcode" android="qr_code" color="blue" />}
          title="Medical ID QR"
          subtitle="Offline emergency card"
          onPress={() => router.push('/medical-id')}
        />
        <ListRow
          icon={<IconTile ios="person.2.fill" android="group" color="green" />}
          title="Caregiver circle"
          subtitle="People who can help with your care"
          onPress={() => router.push('/caregiver')}
        />
        <ListRow
          icon={<IconTile ios="stethoscope" android="stethoscope" color="orange" />}
          title="Symptom triage"
          subtitle="Check symptoms before you visit a doctor"
          onPress={() => router.push('/triage')}
        />
      </ListGroup>

      {/* Health profile */}
      <Card>
        <CardHeader title="Health profile" />
        <View style={styles.field}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            Full name
          </Text>
          <TextInput
            accessibilityLabel="Full name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
          />
        </View>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 2 }]}>
            <Text variant="footnote" tone="secondary" style={styles.label}>
              Phone
            </Text>
            <TextInput
              accessibilityLabel="Phone number"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              keyboardType="phone-pad"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text variant="footnote" tone="secondary" style={styles.label}>
              Blood group
            </Text>
            <TextInput
              accessibilityLabel="Blood group"
              value={bloodGroup}
              onChangeText={setBloodGroup}
              style={styles.input}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            Allergies (comma-separated)
          </Text>
          <TextInput
            accessibilityLabel="Allergies"
            value={allergiesText}
            onChangeText={setAllergiesText}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            Preferred language
          </Text>
          <View style={styles.chipsRow}>
            {(['en', 'hi', 'hinglish'] as const).map((l) => {
              const active = preferredLang === l;
              return (
                <Pressable
                  key={l}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Set preferred language to ${l}`}
                  onPress={() => setPreferredLang(l)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text variant="footnote" tone={active ? 'white' : 'secondary'} style={styles.chipText}>
                    {l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : 'Hinglish'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Button
          title={updateProfileMutation.isPending ? 'Saving…' : 'Save profile changes'}
          onPress={handleSaveProfile}
          loading={updateProfileMutation.isPending}
          label="Save profile changes"
        />
      </Card>

      {/* Emergency contacts */}
      <ListGroup header="Emergency contacts" footer="These people are alerted on SOS 108.">
        {contacts.map((c, idx) => (
          <ListRow
            key={c.id}
            icon={
              <IconTile
                ios={idx === 0 ? 'star.fill' : 'person.fill'}
                android={idx === 0 ? 'star' : 'person'}
                color={idx === 0 ? 'orange' : 'gray'}
              />
            }
            title={c.name}
            subtitle={`${c.phone} · ${c.relation || 'Family'}${idx === 0 ? ' · Primary' : ''}`}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove emergency contact ${c.name}`}
                disabled={deleteContactMutation.isPending}
                onPress={() => handleDeleteContact(c.id)}
                style={styles.removeBtn}
              >
                <Text variant="footnote" tone="danger" style={styles.removeText}>
                  Remove
                </Text>
              </Pressable>
            }
          />
        ))}
        <ListRow
          icon={<IconTile ios="plus" android="add" color="accent" />}
          title="Add emergency contact"
          onPress={() => setAddContactOpen(true)}
        />
      </ListGroup>

      {/* Share links */}
      {shareLinks.length > 0 && (
        <ListGroup header="Active share links">
          {shareLinks.map((link) => (
            <ListRow
              key={link.token}
              icon={<IconTile ios="link" android="link" color="indigo" />}
              title={`${link.kind} · ${link.token.slice(0, 8)}…`}
              subtitle={`Expires ${new Date(link.expires_at).toLocaleString()}`}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Revoke share link"
                  disabled={revokeShareMutation.isPending}
                  onPress={() =>
                    revokeShareMutation.mutate(link.token, {
                      onSuccess: () => showToast('Link turned off. It no longer opens.', 'success'),
                      onError: (err) => showToast(err.message || 'Could not turn the link off', 'error'),
                    })
                  }
                  style={styles.removeBtn}
                >
                  <Text variant="footnote" tone="danger" style={styles.removeText}>
                    Revoke
                  </Text>
                </Pressable>
              }
            />
          ))}
        </ListGroup>
      )}

      {/* Privacy */}
      <ListGroup
        header="Privacy"
        footer={`DPDP Act 2023 · Consent ${consentRecord?.version ?? CONSENT_VERSION}`}
      >
        <ListRow
          icon={<IconTile ios="square.and.arrow.down" android="download" color="blue" />}
          title="Download my data"
          subtitle="Your health data as a portable JSON bundle"
          onPress={handleExportMyData}
        />
        <ListRow
          icon={<IconTile ios="doc.text.fill" android="description" color="gray" />}
          title="Review consent"
          onPress={() => router.push('/consent')}
        />
        <ListRow
          icon={<IconTile ios="envelope.fill" android="mail" color="gray" />}
          title="Help and contact"
          subtitle="piyushgarg@vyanahealth.app"
          onPress={() => Linking.openURL('mailto:piyushgarg@vyanahealth.app')}
        />
        <ListRow
          icon={<IconTile ios="lock.fill" android="lock" color="gray" />}
          title="Privacy policy"
          subtitle="vyanahealth.app/privacy"
          onPress={() => Linking.openURL('https://vyanahealth.app/privacy')}
        />
      </ListGroup>

      {exportedJsonPreview && (
        <Card>
          <CardHeader title="Exported data bundle" trailing={`${exportedJsonPreview.length} bytes`} />
          <View style={styles.jsonBox}>
            <Text variant="caption" tone="white" numberOfLines={8} style={styles.jsonText}>
              {exportedJsonPreview}
            </Text>
          </View>
        </Card>
      )}

      <Button
        title="Delete my account and data"
        variant="destructive"
        onPress={() => setDeleteOpen(true)}
        label="Delete my account and health data"
        icon={<Symbol ios="trash.fill" android="delete" size={16} color={T.color.dangerText} />}
      />
      <Button
        title="Sign out"
        variant="secondary"
        onPress={handleSignOut}
        label="Sign out"
      />

      {/* Add contact sheet */}
      <Sheet visible={addContactOpen} onClose={() => setAddContactOpen(false)} title="Add emergency contact">
        <View style={styles.field}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            Name
          </Text>
          <TextInput
            accessibilityLabel="New contact name"
            value={newEcName}
            onChangeText={setNewEcName}
            placeholder="Contact name"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            Phone
          </Text>
          <TextInput
            accessibilityLabel="New contact phone"
            value={newEcPhone}
            onChangeText={setNewEcPhone}
            placeholder="+91 98111 00000"
            placeholderTextColor={T.color.label3}
            style={styles.input}
            keyboardType="phone-pad"
          />
        </View>
        <View style={styles.field}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            Relationship
          </Text>
          <TextInput
            accessibilityLabel="New contact relationship"
            value={newEcRel}
            onChangeText={setNewEcRel}
            placeholder="Family"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>
        <Button
          title="Add contact"
          onPress={handleAddContact}
          loading={addContactMutation.isPending}
          label="Add emergency contact"
        />
      </Sheet>

      {/* Delete confirmation sheet */}
      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?">
        <Text variant="body" tone="danger">
          This permanently deletes your profile, prescriptions, lab reports, vitals and
          stored files. This cannot be undone.
        </Text>
        <View style={styles.field}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            Enter your password to confirm
          </Text>
          <TextInput
            accessibilityLabel="Confirm password to delete account"
            secureTextEntry
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="Your current password"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>
        <Button
          title={deleteAccountMutation.isPending ? 'Deleting…' : 'Delete permanently'}
          variant="destructive"
          onPress={handleConfirmDeleteAccount}
          loading={deleteAccountMutation.isPending}
          label="Confirm permanent account deletion"
        />
        <Button
          title="Keep my account"
          variant="secondary"
          onPress={() => {
            setDeleteOpen(false);
            setDeletePassword('');
          }}
          label="Cancel account deletion"
        />
      </Sheet>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sosHeaderBtn: {
    backgroundColor: T.color.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: T.radius.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  sosHeaderText: { fontWeight: '700' },
  field: { gap: T.space.xs },
  label: { fontWeight: '600' },
  input: {
    ...T.text.body,
    color: T.color.label,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 44,
  },
  row: { flexDirection: 'row', gap: T.space.md },
  chipsRow: { flexDirection: 'row', gap: T.space.sm },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.fill,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingVertical: T.space.sm,
    minHeight: 44,
  },
  chipActive: { backgroundColor: T.color.accent },
  chipText: { fontWeight: '600' },
  removeBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: T.space.sm,
  },
  removeText: { fontWeight: '700' },
  jsonBox: {
    backgroundColor: T.color.label,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
  },
  jsonText: { fontFamily: 'monospace' },
});
