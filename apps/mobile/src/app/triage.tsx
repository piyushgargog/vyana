import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useMyProfile,
  useTriage,
  type Language,
  type TriageRes,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';
import { T } from '@/constants/theme';

const SEX_OPTIONS = ['female', 'male', 'other'] as const;

export default function TriageScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();
  const { data: profile } = useMyProfile();
  const triageMutation = useTriage();

  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | undefined>(
    undefined
  );
  const [triageResult, setTriageResult] = useState<TriageRes | null>(null);

  const handleAssessSymptoms = async () => {
    const trimmed = symptoms.trim();
    if (trimmed.length < 3) {
      showToast('Please describe your symptoms in at least 3 characters', 'error');
      return;
    }

    try {
      let parsedAge: number | undefined = age ? parseInt(age, 10) : undefined;
      if ((parsedAge === undefined || isNaN(parsedAge)) && profile?.dob) {
        const birth = new Date(profile.dob).getTime();
        if (!isNaN(birth)) {
          const years = Math.floor(
            (Date.now() - birth) / (365.25 * 24 * 3600 * 1000)
          );
          if (years > 0 && years < 120) {
            parsedAge = years;
          }
        }
      }
      const validLang: Language | undefined =
        profile?.preferred_language === 'hi' ||
        profile?.preferred_language === 'hinglish' ||
        profile?.preferred_language === 'en'
          ? profile.preferred_language
          : undefined;

      const res = await triageMutation.mutateAsync({
        symptoms: trimmed,
        duration: duration.trim() || undefined,
        age: parsedAge && !isNaN(parsedAge) ? parsedAge : undefined,
        sex,
        language: validLang,
      });
      setTriageResult(res);

      if (res.urgency === 'emergency') {
        showToast('Emergency signs detected. Please seek immediate help.', 'error');
      } else {
        showToast('Triage assessment completed', 'info');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not assess symptoms',
        'error'
      );
    }
  };

  const handleReset = () => {
    setTriageResult(null);
    setSymptoms('');
    setDuration('');
  };

  const handleGoToSos = () => {
    router.push('/sos');
  };

  const handleGoToBooking = (dept?: string) => {
    if (dept) {
      router.push(`/appointments/book?department=${encodeURIComponent(dept)}`);
    } else {
      router.push('/appointments/book');
    }
  };

  const canSubmit = symptoms.trim().length >= 3 && !triageMutation.isPending;

  return (
    <Screen
      eyebrow="Check urgency"
      title="Symptom Triage"
      trailing={
        <Button
          title="Back"
          variant="plain"
          size="sm"
          label="Back"
          onPress={() => router.back()}
        />
      }
    >
      {/* Safety Notice */}
      <Card style={styles.noticeCard}>
        <Text variant="headline" tone="accent">
          Safety first
        </Text>
        <Text variant="footnote" tone="accent">
          Vyana triage evaluates clinical urgency and directs you to the
          appropriate medical department. It never invents diagnoses or
          provides prescription treatments.
        </Text>
      </Card>

      {!triageResult ? (
        /* Symptom Intake Form */
        <Card>
          <Text variant="headline">Describe Your Symptoms</Text>
          <Text variant="footnote" tone="tertiary">
            Provide details about what you are experiencing, how long it has
            lasted, and any associated discomfort.
          </Text>

          <Text variant="footnote" tone="secondary" style={styles.label}>
            What symptoms are you experiencing? *
          </Text>
          <TextInput
            accessibilityLabel="Symptoms description"
            multiline
            numberOfLines={4}
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="e.g. Sudden severe chest tightness with shortness of breath, or mild dry cough for 3 days…"
            placeholderTextColor={T.color.label3}
            style={[styles.input, styles.textArea]}
          />

          <Text variant="footnote" tone="secondary" style={styles.label}>
            Duration (Optional)
          </Text>
          <TextInput
            accessibilityLabel="Duration of symptoms"
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g. 2 hours, 3 days, 1 week"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={styles.ageCol}>
              <Text variant="footnote" tone="secondary" style={styles.label}>
                Age (Optional)
              </Text>
              <TextInput
                accessibilityLabel="Age"
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
                placeholder={profile?.dob ? 'Auto from profile or type' : 'Years'}
                placeholderTextColor={T.color.label3}
                style={styles.input}
              />
            </View>

            <View style={styles.sexCol}>
              <Text variant="footnote" tone="secondary" style={styles.label}>
                Biological Sex (Optional)
              </Text>
              <View style={styles.sexSelector}>
                {SEX_OPTIONS.map((s) => {
                  const selected = sex === s;
                  return (
                    <Pressable
                      key={s}
                      accessibilityRole="button"
                      accessibilityLabel={`Select biological sex ${s}`}
                      accessibilityState={{ selected }}
                      onPress={() => setSex(s === sex ? undefined : s)}
                      style={[
                        styles.sexBtn,
                        selected && styles.sexBtnActive,
                      ]}
                    >
                      <Text
                        variant="footnote"
                        tone={selected ? 'accent' : 'tertiary'}
                        style={selected && styles.bold}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <Button
            title={
              triageMutation.isPending
                ? 'Evaluating with Clinical Rules…'
                : 'Assess Urgency & Department'
            }
            label="Assess Symptoms"
            loading={triageMutation.isPending}
            disabled={!canSubmit}
            onPress={handleAssessSymptoms}
          />
        </Card>
      ) : (
        /* Assessment Results */
        <View style={styles.stack}>
          <MobileAiSafetyBanner feature="triage" />

          {/* Urgency Level Banner */}
          {triageResult.urgency === 'emergency' ? (
            <Card style={styles.emergencyCard}>
              <Pill text="EMERGENCY" tone="danger" />
              <Text variant="title3" tone="danger">
                Immediate Medical Attention Required
              </Text>
              <Text variant="body" tone="danger">
                {triageResult.advice}
              </Text>
              <Button
                title="Open Emergency SOS / Call 108 Now"
                variant="destructive"
                label="Call 108 or Open Emergency SOS"
                icon={
                  <Symbol
                    ios="exclamationmark.triangle.fill"
                    android="warning"
                    size={18}
                    color={T.color.dangerText}
                  />
                }
                onPress={handleGoToSos}
              />
            </Card>
          ) : (
            <Card>
              <Pill
                text={
                  triageResult.urgency === 'soon'
                    ? 'ATTENTION NEEDED SOON'
                    : 'ROUTINE OPD CONSULTATION'
                }
                tone={triageResult.urgency === 'soon' ? 'warn' : 'ok'}
              />
              <Text variant="title3">
                {triageResult.urgency === 'soon'
                  ? 'Seek Clinical Consultation in 24–48 Hours'
                  : 'Schedule a Regular Hospital OPD Visit'}
              </Text>
              <Text variant="body" tone="secondary">
                {triageResult.advice}
              </Text>

              {/* Department Recommendations */}
              {triageResult.departments && triageResult.departments.length > 0 && (
                <View style={styles.deptSection}>
                  <Text variant="footnote" tone="secondary" style={styles.bold}>
                    Recommended Medical Department:
                  </Text>
                  <View style={styles.deptRow}>
                    {triageResult.departments.map((dept, idx) => (
                      <Pill key={idx} text={dept} tone="accent" />
                    ))}
                  </View>
                  <Button
                    title={`Book OPD Appointment in ${triageResult.departments[0]}`}
                    label={`Book appointment in ${triageResult.departments[0]}`}
                    icon={
                      <Symbol
                        ios="calendar"
                        android="calendar_today"
                        size={18}
                        color={T.color.white}
                      />
                    }
                    onPress={() =>
                      handleGoToBooking(triageResult.departments[0])
                    }
                  />
                </View>
              )}
            </Card>
          )}

          {/* Red Flag Symptoms */}
          {triageResult.red_flags && triageResult.red_flags.length > 0 && (
            <Card style={styles.redFlagsCard}>
              <View style={styles.redFlagsTitleRow}>
                <Symbol
                  ios="exclamationmark.triangle.fill"
                  android="warning"
                  size={18}
                  color={T.color.warn}
                />
                <Text variant="headline" tone="warn">
                  Warning Signs (Go to Emergency Room If Observed):
                </Text>
              </View>
              {triageResult.red_flags.map((flag, idx) => (
                <View key={idx} style={styles.flagBulletRow}>
                  <Text variant="body" tone="warn" style={styles.bold}>
                    •
                  </Text>
                  <Text variant="footnote" tone="warn" style={styles.flagText}>
                    {flag}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          {/* Clinical Disclaimer */}
          {triageResult.disclaimer ? (
            <Text variant="footnote" tone="tertiary" style={styles.disclaimer}>
              {triageResult.disclaimer}
            </Text>
          ) : null}

          {/* Reset / Assess Other Symptoms */}
          <Button
            title="Assess Different Symptoms"
            variant="secondary"
            label="Assess different symptoms"
            icon={
              <Symbol
                ios="chevron.left"
                android="chevron_left"
                size={18}
                color={T.color.accentStrong}
              />
            }
            onPress={handleReset}
          />
        </View>
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: T.space.md },
  bold: { fontWeight: '700' },
  noticeCard: { backgroundColor: T.color.accentSoft },
  label: { fontWeight: '700', marginTop: T.space.xs },
  input: {
    backgroundColor: T.color.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    minHeight: 44,
    ...T.text.body,
    color: T.color.label,
  },
  textArea: {
    minHeight: 96,
    paddingVertical: T.space.md,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: T.space.md, alignItems: 'flex-start' },
  ageCol: { flex: 1, gap: T.space.xs },
  sexCol: { flex: 1.5, gap: T.space.xs },
  sexSelector: { flexDirection: 'row', gap: T.space.sm },
  sexBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    backgroundColor: T.color.fill,
    paddingHorizontal: T.space.xs,
  },
  sexBtnActive: {
    borderColor: T.color.accent,
    borderWidth: 1.5,
    backgroundColor: T.color.accentSoft,
  },
  emergencyCard: {
    borderWidth: 1.5,
    borderColor: T.color.danger,
    alignItems: 'flex-start',
  },
  deptSection: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.sm,
  },
  deptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  redFlagsCard: { backgroundColor: T.color.warnSoft },
  redFlagsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
  },
  flagBulletRow: {
    flexDirection: 'row',
    gap: T.space.sm,
    alignItems: 'flex-start',
  },
  flagText: { flex: 1, lineHeight: 18 },
  disclaimer: { fontStyle: 'italic', lineHeight: 16 },
});
