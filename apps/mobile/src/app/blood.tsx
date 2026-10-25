import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import * as Clipboard from 'expo-clipboard';
import {
  BLOOD_REQUEST_STATUSES,
  BloodGroup,
  E_RAKTKOSH_URL,
  buildBloodRequestMessage,
  relativeTime,
  smsShareUrl,
  sortBloodBanks,
  telHref,
  useBloodJob,
  useBloodRequests,
  useCreateBloodRequest,
  useMyProfile,
  useSearchBlood,
  useUpdateBloodRequest,
  whatsappShareUrl,
  type BloodBank,
  type BloodComponent,
  type BloodRequestStatus,
  type DbBloodRequest,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileSkeletonCard } from '@/components/ui-primitives';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Pill,
  Screen,
  Symbol,
  Text,
  TextField,
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

const componentWords = (c: string) => COMPONENTS.find((x) => x.value === c)?.label ?? c;

/** When a search finds nothing or cannot be read: the public stock page itself, and a way to share the request. */
function SearchFallback({ message }: { message: string }) {
  const { showToast } = useVyanaMobile();
  const fail = () => showToast('Could not open that', 'error');
  return (
    <View style={styles.actionRow}>
      <Button
        title="Open e-RaktKosh"
        variant="secondary"
        size="md"
        label="Open e-RaktKosh, the public blood stock page"
        icon={<Symbol ios="arrow.up.right" android="open_in_new" size={14} color={T.color.accentStrong} />}
        onPress={() => openUrl(E_RAKTKOSH_URL, fail)}
      />
      <Button
        title="Share on WhatsApp"
        variant="secondary"
        size="md"
        label="Share this request on WhatsApp"
        onPress={() => openUrl(whatsappShareUrl(message), fail)}
      />
      <Button
        title="Share by SMS"
        variant="secondary"
        size="md"
        label="Share this request by SMS"
        onPress={() => openUrl(smsShareUrl(message), fail)}
      />
    </View>
  );
}

function openUrl(url: string, onFail: () => void) {
  Linking.openURL(url).catch(onFail);
}

function BankCard({ bank }: { bank: BloodBank }) {
  const { showToast } = useVyanaMobile();
  const units =
    bank.units === null ? 'Count not listed' : `${bank.units} ${bank.units === 1 ? 'unit' : 'units'} listed`;
  const fail = () => showToast('Could not open that', 'error');
  // A Call or Message button exists only for something that is a phone number, and
  // the source opens only over https (the check both apps share, from ui-helpers).
  const tel = telHref(bank.phone);
  const sourceOk = bank.source_url.startsWith('https://');
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
        Read {relativeTime(bank.fetched_at)}
      </Text>
      {bank.last_updated_text ? (
        <Text variant="footnote" tone="tertiary">
          Source page says: {bank.last_updated_text}
        </Text>
      ) : null}
      <Text variant="footnote" tone="secondary" style={styles.strong}>
        Call to confirm
      </Text>
      <View style={styles.actionRow}>
        {tel ? (
          <>
            <Button
              title="Call"
              variant="secondary"
              size="md"
              label={`Call ${bank.name}`}
              icon={<Symbol ios="phone.fill" android="call" size={14} color={T.color.accentStrong} />}
              onPress={() => openUrl(tel, fail)}
            />
            <Button
              title="Message"
              variant="secondary"
              size="md"
              label={`Message ${bank.name}`}
              icon={<Symbol ios="message.fill" android="sms" size={14} color={T.color.accentStrong} />}
              onPress={() => openUrl(`sms:${tel.slice(4)}`, fail)}
            />
          </>
        ) : null}
        {sourceOk ? (
          <Button
            title="Source"
            variant="secondary"
            size="md"
            label={`Open the source page for ${bank.name}`}
            icon={
              <Symbol ios="arrow.up.right" android="open_in_new" size={14} color={T.color.accentStrong} />
            }
            onPress={() => openUrl(bank.source_url, fail)}
          />
        ) : null}
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
  const contactTel = telHref(request.contact_phone);

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
        <Button title="Copy message" variant="secondary" size="md" label="Copy the request message" onPress={copy} />
        <Button
          title="WhatsApp"
          variant="secondary"
          size="md"
          label="Send the request message on WhatsApp"
          onPress={() => openUrl(whatsappShareUrl(message), fail)}
        />
        <Button
          title="SMS"
          variant="secondary"
          size="md"
          label="Send the request message by SMS"
          onPress={() => openUrl(smsShareUrl(message), fail)}
        />
        {contactTel ? (
          <Button
            title={`Call ${request.contact_name}`}
            variant="secondary"
            size="md"
            label={`Call ${request.contact_name}`}
            onPress={() => openUrl(contactTel, fail)}
          />
        ) : null}
      </View>
    </Card>
  );
}

export default function BloodScreen() {
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
    BloodGroup.options.includes(groupValue as never) &&
    cityValue.trim().length >= 2 &&
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
  const banks = result ? sortBloodBanks(result.banks) : [];
  // The request this search belongs to, for the empty and failed states: the search fields
  // plus the request form below, so the message says only what the patient typed.
  const shareMessage = buildBloodRequestMessage({
    blood_group: groupValue,
    component,
    units: unitsOk ? unitsNumber : undefined,
    hospital_name: hospital.trim(),
    city: cityValue.trim(),
    contact_name: nameValue.trim(),
    contact_phone: phoneValue.trim(),
  });

  return (
    <Screen eyebrow="Emergency" title="Find blood">
      <Text variant="subhead" tone="secondary">
        Blood banks that list stock for your blood group, and a tracker for the request.
      </Text>

      {/* The standing text (ADR-071): shown at all times, with the emergency number one tap away. */}
      <Card style={styles.safetyCard}>
        <Text variant="subhead">{SAFETY_TEXT}</Text>
        <Button
          title="Call 108"
          variant="destructive"
          size="md"
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

        <TextField
          accessibilityLabel="City"
          placeholder="City, for example Delhi"
          placeholderTextColor={T.color.label3}
          value={cityValue}
          onChangeText={setCity}
          autoComplete="postal-address-locality"
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
            <Button title="Retry" variant="plain" size="md" label="Retry the search" onPress={runSearch} />
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
                <Button title="Retry" variant="plain" size="md" label="Retry reading the results" onPress={() => job.refetch()} />
                <SearchFallback message={shareMessage} />
              </View>
            ) : running ? (
              <MobileSkeletonCard />
            ) : null}
          </Card>

          {!running && banks.length > 0
            ? banks.map((b) => <BankCard key={`${b.name}|${b.city}|${b.phone ?? ''}`} bank={b} />)
            : null}
          {result?.status === 'done' && banks.length === 0 ? (
            result.sources.some((s) => s.status === 'ok' || s.status === 'not_found') ? (
              <>
                <EmptyState
                  ios="drop.fill"
                  android="water_drop"
                  title="No blood bank listed for this search"
                  body="Try a nearby city, check the public stock page yourself, or call the hospital's own blood bank. In an emergency call 108."
                />
                <SearchFallback message={shareMessage} />
              </>
            ) : (
              // No area answered at all: that says nothing about stock, so it is
              // an unread page with a retry, never an empty result.
              <Card>
                <Text variant="headline">The source page could not be read</Text>
                <Text variant="footnote" tone="secondary">
                  That says nothing about stock. Try again, or call the hospital&apos;s own blood bank. In
                  an emergency call 108.
                </Text>
                <Button
                  title="Retry"
                  variant="plain"
                  size="md"
                  label="Try the search again"
                  onPress={runSearch}
                  style={styles.retryBtn}
                />
                <SearchFallback message={shareMessage} />
              </Card>
            )
          ) : null}
        </View>
      ) : null}

      <Card>
        <CardHeader title="Start a request" />
        <Text variant="footnote" tone="secondary">
          Keep track of who you called. Uses the blood group, what is needed and the city above.
        </Text>
        <TextField
          accessibilityLabel="Units needed"
          placeholder="Units needed (1 to 10)"
          placeholderTextColor={T.color.label3}
          value={units}
          onChangeText={setUnits}
          keyboardType="number-pad"
        />
        {units !== '' && !unitsOk ? (
          <Text variant="footnote" tone="danger">
            Enter 1 to 10 units
          </Text>
        ) : null}
        <TextField
          accessibilityLabel="Hospital"
          placeholder="Hospital, where the blood is needed"
          placeholderTextColor={T.color.label3}
          value={hospital}
          onChangeText={setHospital}
        />
        <TextField
          accessibilityLabel="Contact name"
          placeholder="Contact name"
          placeholderTextColor={T.color.label3}
          value={nameValue}
          onChangeText={setContactName}
          autoComplete="name"
        />
        <TextField
          accessibilityLabel="Contact phone"
          placeholder="Contact phone"
          placeholderTextColor={T.color.label3}
          value={phoneValue}
          onChangeText={setContactPhone}
          autoComplete="tel"
          keyboardType="phone-pad"
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
            <Button title="Retry" variant="plain" size="md" label="Retry loading your requests" onPress={() => requests.refetch()} />
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
  retryBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  flex1: { flex: 1 },
  safetyCard: { borderWidth: 1, borderColor: T.color.dangerSoft },
  call108: { alignSelf: 'flex-start' },
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
  strong: { fontWeight: '700' },
  section: { gap: T.space.md },
  sectionTitle: { paddingHorizontal: T.space.xs },
  bankTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: T.space.sm },
  bankTitles: { flex: 1, gap: T.space.xs },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
});
