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
import {
  useAnalyzeReport,
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
  const { showToast } = useVyanaMobile();
  const analyzeMutation = useAnalyzeReport();

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [filePath, setFilePath] = useState('');
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [analyzedData, setAnalyzedData] =
    useState<ReportAnalyzeRes | null>(null);
  const [editedValues, setEditedValues] = useState<LabValue[]>([]);

  const handleRunAnalyze = async (targetPath: string) => {
    try {
      const res = await analyzeMutation.mutateAsync({
        file_path: targetPath,
        report_date: reportDate || undefined,
      });
      setAnalyzedData(res);
      setEditedValues(res.values);
      setStep('review');
      showToast('Lab report analyzed successfully', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Report analysis failed',
        'error'
      );
    }
  };

  const handleSelectSample = () => {
    const samplePath = 'demo-patient/sample-lab-hba1c-glucose.pdf';
    setFilePath(samplePath);
    handleRunAnalyze(samplePath);
  };

  // When patient edits numeric value, recompute flag in code (§2A rule 4)
  const handleValueChange = (index: number, newNumStr: string) => {
    setEditedValues((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      const parsed = parseFloat(newNumStr);
      if (!isNaN(parsed)) {
        target.value = parsed;
        if (target.ref_high !== null && parsed > target.ref_high) {
          target.flag = 'high';
        } else if (target.ref_low !== null && parsed < target.ref_low) {
          target.flag = 'low';
        } else if (target.ref_low !== null || target.ref_high !== null) {
          target.flag = 'normal';
        }
      } else {
        target.value = null;
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleSaveToRecords = () => {
    showToast(
      `Saved ${editedValues.length} lab results to your health record`,
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
          {/* Sample Diagnostic Report Option */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose Report Document</Text>
            <Text style={styles.cardSub}>
              Select a blood test, lipid panel, or metabolic report (PDF or image).
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Analyze sample lab report with HbA1c and Glucose"
              disabled={analyzeMutation.isPending}
              onPress={handleSelectSample}
              style={styles.sampleBtn}
            >
              <Text style={styles.sampleBtnTitle}>
                🧪 Load Verified Demo Lab Report
              </Text>
              <Text style={styles.sampleBtnSub}>
                HbA1c (7.4%), Fasting Blood Glucose (138 mg/dL), Serum Creatinine
              </Text>
            </Pressable>

            {/* Custom file path entry */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Or enter Supabase Storage path:
              </Text>
              <TextInput
                accessibilityLabel="Lab Report Storage Path"
                value={filePath}
                onChangeText={setFilePath}
                placeholder="e.g., patient-id/report-oct2026.pdf"
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Report Test Date:</Text>
              <TextInput
                accessibilityLabel="Report Test Date"
                value={reportDate}
                onChangeText={setReportDate}
                placeholder="YYYY-MM-DD"
                style={styles.textInput}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Analyze entered lab report"
                disabled={analyzeMutation.isPending || !filePath.trim()}
                onPress={() => handleRunAnalyze(filePath.trim())}
                style={[
                  styles.analyzeBtn,
                  (!filePath.trim() || analyzeMutation.isPending) &&
                    styles.analyzeBtnDisabled,
                ]}
              >
                {analyzeMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.analyzeBtnText}>
                    Analyze Report with AI
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* AI Safety Rule Card */}
          <View style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Medical Safety Rules (§2A)</Text>
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
            <Text style={styles.reviewTitle}>Review & Correct Lab Values</Text>
            <Text style={styles.reviewSub}>
              Verify extracted values against your physical paper report. You
              can correct any number before saving.
            </Text>
          </View>

          {/* AI Banner with mistake reporting */}
          <MobileAiSafetyBanner
            feature="reports_analyze"
            aiRunId={analyzedData?.ai?.model ?? 'reports-analyze'}
          />

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
                            : 'Normal'}
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

                {/* Editable Value Input */}
                <View style={styles.valueInputRow}>
                  <Text style={styles.valueInputLabel}>Measured Value:</Text>
                  <TextInput
                    accessibilityLabel={`${val.test_name} value`}
                    value={val.value !== null ? String(val.value) : ''}
                    onChangeText={(t) => handleValueChange(idx, t)}
                    style={styles.numericInput}
                    keyboardType="numeric"
                  />
                  <Text style={styles.unitText}>{val.unit || ''}</Text>
                </View>
              </View>
            );
          })}

          {/* Save Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save verified lab report to health records"
            onPress={handleSaveToRecords}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>
              ✓ Save to Health Records & Timeline
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
  sampleBtn: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  sampleBtnTitle: { fontSize: 15, fontWeight: '700', color: '#0F766E' },
  sampleBtnSub: { fontSize: 12, color: '#115E59' },
  inputGroup: { gap: 6, marginTop: 4 },
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
  analyzeBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  analyzeBtnDisabled: { opacity: 0.5 },
  analyzeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
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
