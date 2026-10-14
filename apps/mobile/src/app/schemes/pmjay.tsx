import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { usePmjayHospitals } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

const PMJAY_PORTAL_URL = 'https://hospitals.pmjay.gov.in';

export default function PmjayHospitalsScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // 'off': no permission or no fix. The search is never run around a place the user is not at.
  const [locationState, setLocationState] = useState<'loading' | 'ready' | 'off'>('loading');

  const pmjayMutation = usePmjayHospitals();
  const { mutate: searchPmjay } = pmjayMutation;
  const started = useRef(false);

  const findLocation = useCallback(
    async (ask: boolean) => {
      setLocationState('loading');
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' && ask) ({ status } = await Location.requestForegroundPermissionsAsync());
        if (status !== 'granted') return setLocationState('off');
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        if (!pos) return setLocationState('off');
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setLocationState('ready');
        searchPmjay(c);
      } catch {
        setLocationState('off');
      }
    },
    [searchPmjay]
  );

  // Once, when the screen opens (an agent run costs money): later searches are the user's refresh.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void findLocation(true);
  }, [findLocation]);

  const handleOpenSource = (url: string | null | undefined, name: string) => {
    const targetUrl = url || PMJAY_PORTAL_URL;
    Linking.openURL(targetUrl).catch(() => {
      showToast(`Could not open source for ${name}`, 'error');
    });
  };

  const handleOpenPmjayPortal = () => {
    Linking.openURL(PMJAY_PORTAL_URL).catch(() => {
      showToast('Could not open National PM-JAY Hospital Search', 'error');
    });
  };

  const handleRefresh = () => {
    if (coords) searchPmjay(coords);
  };

  // Permission was refused for good: only the phone's settings can turn it on again.
  const handleAllowLocation = async () => {
    const { canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (canAskAgain) void findLocation(true);
    else Linking.openSettings().catch(() => showToast('Open the phone settings and allow location for Vyana', 'info'));
  };

  const hospitals = pmjayMutation.data?.hospitals ?? [];
  const area = pmjayMutation.data?.area;
  const isLoading = locationState === 'loading' || pmjayMutation.isPending;

  return (
    <Screen
      eyebrow="Schemes"
      title="PM-JAY Empanelled Hospitals"
      trailing={
        <Button
          title="Done"
          variant="plain"
          size="sm"
          label="Back"
          onPress={() => router.back()}
          style={styles.doneBtn}
        />
      }
    >
      <Text variant="subhead" tone="secondary">
        Ayushman Bharat Pradhan Mantri Jan Arogya Yojana empanelled
        healthcare providers.
      </Text>

      <MobileAiSafetyBanner />

      {/* Official Government Verification Banner */}
      <Card>
        <Pill text="Government sources only" tone="ok" />
        <Text variant="headline">Official portal listings only</Text>
        <Text variant="footnote" tone="secondary">
          Hospital empanelment records are fetched strictly from verified
          government pages (pmjay.gov.in / National Health Authority).
          Third-party commercial directories are never used.
        </Text>
      </Card>

      {/* Location / Status Bar */}
      <Card>
        <View style={styles.statusRow}>
          <View style={styles.statusText}>
            <Text variant="caption" tone="tertiary">
              Search location
            </Text>
            <Text variant="subhead" style={styles.strong}>
              {area
                ? `${area}`
                : coords
                  ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`
                  : locationState === 'off'
                    ? 'Location is off'
                    : 'Finding your location…'}
            </Text>
          </View>
          <Button
            title="Refresh"
            variant="secondary"
            size="sm"
            disabled={isLoading || !coords}
            loading={isLoading}
            icon={
              <Symbol
                ios="arrow.clockwise"
                android="refresh"
                size={16}
                color={T.color.accentStrong}
              />
            }
            label="Refresh empanelled hospitals"
            onPress={handleRefresh}
          />
        </View>
      </Card>

      {/* Hospital List */}
      {isLoading && (
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={T.color.accent} />
            <Text variant="subhead" tone="tertiary">
              Fetching government empanelled list…
            </Text>
          </View>
        </Card>
      )}

      {locationState === 'off' && (
        <EmptyState
          ios="mappin"
          android="pin_drop"
          title="Location is off"
          body="To find empanelled hospitals near you, allow Vyana to use your location. Without it we do not search, so we never show hospitals that are far from you. You can also search by state on the national portal."
          action={
            <View style={styles.emptyActions}>
              <Button
                title="Allow location"
                label="Allow location"
                onPress={handleAllowLocation}
              />
              <Button
                title="Open hospitals.pmjay.gov.in"
                variant="secondary"
                label="Open National PM-JAY Hospital Search portal"
                onPress={handleOpenPmjayPortal}
              />
            </View>
          }
        />
      )}

      {locationState === 'ready' && !isLoading && hospitals.length === 0 && (
        <EmptyState
          ios="building.columns.fill"
          android="local_hospital"
          title="No official list found nearby"
          body="Official government pages did not return empanelled hospitals for this immediate GPS radius. Search state-wise on the national portal."
          action={
            <Button
              title="Open hospitals.pmjay.gov.in"
              variant="secondary"
              label="Open National PM-JAY Hospital Search portal"
              onPress={handleOpenPmjayPortal}
            />
          }
        />
      )}

      {hospitals.map((h, idx) => (
        <Card key={`${h.name}-${idx}`}>
          <View style={styles.hospitalTop}>
            <View style={styles.hospitalTitles}>
              <Text variant="headline">{h.name}</Text>
              {h.address && (
                <Text variant="footnote" tone="secondary">
                  {h.address}
                </Text>
              )}
            </View>
            <Pill text="PM-JAY empanelled" tone="accent" />
          </View>

          {h.specialities && h.specialities.length > 0 && (
            <View style={styles.specRow}>
              {h.specialities.map((spec, sIdx) => (
                <View key={sIdx} style={styles.specChip}>
                  <Text variant="caption" tone="secondary">
                    {spec}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.sourceRow}>
            <Text variant="caption" tone="tertiary">
              Government source
            </Text>
            <Button
              title={
                h.source_url
                  ? 'View government page'
                  : 'pmjay.gov.in portal'
              }
              variant="plain"
              size="sm"
              icon={
                <Symbol
                  ios="arrow.up.right"
                  android="open_in_new"
                  size={14}
                  color={T.color.accentStrong}
                />
              }
              label={`Open source URL for ${h.name}`}
              onPress={() => handleOpenSource(h.source_url, h.name)}
            />
          </View>
        </Card>
      ))}

      {/* Direct National Portal Button */}
      <Card>
        <CardHeader title="National PM-JAY helpdesk" />
        <Text variant="footnote" tone="secondary">
          Toll-free helpline: 14555. Check scheme eligibility, claim status, or
          find nationwide empanelled hospitals.
        </Text>
        <Button
          title="Visit national portal (pmjay.gov.in)"
          variant="secondary"
          label="Visit National PM-JAY Portal"
          onPress={handleOpenPmjayPortal}
          style={styles.portalBtn}
        />
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneBtn: { minHeight: 44, justifyContent: 'center' },
  strong: { fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.space.md,
  },
  statusText: { flex: 1, gap: T.space.xs },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.sm,
    paddingVertical: T.space.sm,
  },
  emptyActions: { gap: T.space.sm, alignItems: 'stretch' },
  hospitalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.space.sm,
  },
  hospitalTitles: { flex: 1, gap: T.space.xs },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.xs },
  specChip: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.sm,
    paddingVertical: T.space.xs,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: T.space.sm,
  },
  portalBtn: { alignSelf: 'flex-start' },
});
