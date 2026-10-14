import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
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
  Button,
  Card,
  EmptyState,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import {
  MobileDisclaimerFooter,
  MobileSkeletonCard,
  MobileSkeletonList,
} from '@/components/ui-primitives';
import { T } from '@/constants/theme';

type Tab = 'tokens' | 'hospitals';
type KindFilter = 'all' | 'government' | 'private';

const KIND_OPTIONS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All Hospitals' },
  { key: 'government', label: 'Government (ORS)' },
  { key: 'private', label: 'Private Hospitals' },
];

function statusTone(status: string): 'ok' | 'neutral' | 'warn' {
  if (status === 'confirmed') return 'ok';
  if (status === 'completed') return 'neutral';
  return 'warn';
}

export default function AppointmentsIndexScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
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
    <Screen
      eyebrow="Hospital visits"
      title="OPD Appointments"
      trailing={
        <Button
          title="Book Token"
          size="sm"
          style={styles.bookTokenBtn}
          label="Book new OPD appointment token"
          onPress={() => router.push('/appointments/book')}
        />
      }
    >
      {/* Tabs Switcher */}
      <View style={styles.segment} accessibilityRole="tablist">
        {(
          [
            { key: 'tokens', label: `My OPD Tokens (${myAppointments.length})` },
            { key: 'hospitals', label: 'Browse Hospitals' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={
              tab.key === 'tokens'
                ? 'View my booked OPD tokens'
                : 'Browse hospitals and OPD timings'
            }
            accessibilityState={{ selected: activeTab === tab.key }}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.segmentBtn,
              activeTab === tab.key && styles.segmentBtnActive,
            ]}
          >
            <Text
              variant="subhead"
              tone={activeTab === tab.key ? 'label' : 'tertiary'}
              style={activeTab === tab.key && styles.segmentTextActive}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'tokens' ? (
        /* My Tokens Tab */
        <View style={styles.tabContent}>
          {apptsLoading ? (
            <MobileSkeletonCard lines={3} />
          ) : myAppointments.length === 0 ? (
            <Card>
              <EmptyState
                ios="ticket.fill"
                android="confirmation_number"
                title="No OPD Tokens Booked"
                body="Book a token at AIIMS, Safdarjung, or other hospitals to skip the physical line."
                action={
                  <Button
                    title="Book an OPD Token"
                    variant="secondary"
                    label="Book an OPD token now"
                    onPress={() => router.push('/appointments/book')}
                  />
                }
              />
            </Card>
          ) : (
            myAppointments.map((appt: MyAppointment) => (
              <Card key={appt.id}>
                <View style={styles.tokenHeader}>
                  <Pill text={`Token #${appt.token_no}`} tone="accent" />
                  <Pill
                    text={appt.status.toUpperCase()}
                    tone={statusTone(appt.status)}
                  />
                </View>
                <View style={styles.tokenBody}>
                  <Text variant="headline">
                    {appt.hospitals?.name ?? 'Hospital OPD'}
                  </Text>
                  <Text variant="subhead" tone="accent">
                    Department: {appt.departments?.name ?? 'General Medicine'}
                  </Text>
                  <View style={styles.detailRow}>
                    <Symbol
                      ios="calendar"
                      android="calendar_today"
                      size={15}
                      color={T.color.label3}
                    />
                    <Text variant="subhead" tone="secondary">
                      Date: {appt.appointment_date}
                    </Text>
                  </View>
                  {appt.reason && (
                    <Text variant="subhead" tone="secondary">
                      Reason: {appt.reason}
                    </Text>
                  )}
                </View>
                <View style={styles.instructionsBox}>
                  <Text variant="footnote" tone="accent" style={styles.instructionsText}>
                    Report to the OPD registration desk by 8:30 AM with Token #
                    {appt.token_no}.
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>
      ) : (
        /* Browse Hospitals Tab */
        <View style={styles.tabContent}>
          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {KIND_OPTIONS.map((opt) => {
              const selected = kindFilter === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter ${opt.key} hospitals`}
                  accessibilityState={{ selected }}
                  onPress={() => setKindFilter(opt.key)}
                  style={[
                    styles.filterPill,
                    selected && styles.filterPillActive,
                  ]}
                >
                  <Text
                    variant="footnote"
                    tone={selected ? 'white' : 'secondary'}
                    style={selected && styles.filterPillTextActive}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Search bar */}
          <TextInput
            accessibilityLabel="Search hospitals by name or city"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search AIIMS, Safdarjung, Delhi, Gurgaon…"
            placeholderTextColor={T.color.label3}
            style={styles.searchInput}
          />

          {hospitalsLoading ? (
            <MobileSkeletonList count={3} />
          ) : filteredHospitals.length === 0 ? (
            <Card>
              <EmptyState
                ios="building.2.fill"
                android="apartment"
                title="No Hospitals Found"
                body='Try clearing your search query or selecting "All Hospitals".'
                action={
                  <Button
                    title="Clear Search & Filters"
                    variant="secondary"
                    label="Clear Search and Filters"
                    onPress={() => {
                      setSearchQuery('');
                      setKindFilter('all');
                    }}
                  />
                }
              />
            </Card>
          ) : (
            filteredHospitals.map((h: DbHospital) => (
              <Card key={h.id}>
                <View style={styles.hospTopRow}>
                  <View style={styles.hospTitles}>
                    <Text variant="headline">{h.name}</Text>
                    <Text variant="footnote" tone="tertiary">
                      {h.address || h.city}
                    </Text>
                  </View>
                  <Pill
                    text={h.kind === 'govt' ? 'GOVT' : 'PRIVATE'}
                    tone={h.kind === 'govt' ? 'accent' : 'neutral'}
                  />
                </View>

                {/* Government ORS portal notice */}
                {h.ors_enabled && (
                  <View style={styles.orsNoticeBox}>
                    <Symbol
                      ios="checkmark.seal.fill"
                      android="verified"
                      size={18}
                      color={T.color.ok}
                    />
                    <Text
                      variant="footnote"
                      tone="ok"
                      style={styles.orsNoticeText}
                    >
                      Empanelled with National Online Registration System (ORS)
                    </Text>
                    <Button
                      title="Book on ORS"
                      variant="secondary"
                      size="sm"
                      style={styles.smallBtn}
                      label="Open National ORS portal"
                      onPress={handleOpenOrs}
                    />
                  </View>
                )}

                {/* Book token button */}
                <Button
                  title="Select Hospital & Book Token"
                  variant="secondary"
                  label={`Select ${h.name} to view OPD departments and book token`}
                  onPress={() => handleBookHospital(h.id)}
                />
              </Card>
            ))
          )}
        </View>
      )}

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bookTokenBtn: { minHeight: 44 },
  segment: {
    flexDirection: 'row',
    backgroundColor: T.color.fill,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    padding: T.space.xs,
    gap: T.space.xs,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.sm,
  },
  segmentBtnActive: {
    backgroundColor: T.color.surface,
    ...T.shadow.float,
  },
  segmentTextActive: { fontWeight: '700' },
  tabContent: { gap: T.space.md },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenBody: { gap: T.space.xs },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
  },
  instructionsBox: {
    backgroundColor: T.color.accentSoft,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
  },
  instructionsText: { fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: T.space.sm, flexWrap: 'wrap' },
  filterPill: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: T.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
  },
  filterPillActive: {
    backgroundColor: T.color.accent,
    borderColor: T.color.accent,
  },
  filterPillTextActive: { fontWeight: '700' },
  searchInput: {
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
  hospTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  hospTitles: { flex: 1, gap: 2 },
  orsNoticeBox: {
    backgroundColor: T.color.okSoft,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
  },
  orsNoticeText: { flex: 1, fontWeight: '600' },
  smallBtn: { minHeight: 44 },
});
