import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ORS_URL,
  useHospitals,
  useMyAppointments,
  type DbHospital,
  type MyAppointment,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileDisclaimerFooter,
  MobileSkeletonCard,
  MobileSkeletonList,
} from '@/components/ui-primitives';

export default function AppointmentsIndexScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const [activeTab, setActiveTab] = useState<'tokens' | 'hospitals'>('tokens');
  const [kindFilter, setKindFilter] = useState<
    'all' | 'government' | 'private'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: myAppointments = [], isLoading: apptsLoading } =
    useMyAppointments();
  const { data: hospitals = [], isLoading: hospitalsLoading } = useHospitals(
    kindFilter === 'all' ? {} : { kind: kindFilter }
  );

  const filteredHospitals = hospitals.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.name.toLowerCase().includes(q) ||
      (h.city && h.city.toLowerCase().includes(q))
    );
  });

  const handleOpenOrs = () => {
    Linking.openURL(ORS_URL).catch(() => {
      showToast('Could not open ORS portal', 'error');
    });
  };

  const handleBookHospital = (hospitalId: string) => {
    router.push({
      pathname: '/appointments/book',
      params: { hospitalId },
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>OPD Appointments</Text>
          <Text style={styles.headerSub}>
            Government ORS & Private Hospital OPD tokens
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Book new OPD appointment token"
          onPress={() => router.push('/appointments/book')}
          style={styles.bookTokenBtn}
        >
          <Text style={styles.bookTokenBtnText}>+ Book Token</Text>
        </Pressable>
      </View>

      {/* Tabs Switcher */}
      <View style={styles.tabSwitchRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View my booked OPD tokens"
          onPress={() => setActiveTab('tokens')}
          style={[
            styles.tabSwitchBtn,
            activeTab === 'tokens' && styles.tabSwitchBtnActive,
          ]}
        >
          <Text
            style={[
              styles.tabSwitchText,
              activeTab === 'tokens' && styles.tabSwitchTextActive,
            ]}
          >
            My OPD Tokens ({myAppointments.length})
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse hospitals and OPD timings"
          onPress={() => setActiveTab('hospitals')}
          style={[
            styles.tabSwitchBtn,
            activeTab === 'hospitals' && styles.tabSwitchBtnActive,
          ]}
        >
          <Text
            style={[
              styles.tabSwitchText,
              activeTab === 'hospitals' && styles.tabSwitchTextActive,
            ]}
          >
            Browse Hospitals
          </Text>
        </Pressable>
      </View>

      {activeTab === 'tokens' ? (
        /* My Tokens Tab */
        <View style={styles.tabContent}>
          {apptsLoading ? (
            <MobileSkeletonCard lines={3} />
          ) : myAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No OPD Tokens Booked</Text>
              <Text style={styles.emptySub}>
                Book a token at AIIMS, Safdarjung, or other hospitals to skip the physical line.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Book an OPD token now"
                onPress={() => router.push('/appointments/book')}
                style={styles.emptyActionBtn}
              >
                <Text style={styles.emptyActionBtnText}>Book an OPD Token</Text>
              </Pressable>
            </View>
          ) : (
            myAppointments.map((appt: MyAppointment) => (
              <View key={appt.id} style={styles.tokenCard}>
                <View style={styles.tokenHeader}>
                  <View style={styles.tokenBadgeBox}>
                    <Text style={styles.tokenBadgeText}>
                      TOKEN #{appt.token_no}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.statusBadge,
                      appt.status === 'confirmed'
                        ? styles.statusConfirmed
                        : appt.status === 'completed'
                          ? styles.statusCompleted
                          : styles.statusRequested,
                    ]}
                  >
                    {appt.status.toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.hospitalName}>
                  {appt.hospitals?.name ?? 'Hospital OPD'}
                </Text>
                <Text style={styles.deptName}>
                  Department: {appt.departments?.name ?? 'General Medicine'}
                </Text>

                <View style={styles.tokenDetails}>
                  <Text style={styles.detailText}>
                    📅 Date: {appt.appointment_date}
                  </Text>
                  {appt.reason && (
                    <Text style={styles.detailText}>
                      Reason: {appt.reason}
                    </Text>
                  )}
                </View>

                <View style={styles.reportInstructionsBox}>
                  <Text style={styles.reportInstructionsText}>
                    Report to OPD registration desk by 8:30 AM with Token #{appt.token_no}.
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      ) : (
        /* Browse Hospitals Tab */
        <View style={styles.tabContent}>
          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {(['all', 'government', 'private'] as const).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${k} hospitals`}
                onPress={() => setKindFilter(k)}
                style={[
                  styles.filterPill,
                  kindFilter === k && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    kindFilter === k && styles.filterPillTextActive,
                  ]}
                >
                  {k === 'all'
                    ? 'All Hospitals'
                    : k === 'government'
                      ? 'Government (ORS)'
                      : 'Private Hospitals'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Search bar */}
          <TextInput
            accessibilityLabel="Search hospitals by name or city"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search AIIMS, Safdarjung, Delhi, Gurgaon…"
            style={styles.searchInput}
          />

          {hospitalsLoading ? (
            <MobileSkeletonList count={3} />
          ) : filteredHospitals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Hospitals Found</Text>
              <Text style={styles.emptySub}>
                Try clearing your search query or selecting &quot;All Hospitals&quot;.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear Search and Filters"
                onPress={() => {
                  setSearchQuery('');
                  setKindFilter('all');
                }}
                style={styles.emptyActionBtn}
              >
                <Text style={styles.emptyActionBtnText}>Clear Search & Filters</Text>
              </Pressable>
            </View>
          ) : (
            filteredHospitals.map((h: DbHospital) => (
              <View key={h.id} style={styles.hospitalCard}>
                <View style={styles.hospTopRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.hospName}>{h.name}</Text>
                    <Text style={styles.hospAddress}>
                      {h.address || h.city}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.kindTag,
                      h.kind === 'govt' ? styles.kindGovt : styles.kindPrivate,
                    ]}
                  >
                    <Text
                      style={[
                        styles.kindTagText,
                        h.kind === 'govt'
                          ? styles.kindGovtText
                          : styles.kindPrivateText,
                      ]}
                    >
                      {h.kind === 'govt' ? 'GOVT' : 'PRIVATE'}
                    </Text>
                  </View>
                </View>

                {/* Government ORS portal notice */}
                {h.ors_enabled && (
                  <View style={styles.orsNoticeBox}>
                    <Text style={styles.orsNoticeText}>
                      ✓ Empanelled with National Online Registration System (ORS)
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open National ORS portal"
                      onPress={handleOpenOrs}
                      style={styles.orsLinkBtn}
                    >
                      <Text style={styles.orsLinkBtnText}>Book on ORS ↗</Text>
                    </Pressable>
                  </View>
                )}

                {/* Book token button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${h.name} to view OPD departments and book token`}
                  onPress={() => handleBookHospital(h.id)}
                  style={styles.selectHospBtn}
                >
                  <Text style={styles.selectHospBtnText}>
                    Select Hospital & Book Token →
                  </Text>
                </Pressable>
              </View>
            ))
          )}
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
  bookTokenBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookTokenBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  tabSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabSwitchBtnActive: { backgroundColor: '#FFFFFF' },
  tabSwitchText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabSwitchTextActive: { color: '#0F766E', fontWeight: '700' },
  tabContent: { gap: 12 },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { fontSize: 13, color: '#64748B' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  emptyActionBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyActionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tokenCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenBadgeBox: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tokenBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  statusBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusConfirmed: { backgroundColor: '#D1FAE5', color: '#065F46' },
  statusCompleted: { backgroundColor: '#E2E8F0', color: '#475569' },
  statusRequested: { backgroundColor: '#FEF3C7', color: '#92400E' },
  hospitalName: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  deptName: { fontSize: 13, fontWeight: '600', color: '#0D9488' },
  tokenDetails: { gap: 4 },
  detailText: { fontSize: 13, color: '#334155' },
  reportInstructionsBox: {
    backgroundColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  reportInstructionsText: { fontSize: 12, color: '#0F766E', fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterPillActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  filterPillText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterPillTextActive: { color: '#FFFFFF' },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  hospitalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hospTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  hospName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  hospAddress: { fontSize: 12, color: '#64748B' },
  kindTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kindGovt: { backgroundColor: '#E0F2FE' },
  kindPrivate: { backgroundColor: '#F1F5F9' },
  kindTagText: { fontSize: 10, fontWeight: '800' },
  kindGovtText: { color: '#0369A1' },
  kindPrivateText: { color: '#475569' },
  orsNoticeBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  orsNoticeText: { fontSize: 11, color: '#15803D', fontWeight: '600', flex: 1 },
  orsLinkBtn: {
    backgroundColor: '#15803D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  orsLinkBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  selectHospBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  selectHospBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
