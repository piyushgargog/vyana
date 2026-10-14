import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAcceptCareInvite } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  Screen,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

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

  const codeReady = code.trim().length === 6;

  return (
    <Screen title="Enter caregiver code" eyebrow="Link a patient to monitor">
      <Card>
        <CardHeader title="Link patient to monitor" />
        <Text variant="footnote" tone="tertiary">
          Enter the 6-digit invite code generated on the patient&apos;s phone.
          Invite codes expire after 24 hours.
        </Text>

        <Text variant="footnote" style={styles.label}>
          6-digit invite code *
        </Text>
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
          placeholderTextColor={T.color.label3}
          style={styles.codeInput}
        />

        <Text variant="footnote" style={styles.label}>
          Your relationship to patient (optional)
        </Text>
        <TextInput
          accessibilityLabel="Relationship to patient"
          value={relation}
          onChangeText={setRelation}
          placeholder="e.g. Son, Daughter, Spouse, Guardian"
          placeholderTextColor={T.color.label3}
          style={styles.input}
        />

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text variant="footnote" tone="danger" style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <Button
          title="Link patient"
          label="Link Patient"
          loading={acceptMutation.isPending}
          disabled={!codeReady}
          onPress={handleLinkPatient}
        />
      </Card>

      <Card style={styles.infoCard}>
        <CardHeader title="What happens after linking?" />
        <Text variant="footnote" tone="secondary">
          You will have read-only access to view the patient&apos;s daily
          medicine schedule, dose adherence records, and approved care plans.
          You will also receive immediate push notifications if they miss a
          scheduled medicine dose by more than 60 minutes.
        </Text>
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', marginTop: T.space.xs, textTransform: 'capitalize' },
  codeInput: {
    backgroundColor: T.color.fill,
    borderWidth: 2,
    borderColor: T.color.accent,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.lg,
    paddingVertical: T.space.md,
    minHeight: 64,
    fontSize: 24,
    fontWeight: '800',
    color: T.color.accentStrong,
    letterSpacing: 4,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: T.color.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.md,
    minHeight: 48,
    fontSize: 15,
    color: T.color.label,
  },
  errorBox: {
    backgroundColor: T.color.dangerSoft,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
  },
  errorText: { fontWeight: '700' },
  infoCard: { backgroundColor: T.color.accentSoft },
});
