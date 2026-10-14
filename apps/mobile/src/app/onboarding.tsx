import React, { useEffect, useState } from 'react';
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.stepTag}>
          Account Role: {role.toUpperCase()} · Health Profile Setup
        </Text>
        <Text style={styles.title}>Complete Your Vyana Setup</Text>

        {errorMsg && (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {role === 'doctor' ? (
          <View style={styles.docBox}>
            <Text style={styles.docTitle}>
              Doctor Onboarding · Hospital, Department & NMC Registration
            </Text>
            <Text style={styles.label}>Hospital</Text>
            <View style={styles.tagsWrap}>
              {hospitals.map((h) => (
                <Pressable
                  key={h.id}
                  accessibilityRole="button"
                  onPress={() => setHospitalId(h.id)}
                  style={[
                    styles.chip,
                    hospitalId === h.id && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      hospitalId === h.id && styles.chipTextActive,
                    ]}
                  >
                    {h.name.split('(')[0].trim()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Department</Text>
            <View style={styles.tagsWrap}>
              {departments.map((dept) => (
                <Pressable
                  key={dept.id}
                  accessibilityRole="button"
                  onPress={() => setDepartmentName(dept.name)}
                  style={[
                    styles.chip,
                    departmentName === dept.name && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      departmentName === dept.name && styles.chipTextActive,
                    ]}
                  >
                    {dept.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>NMC Registration No.</Text>
            <TextInput
              accessibilityLabel="NMC Registration Number"
              value={regNo}
              onChangeText={setRegNo}
              placeholder="e.g., DMC-45892"
              style={styles.input}
            />

            <Text style={styles.label}>State Medical Council</Text>
            <TextInput
              accessibilityLabel="State Medical Council"
              value={stateCouncil}
              onChangeText={setStateCouncil}
              placeholder="e.g., Delhi Medical Council"
              style={styles.input}
            />

            <Text style={styles.label}>Specialization</Text>
            <TextInput
              accessibilityLabel="Doctor Specialization"
              value={specialization}
              onChangeText={setSpecialization}
              placeholder="e.g., General Medicine"
              style={styles.input}
            />
          </View>
        ) : null}

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          accessibilityLabel="Full Name"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
        />

        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          accessibilityLabel="Mobile Number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
            <TextInput
              accessibilityLabel="Date of Birth"
              value={dob}
              onChangeText={setDob}
              placeholder="1980-01-15"
              style={styles.input}
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Blood Group</Text>
            <TextInput
              accessibilityLabel="Blood Group"
              value={bloodGroup}
              onChangeText={setBloodGroup}
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>City</Text>
        <TextInput
          accessibilityLabel="City"
          value={city}
          onChangeText={setCity}
          style={styles.input}
        />

        <Text style={styles.label}>Preferred Language</Text>
        <View style={styles.row}>
          {[
            { id: 'en', label: 'English' },
            { id: 'hi', label: 'Hindi' },
            { id: 'hinglish', label: 'Hinglish' },
          ].map((l) => (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityState={{ selected: preferredLang === l.id }}
              accessibilityLabel={`Language ${l.label}`}
              onPress={() => setPreferredLang(l.id)}
              style={[
                styles.chip,
                preferredLang === l.id && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  preferredLang === l.id && styles.chipTextActive,
                ]}
              >
                {l.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Known Allergies (comma-separated)</Text>
        <TextInput
          accessibilityLabel="Known Allergies"
          value={allergiesStr}
          onChangeText={setAllergiesStr}
          placeholder="e.g., Penicillin, Peanuts"
          style={styles.input}
        />

        <Text style={styles.label}>Chronic Conditions</Text>
        <View style={styles.tagsWrap}>
          {conditions.map((c) => (
            <View key={c.id} style={styles.condBadge}>
              <Text style={styles.condBadgeText}>{c.name}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Add new chronic condition"
            value={newCondition}
            onChangeText={setNewCondition}
            placeholder="e.g., Asthma, Hypothyroidism"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add condition"
            disabled={addConditionMutation.isPending}
            onPress={handleAddCondition}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>+ Add</Text>
          </Pressable>
        </View>

        <View style={styles.ecBox}>
          <Text style={styles.ecTitle}>
            Primary Emergency Contact (For SOS 108 & Medical ID)
          </Text>
          {emergencyContacts.length > 0 && (
            <View style={styles.tagsWrap}>
              {emergencyContacts.map((ec) => (
                <View key={ec.id} style={styles.condBadge}>
                  <Text style={styles.condBadgeText}>
                    {ec.name} ({ec.phone})
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.label}>Contact Name</Text>
          <TextInput
            accessibilityLabel="Emergency Contact Name"
            value={ecName}
            onChangeText={setEcName}
            placeholder="Family member name"
            style={styles.input}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Mobile Number</Text>
              <TextInput
                accessibilityLabel="Emergency Contact Phone"
                keyboardType="phone-pad"
                value={ecPhone}
                onChangeText={setEcPhone}
                placeholder="+91 98111 00000"
                style={styles.input}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Relationship</Text>
              <TextInput
                accessibilityLabel="Emergency Contact Relationship"
                value={ecRel}
                onChangeText={setEcRel}
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save Profile and Open Home"
          disabled={completeOnboardingMutation.isPending}
          onPress={handleSaveOnboarding}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {completeOnboardingMutation.isPending
              ? 'Saving Profile…'
              : 'Save Profile & Open Home →'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  stepTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: '#991B1B', fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  half: { flex: 1, gap: 4 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  chipActive: { borderColor: '#0D9488', backgroundColor: '#F0FDFA' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#0F766E', fontWeight: '700' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  condBadge: {
    backgroundColor: '#CCFBF1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  condBadgeText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#0D9488',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: '#0F766E', fontSize: 12, fontWeight: '700' },
  docBox: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  docTitle: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  ecBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  ecTitle: { fontSize: 12, fontWeight: '700', color: '#991B1B' },
  primaryBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
