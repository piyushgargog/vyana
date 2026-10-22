import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useCareInvite } from '@vyana/shared';
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

export default function CaregiverInviteScreen() {
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
    <Screen title="Invite caregiver" eyebrow="Share a secure 6-digit code">
      <Card>
        <CardHeader title="Temporary caregiver code" />
        <Text variant="footnote" tone="tertiary">
          When your caregiver enters this code on their Vyana app, they will be
          securely linked to your health circle for medication monitoring and
          emergency escalation.
        </Text>

        {inviteCode ? (
          <View style={styles.codeBox}>
            <Text variant="caption" tone="tertiary" style={styles.center}>
              6-digit invite code
            </Text>
            <Text
              accessibilityLabel={`Invite code ${inviteCode}`}
              style={[styles.codeDisplay, styles.center]}
            >
              {inviteCode.split('').join(' ')}
            </Text>
            <View style={styles.centerRow}>
              <Symbol
                ios="timer"
                android="timer"
                size={14}
                color={T.color.warn}
              />
              <Pill text="Valid for 24 hours · Single-use" tone="warn" />
            </View>
            <MobileQrGrid
              data={inviteCode}
              size={180}
              label="Caregiver Invite QR Code"
            />
            <Button
              variant="secondary"
              title="Share code"
              label="Share invite code with caregiver"
              icon={
                <Symbol
                  ios="square.and.arrow.up"
                  android="share"
                  size={18}
                  color={T.color.accentStrong}
                />
              }
              onPress={handleShareCode}
            />
          </View>
        ) : (
          <View style={styles.generateBox}>
            <Text variant="subhead" tone="accent" style={styles.center}>
              Generate a code now to share with your family caregiver or
              guardian.
            </Text>
            <Button
              title="Generate 6-digit code"
              label="Generate 6-digit invite code"
              loading={inviteMutation.isPending}
              onPress={handleGenerateCode}
            />
          </View>
        )}
      </Card>

      <ListGroup header="What your caregiver can see">
        <ListRow
          icon={<IconTile ios="checkmark" android="check" color="accent" />}
          title="Today's scheduled medicines, dosage logs, and adherence rate"
          wrapTitle
        />
        <ListRow
          icon={<IconTile ios="checkmark" android="check" color="accent" />}
          title="Missed-dose push notifications if a dose is not logged within 60 minutes"
          wrapTitle
        />
        <ListRow
          icon={<IconTile ios="checkmark" android="check" color="accent" />}
          title="Approved disease care plans, follow-up tests, and dietary guidelines"
          wrapTitle
        />
        <ListRow
          icon={<IconTile ios="checkmark" android="check" color="accent" />}
          title="Emergency SOS trigger and offline medical summary"
          wrapTitle
        />
      </ListGroup>

      <ListGroup header="Privacy & safeguards">
        <ListRow
          icon={<IconTile ios="lock.fill" android="lock" color="gray" />}
          title="Read-only access: caregivers cannot change prescriptions or medical notes"
          wrapTitle
        />
        <ListRow
          icon={<IconTile ios="lock.fill" android="lock" color="gray" />}
          title="You can revoke access at any time from your Caregiver Circle"
          wrapTitle
        />
      </ListGroup>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.xs,
  },
  codeBox: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    padding: T.space.lg,
    gap: T.space.md,
    alignItems: 'center',
    marginTop: T.space.xs,
  },
  codeDisplay: {
    ...T.text.title1,
    fontSize: 34,
    letterSpacing: 6,
    color: T.color.accentStrong,
    fontFamily: 'monospace',
    fontWeight: '900',
    paddingVertical: T.space.xs,
  },
  generateBox: {
    backgroundColor: T.color.accentSoft,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    padding: T.space.lg,
    gap: T.space.md,
    alignItems: 'center',
    marginTop: T.space.xs,
  },
});
