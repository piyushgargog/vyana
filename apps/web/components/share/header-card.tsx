import { Phone, ShieldAlert } from "lucide-react";
import type { ShareRes, SharedProfile } from "@vyana/shared";
import { Card, CardHeader, Pill } from "@/components/ui";
import { ExpiryCountdown } from "./expiry-countdown";

/**
 * The top of the public record (issue #238): who the patient is, how long the link
 * stays valid, and the two things a reader needs first — blood group and allergies.
 * Everything shown comes from the record itself; nothing is added.
 */
export function ShareHeaderCard({ record }: { record: ShareRes }) {
  const { profile, kind, expires_at } = record;
  const expiresDate = new Date(expires_at);

  return (
    <Card className="share-section p-6 sm:p-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-label">
              {profile.full_name || "Patient Record"}
            </h1>
            <ExpiryCountdown expiresAt={expires_at} />
          </div>

          <p className="text-[13px] text-label-3">
            Link valid until{" "}
            {Number.isNaN(expiresDate.getTime())
              ? "the date on the link"
              : `${expiresDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}, ${expiresDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}`}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-[14px] text-label-2">
            {profile.age != null && (
              <span>
                Age: <strong className="text-label">{profile.age} years</strong>
              </span>
            )}
            {profile.blood_group && <Pill tone="danger">Blood group: {profile.blood_group}</Pill>}
            <span className="text-label-3">·</span>
            <span className="capitalize text-label-3">Scope: {kind.replace("_", " ")}</span>
          </div>

          {profile.emergency_contacts && profile.emergency_contacts.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] pt-1">
              <span className="font-semibold text-label">Emergency contacts:</span>
              {profile.emergency_contacts.map((c, i) => (
                <a
                  key={i}
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-separator bg-fill px-3 py-1 font-semibold text-label transition-colors hover:bg-accent-soft hover:text-accent-strong motion-reduce:transition-none"
                >
                  <Phone className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {c.name}: {c.phone}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="w-full sm:w-72 shrink-0">
          {profile.allergies && profile.allergies.length > 0 ? (
            <div className="rounded-card border border-danger-soft bg-danger-soft p-4 text-[13px] text-danger-text space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                <span>Known Allergies</span>
              </div>
              <ul className="list-disc pl-4 font-semibold space-y-0.5">
                {profile.allergies.map((alg, i) => (
                  <li key={i}>{alg}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-card border border-separator bg-fill/50 p-3.5 text-[13px] text-label-3">
              No drug allergies recorded.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** The record's standing facts beside the header: active conditions and active medicines. */
export function ShareConditionsMeds({ profile }: { profile: SharedProfile }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="share-section space-y-3">
        <CardHeader title={`Active conditions (${profile.conditions?.length || 0})`} />

        {!profile.conditions || profile.conditions.length === 0 ? (
          <p className="text-[14px] text-label-3 py-2">No active diagnosed conditions listed.</p>
        ) : (
          <ul className="space-y-2 text-[14px]">
            {profile.conditions.map((cond, i) => (
              <li
                key={i}
                className="rounded-row border border-separator bg-fill/50 px-3.5 py-2 font-medium text-label"
              >
                {cond}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="share-section space-y-3">
        <CardHeader title={`Active medications (${profile.active_medicines?.length || 0})`} />

        {!profile.active_medicines || profile.active_medicines.length === 0 ? (
          <p className="text-[14px] text-label-3 py-2">No active prescribed medications listed.</p>
        ) : (
          <div className="space-y-2 text-[14px]">
            {profile.active_medicines.map((med, i) => (
              <div
                key={i}
                className="rounded-row border border-separator bg-fill/50 px-3.5 py-2.5 flex items-center justify-between gap-3"
              >
                <div>
                  <strong className="text-label block font-semibold">
                    {med.name} {med.strength || ""}
                  </strong>
                  <span className="text-[12px] text-label-3">
                    {med.dose || "1 dose"} · {med.frequency}
                  </span>
                </div>
                <Pill tone="accent">Active</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
