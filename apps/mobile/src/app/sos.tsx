import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
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
import { MobileDisclaimerFooter } from '@/components/ui-primitives';

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
          nearbyMutation.mutate(c);
        }
      } catch {
        if (!ignore) {
          setLocationError('Could not acquire GPS fix in time.');
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
  }, [nearbyMutation]);

  const triggerSosCall = useCallback(async () => {
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
        showToast('Emergency SOS dispatched', 'success');
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

  // 3-second automatic countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            void triggerSosCall();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, triggerSosCall]);

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
  const etaMinutes =
    emergencyRequest?.eta_minutes ?? sosMutation.data?.eta_minutes ?? 11;
  const hospitals =
    sosMutation.data?.hospitals ?? nearbyMutation.data?.hospitals ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header & Dismiss */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Emergency SOS</Text>
          <Text style={styles.headerSub}>Immediate Ambulance & Safety Alert</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close SOS Screen"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </Pressable>
      </View>

      {/* Real-time GPS Location Status */}
      {locationError ? (
        <View style={styles.locationNoticeBox}>
          <Text style={styles.locationNoticeText}>
            ⚠️ {locationError} Emergency call dials 108 without GPS coordinates.
          </Text>
        </View>
      ) : coords ? (
        <View style={styles.locationSuccessBox}>
          <Text style={styles.locationSuccessText}>
            📍 Live GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </Text>
        </View>
      ) : locationLoading ? (
        <View style={styles.locationLoadingBox}>
          <ActivityIndicator size="small" color="#0D9488" />
          <Text style={styles.locationLoadingText}>Acquiring real-time GPS location…</Text>
        </View>
      ) : null}

      {/* Countdown Card or Active SOS Card */}
      {countdown !== null && countdown > 0 ? (
        <View style={styles.countdownCard}>
          <Text style={styles.countdownBadge}>CALLING 108 IN</Text>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownSub}>
            Auto-dialing 108 ambulance in {countdown} seconds…
          </Text>
          <View style={styles.countdownActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call 108 Ambulance immediately"
              onPress={triggerSosCall}
              style={styles.callNowBtn}
            >
              <Text style={styles.callNowBtnText}>Call 108 Now</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel emergency countdown"
              onPress={handleCancelCountdown}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel Countdown</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.sosCard}>
          <View style={styles.sosButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dial 108 Ambulance"
              onPress={() => Linking.openURL(`tel:${EMERGENCY.ambulance}`)}
              style={styles.dialBtn108}
            >
              <Text style={styles.dialBtnNumber}>108</Text>
              <Text style={styles.dialBtnLabel}>Call Ambulance</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dial 112 National Emergency"
              onPress={() => Linking.openURL(`tel:${EMERGENCY.all}`)}
              style={styles.dialBtn112}
            >
              <Text style={styles.dialBtnNumber}>112</Text>
              <Text style={styles.dialBtnLabel}>All Emergency</Text>
            </Pressable>
          </View>

          {/* Simulated Ambulance Dispatch Status */}
          {sosActive && (
            <View style={styles.liveDispatchBox}>
              <View style={styles.dispatchHeader}>
                <View style={styles.livePulse} />
                <Text style={styles.dispatchTitle}>Ambulance Dispatch Status</Text>
                <Text style={styles.simulatedTag}>SIMULATED</Text>
              </View>
              <Text style={styles.dispatchStatusText}>
                Status: <Text style={styles.statusHighlight}>{activeStatus.toUpperCase()}</Text>
              </Text>
              <Text style={styles.dispatchEtaText}>
                Estimated Arrival: ~{etaMinutes} minutes
              </Text>
              <Text style={styles.dispatchNote}>
                * Labelled simulated ambulance tracking for demonstration purposes.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Blinkit Ambulance Button */}
      <View style={styles.blinkitCard}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.blinkitBadge}>RAPID DISPATCH PARTNER</Text>
          <Text style={styles.blinkitTitle}>Blinkit Ambulance</Text>
          <Text style={styles.blinkitNote}>{BLINKIT.note}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Blinkit app for ambulance"
          onPress={handleOpenBlinkit}
          style={styles.blinkitBtn}
        >
          <Text style={styles.blinkitBtnText}>Open Blinkit ↗</Text>
        </Pressable>
      </View>

      {/* Emergency Medical ID Quick Access */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show Emergency Medical ID QR Code"
        onPress={() => router.push('/medical-id')}
        style={styles.medicalIdBanner}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.medicalIdTitle}>Show Emergency Medical ID</Text>
          <Text style={styles.medicalIdSub}>
            Offline QR code with blood group, allergies, conditions & contact for first responders
          </Text>
        </View>
        <Text style={styles.bannerArrow}>Show QR →</Text>
      </Pressable>

      {/* Send GPS SMS to Emergency Contacts */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Emergency Contacts & GPS SMS</Text>
        <Text style={styles.sectionSub}>
          Send your live GPS coordinates with Google Maps link directly via SMS
        </Text>

        {contacts.length === 0 ? (
          <Text style={styles.emptyText}>
            No emergency contacts saved. Add family contacts in your Profile tab.
          </Text>
        ) : (
          contacts.map((c) => (
            <View key={c.id} style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>
                  {c.name} ({c.relation})
                </Text>
                <Text style={styles.contactPhone}>{c.phone}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Send emergency SMS to ${c.name}`}
                onPress={() => handleSendLocationSms(c.phone, c.name)}
                style={styles.smsBtn}
              >
                <Text style={styles.smsBtnText}>Send GPS SMS</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Nearby Emergency Hospitals */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Emergency Hospitals</Text>
          {nearbyMutation.isPending && <ActivityIndicator size="small" color="#0D9488" />}
        </View>
        <Text style={styles.sectionSub}>
          Hospitals with 24/7 Emergency & Trauma Care near your coordinates
        </Text>

        {hospitals.length === 0 ? (
          <Text style={styles.emptyText}>Finding nearby emergency hospitals…</Text>
        ) : (
          hospitals.map((h, idx) => (
            <View key={`${h.name}-${idx}`} style={styles.hospitalCard}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.hospitalName}>{h.name}</Text>
                <Text style={styles.hospitalAddress}>
                  {h.address || 'Emergency 24/7'}
                </Text>
                {h.has_emergency && (
                  <Text style={styles.hospitalDistance}>
                    Emergency Department Open
                  </Text>
                )}
              </View>
              <View style={styles.hospitalActions}>
                {h.phone && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${h.name} emergency desk`}
                    onPress={() => handleCallHospital(h.phone as string)}
                    style={styles.callHospBtn}
                  >
                    <Text style={styles.callHospBtnText}>Call</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Get directions to ${h.name}`}
                  onPress={() => Linking.openURL(h.maps_url)}
                  style={styles.dirBtn}
                >
                  <Text style={styles.dirBtnText}>Directions</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF5F5' },
  content: { padding: 16, gap: 14 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#991B1B' },
  headerSub: { fontSize: 13, color: '#7F1D1D' },
  closeBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
  locationNoticeBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  locationNoticeText: { color: '#991B1B', fontSize: 13, fontWeight: '600' },
  locationSuccessBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  locationSuccessText: { color: '#166534', fontSize: 13, fontWeight: '700' },
  locationLoadingBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationLoadingText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  countdownCard: {
    backgroundColor: '#DC2626',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  countdownBadge: { color: '#FEE2E2', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  countdownNumber: { fontSize: 72, fontWeight: '900', color: '#FFFFFF', lineHeight: 80 },
  countdownSub: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  countdownActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  callNowBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  callNowBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sosCard: { gap: 12 },
  sosButtonsRow: { flexDirection: 'row', gap: 12 },
  dialBtn108: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  dialBtn112: {
    flex: 1,
    backgroundColor: '#B91C1C',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  dialBtnNumber: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  dialBtnLabel: { color: '#FEE2E2', fontSize: 13, fontWeight: '700' },
  liveDispatchBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  livePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  dispatchTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 },
  simulatedTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dispatchStatusText: { fontSize: 13, color: '#334155' },
  statusHighlight: { fontWeight: '800', color: '#DC2626' },
  dispatchEtaText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  dispatchNote: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },
  blinkitCard: {
    backgroundColor: '#FEF08A',
    borderColor: '#FACC15',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blinkitBadge: { fontSize: 10, fontWeight: '800', color: '#854D0E', letterSpacing: 1 },
  blinkitTitle: { fontSize: 15, fontWeight: '800', color: '#713F12' },
  blinkitNote: { fontSize: 12, color: '#854D0E', lineHeight: 16 },
  blinkitBtn: {
    backgroundColor: '#713F12',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  blinkitBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  medicalIdBanner: {
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  medicalIdTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  medicalIdSub: { fontSize: 12, color: '#CCFBF1', lineHeight: 16 },
  bannerArrow: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  emptyText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  contactName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  contactPhone: { fontSize: 12, color: '#64748B' },
  smsBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  smsBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  hospitalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  hospitalName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  hospitalAddress: { fontSize: 12, color: '#64748B' },
  hospitalDistance: { fontSize: 11, fontWeight: '600', color: '#0D9488' },
  hospitalActions: { flexDirection: 'row', gap: 6 },
  callHospBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  callHospBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dirBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  dirBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '600' },
});
