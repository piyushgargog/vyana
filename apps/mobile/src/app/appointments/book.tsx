import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDays,
  formatLocalDate,
  useBookAppointment,
  useHospital,
  useHospitalInfo,
  useHospitals,
  type DbAppointment,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

export default function AppointmentBookScreen() {
  const router = useRouter();
  const { hospitalId: initialHospitalId, department: initialDepartment } =
    useLocalSearchParams<{
      hospitalId?: string;
      department?: string;
    }>();
  const { showToast } = useVyanaMobile();

  const { data: hospitals = [] } = useHospitals();
  const [hospitalQuery, setHospitalQuery] = useState('');
  const filteredHospitals = useMemo(() => {
    const q = hospitalQuery.trim().toLowerCase();
    if (!q) return hospitals;
    return hospitals.filter(
      (h) =>
        h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q)
    );
  }, [hospitals, hospitalQuery]);
  const [userHospitalId, setUserHospitalId] = useState<string>(
    initialHospitalId || ''
  );
  const selectedHospitalId = userHospitalId || hospitals[0]?.id || '';

  const { data: hospital, isLoading: hospLoading } =
    useHospital(selectedHospitalId);
  const infoMutation = useHospitalInfo();
  const loadHospitalInfo = infoMutation.mutate; // stable between renders (the mutation object is not)
  const bookMutation = useBookAppointment();

  // Load OPD timings via TinyFish, once per hospital
  useEffect(() => {
    if (selectedHospitalId) {
      loadHospitalInfo({ hospital_id: selectedHospitalId });
    }
  }, [selectedHospitalId, loadHospitalInfo]);

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

  // The phone's own calendar day: the UTC date is still "yesterday" in India until 05:30.
  const [dateDefaults] = useState(() => {
    const today = formatLocalDate(new Date());
    return { today, tomorrow: addDays(today, 1) };
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
    <Screen
      eyebrow="New booking"
      title="Book OPD Token"
      trailing={
        <Button
          title="Cancel"
          variant="plain"
          size="sm"
          label="Back to appointments list"
          onPress={() => router.back()}
        />
      }
    >
      {confirmedAppt ? (
        /* Booking Confirmation Card */
        <View style={styles.stack}>
          <Card style={styles.successCard}>
            <View style={styles.successPill}>
              <Text variant="footnote" tone="white" style={styles.bold}>
                APPOINTMENT CONFIRMED
              </Text>
            </View>
            <Text variant="largeTitle" tone="white" style={styles.tokenNumber}>
              Token #{confirmedAppt.token_no}
            </Text>
            <Text variant="title3" tone="white" style={styles.center}>
              {hospital?.name || 'Hospital OPD'}
            </Text>
            <Text variant="subhead" tone="white" style={styles.centerMuted}>
              Department: {selectedDeptObj?.name || 'General OPD'}
            </Text>

            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Symbol
                  ios="calendar"
                  android="calendar_today"
                  size={15}
                  color={T.color.white}
                />
                <Text variant="subhead" tone="white">
                  Date: {confirmedAppt.appointment_date}
                </Text>
              </View>
              <Text variant="subhead" tone="white">
                Status: {confirmedAppt.status.toUpperCase()}
              </Text>
              {confirmedAppt.reason && (
                <Text variant="subhead" tone="white">
                  Reason: {confirmedAppt.reason}
                </Text>
              )}
            </View>

            <View style={styles.arrivalBox}>
              <Text variant="footnote" tone="white" style={styles.arrivalTitle}>
                OPD Reporting Notice
              </Text>
              <Text variant="footnote" tone="white">
                Please arrive at the hospital registration counter by 8:30 AM
                on {confirmedAppt.appointment_date} with your Token #
                {confirmedAppt.token_no}.
              </Text>
            </View>
          </Card>

          <View style={styles.stack}>
            <Button
              title="View My OPD Tokens"
              label="View all booked OPD appointments"
              onPress={() => router.replace('/appointments')}
            />
            <Button
              title="Back to Home"
              variant="secondary"
              label="Return to home dashboard"
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        </View>
      ) : (
        /* Booking Form */
        <View style={styles.stack}>
          {/* 1. Select Hospital */}
          <Card>
            <CardHeader title="1. Select Hospital" />
            {/* A real search field (U2): search keyboard, a clear button, results under it. */}
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Search hospitals"
                placeholder="Search hospitals"
                placeholderTextColor={T.color.label3}
                value={hospitalQuery}
                onChangeText={setHospitalQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {hospitalQuery.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear the hospital search"
                  onPress={() => setHospitalQuery('')}
                  style={styles.clearBtn}
                >
                  <Symbol ios="xmark.circle.fill" android="cancel" size={20} color={T.color.label3} />
                </Pressable>
              )}
            </View>
            <View style={styles.stackSm}>
              {filteredHospitals.length === 0 ? (
                <Text variant="footnote" tone="tertiary" style={styles.italic}>
                  No hospital matches that search.
                </Text>
              ) : null}
              {filteredHospitals.map((h) => {
                const isSelected = h.id === selectedHospitalId;
                return (
                  <Pressable
                    key={h.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${h.name}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setUserHospitalId(h.id)}
                    style={[
                      styles.hospOption,
                      isSelected && styles.hospOptionSelected,
                    ]}
                  >
                    <View style={styles.hospOptionText}>
                      <Text
                        variant="subhead"
                        tone={isSelected ? 'accent' : 'label'}
                        style={isSelected && styles.bold}
                      >
                        {h.name}
                      </Text>
                      <Text variant="footnote" tone="tertiary">
                        {h.city} ·{' '}
                        {h.kind === 'government' ? 'Government' : 'Private'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Symbol
                        ios="checkmark.circle.fill"
                        android="check_circle"
                        size={22}
                        color={T.color.accent}
                        label="Selected"
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* OPD Timings (live lookup) */}
          {opdInfo && (
            <Card style={styles.opdCard}>
              <View style={styles.opdHeader}>
                <Pill text="LIVE OPD INFO" tone="accent" />
                {opdInfo.cached && <Pill text="CACHED" tone="neutral" />}
              </View>
              <Text variant="headline" tone="accent">
                Verified OPD Registration Timings
              </Text>
              {opdInfo.opd.map((slot, idx) => (
                <View key={idx} style={styles.opdSlotRow}>
                  <Text variant="footnote" tone="accent" style={styles.bold}>
                    {slot.department}:
                  </Text>
                  <Text variant="footnote" tone="accent">
                    {slot.days} ({slot.timings})
                  </Text>
                </View>
              ))}
              {opdInfo.notes && (
                <Text variant="footnote" tone="accent" style={styles.italic}>
                  Note: {opdInfo.notes}
                </Text>
              )}
            </Card>
          )}

          {/* 2. Select Department */}
          <Card>
            <CardHeader title="2. Select OPD Department" />
            {hospLoading ? (
              <ActivityIndicator size="small" color={T.color.accent} />
            ) : departments.length === 0 ? (
              <Text variant="footnote" tone="tertiary" style={styles.italic}>
                No departments listed for this hospital.
              </Text>
            ) : (
              <View style={styles.chipWrap}>
                {departments.map((dept) => {
                  const isSelected = dept.id === selectedDeptId;
                  return (
                    <Pressable
                      key={dept.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Select department ${dept.name}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setUserDeptId(dept.id)}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        variant="subhead"
                        tone={isSelected ? 'white' : 'secondary'}
                        style={isSelected && styles.bold}
                      >
                        {dept.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Button
              title="Not sure which department? Try Symptom Triage"
              variant="secondary"
              label="Unsure which department? Use Symptom Triage"
              icon={
                <Symbol
                  ios="lightbulb.fill"
                  android="lightbulb"
                  size={18}
                  color={T.color.accentStrong}
                />
              }
              onPress={() => router.push('/triage')}
            />
          </Card>

          {/* 3. Appointment Date */}
          <Card>
            <CardHeader title="3. Appointment Date" />
            <View style={styles.dateRow}>
              {(
                [
                  { key: dateDefaults.today, label: `Today (${dateDefaults.today})`, a11y: 'Select today' },
                  { key: dateDefaults.tomorrow, label: `Tomorrow (${dateDefaults.tomorrow})`, a11y: 'Select tomorrow' },
                ] as const
              ).map((d) => {
                const selected = appointmentDate === d.key;
                return (
                  <Pressable
                    key={d.key}
                    accessibilityRole="button"
                    accessibilityLabel={d.a11y}
                    accessibilityState={{ selected }}
                    onPress={() => setAppointmentDate(d.key)}
                    style={[styles.dateBtn, selected && styles.dateBtnSelected]}
                  >
                    <Text
                      variant="footnote"
                      tone={selected ? 'white' : 'secondary'}
                      style={selected && styles.bold}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              accessibilityLabel="Appointment Date YYYY-MM-DD"
              value={appointmentDate}
              onChangeText={setAppointmentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </Card>

          {/* 4. Reason */}
          <Card>
            <CardHeader title="4. Reason for Visit (Optional)" />
            <TextInput
              accessibilityLabel="Reason for visit"
              value={reason}
              onChangeText={setReason}
              placeholder="e.g., Blood sugar checkup, cough, routine follow-up"
              placeholderTextColor={T.color.label3}
              style={styles.input}
            />
          </Card>

          {/* Book Button */}
          <Button
            title="Confirm & Issue OPD Token"
            label="Confirm OPD token booking"
            loading={bookMutation.isPending}
            disabled={!selectedDeptId}
            onPress={handleBookToken}
          />
        </View>
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: T.space.md },
  stackSm: { gap: T.space.sm },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  center: { textAlign: 'center' },
  centerMuted: { textAlign: 'center', opacity: 0.85 },
  successCard: {
    backgroundColor: T.color.accent,
    alignItems: 'center',
    ...T.shadow.accent,
  },
  successPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.xs,
  },
  tokenNumber: { fontSize: 44, lineHeight: 52, textAlign: 'center' },
  metaBox: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    width: '100%',
    gap: T.space.xs,
    marginTop: T.space.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  arrivalBox: {
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    width: '100%',
    gap: T.space.xs,
    marginTop: T.space.xs,
  },
  arrivalTitle: { fontWeight: '800' },
  hospOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    padding: T.space.md,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    backgroundColor: T.color.surface,
    gap: T.space.sm,
  },
  hospOptionSelected: {
    borderColor: T.color.accent,
    borderWidth: 1.5,
    backgroundColor: T.color.accentSoft,
  },
  hospOptionText: { flex: 1, gap: 2 },
  opdCard: { borderWidth: 1, borderColor: T.color.accentSoft },
  opdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opdSlotRow: { flexDirection: 'row', gap: T.space.xs, flexWrap: 'wrap' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
  },
  chipSelected: {
    backgroundColor: T.color.accent,
    borderColor: T.color.accent,
  },
  dateRow: { flexDirection: 'row', gap: T.space.sm },
  dateBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.color.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.sm,
  },
  dateBtnSelected: {
    backgroundColor: T.color.accent,
    borderColor: T.color.accent,
  },
  input: {
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    minHeight: 44,
    ...T.text.subhead,
    color: T.color.label,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  searchInput: {
    flex: 1,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    minHeight: 44,
    ...T.text.subhead,
    color: T.color.label,
  },
  clearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
