import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  EMERGENCY,
  useCarePlans,
  useMyCaregivers,
  useMyPatients,
  usePrescriptions,
  useRevokeCareLink,
  type CaregiverLink,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  EmptyState,
  IconTile,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

export default function CaregiverScreen() {
  const router = useRouter();
  const { patient_id } = useLocalSearchParams<{ patient_id?: string }>();
  const { showToast } = useVyanaMobile();

  // Mode: "patients" (I look after someone) vs "my_caregivers" (people looking after me)
  const [activeTab, setActiveTab] = useState<'patients' | 'my_caregivers'>(
    patient_id ? 'patients' : 'patients'
  );

  const {
    data: patients = [],
    isLoading: patientsLoading,
  } = useMyPatients();

  const {
    data: caregivers = [],
    isLoading: caregiversLoading,
    refetch: refetchCaregivers,
  } = useMyCaregivers();

  const revokeMutation = useRevokeCareLink();

  // If patient_id param is provided, pick that patient, else first patient
  const selectedPatientId =
    patient_id && patients.some((p) => p.patient_id === patient_id)
      ? patient_id
      : patients[0]?.patient_id ?? null;

  const [activePatientId, setActivePatientId] = useState<string | null>(
    selectedPatientId
  );

  const currentPatient =
    patients.find((p) => p.patient_id === (activePatientId || selectedPatientId)) ||
    patients[0] ||
    null;

  // Care plans for the currently viewed patient
  const { data: patientCarePlans = [] } = useCarePlans(
    currentPatient?.patient_id ?? undefined
  );

  // The linked patient's prescriptions, never the viewer's own: with no patient selected, nothing is shown.
  const linkedPatientId = currentPatient?.patient_id;
  const { data: patientPrescriptions = [] } = usePrescriptions(linkedPatientId);
  const prescriptions = linkedPatientId ? patientPrescriptions : [];

  const handleRevokeCaregiver = (link: CaregiverLink) => {
    Alert.alert(
      'Revoke Caregiver Access',
      `Are you sure you want to remove ${
        link.full_name || 'this caregiver'
      }? They will no longer be able to see your medicines or receive missed dose alerts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Access',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeMutation.mutateAsync(link.link_id);
              showToast('Caregiver access revoked', 'info');
              refetchCaregivers();
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : 'Could not revoke access',
                'error'
              );
            }
          },
        },
      ]
    );
  };

  const activeCaregiverCount = caregivers.filter((c) => c.status === 'active').length;

  return (
    <Screen title="Caregiver Circle" eyebrow="Family care">
      <View style={styles.tabBar}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Patients I Monitor"
          accessibilityState={{ selected: activeTab === 'patients' }}
          onPress={() => setActiveTab('patients')}
          style={[styles.tabItem, activeTab === 'patients' && styles.tabItemActive]}
        >
          <Text
            variant="footnote"
            style={[
              styles.tabText,
              activeTab === 'patients' && styles.tabTextActive,
            ]}
          >
            Patients I monitor ({patients.length})
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="My Caregivers"
          accessibilityState={{ selected: activeTab === 'my_caregivers' }}
          onPress={() => setActiveTab('my_caregivers')}
          style={[
            styles.tabItem,
            activeTab === 'my_caregivers' && styles.tabItemActive,
          ]}
        >
          <Text
            variant="footnote"
            style={[
              styles.tabText,
              activeTab === 'my_caregivers' && styles.tabTextActive,
            ]}
          >
            My caregivers ({activeCaregiverCount})
          </Text>
        </Pressable>
      </View>

      {activeTab === 'patients' ? (
        <View style={styles.tabContent}>
          {patientsLoading ? (
            <Card style={styles.centerRow}>
              <ActivityIndicator size="small" color={T.color.accent} />
              <Text variant="footnote" tone="tertiary">
                Loading linked patients…
              </Text>
            </Card>
          ) : patients.length === 0 ? (
            <EmptyState
              ios="person.2.fill"
              android="group"
              title="No patients linked yet"
              body="You are not currently monitoring any family members or patients. Ask the patient to generate a 6-digit invite code from their Vyana app."
              action={
                <Button
                  title="Enter caregiver code"
                  label="Enter caregiver invite code"
                  icon={
                    <Symbol
                      ios="plus"
                      android="add"
                      size={18}
                      color={T.color.white}
                    />
                  }
                  onPress={() => router.push('/caregiver/enter-code')}
                />
              }
            />
          ) : (
            <View style={styles.tabContent}>
              {patients.length > 1 ? (
                <View style={styles.patientSelectorRow}>
                  {patients.map((p) => {
                    const isSelected =
                      (currentPatient?.patient_id ?? '') === p.patient_id;
                    return (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Select patient ${
                          p.patient?.full_name || 'Patient'
                        }`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setActivePatientId(p.patient_id)}
                        style={[
                          styles.patientPill,
                          isSelected && styles.patientPillActive,
                        ]}
                      >
                        <Text
                          variant="footnote"
                          style={[
                            styles.patientPillText,
                            isSelected && styles.patientPillTextActive,
                          ]}
                        >
                          {p.patient?.full_name || 'Patient'}
                          {p.relation ? ` (${p.relation})` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {currentPatient ? (
                <Card>
                  <View style={styles.patientHeader}>
                    <View style={styles.flex}>
                      <Text variant="title3">
                        {currentPatient.patient?.full_name || 'Linked patient'}
                      </Text>
                      <Text variant="footnote" tone="tertiary">
                        Relation: {currentPatient.relation || 'Caregiver'}
                      </Text>
                    </View>
                    <Pill text="Active" tone="ok" />
                  </View>

                  <View style={styles.noticeBox}>
                    <Symbol
                      ios="shield.fill"
                      android="shield"
                      size={22}
                      color={T.color.warn}
                    />
                    <View style={styles.flex}>
                      <Text variant="footnote" style={styles.noticeTitle}>
                        60-minute missed-dose watch active
                      </Text>
                      <Text variant="footnote" tone="secondary">
                        If a scheduled medication dose is not logged within 60
                        minutes of its time, our automated system sends a push
                        alert to your device.
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}

              <ListGroup header="Active medicines">
                {prescriptions.length === 0 ? (
                  <ListRow
                    icon={
                      <IconTile ios="pills.fill" android="medication" color="accent" />
                    }
                    title="No active prescription items recorded."
                  />
                ) : (
                  prescriptions.flatMap((rx) =>
                    rx.prescription_items
                      .filter((i) => i.active)
                      .map((item) => (
                        <ListRow
                          key={item.id}
                          icon={
                            <IconTile
                              ios="pills.fill"
                              android="medication"
                              color="accent"
                            />
                          }
                          title={`${item.medicine_name} ${item.strength || ''}`.trim()}
                          subtitle={`${item.frequency} · ${(item.times || []).join(', ')} · ${item.with_food || 'after'} food`}
                          value={item.dose || '1 dose'}
                        />
                      ))
                  )
                )}
              </ListGroup>

              {patientCarePlans.length > 0 ? (
                <ListGroup header={`Care plans (${patientCarePlans.length})`}>
                  {patientCarePlans.map((cp) => (
                    <ListRow
                      key={cp.id}
                      icon={
                        <IconTile
                          ios="heart.text.square.fill"
                          android="clinical_notes"
                          color="blue"
                        />
                      }
                      title="Care plan"
                      subtitle={`Status: ${cp.status}`}
                    />
                  ))}
                </ListGroup>
              ) : null}

              <Button
                variant="destructive"
                title="Call 108 for the patient"
                label="Call 108 ambulance for the patient"
                icon={
                  <Symbol
                    ios="phone.fill"
                    android="call"
                    size={18}
                    color={T.color.dangerText}
                  />
                }
                onPress={() =>
                  Linking.openURL(`tel:${EMERGENCY.ambulance}`).catch(() =>
                    showToast('Could not open the dialer. Dial 108 yourself.', 'error')
                  )
                }
              />

              <Button
                variant="secondary"
                title="Enter another caregiver code"
                label="Link another patient"
                onPress={() => router.push('/caregiver/enter-code')}
              />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.tabContent}>
          {caregiversLoading ? (
            <Card style={styles.centerRow}>
              <ActivityIndicator size="small" color={T.color.accent} />
              <Text variant="footnote" tone="tertiary">
                Loading caregivers…
              </Text>
            </Card>
          ) : (
            <View style={styles.tabContent}>
              <Card>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.flex}>
                    <Text variant="headline">My caregivers</Text>
                    <Text variant="footnote" tone="tertiary">
                      These people get an alert if you miss a dose by 60 minutes
                      and can view your medicine schedule.
                    </Text>
                  </View>
                  <Button
                    variant="secondary"
                    size="sm"
                    title="Invite"
                    label="Invite caregiver"
                    style={styles.inviteBtn}
                    onPress={() => router.push('/caregiver/invite')}
                  />
                </View>
              </Card>

              {caregivers.length === 0 ? (
                <EmptyState
                  ios="person.fill"
                  android="person"
                  title="No caregivers linked yet"
                  body="Invite a family member to watch over your medicines and get alerted if you miss a dose."
                  action={
                    <Button
                      title="Generate invite code"
                      label="Generate caregiver invite code"
                      onPress={() => router.push('/caregiver/invite')}
                    />
                  }
                />
              ) : (
                <ListGroup header="Linked caregivers">
                  {caregivers.map((c) => (
                    <ListRow
                      key={c.link_id}
                      icon={
                        <IconTile ios="person.fill" android="person" color="blue" />
                      }
                      title={c.full_name || 'Family caregiver'}
                      subtitle={`Relation: ${c.relation || 'Caregiver'}`}
                      trailing={
                        <View style={styles.caregiverTrailing}>
                          <Pill
                            text={c.status === 'active' ? 'Active' : c.status}
                            tone={c.status === 'active' ? 'ok' : 'neutral'}
                          />
                          {c.status === 'active' ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              title="Revoke"
                              label={`Revoke access for ${c.full_name || 'caregiver'}`}
                              style={styles.revokeBtn}
                              onPress={() => handleRevokeCaregiver(c)}
                            />
                          ) : null}
                        </View>
                      }
                    />
                  ))}
                </ListGroup>
              )}

              <Button
                variant="plain"
                title="Looking after someone else? Enter their code"
                label="I am also a caregiver - enter code"
                onPress={() => router.push('/caregiver/enter-code')}
              />
            </View>
          )}
        </View>
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tabContent: { gap: T.space.lg },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.xs,
    gap: T.space.xs,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.sm,
  },
  tabItemActive: {
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.separator,
  },
  tabText: { fontWeight: '600', color: T.color.label2, textAlign: 'center' },
  tabTextActive: { color: T.color.accentStrong, fontWeight: '700' },
  centerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: T.space.sm },
  patientSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  patientPill: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: T.color.fill,
    paddingHorizontal: T.space.lg,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: T.color.separator,
  },
  patientPillActive: {
    backgroundColor: T.color.accentSoft,
    borderColor: T.color.accent,
  },
  patientPillText: { fontWeight: '600', color: T.color.label2 },
  patientPillTextActive: { color: T.color.accentStrong, fontWeight: '700' },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: T.space.md,
    backgroundColor: T.color.warnSoft,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    alignItems: 'flex-start',
  },
  noticeTitle: { fontWeight: '700', color: T.color.warn },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  inviteBtn: { minHeight: 44 },
  caregiverTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
  },
  revokeBtn: { minHeight: 44 },
});
