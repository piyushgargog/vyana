import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  DEFAULT_TIMES,
  uploadFile,
  useCheckInteractions,
  useExtractPrescription,
  type FrequencyType,
  type PrescriptionExtractRes,
  type PrescriptionItem,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { syncReminders } from '@/lib/notifications';
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

export default function PrescriptionScanScreen() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaMobile();
  const extractMutation = useExtractPrescription();
  const checkInteractionsMutation = useCheckInteractions();

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [pickerOpen, setPickerOpen] = useState(false);
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
      setPickerOpen(false);
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
      setPickerOpen(false);
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
      setPickerOpen(false);
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
      const prescriptionId = extractedData?.prescription_id;
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

      // 4. Auto-check drug interactions for newly added prescription
      if (prescriptionId) {
        await checkInteractionsMutation
          .mutateAsync({ prescription_id: prescriptionId })
          .catch(() => {});
      }

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

  const busy = isUploading || extractMutation.isPending;

  return (
    <Screen
      title="Scan prescription"
      eyebrow="Add medicines"
      trailing={
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} label="Back to medicines" />
      }
    >
      {step === 'upload' ? (
        <>
          <Card>
            <CardHeader title="Upload prescription" />
            <Text variant="subhead" tone="secondary">
              Take a photo or pick an image or PDF of your paper prescription to
              extract medicines, dosages and schedules.
            </Text>
            {busy ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={T.color.accent} />
                <Text variant="subhead" tone="accent" style={styles.strong}>
                  {isUploading
                    ? 'Uploading prescription file…'
                    : 'Analyzing prescription with AI vision…'}
                </Text>
              </View>
            ) : (
              <Button
                title="Choose photo or PDF"
                onPress={() => setPickerOpen(true)}
                label="Choose prescription photo or PDF"
                icon={<Symbol ios="camera.fill" android="photo_camera" size={16} color={T.color.white} />}
              />
            )}
          </Card>

          <Card>
            <View style={styles.safetyRow}>
              <Symbol ios="shield.fill" android="shield" size={20} color={T.color.accent} />
              <Text variant="headline">How we keep it safe</Text>
            </View>
            <Text variant="subhead" tone="secondary">
              Doses and frequencies come only from verified prescription text. Fields
              without source evidence are flagged for your review. Nothing is scheduled
              until you confirm every field.
            </Text>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <View style={styles.reviewHead}>
              <Pill text="Check every medicine" tone="warn" />
              <Text variant="title3">Verify the extracted medicines</Text>
            </View>
            <Text variant="subhead" tone="secondary">
              Check medicine names, strengths, doses and frequencies before we set
              automatic reminders.
            </Text>
          </Card>

          <MobileAiSafetyBanner feature="prescriptions_extract" aiRunId={extractedData?.ai?.run_id} />

          {extractedData?.warnings && extractedData.warnings.length > 0 && (
            <Card>
              <CardHeader title="Attention needed" />
              {extractedData.warnings.map((w, idx) => (
                <View key={idx} style={styles.warningRow}>
                  <Symbol ios="exclamationmark.triangle.fill" android="warning" size={14} color={T.color.warn} />
                  <Text variant="subhead" tone="warn" style={{ flex: 1 }}>
                    {w}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          <ListGroup header="Prescription details">
            <ListRow
              title="Prescribing doctor"
              value={extractedData?.doctor_name || 'Not found on the prescription'}
            />
            <ListRow
              title="Diagnosis"
              value={extractedData?.diagnosis || 'Not found on the prescription'}
            />
            <ListRow
              title="Issued on"
              value={extractedData?.issued_on || 'Not found on the prescription'}
            />
          </ListGroup>

          <Text variant="title3" accessibilityRole="header" style={styles.sectionTitle}>
            Medicines ({editedItems.length})
          </Text>

          {editedItems.map((item, idx) => {
            const needsReview = item.needs_review;
            return (
              <Card key={item.id || idx}>
                <View style={styles.itemHead}>
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">{item.medicine_name}</Text>
                    <Text variant="footnote" tone="tertiary">
                      {(item.form ?? 'Tablet').toUpperCase()}
                    </Text>
                  </View>
                  {needsReview && <Pill text="Needs check" tone="warn" />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.medicine_name}`}
                    onPress={() => handleRemoveItem(idx)}
                    style={styles.removeBtn}
                  >
                    <Symbol ios="trash" android="delete" size={16} color={T.color.dangerText} label={`Remove ${item.medicine_name}`} />
                  </Pressable>
                </View>

                {needsReview && item.evidence && (
                  <Text variant="footnote" tone="tertiary" style={styles.evidence}>
                    From your prescription: “{item.evidence}”
                  </Text>
                )}

                <View style={styles.fieldGrid}>
                  <View style={styles.fieldCol}>
                    <Text variant="caption" tone="secondary" style={styles.fieldLabel}>
                      Strength
                    </Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} strength`}
                      value={item.strength ?? ''}
                      onChangeText={(t) => handleItemFieldChange(idx, 'strength', t)}
                      style={styles.fieldInput}
                      placeholder="e.g. 500 mg"
                      placeholderTextColor={T.color.label3}
                    />
                  </View>
                  <View style={styles.fieldCol}>
                    <Text variant="caption" tone="secondary" style={styles.fieldLabel}>
                      Dose
                    </Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} dose`}
                      value={item.dose ?? ''}
                      onChangeText={(t) => handleItemFieldChange(idx, 'dose', t)}
                      style={styles.fieldInput}
                      placeholder="e.g. 1 tablet"
                      placeholderTextColor={T.color.label3}
                    />
                  </View>
                </View>

                <View style={styles.fieldGrid}>
                  <View style={styles.fieldCol}>
                    <Text variant="caption" tone="secondary" style={styles.fieldLabel}>
                      Frequency
                    </Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} frequency`}
                      value={item.frequency ?? ''}
                      onChangeText={(t) => handleItemFieldChange(idx, 'frequency', t)}
                      style={styles.fieldInput}
                      placeholder="OD, BD, TDS, SOS"
                      placeholderTextColor={T.color.label3}
                    />
                  </View>
                  <View style={styles.fieldCol}>
                    <Text variant="caption" tone="secondary" style={styles.fieldLabel}>
                      Duration (days)
                    </Text>
                    <TextInput
                      accessibilityLabel={`${item.medicine_name} duration in days`}
                      value={
                        item.duration_days !== null && item.duration_days !== undefined
                          ? String(item.duration_days)
                          : ''
                      }
                      onChangeText={(t) =>
                        handleItemFieldChange(idx, 'duration_days', t ? parseInt(t, 10) : null)
                      }
                      style={styles.fieldInput}
                      placeholder="e.g. 30"
                      placeholderTextColor={T.color.label3}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {item.instructions && (
                  <Text variant="footnote" tone="tertiary" style={styles.instructions}>
                    Note: {item.instructions}
                  </Text>
                )}
              </Card>
            );
          })}

          <Button
            title="Confirm and set reminders"
            onPress={handleConfirmAndSetReminders}
            loading={isSaving}
            label="Confirm verified medicines and schedule dose reminders"
            icon={<Symbol ios="checkmark" android="check" size={16} color={T.color.white} />}
          />
        </>
      )}

      {/* Camera / photo / PDF choice */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add prescription">
        <ListGroup>
          <ListRow
            icon={<IconTile ios="camera.fill" android="photo_camera" color="blue" />}
            title="Take photo"
            subtitle="Snap a clear picture of your prescription"
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
            subtitle="Digital e-prescription or scanned PDF"
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
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: T.space.sm },
  sectionTitle: { paddingHorizontal: T.space.xs, marginTop: T.space.sm },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: T.space.sm },
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.dangerSoft,
  },
  evidence: { fontStyle: 'italic' },
  fieldGrid: { flexDirection: 'row', gap: T.space.md },
  fieldCol: { flex: 1, gap: T.space.xs },
  fieldLabel: { fontWeight: '600' },
  fieldInput: {
    ...T.text.body,
    color: T.color.label,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 44,
  },
  instructions: { fontStyle: 'italic' },
});
