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
  useAddCondition,
  useAddContact,
  useDepartments,
  useHospitals,
  useUpdateProfile,
  useUpsertDoctorProfile,
} from '@vyana/shared';
import { DEMO_HOSPITALS } from '@/components/health-helpers';
import { useVyanaMobile, type MobileRole } from '@/components/providers';

export default function MobileOnboardingScreen() {
  const router = useRouter();
  const {
    profile,
    role,
    setRole,
    updateLocalProfile,
    conditions,
    addLocalCondition,
    emergencyContacts,
    addLocalEmergencyContact,
    setOnboarded,
    showToast,
  } = useVyanaMobile();

  const updateProfileMutation = useUpdateProfile();
  const addConditionMutation = useAddCondition();
  const addEmergencyContactMutation = useAddContact();
  const upsertDoctorMutation = useUpsertDoctorProfile();
  const { data: liveHospitals } = useHospitals();

  const hospitals =
    liveHospitals && liveHospitals.length > 0 ? liveHospitals : DEMO_HOSPITALS;

  const [selectedRole, setSelectedRole] = useState<MobileRole>(role);
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [dob, setDob] = useState(profile.dob || '1968-04-12');
  const [bloodGroup, setBloodGroup] = useState(profile.blood_group || 'B+');
  const [city, setCity] = useState(profile.city || 'New Delhi');
  const [pincode, setPincode] = useState('110029');
  const [preferredLang, setPreferredLang] = useState(
    profile.preferred_language || 'en'
  );
  const [allergiesStr, setAllergiesStr] = useState(
    (profile.allergies ?? []).join(', ')
  );
  const [newCondition, setNewCondition] = useState('');
  const [ecName, setEcName] = useState(emergencyContacts[0]?.name || '');
  const [ecPhone, setEcPhone] = useState(emergencyContacts[0]?.phone || '');
  const [ecRel, setEcRel] = useState(
    emergencyContacts[0]?.relation || 'Family'
  );

  // Doctor onboarding fields (hospital + department + reg no)
  const [hospitalId, setHospitalId] = useState(
    hospitals[0]?.id ?? 'hosp-aiims-delhi'
  );
  const { data: liveDepartments } = useDepartments(hospitalId);
  const [departmentName, setDepartmentName] = useState(
    'General Medicine OPD'
  );
  const [regNo, setRegNo] = useState('DMC-45892');
  const [stateCouncil, setStateCouncil] = useState('Delhi Medical Council');
  const [specialization, setSpecialization] = useState(
    'General Medicine & Diabetology'
  );

  const handleAddCondition = async () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    try {
      await addConditionMutation.mutateAsync({
        name: trimmed,
      });
    } catch {
      // Demo fallback
    }
    addLocalCondition(trimmed);
    setNewCondition('');
    showToast(`Condition added: ${trimmed}`, 'success');
  };

  const handleSaveOnboarding = async () => {
    const parsedAllergies = allergiesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await updateProfileMutation.mutateAsync({
        full_name: fullName.trim(),
        phone: phone.trim(),
        dob,
        blood_group: bloodGroup,
        city: city.trim(),
        preferred_language: preferredLang,
        allergies: parsedAllergies,
      });
    } catch {
      // Demo fallback
    }

    if (selectedRole === 'doctor') {
      try {
        const selectedHosp = hospitals.find((h) => h.id === hospitalId);
        await upsertDoctorMutation.mutateAsync({
          specialization: specialization.trim() || departmentName,
          reg_no: regNo.trim(),
          state_council: stateCouncil.trim(),
          year_of_registration: 2010,
          clinic_name: `${selectedHosp?.name ?? 'AIIMS'} · ${departmentName}`,
        });
      } catch {
        // Demo fallback
      }
    }

    if (ecName.trim() && ecPhone.trim()) {
      try {
        await addEmergencyContactMutation.mutateAsync({
          name: ecName.trim(),
          phone: ecPhone.trim(),
          relation: ecRel.trim() || 'Family',
        });
      } catch {
        // Demo fallback
      }
      if (!emergencyContacts.some((c) => c.phone === ecPhone.trim())) {
        addLocalEmergencyContact({
          name: ecName.trim(),
          phone: ecPhone.trim(),
          relation: ecRel.trim() || 'Family',
        });
      }
    }

    setRole(selectedRole);
    updateLocalProfile({
      role: selectedRole,
      full_name: fullName.trim(),
      phone: phone.trim(),
      dob,
      blood_group: bloodGroup,
      city: city.trim(),
      preferred_language: preferredLang,
      allergies: parsedAllergies,
    });
    setOnboarded(true);
    showToast('Onboarding completed!', 'success');
    router.replace('/(tabs)');
  };

  const deptOptions =
    liveDepartments && liveDepartments.length > 0
      ? liveDepartments.map((d) => d.name)
      : [
          'General Medicine OPD',
          'Endocrinology & Diabetes',
          'Cardiology OPD',
          'Obstetrics & Gynaecology',
        ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.stepTag}>Step 2 of 2 · Health Profile</Text>
        <Text style={styles.title}>Complete Your Vyana Setup</Text>

        <Text style={styles.label}>Primary Role</Text>
        <View style={styles.row}>
          {(['patient', 'doctor', 'caregiver'] as const).map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRole === r }}
              accessibilityLabel={`Select ${r} role`}
              onPress={() => setSelectedRole(r)}
              style={[
                styles.chip,
                selectedRole === r && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedRole === r && styles.chipTextActive,
                ]}
              >
                {r === 'patient'
                  ? 'Patient'
                  : r === 'doctor'
                  ? 'Doctor'
                  : 'Caregiver'}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedRole === 'doctor' ? (
          <View style={styles.docBox}>
            <Text style={styles.docTitle}>
              Doctor Onboarding · Hospital, Department & NMC Registration
            </Text>
            <Text style={styles.label}>Hospital</Text>
            <View style={styles.tagsWrap}>
              {hospitals.slice(0, 3).map((h) => (
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
              {deptOptions.map((dept) => (
                <Pressable
                  key={dept}
                  accessibilityRole="button"
                  onPress={() => setDepartmentName(dept)}
                  style={[
                    styles.chip,
                    departmentName === dept && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      departmentName === dept && styles.chipTextActive,
                    ]}
                  >
                    {dept}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>NMC Registration No.</Text>
            <TextInput
              accessibilityLabel="NMC Registration Number"
              value={regNo}
              onChangeText={setRegNo}
              placeholder="DMC-45892"
              style={styles.input}
            />

            <Text style={styles.label}>State Medical Council</Text>
            <TextInput
              accessibilityLabel="State Medical Council"
              value={stateCouncil}
              onChangeText={setStateCouncil}
              placeholder="Delhi Medical Council"
              style={styles.input}
            />

            <Text style={styles.label}>Specialization</Text>
            <TextInput
              accessibilityLabel="Doctor Specialization"
              value={specialization}
              onChangeText={setSpecialization}
              placeholder="General Medicine & Diabetology"
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

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>City</Text>
            <TextInput
              accessibilityLabel="City"
              value={city}
              onChangeText={setCity}
              style={styles.input}
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>PIN Code</Text>
            <TextInput
              accessibilityLabel="PIN Code"
              keyboardType="numeric"
              value={pincode}
              onChangeText={setPincode}
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>Preferred Language</Text>
        <View style={styles.row}>
          {[
            { id: 'en', label: 'English' },
            { id: 'hi', label: 'हिंदी' },
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
          placeholder="Penicillin, Sulfa drugs"
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
          <Text style={styles.label}>Contact Name</Text>
          <TextInput
            accessibilityLabel="Emergency Contact Name"
            value={ecName}
            onChangeText={setEcName}
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
          onPress={handleSaveOnboarding}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Save Profile & Open Home →</Text>
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
