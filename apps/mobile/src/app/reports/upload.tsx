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
  uploadFile,
  useAnalyzeReport,
  useCorrectLabValue,
  type LabValue,
  type ReportAnalyzeRes,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

export default function ReportUploadScreen() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaMobile();
  const analyzeMutation = useAnalyzeReport();
  const correctMutation = useCorrectLabValue();

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isUploading, setIsUploading] = useState(false);
  const [analyzedData, setAnalyzedData] =
    useState<ReportAnalyzeRes | null>(null);
  const [editedValues, setEditedValues] = useState<LabValue[]>([]);
  // What the patient typed per row, until it is saved through the server (ADR-062).
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const handleRunAnalyze = async (targetPath: string) => {
    try {
      const res = await analyzeMutation.mutateAsync({
        file_path: targetPath,
        report_date: reportDate || undefined,
      });
      setAnalyzedData(res);
      setEditedValues(res.values);
      setDrafts({});
      setStep('review');
      showToast('Lab report analyzed successfully', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Report analysis failed',
        'error'
      );
    }
  };

  const handlePickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Camera permission is required to photograph lab reports', 'warning');
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
        'lab-reports',
        { uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' },
        ext
      );
      await handleRunAnalyze(uploadedPath);
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
        'lab-reports',
        { uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' },
        ext
      );
      await handleRunAnalyze(uploadedPath);
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
        'lab-reports',
        { uri: asset.uri, mimeType: 'application/pdf' },
        'pdf'
      );
      await handleRunAnalyze(uploadedPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Document upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // A corrected value is saved on the server, which recomputes the flag and the summary.
  const handleSaveValue = async (index: number) => {
    const val = editedValues[index];
    const parsed = Number((drafts[index] ?? '').trim());
    if (!val?.id) {
      showToast('This value cannot be corrected here. Open the report again.', 'warning');
      return;
    }
    if (!(drafts[index] ?? '').trim() || !Number.isFinite(parsed)) {
      showToast('Enter the number exactly as it is written on the report', 'warning');
      return;
    }
    setSavingIdx(index);
    try {
      const res = await correctMutation.mutateAsync({ value_id: val.id, value: parsed });
      setEditedValues((prev) => prev.map((v, i) => (i === index ? { ...v, ...res.value } : v)));
      setAnalyzedData((prev) => (prev ? { ...prev, summary: res.summary, follow_up_tests: res.follow_up_tests } : prev));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      showToast(`${val.test_name} saved`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save this value', 'error');
    } finally {
      setSavingIdx(null);
    }
  };

  const handleDone = () => {
    showToast(
      `Lab report analyzed with ${editedValues.length} extracted values`,
      'success'
    );
    router.replace('/(tabs)/reports');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Upload Lab Report</Text>
          <Text style={styles.headerSub}>
            AI extraction of test values, reference flags & summary
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel upload"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>Cancel</Text>
        </Pressable>
      </View>

      {step === 'upload' ? (
        <View style={styles.uploadContainer}>
          {/* Diagnostic Report Source Picker */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose Report Document</Text>
            <Text style={styles.cardSub}>
              Take a photo or pick a diagnostic test report (PDF, JPG, PNG) to extract values and reference ranges.
            </Text>

            <View style={styles.dateGroup}>
              <Text style={styles.inputLabel}>Report Test Date:</Text>
              <TextInput
                accessibilityLabel="Report Test Date"
                value={reportDate}
                onChangeText={setReportDate}
                placeholder="YYYY-MM-DD"
                style={styles.textInput}
              />
            </View>

            {isUploading || analyzeMutation.isPending ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#0D9488" />
                <Text style={styles.loadingText}>
                  {isUploading
                    ? 'Uploading report document…'
                    : 'Analyzing lab values with AI…'}
                </Text>
              </View>
            ) : (
              <View style={styles.pickerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Photograph lab report with camera"
                  onPress={handlePickFromCamera}
                  style={styles.pickerBtn}
                >
                  <Text style={styles.pickerBtnTitle}>📷 Take Photo with Camera</Text>
                  <Text style={styles.pickerBtnSub}>Snap a picture of your physical lab sheet</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pick lab report image from gallery"
                  onPress={handlePickFromGallery}
                  style={styles.pickerBtn}
                >
                  <Text style={styles.pickerBtnTitle}>🖼️ Pick from Photo Gallery</Text>
                  <Text style={styles.pickerBtnSub}>Select JPG or PNG from photos</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Upload lab report PDF document"
                  onPress={handlePickPdfDocument}
                  style={styles.pickerBtn}
                >
                  <Text style={styles.pickerBtnTitle}>📄 Choose PDF Document</Text>
                  <Text style={styles.pickerBtnSub}>Select digital diagnostic PDF from lab</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* AI Safety Rule Card */}
          <View style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Medical Safety Rules</Text>
            <Text style={styles.safetyText}>
              • Values and units are verified verbatim against the document.
              {'\n'}• Flags (High, Low, Normal) are calculated by code, not guessed by AI.
              {'\n'}• Summary strictly restates extracted numbers without diagnosing diseases.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.reviewContainer}>
          {/* Review Header */}
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewStepBadge}>MANDATORY LAB REVIEW</Text>
            <Text style={styles.reviewTitle}>Review Extracted Lab Values</Text>
            <Text style={styles.reviewSub}>
              Check each value against your paper report. If a number is wrong, type the correct one and tap Save; the flag is worked out again on our server.
            </Text>
          </View>

          {/* AI Safety Banner */}
          <MobileAiSafetyBanner feature="reports_analyze" />

          {/* Plain-Language Summary */}
          {analyzedData?.summary && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Plain-Language Summary</Text>
              <Text style={styles.summaryBody}>{analyzedData.summary}</Text>
            </View>
          )}

          {/* Follow-Up Tests */}
          {analyzedData?.follow_up_tests &&
            analyzedData.follow_up_tests.length > 0 && (
              <View style={styles.followUpCard}>
                <Text style={styles.followUpTitle}>
                  Suggested Follow-Up Tests
                </Text>
                <View style={styles.tagsRow}>
                  {analyzedData.follow_up_tests.map((test, idx) => (
                    <View key={idx} style={styles.testTag}>
                      <Text style={styles.testTagText}>{test}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

          {/* Values List with in-code flag recomputation */}
          <Text style={styles.valuesHeaderTitle}>
            Extracted Test Values ({editedValues.length})
          </Text>

          {editedValues.map((val, idx) => {
            const isHigh = val.flag === 'high';
            const isLow = val.flag === 'low';

            return (
              <View
                key={idx}
                style={[
                  styles.valueCard,
                  val.needs_review && styles.valueCardReview,
                ]}
              >
                {val.needs_review && (
                  <View style={styles.needsReviewBox}>
                    <Text style={styles.needsReviewText}>
                      ⚠ NEEDS REVIEW: {val.evidence || 'Check document value'}
                    </Text>
                  </View>
                )}

                <View style={styles.valueRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.testName}>{val.test_name}</Text>
                    <Text style={styles.refRange}>
                      Reference:{' '}
                      {val.ref_low !== null && val.ref_high !== null
                        ? `${val.ref_low} – ${val.ref_high} ${val.unit ?? ''}`
                        : val.ref_high !== null
                          ? `< ${val.ref_high} ${val.unit ?? ''}`
                          : val.ref_low !== null
                            ? `> ${val.ref_low} ${val.unit ?? ''}`
                            : 'No range on the report'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.flagBadge,
                      isHigh
                        ? styles.flagHigh
                        : isLow
                          ? styles.flagLow
                          : styles.flagNormal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.flagBadgeText,
                        isHigh
                          ? styles.flagHighText
                          : isLow
                            ? styles.flagLowText
                            : styles.flagNormalText,
                      ]}
                    >
                      {val.flag.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Correct a value: saved through the server */}
                <View style={styles.valueInputRow}>
                  <Text style={styles.valueInputLabel}>{val.corrected ? 'Corrected value:' : 'Measured value:'}</Text>
                  <TextInput
                    accessibilityLabel={`${val.test_name} value`}
                    value={drafts[idx] ?? (val.value !== null ? String(val.value) : val.value_text ?? '')}
                    onChangeText={(t) => setDrafts((prev) => ({ ...prev, [idx]: t }))}
                    style={styles.numericInput}
                    keyboardType="decimal-pad"
                    editable={savingIdx === null && val.value_text === null}
                  />
                  <Text style={styles.unitText}>{val.unit || ''}</Text>
                  {drafts[idx] !== undefined && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Save corrected ${val.test_name}`}
                      onPress={() => handleSaveValue(idx)}
                      disabled={savingIdx !== null}
                      style={styles.rowSaveBtn}
                    >
                      {savingIdx === idx ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.rowSaveBtnText}>Save</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          {/* Done Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done and view in health records"
            onPress={handleDone}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>
              ✓ Done · View in Health Records
            </Text>
          </Pressable>
        </View>
      )}

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowSaveBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  rowSaveBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
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
  dateGroup: { gap: 6, marginBottom: 4 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
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
  saveBtnDisabled: { opacity: 0.6 },
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
  reviewBanner: {
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
  reviewTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  reviewSub: { fontSize: 13, color: '#CCFBF1', lineHeight: 18 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  summaryBody: { fontSize: 13, color: '#334155', lineHeight: 20 },
  followUpCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  followUpTitle: { fontSize: 13, fontWeight: '700', color: '#0F766E' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  testTag: {
    backgroundColor: '#FFFFFF',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  testTagText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  valuesHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  valueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  valueCardReview: { borderColor: '#F59E0B', borderWidth: 2 },
  needsReviewBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
  },
  needsReviewText: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  refRange: { fontSize: 12, color: '#64748B' },
  flagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flagHigh: { backgroundColor: '#FEE2E2' },
  flagLow: { backgroundColor: '#FEF3C7' },
  flagNormal: { backgroundColor: '#D1FAE5' },
  flagBadgeText: { fontSize: 11, fontWeight: '800' },
  flagHighText: { color: '#B91C1C' },
  flagLowText: { color: '#B45309' },
  flagNormalText: { color: '#065F46' },
  valueInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  valueInputLabel: { fontSize: 12, color: '#475569', fontWeight: '500' },
  numericInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 80,
  },
  unitText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0F766E',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
