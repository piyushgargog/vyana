import React, { useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Linking, StyleSheet, View } from 'react-native';
import {
  buildMedicalIdQr,
  useActiveItems,
  useCreateShareLink,
  isShareUrlDead,
  useEmergencyContacts,
  useMyProfile,
  useShareLinks,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  IconTile,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter, MobileQrGrid } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

export default function MedicalIdScreen() {
  const { baseUrl, showToast } = useVyanaMobile();

  const { data: profile } = useMyProfile();
  const { data: activeItems = [] } = useActiveItems();
  const { data: contacts = [] } = useEmergencyContacts();
  const createShareMutation = useCreateShareLink();

  const [createdUrl, setShareUrl] = useState<string | null>(null);
  const { data: shareLinks = [] } = useShareLinks();
  // A link turned off (or expired) in Profile must not keep showing here as active.
  const shareUrl = createdUrl && !isShareUrlDead(shareLinks, createdUrl) ? createdUrl : null;

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
    return buildMedicalIdQr(p, m, primaryContact);
  }, [profile, activeItems, primaryContact]);

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

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
      showToast('Link copied for your doctor', 'success');
    } catch {
      showToast('Could not copy the link', 'error');
    }
  };

  const handleOpenLink = () => {
    if (!shareUrl) return;
    Linking.openURL(shareUrl).catch(() => {
      showToast('Could not open browser', 'error');
    });
  };

  const allergies = profile?.allergies ?? [];

  return (
    <Screen title="Medical ID" eyebrow="Emergency · Works offline">
      <Card style={styles.tintOk}>
        <CardHeader title="Offline scannable" />
        <Text variant="footnote" tone="secondary">
          Self-contained offline QR code. Any phone camera or first responder can
          scan it to read your name, blood group, allergies, medicines and one
          emergency contact as plain text, without internet. A long medicine list
          is cut, and the text then says how many more there are.
        </Text>
      </Card>

      <Card style={styles.qrCard}>
        <MobileQrGrid
          data={qrData}
          size={270}
          label="Offline Emergency Medical ID QR Code"
        />
        <Text variant="footnote" tone="tertiary" style={styles.center}>
          Any phone camera shows the details as plain text, no internet needed. The 24h link below needs internet.
        </Text>
      </Card>

      <ListGroup header="Emergency details">
        <ListRow
          icon={<IconTile ios="person.fill" android="person" color="blue" />}
          title="Name"
          value={profile?.full_name || '—'}
        />
        <ListRow
          icon={<IconTile ios="drop.fill" android="water_drop" color="red" />}
          title="Blood group"
          trailing={
            <Pill text={profile?.blood_group || '—'} tone="danger" />
          }
        />
        <ListRow
          icon={
            <IconTile
              ios="exclamationmark.triangle.fill"
              android="warning"
              color="orange"
            />
          }
          title="Known allergies"
          subtitle={
            allergies.length > 0
              ? allergies.join(', ')
              : 'No known drug allergies recorded'
          }
        />
      </ListGroup>

      <ListGroup header={`Active medicines (${activeItems.length})`}>
        {activeItems.length === 0 ? (
          <ListRow
            icon={<IconTile ios="pills.fill" android="medication" color="accent" />}
            title="No active medicines"
          />
        ) : (
          activeItems.map((item) => (
            <ListRow
              key={item.id}
              icon={<IconTile ios="pills.fill" android="medication" color="accent" />}
              title={`${item.medicine_name} ${item.strength || ''}`.trim()}
              subtitle={item.frequency || undefined}
              value={item.dose || '1 dose'}
            />
          ))
        )}
      </ListGroup>

      <ListGroup header="Emergency contact">
        <ListRow
          icon={<IconTile ios="phone.fill" android="call" color="green" />}
          title={primaryContact ? primaryContact.name : 'No contact recorded'}
          subtitle={
            primaryContact
              ? primaryContact.phone
              : 'Add one in the Profile tab.'
          }
        />
      </ListGroup>

      <Card>
        <CardHeader title="Doctor share link" trailing="24h" />
        <Text variant="footnote" tone="tertiary">
          Generates a 24-hour expiring link to your full medical summary for
          doctors and hospitals.
        </Text>
        {shareUrl ? (
          <View style={styles.shareBox}>
            <Text variant="caption" tone="accent" style={styles.shareLinkTitle}>
              Active 24h expiring link
            </Text>
            <Text
              variant="footnote"
              tone="accent"
              numberOfLines={2}
              style={styles.shareLinkUrl}
            >
              {shareUrl}
            </Text>
            <View style={styles.shareActions}>
              <Button
                variant="secondary"
                size="sm"
                title="Copy link"
                label="Copy share link"
                onPress={handleCopyLink}
              />
              <Button
                variant="plain"
                size="sm"
                title="Preview page"
                label="Open share page in browser"
                icon={
                  <Symbol
                    ios="arrow.up.right"
                    android="open_in_new"
                    size={16}
                    color={T.color.accentStrong}
                  />
                }
                onPress={handleOpenLink}
              />
            </View>
          </View>
        ) : (
          <Button
            title="Create link (24h)"
            label="Generate 24-hour doctor share link"
            loading={createShareMutation.isPending}
            onPress={handleCreateShareLink}
          />
        )}
      </Card>

      <Card style={styles.tintAccent}>
        <CardHeader title="Lock screen wallpaper" />
        <Text variant="footnote" tone="secondary">
          Take a screenshot of this QR screen and set it as your lock screen
          wallpaper. In an emergency, first responders can scan your phone
          without unlocking it.
        </Text>
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tintOk: { backgroundColor: T.color.okSoft },
  tintAccent: { backgroundColor: T.color.accentSoft },
  qrCard: { alignItems: 'center' },
  center: { textAlign: 'center' },
  shareBox: {
    backgroundColor: T.color.accentSoft,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.sm,
  },
  shareLinkTitle: { fontWeight: '700', textTransform: 'uppercase' },
  shareLinkUrl: { fontWeight: '600' },
  shareActions: { flexDirection: 'row', gap: T.space.sm, marginTop: T.space.xs },
});
