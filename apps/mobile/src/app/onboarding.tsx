import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CONSENT_VERSION,
  useAddCondition,
  useAddContact,
  useCompleteOnboarding,
  useConditions,
  useConsent,
  useDepartments,
  useEmergencyContacts,
  useHospitals,
  useMyDoctorProfile,
  useMyProfile,
  useSession,
  useUpsertDoctorProfile,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  Pill,
  Screen,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

export default function MobileOnboardingScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const { user, loading: sessionLoading } = useSession();
  const { data: consentRecord, isLoading: consentLoading } =
    useConsent(CONSENT_VERSION);
  const { data: profile } = useMyProfile();
  const { data: conditions = [] } = useConditions();
  const { data: emergencyContacts = [] } = useEmergencyContacts();
  const { data: doctorProfile } = useMyDoctorProfile();
  const { data: hospitals = [] } = useHospitals();

  const completeOnboardingMutation = useCompleteOnboarding();
  const addConditionMutation = useAddCondition();
  const addEmergencyContactMutation = useAddContact();
  const upsertDoctorMutation = useUpsertDoctorProfile();

  const [fullNameOverride, setFullName] = useState<string | null>(null);
  const [phoneOverride, setPhone] = useState<string | null>(null);
  const [dobOverride, setDob] = useState<string | null>(null);
  const [bloodGroupOverride, setBloodGroup] = useState<string | null>(null);
  const [cityOverride, setCity] = useState<string | null>(null);
  const [preferredLangOverride, setPreferredLang] = useState<string | null>(null);
  const [allergiesStrOverride, setAllergiesStr] = useState<string | null>(null);
  const [newCondition, setNewCondition] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRel, setEcRel] = useState('Family');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fullName = fullNameOverride ?? profile?.full_name ?? '';
  const phone = phoneOverride ?? profile?.phone ?? '';
  const dob = dobOverride ?? profile?.dob ?? '';
  const bloodGroup = bloodGroupOverride ?? profile?.blood_group ?? 'B+';
  const city = cityOverride ?? profile?.city ?? '';
  const preferredLang =
    preferredLangOverride ?? profile?.preferred_language ?? 'en';
  const allergiesStr =
    allergiesStrOverride ?? (profile?.allergies ?? []).join(', ');

  // Doctor onboarding fields (hospital + department + reg no)
  const [hospitalIdOverride, setHospitalId] = useState('');
  const hospitalId = hospitalIdOverride || hospitals[0]?.id || '';
  const { data: departments = [] } = useDepartments(hospitalId || undefined);
  const [departmentNameOverride, setDepartmentName] = useState('');
  const departmentName = departmentNameOverride || departments[0]?.name || '';
  const [regNoOverride, setRegNo] = useState<string | null>(null);
  const [stateCouncilOverride, setStateCouncil] = useState<string | null>(null);
  const [specializationOverride, setSpecialization] = useState<string | null>(
    null
  );

  const regNo = regNoOverride ?? doctorProfile?.reg_no ?? '';
  const stateCouncil =
    stateCouncilOverride ?? doctorProfile?.state_council ?? '';
  const specialization =
    specializationOverride ?? doctorProfile?.specialization ?? '';

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (!consentLoading && consentRecord === null) {
      router.replace('/consent');
    }
  }, [sessionLoading, user, consentLoading, consentRecord, router]);

  const role = profile?.role ?? 'patient';

  const handleAddCondition = async () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    setErrorMsg(null);
    try {
      await addConditionMutation.mutateAsync({
        name: trimmed,
      });
      setNewCondition('');
      showToast(`Condition added: ${trimmed}`, 'success');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to add condition'
      );
    }
  };

  const handleSaveOnboarding = async () => {
    setErrorMsg(null);
    const parsedAllergies = allergiesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await completeOnboardingMutation.mutateAsync({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        dob: dob.trim() || null,
        blood_group: bloodGroup.trim() || null,
        city: city.trim() || null,
        preferred_language: preferredLang,
        allergies: parsedAllergies,
      });

      if (role === 'doctor') {
        const selectedHosp = hospitals.find((h) => h.id === hospitalId);
        await upsertDoctorMutation.mutateAsync({
          specialization:
            specialization.trim() || departmentName || 'General Medicine',
          reg_no: regNo.trim(),
          state_council: stateCouncil.trim(),
          year_of_registration: null,
          clinic_name: selectedHosp
            ? `${selectedHosp.name}${departmentName ? ` · ${departmentName}` : ''}`
            : departmentName || null,
        });
      }

      if (
        ecName.trim() &&
        ecPhone.trim() &&
        !emergencyContacts.some((c) => c.phone === ecPhone.trim())
      ) {
        await addEmergencyContactMutation.mutateAsync({
          name: ecName.trim(),
          phone: ecPhone.trim(),
          relation: ecRel.trim() || 'Family',
        });
      }

      showToast('Onboarding completed!', 'success');
      router.replace('/(tabs)');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not complete onboarding'
      );
    }
  };

  return (
    <Screen
      eyebrow={`Health profile setup · ${role === 'doctor' ? 'Doctor' : 'Patient'}`}
      title="Complete your setup"
    >
      {errorMsg && (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text variant="footnote" tone="danger" style={styles.errorText}>
            {errorMsg}
          </Text>
        </View>
      )}

      {role === 'doctor' && (
        <Card>
          <CardHeader title="Doctor details" />
          <View style={styles.fieldGroup}>
            <Text variant="footnote" style={styles.label}>
              Hospital
            </Text>
            <View style={styles.chipWrap}>
              {hospitals.map((h) => {
                const selected = hospitalId === h.id;
                return (
                  <Pressable
                    key={h.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Select hospital ${h.name}`}
                    onPress={() => setHospitalId(h.id)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text
                      variant="footnote"
                      tone={selected ? 'accent' : 'secondary'}
                      style={selected ? styles.chipTextActive : undefined}
                    >
                      {h.name.split('(')[0].trim()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text variant="footnote" style={styles.label}>
              Department
            </Text>
            <View style={styles.chipWrap}>
              {departments.map((dept) => {
                const selected = departmentName === dept.name;
                return (
                  <Pressable
                    key={dept.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Select department ${dept.name}`}
                    onPress={() => setDepartmentName(dept.name)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text
                      variant="footnote"
                      tone={selected ? 'accent' : 'secondary'}
                      style={selected ? styles.chipTextActive : undefined}
                    >
                      {dept.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text variant="footnote" style={styles.label}>
              NMC Registration No.
            </Text>
            <TextInput
              accessibilityLabel="NMC Registration Number"
              value={regNo}
              onChangeText={setRegNo}
              placeholder="e.g., DMC-45892"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text variant="footnote" style={styles.label}>
              State Medical Council
            </Text>
            <TextInput
              accessibilityLabel="State Medical Council"
              value={stateCouncil}
              onChangeText={setStateCouncil}
              placeholder="e.g., Delhi Medical Council"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text variant="footnote" style={styles.label}>
              Specialization
            </Text>
            <TextInput
              accessibilityLabel="Doctor Specialization"
              value={specialization}
              onChangeText={setSpecialization}
              placeholder="e.g., General Medicine"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>
        </Card>
      )}

      <Card>
        <CardHeader title="About you" />
        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Full Name
          </Text>
          <TextInput
            accessibilityLabel="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Mobile Number
          </Text>
          <TextInput
            accessibilityLabel="Mobile Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text variant="footnote" style={styles.label}>
              Date of Birth (YYYY-MM-DD)
            </Text>
            <TextInput
              accessibilityLabel="Date of Birth"
              value={dob}
              onChangeText={setDob}
              placeholder="1980-01-15"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>
          <View style={styles.half}>
            <Text variant="footnote" style={styles.label}>
              Blood Group
            </Text>
            <TextInput
              accessibilityLabel="Blood Group"
              value={bloodGroup}
              onChangeText={setBloodGroup}
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            City
          </Text>
          <TextInput
            accessibilityLabel="City"
            value={city}
            onChangeText={setCity}
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Preferred Language
          </Text>
          <View style={styles.row}>
            {[
              { id: 'en', label: 'English' },
              { id: 'hi', label: 'Hindi' },
              { id: 'hinglish', label: 'Hinglish' },
            ].map((l) => {
              const selected = preferredLang === l.id;
              return (
                <Pressable
                  key={l.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Language ${l.label}`}
                  onPress={() => setPreferredLang(l.id)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text
                    variant="footnote"
                    tone={selected ? 'accent' : 'secondary'}
                    style={selected ? styles.chipTextActive : undefined}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Known Allergies (comma-separated)
          </Text>
          <TextInput
            accessibilityLabel="Known Allergies"
            value={allergiesStr}
            onChangeText={setAllergiesStr}
            placeholder="e.g., Penicillin, Peanuts"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>
      </Card>

      <Card>
        <CardHeader title="Chronic conditions" />
        {conditions.length > 0 && (
          <View style={styles.chipWrap}>
            {conditions.map((c) => (
              <Pill key={c.id} text={c.name} tone="accent" />
            ))}
          </View>
        )}
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Add new chronic condition"
            value={newCondition}
            onChangeText={setNewCondition}
            placeholder="e.g., Asthma, Hypothyroidism"
            placeholderTextColor={T.color.label3}
            style={[styles.input, { flex: 1 }]}
          />
          <Button
            title="Add"
            variant="secondary"
            size="sm"
            label="Add condition"
            disabled={addConditionMutation.isPending}
            onPress={handleAddCondition}
          />
        </View>
      </Card>

      <Card style={styles.ecCard}>
        <CardHeader title="Emergency contact" trailing="For SOS 108" />
        {emergencyContacts.length > 0 && (
          <View style={styles.chipWrap}>
            {emergencyContacts.map((ec) => (
              <Pill
                key={ec.id}
                text={`${ec.name} (${ec.phone})`}
                tone="neutral"
              />
            ))}
          </View>
        )}
        <View style={styles.fieldGroup}>
          <Text variant="footnote" style={styles.label}>
            Contact Name
          </Text>
          <TextInput
            accessibilityLabel="Emergency Contact Name"
            value={ecName}
            onChangeText={setEcName}
            placeholder="Family member name"
            placeholderTextColor={T.color.label3}
            style={styles.input}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text variant="footnote" style={styles.label}>
              Mobile Number
            </Text>
            <TextInput
              accessibilityLabel="Emergency Contact Phone"
              keyboardType="phone-pad"
              value={ecPhone}
              onChangeText={setEcPhone}
              placeholder="+91 98111 00000"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>
          <View style={styles.half}>
            <Text variant="footnote" style={styles.label}>
              Relationship
            </Text>
            <TextInput
              accessibilityLabel="Emergency Contact Relationship"
              value={ecRel}
              onChangeText={setEcRel}
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </View>
        </View>
      </Card>

      <Button
        title="Save profile and open home"
        label="Save profile and open home"
        loading={completeOnboardingMutation.isPending}
        onPress={handleSaveOnboarding}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    backgroundColor: T.color.dangerSoft,
    borderRadius: T.radius.row,
    padding: T.space.md,
  },
  errorText: {
    fontWeight: '600',
  },
  fieldGroup: {
    gap: T.space.xs,
  },
  label: {
    fontWeight: '700',
  },
  input: {
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    paddingHorizontal: T.space.md,
    minHeight: 46,
    ...T.text.body,
    color: T.color.label,
  },
  row: {
    flexDirection: 'row',
    gap: T.space.sm,
    alignItems: 'center',
  },
  half: {
    flex: 1,
    gap: T.space.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.space.xs,
  },
  chip: {
    minHeight: 44,
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    paddingVertical: T.space.sm,
    paddingHorizontal: T.space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: T.color.accentSoft,
    borderWidth: 1.5,
    borderColor: T.color.accent,
  },
  chipTextActive: {
    fontWeight: '700',
  },
  ecCard: {
    backgroundColor: T.color.dangerSoft,
  },
});
