import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
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
  Button,
  Card,
  CardHeader,
  IconTile,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Sheet,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

function flagTone(flag: string): 'danger' | 'warn' | 'ok' | 'neutral' {
  if (flag === 'high') return 'danger';
  if (flag === 'low') return 'warn';
  if (flag === 'normal') return 'ok';
  return 'neutral';
}

function formatRange(val: LabValue): string {
  if (val.ref_low !== null && val.ref_high !== null)
    return `${val.ref_low} – ${val.ref_high} ${val.unit ?? ''}`.trim();
  if (val.ref_high !== null) return `< ${val.ref_high} ${val.unit ?? ''}`.trim();
  if (val.ref_low !== null) return `> ${val.ref_low} ${val.unit ?? ''}`.trim();
  return 'No range on the report';
}

export default function ReportUploadScreen() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaMobile();
  const analyzeMutation = useAnalyzeReport();
  const correctMutation = useCorrectLabValue();

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [pickerOpen, setPickerOpen] = useState(false);
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
      setPickerOpen(false);
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
      setPickerOpen(false);
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
      setPickerOpen(false);
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

  const busy = isUploading || analyzeMutation.isPending;

  return (
    <Screen
      title="Upload lab report"
      eyebrow="Add results"
      trailing={
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} label="Cancel upload" />
      }
    >
      {step === 'upload' ? (
        <>
          <Card>
            <CardHeader title="Choose report document" />
            <Text variant="subhead" tone="secondary">
              Take a photo or pick a diagnostic test report (PDF, JPG, PNG) to
              extract values and reference ranges.
            </Text>
            <View style={styles.field}>
              <Text variant="footnote" tone="secondary" style={styles.label}>
                Report date
              </Text>
              <TextInput
                accessibilityLabel="Report test date"
                value={reportDate}
                onChangeText={setReportDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={T.color.label3}
                style={styles.input}
              />
            </View>
            {busy ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={T.color.accent} />
                <Text variant="subhead" tone="accent" style={styles.strong}>
                  {isUploading
                    ? 'Uploading report document…'
                    : 'Analyzing lab values with AI…'}
                </Text>
              </View>
            ) : (
              <Button
                title="Choose report"
                onPress={() => setPickerOpen(true)}
                label="Choose lab report photo or PDF"
                icon={<Symbol ios="doc.fill" android="description" size={16} color={T.color.white} />}
              />
            )}
          </Card>

          <Card>
            <View style={styles.safetyRow}>
              <Symbol ios="shield.fill" android="shield" size={20} color={T.color.accent} />
              <Text variant="headline">How we keep it safe</Text>
            </View>
            <Text variant="subhead" tone="secondary">
              Values and units are checked against the document. Flags (high, low,
              normal) are worked out by code, not guessed by AI. The summary only
              restates your numbers.
            </Text>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <View style={styles.reviewHead}>
              <Pill text="Check every value" tone="warn" />
              <Text variant="title3">Review the extracted values</Text>
            </View>
            <Text variant="subhead" tone="secondary">
              Check each value against your paper report. If a number is wrong,
              type the correct one and tap Save — the flag is worked out again on
              our server.
            </Text>
          </Card>

          <MobileAiSafetyBanner feature="reports_analyze" aiRunId={analyzedData?.ai?.run_id} />

          {analyzedData?.summary && (
            <Card>
              <CardHeader title="Summary in plain words" />
              <Text variant="subhead">{analyzedData.summary}</Text>
            </Card>
          )}

          {analyzedData?.follow_up_tests && analyzedData.follow_up_tests.length > 0 && (
            <Card>
              <CardHeader title="Suggested follow-up tests" />
              <View style={styles.tagsRow}>
                {analyzedData.follow_up_tests.map((test, idx) => (
                  <Pill key={idx} text={test} tone="accent" />
                ))}
              </View>
            </Card>
          )}

          <Text variant="title3" accessibilityRole="header" style={styles.sectionTitle}>
            Test values ({editedValues.length})
          </Text>

          {editedValues.map((val, idx) => (
            <Card key={idx}>
              <View style={styles.valueHead}>
                <View style={{ flex: 1 }}>
                  <Text variant="headline">{val.test_name}</Text>
                  <Text variant="footnote" tone="tertiary">
                    Reference: {formatRange(val)}
                  </Text>
                </View>
                <Pill text={val.flag.toUpperCase()} tone={flagTone(val.flag)} />
              </View>

              {val.needs_review && (
                <Text variant="footnote" tone="warn">
                  Needs review: {val.evidence || 'check the value on your report'}
                </Text>
              )}

              <View style={styles.correctionRow}>
                <Text variant="footnote" tone="secondary">
                  {val.corrected ? 'Corrected:' : 'Measured:'}
                </Text>
                <TextInput
                  accessibilityLabel={`${val.test_name} value`}
                  value={drafts[idx] ?? (val.value !== null ? String(val.value) : val.value_text ?? '')}
                  onChangeText={(t) => setDrafts((prev) => ({ ...prev, [idx]: t }))}
                  style={styles.numericInput}
                  keyboardType="decimal-pad"
                  editable={savingIdx === null && val.value_text === null}
                />
                {val.unit ? (
                  <Text variant="footnote" tone="secondary">
                    {val.unit}
                  </Text>
                ) : null}
                {drafts[idx] !== undefined && (
                  <Button
                    title="Save"
                    variant="secondary"
                    size="sm"
                    onPress={() => handleSaveValue(idx)}
                    disabled={savingIdx !== null}
                    loading={savingIdx === idx}
                    label={`Save corrected ${val.test_name}`}
                    style={styles.rowSave}
                  />
                )}
              </View>
            </Card>
          ))}

          <Button
            title="Done · View in health records"
            onPress={handleDone}
            label="Done and view in health records"
            icon={<Symbol ios="checkmark" android="check" size={16} color={T.color.white} />}
          />
        </>
      )}

      {/* Camera / photo / PDF choice */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add lab report">
        <ListGroup>
          <ListRow
            icon={<IconTile ios="camera.fill" android="photo_camera" color="blue" />}
            title="Take photo"
            subtitle="Snap a picture of your lab sheet"
            onPress={handlePickFromCamera}
          />
          <ListRow
            icon={<IconTile ios="photo.fill" android="photo_library" color="green" />}
            title="Choose from gallery"
            subtitle="JPG or PNG from your photos"
            onPress={handlePickFromGallery}
          />
          <ListRow
            icon={<IconTile ios="doc.fill" android="description" color="orange" />}
            title="Choose PDF"
            subtitle="Digital report PDF from your lab"
            onPress={handlePickPdfDocument}
          />
        </ListGroup>
      </Sheet>

      <MobileDisclaimerFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  strong: { fontWeight: '600' },
  field: { gap: T.space.xs },
  label: { fontWeight: '600' },
  input: {
    ...T.text.body,
    color: T.color.label,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 44,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.md,
    backgroundColor: T.color.accentSoft,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.lg,
  },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  reviewHead: { gap: T.space.sm, alignItems: 'flex-start' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  sectionTitle: { paddingHorizontal: T.space.xs, marginTop: T.space.sm },
  valueHead: { flexDirection: 'row', alignItems: 'flex-start', gap: T.space.sm },
  correctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
    flexWrap: 'wrap',
  },
  numericInput: {
    ...T.text.body,
    fontWeight: '700',
    color: T.color.label,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 44,
    minWidth: 88,
  },
  rowSave: { minHeight: 44, justifyContent: 'center' },
});
