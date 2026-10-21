import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  BLOOD_REQUEST_STATUSES,
  BloodGroup,
  buildBloodRequestMessage,
  relativeTime,
  useBloodJob,
  useBloodRequests,
  useCreateBloodRequest,
  useMyProfile,
  useSearchBlood,
  useUpdateBloodRequest,
  type BloodBank,
  type BloodComponent,
  type BloodRequestStatus,
  type DbBloodRequest,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { T } from '@/constants/theme';

/**
 * RapidBlood on the phone (issue #236): the same search, results and request
 * tracker as the web page, in the phone's own shapes. Words are "listed", never
 * "available" — a row is what a public source page showed at `fetched_at`.
 */

/** Shown at all times (RapidBlood, ADR-071): what the list is, and who does the matching. */
const SAFETY_TEXT =
  'Stock is what the source page showed at the time written on each row. Call the blood bank to confirm. Matching and cross-match are done by the hospital and the blood bank. In an emergency call 108.';

const COMPONENTS: { value: BloodComponent; label: string }[] = [
  { value: 'whole_blood', label: 'Whole blood' },
  { value: 'red_cells', label: 'Red cells' },
  { value: 'platelets', label: 'Platelets' },
  { value: 'plasma', label: 'Plasma' },
];

const STATUS_LABEL: Record<BloodRequestStatus, string> = {
  searching: 'Searching',
  contacted: 'Contacted',
  confirmed: 'Confirmed by the blood bank',
  arranged: 'Arranged',
  received: 'Received',
  cancelled: 'Cancelled',
};

const AREA_STATUS: Record<string, { label: string; tone: 'neutral' | 'ok' | 'warn' | 'danger' }> = {
  pending: { label: 'Reading the page…', tone: 'neutral' },
  ok: { label: 'Done', tone: 'ok' },
  not_found: { label: 'Nothing listed', tone: 'neutral' },
  timeout: { label: 'Took too long', tone: 'warn' },
  error: { label: 'Could not read', tone: 'warn' },
};

const componentWords = (c: string) => COMPONENTS.find((x) => x.value === c)?.label ?? c;

function openUrl(url: string, onFail: () => void) {
  Linking.openURL(url).catch(onFail);
}

function BankCard({ bank }: { bank: BloodBank }) {
  const { showToast } = useVyanaMobile();
  const units =
    bank.units === null ? 'Count not listed' : `${bank.units} ${bank.units === 1 ? 'unit' : 'units'} listed`;
  const fail = () => showToast('Could not open that', 'error');
  return (
    <Card>
      <View style={styles.bankTop}>
        <View style={styles.bankTitles}>
          <Text variant="headline" numberOfLines={2}>
            {bank.name}
          </Text>
          <Text variant="footnote" tone="secondary">
            {[bank.address, bank.city].filter(Boolean).join(', ')}
          </Text>
        </View>
        <Pill
          text={bank.verified ? 'Matches the page text' : 'Not confirmed'}
          tone={bank.verified ? 'ok' : 'neutral'}
        />
      </View>
      <Text variant="footnote" tone="secondary">
        {units} · {bank.component}
      </Text>
      <Text variant="footnote" tone="tertiary">
        {bank.last_updated_text ? `Source says: ${bank.last_updated_text}. ` : ''}Read{' '}
        {relativeTime(bank.fetched_at)}
      </Text>
      <View style={styles.actionRow}>
        {bank.phone ? (
          <>
            <Button
              title="Call"
              variant="secondary"
              size="sm"
              label={`Call ${bank.name}`}
              icon={<Symbol ios="phone.fill" android="call" size={14} color={T.color.accentStrong} />}
              onPress={() => openUrl(`tel:${bank.phone!.replace(/\s+/g, '')}`, fail)}
            />
            <Button
              title="Message"
              variant="secondary"
              size="sm"
              label={`Message ${bank.name}`}
              icon={<Symbol ios="message.fill" android="sms" size={14} color={T.color.accentStrong} />}
              onPress={() => openUrl(`sms:${bank.phone!.replace(/\s+/g, '')}`, fail)}
            />
          </>
        ) : null}
        <Button
          title="Source"
          variant="secondary"
          size="sm"
          label={`Open the source page for ${bank.name}`}
          icon={
            <Symbol ios="arrow.up.right" android="open_in_new" size={14} color={T.color.accentStrong} />
          }
          onPress={() => openUrl(bank.source_url, fail)}
        />
      </View>
    </Card>
  );
}

function RequestCard({ request }: { request: DbBloodRequest }) {
  const { showToast } = useVyanaMobile();
  const update = useUpdateBloodRequest();
  const message = buildBloodRequestMessage(request);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(message);
      showToast('Message copied', 'success');
    } catch {
      showToast('Could not copy the message', 'error');
    }
  };
  const fail = () => showToast('Could not open that', 'error');

  return (
    <Card>
      <CardHeader
        title={`${request.blood_group} · ${componentWords(request.component)} · ${request.units} ${request.units === 1 ? 'unit' : 'units'}`}
      />
      <Text variant="subhead" tone="secondary">
        {request.hospital_name}, {request.city}
      </Text>
      <View style={styles.chipWrap} accessibilityLabel="Where this request stands">
        {BLOOD_REQUEST_STATUSES.map((status) => {
          const selected = request.status === status;
          return (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: update.isPending }}
              accessibilityLabel={`Set status ${STATUS_LABEL[status]}`}
              disabled={update.isPending}
              onPress={() => {
                if (!selected) update.mutate({ id: request.id, patch: { status } });
              }}
              style={[styles.statusChip, selected && styles.statusChipActive]}
            >
              <Text variant="footnote" tone={selected ? 'white' : 'secondary'} style={selected && styles.chipTextActive}>
                {STATUS_LABEL[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {update.isError ? (
        <Text variant="footnote" tone="danger">
          Could not save that change. Try again.
        </Text>
      ) : null}
      <Text variant="caption" tone="tertiary">
        You set every status yourself; nothing here changes by itself.
      </Text>
      <View style={styles.actionRow}>
        <Button title="Copy message" variant="secondary" size="sm" label="Copy the request message" onPress={copy} />
        <Button
          title="WhatsApp"
          variant="secondary"
          size="sm"
          label="Send the request message on WhatsApp"
          onPress={() => openUrl(`https://wa.me/?text=${encodeURIComponent(message)}`, fail)}
        />
        <Button
          title={`Call ${request.contact_name}`}
          variant="secondary"
          size="sm"
          label={`Call ${request.contact_name}`}
          onPress={() => openUrl(`tel:${request.contact_phone.replace(/\s+/g, '')}`, fail)}
        />
      </View>
    </Card>
  );
}

export default function BloodScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();
  const { data: profile } = useMyProfile();
  const search = useSearchBlood();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useBloodJob(jobId);
  const requests = useBloodRequests();
  const createRequest = useCreateBloodRequest();

  const [group, setGroup] = useState<string | null>(null);
  const [component, setComponent] = useState<BloodComponent>('red_cells');
  const [city, setCity] = useState<string | null>(null);
  const [units, setUnits] = useState('1');
  const [hospital, setHospital] = useState('');
  const [contactName, setContactName] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState<string | null>(null);

  const groupValue = group ?? profile?.blood_group ?? '';
  const cityValue = city ?? profile?.city ?? '';
  const unitsNumber = Number(units);
  const unitsOk = Number.isInteger(unitsNumber) && unitsNumber >= 1 && unitsNumber <= 10;
  const canSearch =
    BloodGroup.options.includes(groupValue as never) && cityValue.trim().length >= 2 && !search.isPending;
  const nameValue = contactName ?? profile?.full_name ?? '';
  const phoneValue = contactPhone ?? profile?.phone ?? '';
  const canStart =
    unitsOk &&
    hospital.trim().length >= 2 &&
    nameValue.trim().length >= 1 &&
    phoneValue.trim().length >= 5 &&
    !createRequest.isPending;

  const runSearch = async () => {
    if (!canSearch) {
      showToast('Pick a blood group and a city first', 'warning');
      return;
    }
    const res = await search
      .mutateAsync({ blood_group: groupValue as never, component, city: cityValue.trim() })
      .catch(() => null);
    setJobId(res?.job_id ?? null);
  };

  const startRequest = async () => {
    if (!canStart) {
      showToast('Fill the units, hospital and contact first', 'warning');
      return;
    }
    await createRequest
      .mutateAsync({
        blood_group: groupValue as never,
        component,
        units: unitsNumber,
        hospital_name: hospital.trim(),
        city: cityValue.trim(),
        contact_name: nameValue.trim(),
        contact_phone: phoneValue.trim(),
      })
      .then(() => {
        setHospital('');
        showToast('Request started', 'success');
      })
      .catch(() => undefined);
  };

  const result = job.data;
  const running = Boolean(jobId) && (job.isLoading || result?.status === 'running');

  return (
    <Screen
      eyebrow="Emergency"
      title="Find blood"
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
        Blood banks that list stock for your blood group, and a tracker for the request.
      </Text>

      {/* The standing text (ADR-071): shown at all times, with the emergency number one tap away. */}
      <Card style={styles.safetyCard}>
        <Text variant="subhead">{SAFETY_TEXT}</Text>
        <Button
          title="Call 108"
          variant="destructive"
          size="sm"
          label="Call 108, the emergency number"
          icon={<Symbol ios="phone.fill" android="call" size={14} color={T.color.white} />}
          onPress={() => openUrl('tel:108', () => showToast('Could not open the dialer', 'error'))}
          style={styles.call108}
        />
      </Card>

      <Card>
        <CardHeader title="Search" />
        <Text variant="footnote" tone="secondary">
          Blood group
        </Text>
        <View style={styles.chipWrap}>
          {BloodGroup.options.map((g) => {
            const selected = groupValue === g;
            return (
              <Pressable
                key={g}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Blood group ${g}`}
                onPress={() => setGroup(g)}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Text variant="footnote" tone={selected ? 'white' : 'secondary'} style={selected && styles.chipTextActive}>
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="footnote" tone="secondary">
          What is needed
        </Text>
        <View style={styles.chipWrap}>
          {COMPONENTS.map((c) => {
            const selected = component === c.value;
            return (
              <Pressable
                key={c.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Need ${c.label}`}
                onPress={() => setComponent(c.value)}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Text variant="footnote" tone={selected ? 'white' : 'secondary'} style={selected && styles.chipTextActive}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          accessibilityLabel="City"
          placeholder="City, for example Delhi"
          placeholderTextColor={T.color.label3}
          value={cityValue}
          onChangeText={setCity}
          autoComplete="postal-address-locality"
          style={styles.input}
        />
        <Button
          title="Search blood banks"
          loading={search.isPending}
          label="Search blood banks"
          disabled={!canSearch}
          onPress={runSearch}
        />
        {search.isError ? (
          <View style={styles.errorBlock}>
            <Text variant="footnote" tone="danger">
              The search did not start. Try again in a moment. In an emergency call 108.
            </Text>
            <Button title="Retry" variant="plain" size="sm" label="Retry the search" onPress={() => search.reset()} />
          </View>
        ) : null}
      </Card>

      {jobId ? (
        <View accessibilityLiveRegion="polite" style={styles.section}>
          <Card>
            <CardHeader title="Blood banks listed" trailing={running ? 'Reading…' : undefined} />
            {job.isError ? (
              <View style={styles.errorBlock}>
                <Text variant="footnote" tone="danger">
                  Could not read the results. Try again. In an emergency call 108.
                </Text>
                <Button title="Retry" variant="plain" size="sm" label="Retry reading the results" onPress={() => job.refetch()} />
              </View>
            ) : (
              <>
                {running ? (
                  <View style={styles.runningRow}>
                    <ActivityIndicator size="small" color={T.color.accent} />
                    <Text variant="footnote" tone="secondary" style={styles.flex1}>
                      Reading the source page for each area. This can take 2 to 3 minutes; you can leave
                      this screen open.
                    </Text>
                  </View>
                ) : null}
                {result ? (
                  <ListGroup>
                    {result.sources.map((s) => (
                      <ListRow
                        key={s.area}
                        title={s.area}
                        trailing={
                          <Pill
                            text={AREA_STATUS[s.status]?.label ?? s.status}
                            tone={AREA_STATUS[s.status]?.tone ?? 'neutral'}
                          />
                        }
                      />
                    ))}
                  </ListGroup>
                ) : null}
              </>
            )}
          </Card>

          {result && result.banks.length > 0
            ? result.banks.map((b) => <BankCard key={`${b.name}|${b.city}|${b.phone ?? ''}`} bank={b} />)
            : null}
          {result?.status === 'done' && result.banks.length === 0 ? (
            <EmptyState
              ios="drop.fill"
              android="water_drop"
              title="No blood bank listed for this search"
              body="Try a nearby city, or call the hospital's own blood bank. In an emergency call 108."
            />
          ) : null}
        </View>
      ) : null}

      <Card>
        <CardHeader title="Start a request" />
        <Text variant="footnote" tone="secondary">
          Keep track of who you called. Uses the blood group, what is needed and the city above.
        </Text>
        <TextInput
          accessibilityLabel="Units needed"
          placeholder="Units needed (1 to 10)"
          placeholderTextColor={T.color.label3}
          value={units}
          onChangeText={setUnits}
          keyboardType="number-pad"
          style={styles.input}
        />
        {units !== '' && !unitsOk ? (
          <Text variant="footnote" tone="danger">
            Enter 1 to 10 units
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel="Hospital"
          placeholder="Hospital, where the blood is needed"
          placeholderTextColor={T.color.label3}
          value={hospital}
          onChangeText={setHospital}
          style={styles.input}
        />
        <TextInput
          accessibilityLabel="Contact name"
          placeholder="Contact name"
          placeholderTextColor={T.color.label3}
          value={nameValue}
          onChangeText={setContactName}
          autoComplete="name"
          style={styles.input}
        />
        <TextInput
          accessibilityLabel="Contact phone"
          placeholder="Contact phone"
          placeholderTextColor={T.color.label3}
          value={phoneValue}
          onChangeText={setContactPhone}
          autoComplete="tel"
          keyboardType="phone-pad"
          style={styles.input}
        />
        <Button
          title="Start request"
          loading={createRequest.isPending}
          label="Start the request"
          disabled={!canStart}
          onPress={startRequest}
        />
        {createRequest.isError ? (
          <Text variant="footnote" tone="danger">
            Could not save the request. Check the fields and try again.
          </Text>
        ) : null}
      </Card>

      <View style={styles.section}>
        <Text variant="title3" style={styles.sectionTitle}>
          Your requests
        </Text>
        {requests.isError ? (
          <Card>
            <Text variant="footnote" tone="danger">
              Could not load your requests.
            </Text>
            <Button title="Retry" variant="plain" size="sm" label="Retry loading your requests" onPress={() => requests.refetch()} />
          </Card>
        ) : requests.data && requests.data.length > 0 ? (
          requests.data.map((r) => <RequestCard key={r.id} request={r} />)
        ) : (
          <Card>
            <Text variant="footnote" tone="tertiary">
              {requests.isLoading ? 'Loading your requests…' : 'No requests yet.'}
            </Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneBtn: { minHeight: 44, justifyContent: 'center' },
  flex1: { flex: 1 },
  safetyCard: { borderWidth: 1, borderColor: T.color.dangerSoft },
  call108: { alignSelf: 'flex-start' },
  input: {
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.md,
    fontSize: 16,
    color: T.color.label,
    minHeight: 48,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: T.space.lg,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.fill,
  },
  chipActive: { backgroundColor: T.color.accent },
  chipTextActive: { fontWeight: '700' },
  statusChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: T.space.md,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    backgroundColor: T.color.fill,
  },
  statusChipActive: { backgroundColor: T.color.accent },
  errorBlock: { gap: T.space.xs },
  runningRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  section: { gap: T.space.md },
  sectionTitle: { paddingHorizontal: T.space.xs },
  bankTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: T.space.sm },
  bankTitles: { flex: 1, gap: T.space.xs },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
});
