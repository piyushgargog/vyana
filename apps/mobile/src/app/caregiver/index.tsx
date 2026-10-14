import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCarePlans,
  useMyCaregivers,
  useMyPatients,
  usePrescriptions,
  useRevokeCareLink,
  type CaregiverLink,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Caregiver Circle</Text>
          <Text style={styles.headerSub}>
            Family medication monitoring, missed-dose escalation & emergency guardrails
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      {/* Segmented Control */}
      <View style={styles.tabBar}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Patients I Monitor"
          onPress={() => setActiveTab('patients')}
          style={[
            styles.tabItem,
            activeTab === 'patients' && styles.tabItemActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'patients' && styles.tabTextActive,
            ]}
          >
            Patients I Monitor ({patients.length})
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="My Caregivers"
          onPress={() => setActiveTab('my_caregivers')}
          style={[
            styles.tabItem,
            activeTab === 'my_caregivers' && styles.tabItemActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'my_caregivers' && styles.tabTextActive,
            ]}
          >
            My Caregivers ({caregivers.filter((c) => c.status === 'active').length})
          </Text>
        </Pressable>
      </View>

      {/* Tab 1: Patients I Look After */}
      {activeTab === 'patients' && (
        <View style={styles.tabContent}>
          {patientsLoading ? (
            <View style={styles.card}>
              <ActivityIndicator size="small" color="#0D9488" />
              <Text style={styles.loadingText}>Loading linked patients…</Text>
            </View>
          ) : patients.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>No Patients Linked Yet</Text>
              <Text style={styles.emptySub}>
                You are not currently monitoring any family members or patients.
                Ask the patient to generate a 6-digit invite code from their Vyana app.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enter caregiver invite code"
                onPress={() => router.push('/caregiver/enter-code')}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  + Enter Caregiver Code to Link Patient
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Patient Selector Pills if more than 1 patient */}
              {patients.length > 1 && (
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
                        onPress={() => setActivePatientId(p.patient_id)}
                        style={[
                          styles.patientPill,
                          isSelected && styles.patientPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.patientPillText,
                            isSelected && styles.patientPillTextActive,
                          ]}
                        >
                          {p.patient?.full_name || 'Patient'}{' '}
                          {p.relation ? `(${p.relation})` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Current Patient Monitoring Card */}
              {currentPatient && (
                <View style={styles.card}>
                  <View style={styles.patientHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.patientName}>
                        {currentPatient.patient?.full_name || 'Linked Patient'}
                      </Text>
                      <Text style={styles.patientMeta}>
                        Relation: {currentPatient.relation || 'Caregiver'} ·
                        Active monitoring
                      </Text>
                    </View>
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  </View>

                  {/* Missed-Dose Notification Banner */}
                  <View style={styles.alertNoticeBox}>
                    <Text style={styles.alertNoticeTitle}>
                      🛡 60-Minute Missed-Dose Watch Active
                    </Text>
                    <Text style={styles.alertNoticeText}>
                      If a scheduled medication dose is not logged within 60 minutes of its time,
                      our automated cron sends a push alert to your device.
                    </Text>
                  </View>

                  {/* Patient Medications Summary */}
                  <View style={styles.sectionBox}>
                    <Text style={styles.sectionBoxTitle}>Active Medications</Text>
                    {prescriptions.length === 0 ? (
                      <Text style={styles.sectionBoxSub}>
                        No active prescription items recorded.
                      </Text>
                    ) : (
                      prescriptions.flatMap((rx) =>
                        rx.prescription_items
                          .filter((i) => i.active)
                          .map((item) => (
                            <View key={item.id} style={styles.medItemRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.medItemName}>
                                  {item.medicine_name} {item.strength || ''}
                                </Text>
                                <Text style={styles.medItemSchedule}>
                                  {item.frequency} · Times:{' '}
                                  {(item.times || []).join(', ')} ·{' '}
                                  {item.with_food || 'after'} food
                                </Text>
                              </View>
                              <Text style={styles.medItemDose}>
                                {item.dose || '1 dose'}
                              </Text>
                            </View>
                          ))
                      )
                    )}
                  </View>

                  {/* Patient Care Plans */}
                  {patientCarePlans.length > 0 && (
                    <View style={styles.sectionBox}>
                      <Text style={styles.sectionBoxTitle}>
                        Clinical Care Plans ({patientCarePlans.length})
                      </Text>
                      {patientCarePlans.map((cp) => (
                        <View key={cp.id} style={styles.carePlanRow}>
                          <Text style={styles.carePlanTitle}>
                            Condition: {cp.condition_id}
                          </Text>
                          <Text style={styles.carePlanStatus}>
                            Status: {cp.status.toUpperCase()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Quick Emergency Escalation */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Trigger Emergency SOS for patient"
                    onPress={() => router.push('/sos')}
                    style={styles.emergencyBtn}
                  >
                    <Text style={styles.emergencyBtnText}>
                      🚨 Emergency SOS · Call 108 for Patient
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Action to Link More Patients */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Link another patient"
                onPress={() => router.push('/caregiver/enter-code')}
                style={styles.outlineBtn}
              >
                <Text style={styles.outlineBtnText}>
                  + Enter Another Caregiver Code
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Tab 2: People Looking After Me */}
      {activeTab === 'my_caregivers' && (
        <View style={styles.tabContent}>
          {caregiversLoading ? (
            <View style={styles.card}>
              <ActivityIndicator size="small" color="#0D9488" />
              <Text style={styles.loadingText}>Loading caregivers…</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>My Authorized Caregivers</Text>
                  <Text style={styles.cardSub}>
                    These individuals receive alerts if you miss a dose by 60 minutes and can view your medical schedule.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Invite caregiver"
                  onPress={() => router.push('/caregiver/invite')}
                  style={styles.inviteMiniBtn}
                >
                  <Text style={styles.inviteMiniBtnText}>+ Invite</Text>
                </Pressable>
              </View>

              {caregivers.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    No caregivers linked to your account yet.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Generate caregiver invite code"
                    onPress={() => router.push('/caregiver/invite')}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>
                      Generate 6-Digit Invite Code
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.caregiverList}>
                  {caregivers.map((c) => (
                    <View key={c.link_id} style={styles.caregiverCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.caregiverName}>
                          {c.full_name || 'Family Caregiver'}
                        </Text>
                        <Text style={styles.caregiverRelation}>
                          Relation: {c.relation || 'Caregiver'} · Status:{' '}
                          <Text
                            style={{
                              color:
                                c.status === 'active' ? '#0D9488' : '#94A3B8',
                              fontWeight: '700',
                            }}
                          >
                            {c.status.toUpperCase()}
                          </Text>
                        </Text>
                      </View>

                      {c.status === 'active' && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Revoke access for ${
                            c.full_name || 'caregiver'
                          }`}
                          disabled={revokeMutation.isPending}
                          onPress={() => handleRevokeCaregiver(c)}
                          style={styles.revokeBtn}
                        >
                          <Text style={styles.revokeBtnText}>Revoke</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Quick Code Entry Action */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I am also a caregiver - enter code"
            onPress={() => router.push('/caregiver/enter-code')}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>
              Looking after someone else? Enter their code →
            </Text>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#0F766E' },
  tabContent: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptySub: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  primaryBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  outlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#0F766E', fontSize: 13, fontWeight: '700' },
  patientSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  patientPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  patientPillActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  patientPillText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  patientPillTextActive: { color: '#0F766E', fontWeight: '800' },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  patientName: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  patientMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  alertNoticeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertNoticeTitle: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  alertNoticeText: { fontSize: 11, color: '#78350F', lineHeight: 16 },
  sectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionBoxTitle: { fontSize: 13, fontWeight: '700', color: '#334155' },
  sectionBoxSub: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  medItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  medItemName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  medItemSchedule: { fontSize: 11, color: '#64748B', marginTop: 1 },
  medItemDose: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  carePlanRow: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  carePlanTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  carePlanStatus: { fontSize: 11, color: '#64748B', marginTop: 2 },
  emergencyBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emergencyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  inviteMiniBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteMiniBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  emptyText: { fontSize: 12, color: '#64748B', textAlign: 'center' },
  caregiverList: { gap: 8, marginTop: 4 },
  caregiverCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  caregiverName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  caregiverRelation: { fontSize: 11, color: '#64748B', marginTop: 2 },
  revokeBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  revokeBtnText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
});
