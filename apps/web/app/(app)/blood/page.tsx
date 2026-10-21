"use client";

import React, { useState } from "react";
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
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Field, LargeTitle, ListGroup, ListRow, Pill, SelectField } from "@/components/ui";
import { Copy, Droplets, ExternalLink, Loader2, Phone, Send } from "lucide-react";

/** Shown at all times (RapidBlood, ADR-071): what the list is, and who does the matching. */
const SAFETY_TEXT =
  "Stock is what the source page showed at the time written on each row. Call the blood bank to confirm. Matching and cross-match are done by the hospital and the blood bank. In an emergency call 108.";

const COMPONENTS: { value: BloodComponent; label: string }[] = [
  { value: "whole_blood", label: "Whole blood" },
  { value: "red_cells", label: "Red cells" },
  { value: "platelets", label: "Platelets" },
  { value: "plasma", label: "Plasma" },
];

const STATUS_LABEL: Record<BloodRequestStatus, string> = {
  searching: "Searching",
  contacted: "Contacted",
  confirmed: "Confirmed by the blood bank",
  arranged: "Arranged",
  received: "Received",
  cancelled: "Cancelled",
};

const AREA_STATUS: Record<string, { label: string; tone: "neutral" | "ok" | "warn" | "danger" }> = {
  pending: { label: "Reading the page…", tone: "neutral" },
  ok: { label: "Done", tone: "ok" },
  not_found: { label: "Nothing listed", tone: "neutral" },
  timeout: { label: "Took too long", tone: "warn" },
  error: { label: "Could not read", tone: "warn" },
};

const componentWords = (c: string) => COMPONENTS.find((x) => x.value === c)?.label ?? c;

function BankRow({ bank }: { bank: BloodBank }) {
  const units = bank.units === null ? "Count not listed" : `${bank.units} ${bank.units === 1 ? "unit" : "units"} listed`;
  return (
    <ListRow
      title={bank.name}
      subtitle={
        <span className="block space-y-0.5">
          <span className="block">{[bank.address, bank.city].filter(Boolean).join(", ")}</span>
          <span className="block">
            {units} · {bank.component}
          </span>
          <span className="block">
            {bank.last_updated_text ? `Source says: ${bank.last_updated_text}. ` : ""}Read {relativeTime(bank.fetched_at)}
          </span>
        </span>
      }
      trailing={
        <span className="flex flex-col items-end gap-2">
          <Pill tone={bank.verified ? "ok" : "neutral"}>{bank.verified ? "Matches the page text" : "Not confirmed"}</Pill>
          <span className="flex gap-2">
            {bank.phone ? (
              <ButtonLink href={`tel:${bank.phone.replace(/\s+/g, "")}`} variant="secondary" size="sm" aria-label={`Call ${bank.name}`}>
                <Phone aria-hidden="true" className="h-4 w-4" />
                Call
              </ButtonLink>
            ) : null}
            <ButtonLink href={bank.source_url} variant="secondary" size="sm" target="_blank" rel="noopener noreferrer" aria-label={`Open the source page for ${bank.name}`}>
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Source
            </ButtonLink>
          </span>
        </span>
      }
    />
  );
}

function RequestCard({ request }: { request: DbBloodRequest }) {
  const { showToast } = useVyanaWeb();
  const update = useUpdateBloodRequest();
  const message = buildBloodRequestMessage(request);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      showToast("Message copied", "success");
    } catch {
      showToast("Could not copy the message", "error");
    }
  };
  return (
    <Card>
      <CardHeader title={`${request.blood_group} · ${componentWords(request.component)} · ${request.units} ${request.units === 1 ? "unit" : "units"}`} />
      <p className="text-[15px] text-label-2">
        {request.hospital_name}, {request.city}
      </p>
      <div role="group" aria-label="Where this request stands" className="mt-3 flex flex-wrap gap-2">
        {BLOOD_REQUEST_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={request.status === status}
            disabled={update.isPending}
            onClick={() => request.status !== status && update.mutate({ id: request.id, patch: { status } })}
            className={`min-h-[44px] rounded-full px-3.5 text-[14px] font-semibold ${request.status === status ? "bg-accent text-white" : "bg-fill text-label-2"}`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>
      {update.isError ? <p className="mt-2 text-[14px] text-danger-text">Could not save that change. Try again.</p> : null}
      <p className="mt-3 text-[13px] text-label-3">You set every status yourself; nothing here changes by itself.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          <Copy aria-hidden="true" className="h-4 w-4" />
          Copy message
        </Button>
        <ButtonLink href={`https://wa.me/?text=${encodeURIComponent(message)}`} variant="secondary" size="sm" target="_blank" rel="noopener noreferrer">
          <Send aria-hidden="true" className="h-4 w-4" />
          Send on WhatsApp
        </ButtonLink>
        <ButtonLink href={`tel:${request.contact_phone.replace(/\s+/g, "")}`} variant="secondary" size="sm">
          <Phone aria-hidden="true" className="h-4 w-4" />
          Call {request.contact_name}
        </ButtonLink>
      </div>
    </Card>
  );
}

export default function BloodPage() {
  const { data: profile } = useMyProfile();
  const search = useSearchBlood();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useBloodJob(jobId);
  const requests = useBloodRequests();
  const createRequest = useCreateBloodRequest();

  const [group, setGroup] = useState<string | null>(null);
  const [component, setComponent] = useState<BloodComponent>("red_cells");
  const [city, setCity] = useState<string | null>(null);
  const [units, setUnits] = useState("1");
  const [hospital, setHospital] = useState("");
  const [contactName, setContactName] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState<string | null>(null);

  const groupValue = group ?? profile?.blood_group ?? "";
  const cityValue = city ?? profile?.city ?? "";
  const unitsNumber = Number(units);
  const unitsOk = Number.isInteger(unitsNumber) && unitsNumber >= 1 && unitsNumber <= 10;
  const canSearch = BloodGroup.options.includes(groupValue as never) && cityValue.trim().length >= 2 && !search.isPending;
  const nameValue = contactName ?? profile?.full_name ?? "";
  const phoneValue = contactPhone ?? profile?.phone ?? "";
  const canStart = unitsOk && hospital.trim().length >= 2 && nameValue.trim().length >= 1 && phoneValue.trim().length >= 5 && !createRequest.isPending;

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSearch) return;
    const res = await search.mutateAsync({ blood_group: groupValue as never, component, city: cityValue.trim() }).catch(() => null);
    setJobId(res?.job_id ?? null);
  };

  const startRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canStart) return;
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
      .then(() => setHospital(""))
      .catch(() => undefined);
  };

  const result = job.data;
  const running = Boolean(jobId) && (job.isLoading || result?.status === "running");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <LargeTitle eyebrow="Emergency" title="Find blood" subtitle="Blood banks that list stock for your blood group, and a tracker for the request." />

      <Card className="border border-danger-soft bg-danger-soft/40">
        <p className="text-[15px] leading-relaxed text-label">{SAFETY_TEXT}</p>
        <ButtonLink href="tel:108" variant="destructive" size="md" className="mt-3">
          <Phone aria-hidden="true" className="h-4 w-4" />
          Call 108
        </ButtonLink>
      </Card>

      <Card>
        <CardHeader title="Search" />
        <form onSubmit={runSearch} className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Blood group" value={groupValue} onChange={(e) => setGroup(e.target.value)} required>
            <option value="" disabled>
              Select blood group
            </option>
            {BloodGroup.options.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </SelectField>
          <SelectField label="What is needed" value={component} onChange={(e) => setComponent(e.target.value as BloodComponent)}>
            {COMPONENTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <Field label="City" value={cityValue} onChange={(e) => setCity(e.target.value)} placeholder="For example Delhi" autoComplete="address-level2" required className="sm:col-span-2" />
          <Button type="submit" variant="primary" size="lg" disabled={!canSearch} className="sm:col-span-2">
            {search.isPending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Droplets aria-hidden="true" className="h-4 w-4" />}
            Search blood banks
          </Button>
        </form>
        {search.isError ? <ErrorState className="mt-4" title="The search did not start" body="Try again in a moment. In an emergency call 108." onRetry={() => search.reset()} /> : null}
      </Card>

      {jobId ? (
        <Card aria-live="polite">
          <CardHeader title="Blood banks listed" />
          {job.isError ? (
            <ErrorState title="Could not read the results" body="Try again. In an emergency call 108." onRetry={() => job.refetch()} />
          ) : (
            <>
              {running ? <p className="mb-3 text-[15px] text-label-2">Reading the source page for each area. This can take 2 to 3 minutes; you can leave this page open.</p> : null}
              {result ? (
                <ul className="mb-3 flex flex-wrap gap-2" aria-label="Areas searched">
                  {result.sources.map((s) => (
                    <li key={s.area}>
                      <Pill tone={AREA_STATUS[s.status]?.tone ?? "neutral"}>
                        {s.area}: {AREA_STATUS[s.status]?.label ?? s.status}
                      </Pill>
                    </li>
                  ))}
                </ul>
              ) : null}
              {result && result.banks.length > 0 ? (
                <ListGroup>
                  {result.banks.map((b) => (
                    <BankRow key={`${b.name}|${b.city}|${b.phone ?? ""}`} bank={b} />
                  ))}
                </ListGroup>
              ) : null}
              {result?.status === "done" && result.banks.length === 0 ? (
                <EmptyState icon={<Droplets />} title="No blood bank listed for this search" body="Try a nearby city, or call the hospital's own blood bank. In an emergency call 108." />
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Start a request" />
        <p className="mb-3 text-[15px] text-label-2">Keep track of who you called. Uses the blood group, what is needed and the city above.</p>
        <form onSubmit={startRequest} className="grid gap-4 sm:grid-cols-2">
          <Field label="Units needed" type="number" inputMode="numeric" min={1} max={10} value={units} onChange={(e) => setUnits(e.target.value)} hint="1 to 10" error={units !== "" && !unitsOk ? "Enter 1 to 10 units" : undefined} />
          <Field label="Hospital" value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Where the blood is needed" required />
          <Field label="Contact name" value={nameValue} onChange={(e) => setContactName(e.target.value)} autoComplete="name" required />
          <Field label="Contact phone" type="tel" value={phoneValue} onChange={(e) => setContactPhone(e.target.value)} autoComplete="tel" required />
          <Button type="submit" variant="primary" size="lg" disabled={!canStart} className="sm:col-span-2">
            {createRequest.isPending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            Start request
          </Button>
        </form>
        {createRequest.isError ? <p className="mt-2 text-[14px] text-danger-text">Could not save the request. Check the fields and try again.</p> : null}
      </Card>

      <section aria-labelledby="blood-requests" className="space-y-3">
        <h2 id="blood-requests" className="px-1 text-[20px] font-semibold tracking-tight text-label">
          Your requests
        </h2>
        {requests.isError ? (
          <ErrorState onRetry={() => requests.refetch()} />
        ) : requests.data && requests.data.length > 0 ? (
          requests.data.map((r) => <RequestCard key={r.id} request={r} />)
        ) : (
          <Card>
            <p className="text-[15px] text-label-3">{requests.isLoading ? "Loading your requests…" : "No requests yet."}</p>
          </Card>
        )}
      </section>
    </div>
  );
}
