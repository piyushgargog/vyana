import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DEVICE_METRIC_LABELS,
  relativeTime,
  useConnectDevice,
  useDisconnectDevice,
  useMockDeviceConnections,
  usePauseDevice,
  useResumeDevice,
  useSyncHealth,
  type DevicePlatform,
} from '@vyana/shared';
import { DeviceExplainer } from '@/components/device-explainer';
import { Button, Card, CardHeader, ErrorState, Pill, Screen, Sheet, Text } from '@/components/ui';
import { MobileSkeletonCard } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

const STORE_NAMES: Record<DevicePlatform, string> = {
  health_connect: 'Health Connect',
  apple_health: 'Apple Health',
};

const HEALTH_CONNECT_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

const STATUS_LABELS = {
  connected: 'Connected',
  paused: 'Paused',
  not_connected: 'Not connected',
} as const;

/**
 * Connected devices (#327, ADR-073): the phone's own health store, phone first.
 * Aggregates only; every state has a screen — loading, error, not installed,
 * consent off, denied, not connected, connected, paused, syncing, sync failed.
 */
export default function ConnectedDevicesScreen() {
  const router = useRouter();
  const platform: DevicePlatform | null =
    Platform.OS === 'android' ? 'health_connect' : Platform.OS === 'ios' ? 'apple_health' : null;

  const { data, isLoading, isError, refetch } = useMockDeviceConnections();
  const connectMutation = useConnectDevice();
  const pauseMutation = usePauseDevice();
  const resumeMutation = useResumeDevice();
  const syncMutation = useSyncHealth();
  const deleteMutation = useDisconnectDevice();

  const [explainerOpen, setExplainerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [denied, setDenied] = useState(false);

  if (!platform) {
    // No health store on this platform: the row is hidden, the screen says why.
    return (
      <Screen eyebrow="Profile" title="Connected devices">
        <Card>
          <Text variant="subhead" tone="secondary">
            This phone has no health store that Vyana can read.
          </Text>
        </Card>
      </Screen>
    );
  }

  const connection = data?.connections.find((c) => c.platform === platform);
  const consentGranted = data?.consent_granted ?? false;
  const storeName = STORE_NAMES[platform];

  const handleContinueFromExplainer = () => {
    setExplainerOpen(false);
    setDenied(false);
    connectMutation.mutate(platform, { onError: () => setDenied(true) });
  };

  return (
    <Screen eyebrow="Profile" title="Connected devices">
      {isLoading ? (
        <MobileSkeletonCard lines={4} />
      ) : isError || !connection ? (
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      ) : !connection.available ? (
        <Card>
          <CardHeader title={storeName} />
          <Text variant="subhead" tone="secondary">
            {platform === 'health_connect'
              ? 'Health Connect is not on this phone yet. It comes with Android 14 and later; on an older phone you can add it from the Play Store.'
              : 'Apple Health is not available on this phone.'}
          </Text>
          {platform === 'health_connect' && (
            <Button
              title="Get Health Connect"
              label="Open the Health Connect page in the Play Store"
              variant="secondary"
              onPress={() => Linking.openURL(HEALTH_CONNECT_STORE_URL).catch(() => undefined)}
            />
          )}
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.statusRow}>
              <CardHeader title={storeName} />
              <Pill
                text={STATUS_LABELS[connection.status]}
                tone={connection.status === 'connected' ? 'ok' : connection.status === 'paused' ? 'warn' : 'neutral'}
              />
            </View>

            {connection.status !== 'not_connected' && connection.last_synced_at && (
              <Text variant="footnote" tone="secondary">
                Last synced {relativeTime(connection.last_synced_at)}
              </Text>
            )}
            {connection.last_sync_failed && connection.status === 'connected' && (
              <Text variant="footnote" tone="secondary" accessibilityRole="alert">
                The last sync did not finish. Check that {storeName} is allowed to share with
                Vyana, then tap Sync now.
              </Text>
            )}
            {syncMutation.isPending && (
              <View style={styles.syncingRow}>
                <ActivityIndicator size="small" color={T.color.accent} />
                <Text variant="footnote" tone="secondary">
                  Syncing now…
                </Text>
              </View>
            )}

            <Text variant="footnote" tone="tertiary" style={styles.metricsLabel}>
              What Vyana reads
            </Text>
            <View style={styles.chips}>
              {connection.metrics.map((metric) => (
                <View key={metric} style={styles.chip}>
                  <Text variant="footnote" tone="secondary">
                    {DEVICE_METRIC_LABELS[metric]}
                  </Text>
                </View>
              ))}
            </View>

            {denied && (
              <View accessibilityRole="alert" style={styles.deniedBox}>
                <Text variant="subhead" tone="secondary">
                  Vyana was not given permission to read {storeName}. You can allow it in
                  Settings.
                </Text>
                <Button
                  title="Open settings"
                  label="Open phone settings"
                  variant="secondary"
                  onPress={() => Linking.openSettings().catch(() => undefined)}
                />
              </View>
            )}

            {!consentGranted && connection.status === 'not_connected' ? (
              <View style={styles.actions}>
                <Text variant="subhead" tone="secondary">
                  The “Device health data” consent is off, so this phone cannot connect yet.
                </Text>
                <Button
                  title="Open the consent screen"
                  label="Open the consent screen to turn on device health data"
                  onPress={() => router.push('/consent')}
                />
              </View>
            ) : connection.status === 'not_connected' ? (
              <View style={styles.actions}>
                <Button
                  title="Connect"
                  label={`Connect ${storeName}`}
                  loading={connectMutation.isPending}
                  onPress={() => setExplainerOpen(true)}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                {connection.status === 'connected' ? (
                  <>
                    <Button
                      title="Sync now"
                      label="Sync device readings now"
                      variant="secondary"
                      loading={syncMutation.isPending}
                      onPress={() => syncMutation.mutate(platform)}
                    />
                    <Button
                      title="Pause"
                      label="Pause device syncing"
                      variant="plain"
                      loading={pauseMutation.isPending}
                      onPress={() => pauseMutation.mutate(platform)}
                    />
                  </>
                ) : (
                  <Button
                    title="Resume"
                    label="Resume device syncing"
                    loading={resumeMutation.isPending}
                    onPress={() => resumeMutation.mutate(platform)}
                  />
                )}
                <Button
                  title="Disconnect this device"
                  label="Disconnect this device"
                  variant="destructive"
                  onPress={() => setDeleteOpen(true)}
                />
              </View>
            )}
          </Card>
        </>
      )}

      {/* The explainer always comes before the system permission dialog. */}
      <Sheet visible={explainerOpen} onClose={() => setExplainerOpen(false)} title="Before you connect">
        <DeviceExplainer />
        <Button title="Continue" label="Continue to the permission request" onPress={handleContinueFromExplainer} />
      </Sheet>

      {/* Confirmation: disconnecting stops syncing; it does not delete stored readings. */}
      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Disconnect this device?">
        <Text variant="subhead" tone="secondary">
          Vyana stops syncing from this device and removes the connection. Readings that were
          already synced are not deleted by this.
        </Text>
        <Text variant="subhead" tone="secondary">
          What you typed in yourself is not touched. You can connect again at any time.
        </Text>
        <Button
          title="Disconnect this device"
          label="Confirm: disconnect this device"
          variant="destructive"
          loading={deleteMutation.isPending}
          onPress={() =>
            deleteMutation.mutate(platform, { onSuccess: () => setDeleteOpen(false) })
          }
        />
        <Button title="Stay connected" label="Stay connected" variant="plain" onPress={() => setDeleteOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: T.space.md },
  metricsLabel: { marginTop: T.space.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  chip: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.pill,
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.xs,
  },
  syncingRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  deniedBox: { gap: T.space.md, backgroundColor: T.color.fill, borderRadius: T.radius.row, padding: T.space.md },
  actions: { gap: T.space.sm, marginTop: T.space.sm },
});
