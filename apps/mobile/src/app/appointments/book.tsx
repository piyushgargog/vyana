import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useBookAppointment,
  useHospital,
  useHospitalInfo,
  useHospitals,
  type DbAppointment,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

export default function AppointmentBookScreen() {
  const router = useRouter();
  const { hospitalId: initialHospitalId, department: initialDepartment } =
    useLocalSearchParams<{
      hospitalId?: string;
      department?: string;
    }>();
  const { showToast } = useVyanaMobile();

  const { data: hospitals = [] } = useHospitals();
  const [userHospitalId, setUserHospitalId] = useState<string>(
    initialHospitalId || ''
  );
  const selectedHospitalId = userHospitalId || hospitals[0]?.id || '';

  const { data: hospital, isLoading: hospLoading } =
    useHospital(selectedHospitalId);
  const infoMutation = useHospitalInfo();
  const bookMutation = useBookAppointment();

  // Load OPD timings via TinyFish
  useEffect(() => {
    if (selectedHospitalId) {
      infoMutation.mutate({ hospital_id: selectedHospitalId });
    }
  }, [selectedHospitalId, infoMutation]);

  const departments = useMemo(
    () => hospital?.departments ?? [],
    [hospital?.departments]
  );
  const [userDeptId, setUserDeptId] = useState<string>('');

  // Auto-select department if routed from symptom triage
  const matchedDeptId = useMemo(() => {
    if (!initialDepartment || departments.length === 0) return '';
    const match = departments.find(
      (d) => d.name.toLowerCase() === initialDepartment.toLowerCase()
    );
    return match?.id || '';
  }, [initialDepartment, departments]);

  const selectedDeptId = userDeptId || matchedDeptId || departments[0]?.id || '';

  // Safe pure date initialization
  const [dateDefaults] = useState(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    return { today, tomorrow };
  });

  const [appointmentDate, setAppointmentDate] = useState<string>(
    dateDefaults.today
  );
  const [reason, setReason] = useState<string>('General OPD consultation');

  const [confirmedAppt, setConfirmedAppt] = useState<DbAppointment | null>(
    null
  );

  const handleBookToken = async () => {
    if (!selectedHospitalId || !selectedDeptId || !appointmentDate) {
      showToast('Please select hospital, department and date', 'warning');
      return;
    }

    try {
      const res = await bookMutation.mutateAsync({
        hospital_id: selectedHospitalId,
        department_id: selectedDeptId,
        appointment_date: appointmentDate,
        reason: reason.trim() || undefined,
      });
      setConfirmedAppt(res);
      showToast(`Token #${res.token_no} Booked Successfully`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not book OPD token',
        'error'
      );
    }
  };

  const selectedDeptObj = departments.find((d) => d.id === selectedDeptId);
  const opdInfo = infoMutation.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Book OPD Token</Text>
          <Text style={styles.headerSub}>
            Direct queue registration & token issuance
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to appointments list"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>Cancel</Text>
        </Pressable>
      </View>

      {confirmedAppt ? (
        /* Booking Confirmation Card */
        <View style={styles.confirmedContainer}>
          <View style={styles.tokenSuccessCard}>
            <Text style={styles.successBadge}>APPOINTMENT CONFIRMED</Text>
            <Text style={styles.tokenNumber}>
              Token #{confirmedAppt.token_no}
            </Text>
            <Text style={styles.tokenHospitalName}>
              {hospital?.name || 'Hospital OPD'}
            </Text>
            <Text style={styles.tokenDeptName}>
              Department: {selectedDeptObj?.name || 'General OPD'}
            </Text>

            <View style={styles.tokenMetaBox}>
              <Text style={styles.tokenMetaText}>
                📅 Date: {confirmedAppt.appointment_date}
              </Text>
              <Text style={styles.tokenMetaText}>
                Status: {confirmedAppt.status.toUpperCase()}
              </Text>
              {confirmedAppt.reason && (
                <Text style={styles.tokenMetaText}>
                  Reason: {confirmedAppt.reason}
                </Text>
              )}
            </View>

            <View style={styles.arrivalInstructions}>
              <Text style={styles.arrivalTitle}>OPD Reporting Notice</Text>
              <Text style={styles.arrivalText}>
                Please arrive at the hospital registration counter by 8:30 AM
                on {confirmedAppt.appointment_date} with your Token #
                {confirmedAppt.token_no}.
              </Text>
            </View>
          </View>

          <View style={styles.confirmedActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all booked OPD appointments"
              onPress={() => router.replace('/appointments')}
              style={styles.viewMineBtn}
            >
              <Text style={styles.viewMineBtnText}>View My OPD Tokens</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to home dashboard"
              onPress={() => router.replace('/(tabs)')}
              style={styles.homeBtn}
            >
              <Text style={styles.homeBtnText}>Back to Home</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Booking Form */
        <View style={styles.formContainer}>
          {/* 1. Select Hospital */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Select Hospital</Text>
            <View style={styles.hospitalPickerList}>
              {hospitals.map((h) => {
                const isSelected = h.id === selectedHospitalId;
                return (
                  <Pressable
                    key={h.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${h.name}`}
                    onPress={() => setUserHospitalId(h.id)}
                    style={[
                      styles.hospOptionCard,
                      isSelected && styles.hospOptionSelected,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.hospOptionName,
                          isSelected && styles.hospOptionNameSelected,
                        ]}
                      >
                        {h.name}
                      </Text>
                      <Text style={styles.hospOptionSub}>
                        {h.city} · {h.kind === 'government' ? 'Government' : 'Private'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={styles.checkIcon}>✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* OPD Timings (Fetched via TinyFish) */}
          {opdInfo && (
            <View style={styles.opdCard}>
              <View style={styles.opdHeader}>
                <Text style={styles.opdBadge}>TINYFISH LIVE OPD INFO</Text>
                {opdInfo.cached && (
                  <Text style={styles.cachedTag}>CACHED</Text>
                )}
              </View>
              <Text style={styles.opdTitle}>Verified OPD Registration Timings</Text>
              {opdInfo.opd.map((slot, idx) => (
                <View key={idx} style={styles.opdSlotRow}>
                  <Text style={styles.opdDept}>{slot.department}:</Text>
                  <Text style={styles.opdTiming}>
                    {slot.days} ({slot.timings})
                  </Text>
                </View>
              ))}
              {opdInfo.notes && (
                <Text style={styles.opdNotes}>Note: {opdInfo.notes}</Text>
              )}
            </View>
          )}

          {/* 2. Select Department */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Select OPD Department</Text>
            {hospLoading ? (
              <ActivityIndicator size="small" color="#0D9488" />
            ) : departments.length === 0 ? (
              <Text style={styles.emptyText}>
                No departments listed for this hospital.
              </Text>
            ) : (
              <View style={styles.deptWrap}>
                {departments.map((dept) => {
                  const isSelected = dept.id === selectedDeptId;
                  return (
                    <Pressable
                      key={dept.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Select department ${dept.name}`}
                      onPress={() => setUserDeptId(dept.id)}
                      style={[
                        styles.deptPill,
                        isSelected && styles.deptPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.deptPillText,
                          isSelected && styles.deptPillTextSelected,
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Unsure which department? Use Symptom Triage"
              onPress={() => router.push('/triage')}
              style={styles.triageHelpBtn}
            >
              <Text style={styles.triageHelpText}>
                💡 Not sure which department? Try Symptom Triage →
              </Text>
            </Pressable>
          </View>

          {/* 3. Appointment Date */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Appointment Date</Text>
            <View style={styles.dateRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select today"
                onPress={() => setAppointmentDate(dateDefaults.today)}
                style={[
                  styles.dateBtn,
                  appointmentDate === dateDefaults.today && styles.dateBtnSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dateBtnText,
                    appointmentDate === dateDefaults.today &&
                      styles.dateBtnTextSelected,
                  ]}
                >
                  Today ({dateDefaults.today})
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select tomorrow"
                onPress={() => setAppointmentDate(dateDefaults.tomorrow)}
                style={[
                  styles.dateBtn,
                  appointmentDate === dateDefaults.tomorrow && styles.dateBtnSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dateBtnText,
                    appointmentDate === dateDefaults.tomorrow &&
                      styles.dateBtnTextSelected,
                  ]}
                >
                  Tomorrow ({dateDefaults.tomorrow})
                </Text>
              </Pressable>
            </View>

            <TextInput
              accessibilityLabel="Appointment Date YYYY-MM-DD"
              value={appointmentDate}
              onChangeText={setAppointmentDate}
              placeholder="YYYY-MM-DD"
              style={styles.dateInput}
            />
          </View>

          {/* 4. Reason */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>4. Reason for Visit (Optional)</Text>
            <TextInput
              accessibilityLabel="Reason for visit"
              value={reason}
              onChangeText={setReason}
              placeholder="e.g., Blood sugar checkup, cough, routine follow-up"
              style={styles.reasonInput}
            />
          </View>

          {/* Book Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm OPD token booking"
            disabled={bookMutation.isPending || !selectedDeptId}
            onPress={handleBookToken}
            style={[
              styles.bookBtn,
              (bookMutation.isPending || !selectedDeptId) &&
                styles.bookBtnDisabled,
            ]}
          >
            {bookMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.bookBtnText}>
                Confirm & Issue OPD Token →
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 13, color: '#64748B' },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  formContainer: { gap: 14 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  hospitalPickerList: { gap: 8 },
  hospOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  hospOptionSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#F0FDFA',
  },
  hospOptionName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  hospOptionNameSelected: { color: '#0F766E', fontWeight: '700' },
  hospOptionSub: { fontSize: 12, color: '#64748B' },
  checkIcon: { color: '#0F766E', fontSize: 16, fontWeight: '800' },
  opdCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  opdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opdBadge: { fontSize: 10, fontWeight: '800', color: '#0F766E', letterSpacing: 1 },
  cachedTag: { fontSize: 9, fontWeight: '800', color: '#64748B', backgroundColor: '#E2E8F0', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  opdTitle: { fontSize: 13, fontWeight: '700', color: '#115E59' },
  opdSlotRow: { flexDirection: 'row', gap: 6 },
  opdDept: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  opdTiming: { fontSize: 12, color: '#134E4A' },
  opdNotes: { fontSize: 11, color: '#047857', fontStyle: 'italic', marginTop: 4 },
  emptyText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  deptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deptPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deptPillSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  deptPillText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  deptPillTextSelected: { color: '#FFFFFF' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateBtnSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  dateBtnText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  dateBtnTextSelected: { color: '#FFFFFF' },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginTop: 4,
  },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  bookBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bookBtnDisabled: { opacity: 0.5 },
  bookBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  confirmedContainer: { gap: 14 },
  tokenSuccessCard: {
    backgroundColor: '#0F766E',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0F766E',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  successBadge: {
    color: '#99F6E4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tokenNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 56,
  },
  tokenHospitalName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tokenDeptName: {
    fontSize: 14,
    color: '#CCFBF1',
    fontWeight: '600',
  },
  tokenMetaBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    gap: 4,
    marginTop: 8,
  },
  tokenMetaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  arrivalInstructions: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    gap: 4,
    marginTop: 4,
  },
  arrivalTitle: { color: '#99F6E4', fontSize: 12, fontWeight: '800' },
  arrivalText: { color: '#FFFFFF', fontSize: 12, lineHeight: 17 },
  confirmedActions: { gap: 10 },
  viewMineBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  viewMineBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  homeBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  homeBtnText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  triageHelpBtn: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  triageHelpText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
});
