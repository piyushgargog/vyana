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
import {
  useMyProfile,
  useTriage,
  type Language,
  type TriageRes,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Symptom Triage</Text>
          <Text style={styles.headerSub}>
            Clinical urgency assessment and OPD department guidance
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      {/* Safety Notice */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Zero-Diagnosis Clinical Guardrail</Text>
        <Text style={styles.noticeText}>
          Vyana triage evaluates clinical urgency and directs you to the appropriate medical
          department. It never invents diagnoses or provides prescription treatments.
        </Text>
      </View>

      {!triageResult ? (
        /* Symptom Intake Form */
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Describe Your Symptoms</Text>
          <Text style={styles.cardSub}>
            Provide details about what you are experiencing, how long it has lasted, and any associated discomfort.
          </Text>

          <Text style={styles.label}>What symptoms are you experiencing? *</Text>
          <TextInput
            accessibilityLabel="Symptoms description"
            multiline
            numberOfLines={4}
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="e.g. Sudden severe chest tightness with shortness of breath, or mild dry cough for 3 days…"
            placeholderTextColor="#94A3B8"
            style={styles.textArea}
          />

          <Text style={styles.label}>Duration (Optional)</Text>
          <TextInput
            accessibilityLabel="Duration of symptoms"
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g. 2 hours, 3 days, 1 week"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Age (Optional)</Text>
              <TextInput
                accessibilityLabel="Age"
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
                placeholder={profile?.dob ? "Auto from profile or type" : "Years"}
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
            </View>

            <View style={{ flex: 1.5 }}>
              <Text style={styles.label}>Biological Sex (Optional)</Text>
              <View style={styles.sexSelector}>
                {(['female', 'male', 'other'] as const).map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityLabel={`Select biological sex ${s}`}
                    onPress={() => setSex(s === sex ? undefined : s)}
                    style={[
                      styles.sexBtn,
                      sex === s && styles.sexBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sexBtnText,
                        sex === s && styles.sexBtnTextActive,
                      ]}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Assess Symptoms"
            disabled={triageMutation.isPending || symptoms.trim().length < 3}
            onPress={handleAssessSymptoms}
            style={[
              styles.submitBtn,
              (triageMutation.isPending || symptoms.trim().length < 3) &&
                styles.submitBtnDisabled,
            ]}
          >
            {triageMutation.isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  Evaluating with Clinical Rules…
                </Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Assess Urgency & Department</Text>
            )}
          </Pressable>
        </View>
      ) : (
        /* Assessment Results */
        <View style={styles.resultContainer}>
          <MobileAiSafetyBanner feature="triage" />

          {/* Urgency Level Banner */}
          {triageResult.urgency === 'emergency' ? (
            <View style={styles.emergencyCard}>
              <View style={styles.emergencyHeader}>
                <Text style={styles.emergencyBadge}>EMERGENCY</Text>
                <Text style={styles.emergencyTitle}>
                  Immediate Medical Attention Required
                </Text>
              </View>

              <Text style={styles.emergencyAdvice}>{triageResult.advice}</Text>

              {/* Prominent Action to SOS Screen */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Call 108 or Open Emergency SOS"
                onPress={handleGoToSos}
                style={styles.sosActionBtn}
              >
                <Text style={styles.sosActionBtnText}>
                  🚨 Open Emergency SOS / Call 108 Now
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[
                styles.standardCard,
                triageResult.urgency === 'soon'
                  ? styles.soonBorder
                  : styles.routineBorder,
              ]}
            >
              <View style={styles.standardHeader}>
                <Text
                  style={[
                    styles.urgencyBadge,
                    triageResult.urgency === 'soon'
                      ? styles.soonBadge
                      : styles.routineBadge,
                  ]}
                >
                  {triageResult.urgency === 'soon'
                    ? 'ATTENTION NEEDED SOON'
                    : 'ROUTINE OPD CONSULTATION'}
                </Text>
                <Text style={styles.urgencyHeading}>
                  {triageResult.urgency === 'soon'
                    ? 'Seek Clinical Consultation in 24–48 Hours'
                    : 'Schedule a Regular Hospital OPD Visit'}
                </Text>
              </View>

              <Text style={styles.standardAdvice}>{triageResult.advice}</Text>

              {/* Department Recommendations */}
              {triageResult.departments && triageResult.departments.length > 0 && (
                <View style={styles.deptSection}>
                  <Text style={styles.deptSectionTitle}>
                    Recommended Medical Department:
                  </Text>
                  <View style={styles.deptRow}>
                    {triageResult.departments.map((dept, idx) => (
                      <View key={idx} style={styles.deptPill}>
                        <Text style={styles.deptPillText}>{dept}</Text>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Book appointment in ${triageResult.departments[0]}`}
                    onPress={() => handleGoToBooking(triageResult.departments[0])}
                    style={styles.bookDeptBtn}
                  >
                    <Text style={styles.bookDeptBtnText}>
                      📅 Book OPD Appointment in {triageResult.departments[0]}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Red Flag Symptoms */}
          {triageResult.red_flags && triageResult.red_flags.length > 0 && (
            <View style={styles.redFlagsCard}>
              <Text style={styles.redFlagsTitle}>
                ⚠️ Warning Signs (Go to Emergency Room If Observed):
              </Text>
              {triageResult.red_flags.map((flag, idx) => (
                <View key={idx} style={styles.flagBulletRow}>
                  <Text style={styles.flagBullet}>•</Text>
                  <Text style={styles.flagText}>{flag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Clinical Disclaimer */}
          {triageResult.disclaimer ? (
            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerText}>
                {triageResult.disclaimer}
              </Text>
            </View>
          ) : null}

          {/* Reset / Assess Other Symptoms */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Assess different symptoms"
            onPress={handleReset}
            style={styles.resetBtn}
          >
            <Text style={styles.resetBtnText}>← Assess Different Symptoms</Text>
          </Pressable>
        </View>
      )}

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
  noticeBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  noticeTitle: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  noticeText: { fontSize: 11, color: '#115E59', lineHeight: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 4 },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 90,
    textAlignVertical: 'top',
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
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sexSelector: { flexDirection: 'row', gap: 6 },
  sexBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  sexBtnActive: {
    borderColor: '#0D9488',
    backgroundColor: '#CCFBF1',
  },
  sexBtnText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  sexBtnTextActive: { color: '#0F766E', fontWeight: '800' },
  submitBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  resultContainer: { gap: 14 },
  emergencyCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  emergencyHeader: { gap: 4 },
  emergencyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emergencyTitle: { fontSize: 17, fontWeight: '800', color: '#991B1B' },
  emergencyAdvice: { fontSize: 13, color: '#7F1D1D', lineHeight: 18 },
  sosActionBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sosActionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  standardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  soonBorder: { borderColor: '#F59E0B' },
  routineBorder: { borderColor: '#10B981' },
  standardHeader: { gap: 4 },
  urgencyBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  soonBadge: { backgroundColor: '#FEF3C7', color: '#92400E' },
  routineBadge: { backgroundColor: '#D1FAE5', color: '#065F46' },
  urgencyHeading: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  standardAdvice: { fontSize: 13, color: '#334155', lineHeight: 18 },
  deptSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deptSectionTitle: { fontSize: 12, fontWeight: '700', color: '#475569' },
  deptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  deptPill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  deptPillText: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
  bookDeptBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  bookDeptBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  redFlagsCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  redFlagsTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  flagBulletRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  flagBullet: { color: '#B45309', fontSize: 14, fontWeight: '800' },
  flagText: { flex: 1, fontSize: 12, color: '#78350F', lineHeight: 16 },
  disclaimerCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  resetBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetBtnText: { color: '#475569', fontSize: 13, fontWeight: '700' },
});
