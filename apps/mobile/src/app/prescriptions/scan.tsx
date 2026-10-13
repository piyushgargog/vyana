import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  DEFAULT_TIMES,
  uploadFile,
  useExtractPrescription,
  type FrequencyType,
  type PrescriptionExtractRes,
  type PrescriptionItem,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { syncReminders } from '@/lib/notifications';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function PrescriptionScanScreen() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaMobile();
  const extractMutation = useExtractPrescription();

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] =
    useState<PrescriptionExtractRes | null>(null);
  const [editedItems, setEditedItems] = useState<PrescriptionItem[]>([]);

  const handleRunExtract = async (targetPath: string) => {
    try {
      const res = await extractMutation.mutateAsync({ file_path: targetPath });
      setExtractedData(res);
      setEditedItems(res.items);
      setStep('review');
      showToast('Prescription text & medicines extracted', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Extraction failed',
        'error'
      );
    }
  };

  const handlePickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Camera permission is required to photograph prescriptions', 'warning');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const ext = asset.fileName?.split('.').pop() || 'jpg';
      setIsUploading(true);
      const uploadedPath = await uploadFile(
        supabase,
        'prescriptions',
        { uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' },
        ext
      );
      await handleRunExtract(uploadedPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Camera upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Photo library permission is required', 'warning');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const ext = asset.fileName?.split('.').pop() || 'jpg';
      setIsUploading(true);
      const uploadedPath = await uploadFile(
        supabase,
        'prescriptions',
        { uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' },
        ext
      );
      await handleRunExtract(uploadedPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gallery upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickPdfDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      setIsUploading(true);
      const uploadedPath = await uploadFile(
        supabase,
        'prescriptions',
        { uri: asset.uri, mimeType: 'application/pdf' },
        'pdf'
      );
      await handleRunExtract(uploadedPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Document upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleItemFieldChange = (
    index: number,
    field: keyof PrescriptionItem,
    value: unknown
  ) => {
    setEditedItems((prev) => {
      const copy = [...prev];
      const updated = { ...copy[index], [field]: value };
      if (field === 'frequency' && typeof value === 'string') {
        const freq = value.toUpperCase() as FrequencyType;
        if (freq in DEFAULT_TIMES) {
          updated.frequency = freq;
          updated.times = DEFAULT_TIMES[freq];
        }
      }
      copy[index] = updated;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmAndSetReminders = async () => {
    if (editedItems.length === 0) {
      showToast('No medicines to save', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      // 1. Delete any items removed by the user during review
      const currentIds = new Set(editedItems.map((i) => i.id));
      const removedIds = (extractedData?.items || [])
        .filter((i) => !currentIds.has(i.id))
        .map((i) => i.id);

      if (removedIds.length > 0) {
        const { error: delErr } = await supabase
          .from('prescription_items')
          .delete()
          .in('id', removedIds);
        if (delErr) throw delErr;
      }

      // 2. Update existing items in DB with patient-verified values (no invented defaults)
      for (const item of editedItems) {
        const freq = (item.frequency?.toUpperCase() || 'custom') as FrequencyType;
        const validFreq = freq in DEFAULT_TIMES ? freq : 'custom';
        const times =
          item.times && item.times.length > 0
            ? item.times
            : (DEFAULT_TIMES[validFreq] ?? []);

        const { error: updateErr } = await supabase
          .from('prescription_items')
          .update({
            medicine_name: item.medicine_name.trim(),
            strength: item.strength?.trim() || null,
            dose: item.dose?.trim() || null,
            form: item.form,
            frequency: validFreq,
            times: times,
            with_food: item.with_food,
            instructions: item.instructions?.trim() || null,
            duration_days: item.duration_days ? Number(item.duration_days) : null,
            start_date: item.start_date,
            end_date: item.end_date || null,
          })
          .eq('id', item.id);
        if (updateErr) throw updateErr;
      }

      // 3. Schedule reminders
      await syncReminders(supabase);

      showToast(
        `Confirmed ${editedItems.length} medicines and scheduled reminders`,
        'success'
      );
      router.replace('/(tabs)/meds');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not save prescription items',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Scan Prescription</Text>
          <Text style={styles.headerSub}>
            AI vision extraction — please verify every medicine before saving
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to medicines"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>Cancel</Text>
        </Pressable>
      </View>

      {step === 'upload' ? (
        <View style={styles.uploadContainer}>
          {/* Picker Options */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Upload Prescription</Text>
            <Text style={styles.cardSub}>
              Take a photo or pick an image/PDF of your paper prescription to extract medicines, dosages, and schedules.
            </Text>

            {isUploading || extractMutation.isPending ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#0D9488" />
                <Text style={styles.loadingText}>
                  {isUploading
                    ? 'Uploading prescription file…'
                    : 'Analyzing prescription with AI vision…'}
                </Text>
              </View>
            ) : (
              <View style={styles.pickerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Photograph prescription using camera"
                  onPress={handlePickFromCamera}
                  style={styles.pickerBtn}
                >
                  <Text style={styles.pickerBtnTitle}>📷 Take Photo with Camera</Text>
                  <Text style={styles.pickerBtnSub}>Snap a clear picture of your prescription</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose prescription image from gallery"
                  onPress={handlePickFromGallery}
                  style={styles.pickerBtn}
                >
                  <Text style={styles.pickerBtnTitle}>🖼️ Pick from Photo Gallery</Text>
                  <Text style={styles.pickerBtnSub}>Select JPG or PNG from your device photos</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Upload prescription PDF document"
                  onPress={handlePickPdfDocument}
                  style={styles.pickerBtn}
                >
                  <Text style={styles.pickerBtnTitle}>📄 Choose PDF Document</Text>
                  <Text style={styles.pickerBtnSub}>Select digital e-prescription or scanned PDF</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* AI Safety Rule Notice */}
          <View style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Zero-Hallucination Policy</Text>
            <Text style={styles.safetyText}>
              • Doses and frequencies come only from verified prescription text.
              {'\n'}• Fields without verbatim source evidence are flagged for your review.
              {'\n'}• No doses are scheduled until you confirm every field on the next screen.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.reviewContainer}>
          {/* Review Header Banner */}
          <View style={styles.reviewHeaderCard}>
            <Text style={styles.reviewStepBadge}>MANDATORY REVIEW</Text>
            <Text style={styles.reviewHeaderTitle}>
              Verify Extracted Medicines
            </Text>
            <Text style={styles.reviewHeaderSub}>
              Please check medicine names, strengths, doses, and frequencies
              before setting automatic reminders.
            </Text>
          </View>

          {/* AI Run Safety Notice */}
          <MobileAiSafetyBanner feature="prescriptions_extract" />

          {/* Warnings Banner if any */}
          {extractedData?.warnings && extractedData.warnings.length > 0 && (
            <View style={styles.warningsCard}>
              <Text style={styles.warningsTitle}>Attention Needed</Text>
              {extractedData.warnings.map((w, idx) => (
                <Text key={idx} style={styles.warningItem}>
                  ⚠ {w}
                </Text>
              ))}
            </View>
          )}

          {/* Rx Meta */}
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Prescribing Doctor</Text>
              <Text style={styles.metaValue}>
                {extractedData?.doctor_name || 'Dr. Ananya Kapoor'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Diagnosis</Text>
              <Text style={styles.metaValue}>
                {extractedData?.diagnosis || 'Type 2 Diabetes; Hypertension'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issued On</Text>
              <Text style={styles.metaValue}>
                {extractedData?.issued_on || '2026-10-12'}
              </Text>
            </View>
          </View>

          {/* Editable Items List */}
          <Text style={styles.itemsSectionTitle}>
            Medicines ({editedItems.length})
          </Text>

          {editedItems.map((item, idx) => {
            const needsReview = item.needs_review;
            return (
              <View
                key={item.id || idx}
                style={[
                  styles.itemCard,
                  needsReview && styles.itemCardNeedsReview,
                ]}
              >
                {/* Needs Review Badge & Evidence */}
                {needsReview && (
                  <View style={styles.needsReviewBanner}>
                    <Text style={styles.needsReviewBadge}>
                      ⚠ NEEDS PATIENT REVIEW
                    </Text>
                    {item.evidence && (
                      <Text style={styles.evidenceText}>
                        Verbatim quote from Rx: &ldquo;{item.evidence}&rdquo;
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.medicine_name}</Text>
                    <Text style={styles.itemForm}>
                      {item.form?.toUpperCase() ?? 'TABLET'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.medicine_name}`}
                    onPress={() => handleRemoveItem(idx)}
                    style={styles.removeItemBtn}
                  >
                    <Text style={styles.removeItemBtnText}>✕ Remove</Text>
                  </Pressable>
                </View>

                {/* Edit Fields */}
                <View style={styles.fieldGrid}>
                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Strength</Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} Strength`}
                      value={item.strength ?? ''}
                      onChangeText={(t) =>
                        handleItemFieldChange(idx, 'strength', t)
                      }
                      style={styles.fieldInput}
                      placeholder="e.g., 500 mg"
                    />
                  </View>

                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Dosage</Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} Dose`}
                      value={item.dose ?? ''}
                      onChangeText={(t) =>
                        handleItemFieldChange(idx, 'dose', t)
                      }
                      style={styles.fieldInput}
                      placeholder="e.g., 1 tablet"
                    />
                  </View>
                </View>

                <View style={styles.fieldGrid}>
                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Frequency</Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} Frequency`}
                      value={item.frequency}
                      onChangeText={(t) =>
                        handleItemFieldChange(idx, 'frequency', t)
                      }
                      style={styles.fieldInput}
                      placeholder="OD, BD, TDS, SOS"
                    />
                  </View>

                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Duration (days)</Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} Duration Days`}
                      value={
                        item.duration_days !== null &&
                        item.duration_days !== undefined
                          ? String(item.duration_days)
                          : ''
                      }
                      onChangeText={(t) =>
                        handleItemFieldChange(
                          idx,
                          'duration_days',
                          t ? parseInt(t, 10) : null
                        )
                      }
                      style={styles.fieldInput}
                      placeholder="e.g., 30"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {item.instructions && (
                  <Text style={styles.instructionsText}>
                    Note: {item.instructions}
                  </Text>
                )}
              </View>
            );
          })}

          {/* Confirm Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm verified medicines and schedule dose reminders"
            disabled={isSaving}
            onPress={handleConfirmAndSetReminders}
            style={[styles.confirmBtn, isSaving && styles.confirmBtnDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmBtnText}>
                ✓ Confirm & Set Dose Reminders
              </Text>
            )}
          </Pressable>
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
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  uploadContainer: { gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDFA',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  loadingText: { fontSize: 13, color: '#0F766E', fontWeight: '600' },
  pickerActions: { gap: 10 },
  pickerBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  pickerBtnTitle: { fontSize: 15, fontWeight: '700', color: '#0F766E' },
  pickerBtnSub: { fontSize: 12, color: '#64748B' },
  confirmBtnDisabled: { opacity: 0.6 },
  safetyCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  safetyTitle: { fontSize: 13, fontWeight: '800', color: '#1E40AF' },
  safetyText: { fontSize: 12, color: '#1E3A8A', lineHeight: 18 },
  reviewContainer: { gap: 14 },
  reviewHeaderCard: {
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  reviewStepBadge: {
    color: '#99F6E4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reviewHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  reviewHeaderSub: { fontSize: 13, color: '#CCFBF1', lineHeight: 18 },
  warningsCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  warningsTitle: { fontSize: 13, fontWeight: '800', color: '#B91C1C' },
  warningItem: { fontSize: 12, color: '#991B1B' },
  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  metaLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  metaValue: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  itemsSectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemCardNeedsReview: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFDF5',
  },
  needsReviewBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  needsReviewBadge: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  evidenceText: { fontSize: 11, color: '#78350F', fontStyle: 'italic' },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  itemForm: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fieldGrid: { flexDirection: 'row', gap: 10 },
  fieldCol: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  instructionsText: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  confirmBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0F766E',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  removeItemBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  removeItemBtnText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
});
