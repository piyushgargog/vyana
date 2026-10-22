import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  BLINKIT,
  EMERGENCY,
  useEmergencyContacts,
  useEmergencyRequest,
  useNearbyHospitals,
  useSos,
  type EmergencySosRes,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  IconTile,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter } from '@/components/ui-primitives';
import { PMJAY_PORTAL_URL } from '@/constants/pmjay';
import { T } from '@/constants/theme';

export default function MobileSosScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const [countdown, setCountdown] = useState<number | null>(3);
  const [sosActive, setSosActive] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const sosMutation = useSos();
  const nearbyMutation = useNearbyHospitals();
  const { mutate: findNearby } = nearbyMutation;
  const { data: contacts = [] } = useEmergencyContacts();
  const { data: emergencyRequest } = useEmergencyRequest(
    requestId ?? undefined
  );

  // Request real device coordinates using expo-location
  useEffect(() => {
    let ignore = false;
    async function fetchLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (ignore) return;
        if (status !== 'granted') {
          setLocationError('Location permission denied. Real-time GPS unavailable.');
          setLocationLoading(false);
          return;
        }
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Location timeout')), 6000)
          ),
        ]);
        if (ignore) return;
        if (pos && 'coords' in pos) {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          findNearby(c);
        }
      } catch {
        if (!ignore) {
          // No fix: nothing is searched around a place the user is not at.
          setLocationError('Could not get your location in time.');
        }
      } finally {
        if (!ignore) {
          setLocationLoading(false);
        }
      }
    }
    void fetchLocation();
    return () => {
      ignore = true;
    };
  }, [findNearby]);

  const triggerSosCall = useCallback(async () => {
    // The warning haptic (U2): an SOS starting should feel different from any ordinary tap.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setSosActive(true);
    // Dial 108 directly
    Linking.openURL(`tel:${EMERGENCY.ambulance}`).catch(() => {
      showToast('Could not open phone dialer', 'error');
    });

    if (coords) {
      try {
        const res: EmergencySosRes = await sosMutation.mutateAsync({
          lat: coords.lat,
          lng: coords.lng,
          note: 'Emergency SOS triggered from mobile app',
        });
        setRequestId(res.request_id);
        showToast('SOS request saved. Call 108 now.', 'success');
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Could not reach SOS dispatch',
          'error'
        );
      }
    } else {
      showToast('Ambulance 108 dialed. Note: GPS coordinates unavailable', 'warning');
    }
  }, [sosMutation, coords, showToast]);

  // A short, informational countdown while the screen gets ready. It NEVER dials: a call only ever starts when the
  // user presses a call button (a phone must not call 108 by itself, for example after an accidental tap).
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev === null || prev <= 1 ? null : prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleCancelCountdown = () => {
    setCountdown(null);
    showToast('Emergency countdown cancelled', 'info');
  };

  const handleSendLocationSms = (phone: string, contactName: string) => {
    const smsText =
      sosMutation.data?.sms_body ??
      (coords
        ? `EMERGENCY: I need urgent medical assistance. My live location: https://maps.google.com/?q=${coords.lat},${coords.lng}. Sent from Vyana.`
        : `EMERGENCY: I need urgent medical assistance. Real GPS coordinates unavailable. Please call me or 108 immediately. Sent from Vyana.`);
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(smsText)}`;
    Linking.openURL(smsUrl).catch(() => {
      showToast(`Could not send SMS to ${contactName}`, 'error');
    });
  };

  const handleOpenBlinkit = () => {
    Linking.openURL(BLINKIT.url).catch(() => {
      showToast('Could not open Blinkit', 'error');
    });
  };

  const handleCallHospital = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showToast('Could not place call', 'error');
    });
  };

  const activeStatus =
    emergencyRequest?.status ?? sosMutation.data?.status ?? 'requested';
  const hospitals =
    sosMutation.data?.hospitals ?? nearbyMutation.data?.hospitals ?? [];

  return (
    <Screen
      eyebrow="Emergency help"
      title="Emergency SOS"
      trailing={
        <Button
          title="Close"
          variant="secondary"
          size="sm"
          label="Close SOS Screen"
          onPress={() => router.back()}
        />
      }
    >
      {/* Real-time GPS Location Status */}
      {locationError ? (
        <Card style={styles.noticeWarn}>
          <View style={styles.noticeRow}>
            <Symbol
              ios="exclamationmark.triangle.fill"
              android="warning"
              size={18}
              color={T.color.warn}
            />
            <Text variant="subhead" tone="warn" style={styles.noticeText}>
              {locationError} Emergency call dials 108 without GPS
              coordinates.
            </Text>
          </View>
        </Card>
      ) : coords ? (
        <Card style={styles.noticeOk}>
          <View style={styles.noticeRow}>
            <Symbol
              ios="location.fill"
              android="location_on"
              size={18}
              color={T.color.ok}
            />
            <Text variant="subhead" tone="ok" style={styles.noticeText}>
              Live GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>
          </View>
        </Card>
      ) : locationLoading ? (
        <Card>
          <View style={styles.noticeRow}>
            <ActivityIndicator size="small" color={T.color.accent} />
            <Text variant="subhead" tone="secondary">
              Acquiring real-time GPS location…
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Countdown Card or Active SOS Card */}
      {countdown !== null && countdown > 0 ? (
        <Card style={styles.countdownCard}>
          <View style={styles.countdownPill}>
            <Text variant="footnote" tone="white" style={styles.bold}>
              EMERGENCY HELP
            </Text>
          </View>
          <Text variant="largeTitle" tone="white" style={styles.countdownNumber}>
            {countdown}
          </Text>
          <Text variant="subhead" tone="white" style={styles.center}>
            Nothing is called until you tap a button. Tap “Call 108 now” for
            an ambulance.
          </Text>
          <View style={styles.countdownActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call 108 Ambulance immediately"
              onPress={triggerSosCall}
              style={styles.callNowBtn}
            >
              <Text variant="headline" tone="danger">
                Call 108 Now
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss and show all emergency options"
              onPress={handleCancelCountdown}
              style={styles.cancelBtn}
            >
              <Text variant="headline" tone="white">
                Cancel
              </Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <View style={styles.stack}>
          <View style={styles.sosButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dial 108 Ambulance"
              onPress={() =>
                Linking.openURL(`tel:${EMERGENCY.ambulance}`).catch(() =>
                  showToast('Could not open the dialer. Dial 108 yourself.', 'error')
                )
              }
              style={[styles.dialBtn, styles.dialBtn108]}
            >
              <Text variant="largeTitle" tone="white" style={styles.dialNumber}>
                108
              </Text>
              <Text variant="subhead" tone="white">
                Call Ambulance
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dial 112 National Emergency"
              onPress={() =>
                Linking.openURL(`tel:${EMERGENCY.all}`).catch(() =>
                  showToast('Could not open the dialer. Dial 112 yourself.', 'error')
                )
              }
              style={[styles.dialBtn, styles.dialBtn112]}
            >
              <Text variant="largeTitle" tone="white" style={styles.dialNumber}>
                112
              </Text>
              <Text variant="subhead" tone="white">
                All Emergency
              </Text>
            </Pressable>
          </View>

          {/* Simulated Ambulance Dispatch Status */}
          {sosActive && (
            <Card style={styles.dispatchCard}>
              <View style={styles.dispatchHeader}>
                <View style={styles.livePulse} />
                <Text variant="headline" style={styles.dispatchTitle}>
                  Your SOS request
                </Text>
                <Pill text="SIMULATED" tone="neutral" />
              </View>
              <Text variant="subhead" tone="secondary">
                Status:{' '}
                <Text variant="subhead" tone="danger" style={styles.bold}>
                  {activeStatus.toUpperCase()}
                </Text>
              </Text>
              <Text variant="headline">No ambulance is sent by this app. Call 108 now.</Text>
              <Text variant="footnote" tone="tertiary" style={styles.italic}>
                * The status above is a demonstration. Vyana saves your request and shows nearby hospitals; it does not
                send or track an ambulance.
              </Text>
            </Card>
          )}
        </View>
      )}

      {/* Blinkit Ambulance Button */}
      <Card>
        <View style={styles.blinkitRow}>
          <IconTile ios="bolt.fill" android="bolt" color="orange" />
          <View style={styles.blinkitText}>
            <Pill text="ALSO AVAILABLE, NOT RUN BY VYANA" tone="neutral" />
            <Text variant="headline">Blinkit Ambulance</Text>
            <Text variant="footnote" tone="secondary">
              {BLINKIT.note}
            </Text>
          </View>
        </View>
        <Button
          title="Open Blinkit"
          variant="secondary"
          size="sm"
          style={styles.smallBtn}
          label="Open Blinkit app for ambulance"
          icon={
            <Symbol
              ios="arrow.up.right"
              android="open_in_new"
              size={16}
              color={T.color.accentStrong}
            />
          }
          onPress={handleOpenBlinkit}
        />
      </Card>

      {/* Emergency Medical ID Quick Access */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show Emergency Medical ID QR Code"
        onPress={() => router.push('/medical-id')}
        style={styles.medicalIdCard}
      >
        <IconTile ios="qrcode" android="qr_code" color="accent" />
        <View style={styles.medicalIdText}>
          <Text variant="headline" tone="white">
            Show Emergency Medical ID
          </Text>
          <Text variant="footnote" tone="white" style={styles.mutedWhite}>
            Offline QR code with blood group, allergies, conditions & contact
            for first responders
          </Text>
        </View>
        <Symbol
          ios="chevron.right"
          android="chevron_right"
          size={18}
          color={T.color.white}
        />
      </Pressable>

      {/* Find blood (RapidBlood, issue #236): bank search + request tracker */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Find blood banks and track a blood request"
        onPress={() => router.push('/blood')}
        style={styles.bloodCard}
      >
        <IconTile ios="drop.fill" android="water_drop" color="red" />
        <View style={styles.medicalIdText}>
          <Text variant="headline">Find blood</Text>
          <Text variant="footnote" tone="secondary">
            Blood banks that list stock for your group, and a tracker for the
            request
          </Text>
        </View>
        <Symbol
          ios="chevron.right"
          android="chevron_right"
          size={18}
          color={T.color.label3}
        />
      </Pressable>

      {/* Send GPS SMS to Emergency Contacts */}
      <ListGroup
        header="Emergency Contacts & GPS SMS"
        footer="Send your live GPS coordinates with Google Maps link directly via SMS"
      >
        {contacts.length === 0 ? (
          <ListRow
            icon={<IconTile ios="person.fill" android="person" color="gray" />}
            title="No emergency contacts saved"
            subtitle="Add family contacts in your Profile tab"
          />
        ) : (
          contacts.map((c) => (
            <ListRow
              key={c.id}
              icon={<IconTile ios="person.fill" android="person" color="blue" />}
              title={`${c.name} (${c.relation})`}
              subtitle={c.phone}
              trailing={
                <Button
                  title="Send GPS SMS"
                  variant="secondary"
                  size="sm"
                  style={styles.smsBtn}
                  label={`Send emergency SMS to ${c.name}`}
                  onPress={() => handleSendLocationSms(c.phone, c.name)}
                />
              }
            />
          ))
        )}
      </ListGroup>

      {/* Nearby Emergency Hospitals */}
      <Card>
        <CardHeader title="Nearby Emergency Hospitals" />
        <Text variant="footnote" tone="tertiary">
          Hospitals with 24/7 Emergency & Trauma Care near your coordinates
        </Text>
        {nearbyMutation.isPending && (
          <ActivityIndicator size="small" color={T.color.accent} />
        )}

        {hospitals.length === 0 ? (
          <Text variant="subhead" tone="tertiary" style={styles.italic}>
            Finding nearby emergency hospitals…
          </Text>
        ) : (
          hospitals.map((h, idx) => (
            <View key={`${h.name}-${idx}`} style={styles.hospitalRow}>
              <View style={styles.hospitalText}>
                <Text variant="headline">{h.name}</Text>
                <Text variant="footnote" tone="tertiary">
                  {h.address || 'Emergency 24/7'}
                </Text>
                {h.has_emergency && (
                  <Text variant="footnote" tone="accent" style={styles.bold}>
                    Emergency Department Open
                  </Text>
                )}
              </View>
              <View style={styles.hospitalActions}>
                {h.phone && (
                  <Button
                    title="Call"
                    variant="secondary"
                    size="sm"
                    style={styles.actionBtn}
                    label={`Call ${h.name} emergency desk`}
                    onPress={() => handleCallHospital(h.phone as string)}
                  />
                )}
                <Button
                  title="Directions"
                  variant="secondary"
                  size="sm"
                  style={styles.actionBtn}
                  label={`Get directions to ${h.name}`}
                  onPress={() => Linking.openURL(h.maps_url)}
                />
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Ayushman Bharat (PM-JAY): a link to the official portal, nothing read by the app */}
      <Card>
        <CardHeader title="Ayushman Bharat (PM-JAY)" />
        <Text variant="footnote" tone="tertiary">
          Eligibility and the list of empanelled hospitals are checked on the
          official portal. Open it to look it up yourself.
        </Text>
        <Button
          title="Open hospitals.pmjay.gov.in"
          variant="secondary"
          size="sm"
          style={styles.smallBtn}
          label="Open the official PM-JAY hospital search portal"
          onPress={() =>
            Linking.openURL(PMJAY_PORTAL_URL).catch(() => {
              showToast('Could not open the PM-JAY hospital search', 'error');
            })
          }
        />
      </Card>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: T.space.md },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  center: { textAlign: 'center' },
  mutedWhite: { opacity: 0.85 },
  noticeWarn: { backgroundColor: T.color.warnSoft },
  noticeOk: { backgroundColor: T.color.okSoft },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  noticeText: { flex: 1, fontWeight: '600' },
  countdownCard: {
    backgroundColor: T.color.danger,
    alignItems: 'center',
    ...T.shadow.float,
  },
  countdownPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.xs,
  },
  countdownNumber: { fontSize: 72, lineHeight: 80, textAlign: 'center' },
  countdownActions: { flexDirection: 'row', gap: T.space.md, marginTop: T.space.sm },
  callNowBtn: {
    backgroundColor: T.color.white,
    minHeight: 48,
    paddingHorizontal: T.space.xl,
    justifyContent: 'center',
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
  },
  cancelBtn: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    minHeight: 48,
    paddingHorizontal: T.space.lg,
    justifyContent: 'center',
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
  },
  sosButtonsRow: { flexDirection: 'row', gap: T.space.md },
  dialBtn: {
    flex: 1,
    minHeight: 96,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.xs,
    ...T.shadow.float,
  },
  dialBtn108: { backgroundColor: T.color.danger },
  dialBtn112: { backgroundColor: T.color.dangerText },
  dialNumber: { fontSize: 34, lineHeight: 40 },
  dispatchCard: { borderWidth: 1, borderColor: T.color.dangerSoft },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  livePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.color.danger,
  },
  dispatchTitle: { flex: 1 },
  blinkitRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.md },
  blinkitText: { flex: 1, gap: T.space.xs, alignItems: 'flex-start' },
  medicalIdCard: {
    backgroundColor: T.color.accent,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    padding: T.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.md,
    ...T.shadow.accent,
  },
  medicalIdText: { flex: 1, gap: 2 },
  bloodCard: {
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    padding: T.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.md,
  },
  smsBtn: { minHeight: 44 },
  actionBtn: { minHeight: 44 },
  smallBtn: { minHeight: 44 },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
    paddingVertical: T.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.color.separator,
  },
  hospitalText: { flex: 1, gap: 2 },
  hospitalActions: { flexDirection: 'row', gap: T.space.sm },
});
