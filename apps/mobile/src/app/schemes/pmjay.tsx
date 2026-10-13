import React, { useEffect, useState } from 'react';
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
import { usePmjayHospitals } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

const PMJAY_PORTAL_URL = 'https://hospitals.pmjay.gov.in';

export default function PmjayHospitalsScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  const pmjayMutation = usePmjayHospitals();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (mounted) {
            const c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
            setCoords(c);
            pmjayMutation.mutate(c);
          }
        } else {
          // Default to central Delhi coordinates if permission denied
          const fallback = { lat: 28.6139, lng: 77.209 };
          if (mounted) {
            setCoords(fallback);
            pmjayMutation.mutate(fallback);
          }
        }
      } catch {
        const fallback = { lat: 28.6139, lng: 77.209 };
        if (mounted) {
          setCoords(fallback);
          pmjayMutation.mutate(fallback);
        }
      } finally {
        if (mounted) setLocLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [pmjayMutation]);

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
    if (coords) {
      pmjayMutation.mutate(coords);
    }
  };

  const hospitals = pmjayMutation.data?.hospitals ?? [];
  const area = pmjayMutation.data?.area;
  const isLoading = locLoading || pmjayMutation.isPending;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>PM-JAY Empanelled Hospitals</Text>
          <Text style={styles.sub}>
            Ayushman Bharat Pradhan Mantri Jan Arogya Yojana empanelled healthcare providers
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </Pressable>
      </View>

      <MobileAiSafetyBanner />

      {/* Official Government Verification Banner */}
      <View style={styles.officialNoticeCard}>
        <Text style={styles.officialBadge}>GOVERNMENT SOURCE GUARANTEE (ADR-048)</Text>
        <Text style={styles.officialTitle}>Official Portal Listings Only</Text>
        <Text style={styles.officialText}>
          Hospital empanelment records are fetched strictly from verified government pages
          (pmjay.gov.in / National Health Authority). Third-party commercial directories are never
          used.
        </Text>
      </View>

      {/* Location / Status Bar */}
      <View style={styles.statusBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusAreaLabel}>Search Location:</Text>
          <Text style={styles.statusAreaValue}>
            {area ? `${area}` : coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : 'Detecting GPS…'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh empanelled hospitals"
          disabled={isLoading}
          onPress={handleRefresh}
          style={[styles.refreshBtn, isLoading && styles.btnDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          )}
        </Pressable>
      </View>

      {/* Hospital List */}
      <View style={styles.listSection}>
        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0D9488" />
            <Text style={styles.loadingText}>Fetching government empanelled list…</Text>
          </View>
        )}

        {!isLoading && hospitals.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyTitle}>No official list found nearby</Text>
            <Text style={styles.emptySub}>
              Official government pages did not return empanelled hospitals for this immediate GPS
              radius. Search state-wise on the national portal:
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open National PM-JAY Hospital Search portal"
              onPress={handleOpenPmjayPortal}
              style={styles.portalBtn}
            >
              <Text style={styles.portalBtnText}>Open hospitals.pmjay.gov.in ↗</Text>
            </Pressable>
          </View>
        )}

        {hospitals.map((h, idx) => (
          <View key={`${h.name}-${idx}`} style={styles.hospitalCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.hospitalName}>{h.name}</Text>
                {h.address && <Text style={styles.hospitalAddress}>{h.address}</Text>}
              </View>
              <View style={styles.pmjayTag}>
                <Text style={styles.pmjayTagText}>PM-JAY EMPANELLED</Text>
              </View>
            </View>

            {h.specialities && h.specialities.length > 0 && (
              <View style={styles.specialityRow}>
                {h.specialities.map((spec, sIdx) => (
                  <View key={sIdx} style={styles.specChip}>
                    <Text style={styles.specChipText}>{spec}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.sourceActionRow}>
              <Text style={styles.sourceLabel}>Verified Government Source:</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open source URL for ${h.name}`}
                onPress={() => handleOpenSource(h.source_url, h.name)}
                style={styles.sourceLinkBtn}
              >
                <Text style={styles.sourceLinkText}>
                  {h.source_url ? 'View Government Page ↗' : 'pmjay.gov.in Portal ↗'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {/* Direct National Portal Button */}
      <View style={styles.nationalPortalBox}>
        <Text style={styles.nationalPortalTitle}>National PM-JAY Helpdesk</Text>
        <Text style={styles.nationalPortalSub}>
          Toll-Free Helpline: 14555 · Check scheme eligibility, claim status, or find nationwide
          empanelled hospitals.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Visit National PM-JAY Portal"
          onPress={handleOpenPmjayPortal}
          style={styles.nationalPortalBtn}
        >
          <Text style={styles.nationalPortalBtnText}>Visit National Portal (pmjay.gov.in) ↗</Text>
        </Pressable>
      </View>

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
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  closeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  officialNoticeCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  officialBadge: { fontSize: 10, fontWeight: '800', color: '#166534', letterSpacing: 0.5 },
  officialTitle: { fontSize: 13, fontWeight: '700', color: '#14532D' },
  officialText: { fontSize: 12, color: '#166534', lineHeight: 17 },
  statusBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusAreaLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  statusAreaValue: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  refreshBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  listSection: { gap: 12 },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 20,
    justifyContent: 'center',
  },
  loadingText: { fontSize: 13, color: '#64748B' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  portalBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  portalBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  hospitalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  hospitalName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  hospitalAddress: { fontSize: 12, color: '#64748B' },
  pmjayTag: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pmjayTagText: { fontSize: 10, fontWeight: '800', color: '#0F766E' },
  specialityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  specChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  specChipText: { fontSize: 11, color: '#475569' },
  sourceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sourceLabel: { fontSize: 11, color: '#64748B' },
  sourceLinkBtn: { paddingVertical: 2 },
  sourceLinkText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  nationalPortalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  nationalPortalTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  nationalPortalSub: { fontSize: 12, color: '#475569', lineHeight: 17 },
  nationalPortalBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nationalPortalBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
});
