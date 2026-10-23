"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  isShareUrlDead,
  shareScopeLabel,
  useCreateShareLink,
  useShareLinks,
  useTimeline,
  type ShareScope,
  type TimelineEntry,
  type TimelineKind,
} from "@vyana/shared";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LargeTitle,
  Pill,
  cn,
} from "@/components/ui";
import { QrCodeSvg, SkeletonCard } from "@/components/ui-primitives";
import { useVyanaWeb } from "@/components/providers";
import { CalendarDays, ChevronRight, Share2, X } from "lucide-react";

const FILTERS = ["all", "prescription", "report", "appointment", "condition"] as const;

/** How long a share link can last (#239). */
const DURATIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
] as const;

/** The record sections a scoped link can include — the Health Memory Graph scopes (#237). */
const SCOPE_OPTIONS: { scope: ShareScope; label: string }[] = [
  { scope: "labs", label: "Labs" },
  { scope: "vitals", label: "Vitals" },
  { scope: "medicines", label: "Medicines" },
  { scope: "adherence", label: "Adherence" },
];

function filterLabel(f: (typeof FILTERS)[number]): string {
  switch (f) {
    case "all":
      return "All events";
    case "prescription":
      return "Prescriptions";
    case "report":
      return "Lab reports";
    case "appointment":
      return "OPD visits";
    case "condition":
      return "Care plans";
  }
}

function kindPill(kind: TimelineKind): { label: string; tone: "accent" | "neutral" | "warn" } {
  switch (kind) {
    case "prescription":
      return { label: "Prescription", tone: "accent" };
    case "report":
      return { label: "Lab report", tone: "neutral" };
    case "appointment":
      return { label: "OPD visit", tone: "warn" };
    case "condition":
      return { label: "Care plan", tone: "neutral" };
  }
}

function entryHref(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "prescription":
      return `/prescriptions/${entry.id}`;
    case "report":
      return `/reports/${entry.id}`;
    case "condition":
      return `/care/${entry.id}`;
    case "appointment":
      return "/appointments";
  }
}

function Chip({
  selected,
  onPress,
  label,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPress}
      className={cn(
        "min-h-11 rounded-full border px-4 text-[14px] font-semibold transition-colors",
        selected
          ? "border-accent bg-accent text-white"
          : "border-separator bg-surface text-label-2 hover:bg-fill",
      )}
    >
      {label}
    </button>
  );
}

export default function TimelinePage() {
  const { showToast } = useVyanaWeb();

  const { data: timeline = [], isLoading, isError: timelineError, refetch: refetchTimeline } = useTimeline();
  const createShareMutation = useCreateShareLink();
  const { data: shareLinks = [] } = useShareLinks();

  const [filter, setFilter] = useState<"all" | TimelineKind>("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(24);
  // Opt-in (#239): a fresh link shares the basic timeline only; the patient switches on
  // each record section they want the doctor to see.
  const [selectedScopes, setSelectedScopes] = useState<ShareScope[]>([]);
  const [created, setCreated] = useState<{ url: string; hours: number; scopes: ShareScope[] } | null>(null);
  // A link turned off (or expired) in Profile must not keep showing here as active.
  const shareUrl = created && !isShareUrlDead(shareLinks, created.url) ? created.url : null;

  const durationLabel = DURATIONS.find((d) => d.hours === durationHours)?.label ?? "24 hours";
  const createdDurationLabel = DURATIONS.find((d) => d.hours === created?.hours)?.label ?? "24 hours";

  const toggleScope = (scope: ShareScope) =>
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));

  const filteredEntries = timeline.filter((e) => (filter === "all" ? true : e.kind === filter));

  const handleGenerateShare = async () => {
    try {
      const res = await createShareMutation.mutateAsync({
        kind: "timeline",
        ttl_hours: durationHours,
        scopes: selectedScopes,
      });
      setCreated({
        url: res.url || `${window.location.origin}/share/${res.token}`,
        hours: durationHours,
        scopes: selectedScopes,
      });
      setShareOpen(true);
      showToast(`${durationLabel} doctor share link created`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create share link", "error");
    }
  };

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied for your doctor", "success");
    } catch {
      showToast("Could not copy the link", "error");
    }
  };

  return (
    <div className="space-y-6">
      <LargeTitle eyebrow="Health" title="Timeline" />

      <Card>
        <CardHeader title="Share with doctor" />
        <p className="text-[15px] leading-relaxed text-label-2">
          Create an expiring link and QR code for a doctor. Choose how long it lasts and which
          parts of your record it includes.
        </p>

        <p className="mt-4 text-[13px] font-bold text-label-3">Link lasts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <Chip
              key={d.hours}
              label={d.label}
              selected={durationHours === d.hours}
              onPress={() => setDurationHours(d.hours)}
            />
          ))}
        </div>

        <p className="mt-4 text-[13px] font-bold text-label-3">Include in the shared record</p>
        <div className="mt-1 divide-y divide-separator">
          {SCOPE_OPTIONS.map((o) => {
            const isOn = selectedScopes.includes(o.scope);
            return (
              <button
                key={o.scope}
                type="button"
                role="switch"
                aria-checked={isOn}
                aria-label={`Include ${o.label}`}
                onClick={() => toggleScope(o.scope)}
                className="flex min-h-11 w-full items-center justify-between py-2 text-left"
              >
                <span className="text-[15px] text-label">{o.label}</span>
                <span className={cn("text-[14px] font-semibold", isOn ? "text-accent-strong" : "text-label-3")}>
                  {isOn ? "Included" : "Off"}
                </span>
              </button>
            );
          })}
        </div>
        {selectedScopes.length === 0 ? (
          <p className="mt-2 text-[13px] text-label-3">
            With nothing selected, the link shows your basic timeline without the summary
            sections.
          </p>
        ) : null}

        <div className="mt-4">
          <Button onClick={handleGenerateShare} disabled={createShareMutation.isPending}>
            <Share2 aria-hidden="true" className="h-[18px] w-[18px]" />
            {createShareMutation.isPending ? "Generating…" : `Share for ${durationLabel}`}
          </Button>
        </div>
      </Card>

      {shareOpen && shareUrl ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-label">Doctor share link active</h2>
            <button
              type="button"
              aria-label="Dismiss share view"
              onClick={() => setShareOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-label-3 transition-colors hover:bg-fill hover:text-label"
            >
              <X aria-hidden="true" className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="mt-2">
            <Pill tone="warn">{`Expires in ${createdDurationLabel}`}</Pill>
          </div>
          <p className="mt-2 text-[14px] text-label-2">
            {created && created.scopes.length > 0
              ? `Includes: ${created.scopes.map(shareScopeLabel).join(" · ")}`
              : "Basic timeline — no summary sections included."}
          </p>
          <div className="mt-4 flex justify-center">
            <QrCodeSvg data={shareUrl} size={200} label="Doctor Timeline Share QR" />
          </div>
          <p className="mt-3 break-all text-[14px] font-semibold text-accent-strong">{shareUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopyShare}>
              Copy link
            </Button>
            <Button variant="plain" size="sm" onClick={() => window.open(shareUrl, "_blank", "noopener")}>
              Open web view
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter timeline">
        {FILTERS.map((f) => (
          <Chip key={f} label={filterLabel(f)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : timelineError ? (
        <ErrorState
          title="Your timeline could not be loaded"
          body="Check your connection and try again."
          onRetry={() => void refetchTimeline()}
        />
      ) : filteredEntries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays aria-hidden="true" />}
            title="No timeline events yet"
            body="Your prescriptions, lab reports and doctor visits will appear here in chronological order."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const pill = kindPill(entry.kind);
            return (
              <Link key={`${entry.kind}:${entry.id}`} href={entryHref(entry)} className="block">
                <Card className="transition-colors hover:bg-fill/60">
                  <div className="flex items-center justify-between gap-3">
                    <Pill tone={pill.tone}>{pill.label}</Pill>
                    <span className="text-[13px] text-label-3">{entry.date}</span>
                  </div>
                  <h2 className="mt-2 text-[17px] font-semibold text-label">{entry.title}</h2>
                  {entry.subtitle ? (
                    <p className="mt-0.5 text-[15px] text-label-2">{entry.subtitle}</p>
                  ) : null}
                  <p className="mt-2 flex items-center gap-1 text-[14px] font-semibold text-accent-strong">
                    View details
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
