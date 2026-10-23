"use client";

// "Suggestions for you" (#304, #417): care-agent proposals the patient confirms or dismisses.
// The cards read the real proposals through the db hooks (useMyProposals / useDecideProposal);
// the mock store still serves tests and NEXT_PUBLIC_USE_MOCKS mode. Wording comes from the
// proposal itself (rules wrote it), never from this component. The deciding function has no
// undo, so a dismissal is final — there is no Undo button.
import React, { useEffect, useState } from "react";
import {
  useDecideAgentProposal,
  useDecideProposal,
  useMyAgentProposals,
  useMyProposals,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { Button, Card, CardHeader, SkeletonLine } from "@/components/ui";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import {
  EMPTY_SUGGESTIONS_TEXT,
  decideArgs,
  toSuggestionView,
  visibleSuggestions,
  type SuggestionView,
} from "./suggestions-data";

const MAX_COLLAPSED = 3;
const DISCLAIMER = "Vyana suggested this from your own records.";

function suggestedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function ProposalCard({
  proposal,
  busy,
  onDecide,
}: {
  proposal: SuggestionView;
  busy: boolean;
  onDecide: (p: SuggestionView, decision: "approve" | "reject") => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <Card className="space-y-3">
      <p className="text-[17px] font-semibold text-label">{proposal.title}</p>
      <p className="text-[15px] text-label-2">{proposal.reason}</p>

      <div>
        <button
          type="button"
          onClick={() => setWhyOpen((v) => !v)}
          aria-expanded={whyOpen}
          className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-accent-strong"
        >
          Why you see this
          {whyOpen ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {whyOpen && (
          <div className="space-y-1.5 rounded-row bg-fill/60 p-3 text-[15px]">
            {proposal.evidence.map((row) => (
              <p key={row.label} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium text-label">{row.label}</span>
                <span className="text-label-2">{row.detail}</span>
              </p>
            ))}
            <p className="pt-1 text-[13px] text-label-3">
              Suggested on {suggestedOn(proposal.created_at)}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="md"
          className="min-h-[44px]"
          disabled={busy}
          aria-label={`Do it: ${proposal.title}`}
          onClick={() => onDecide(proposal, "approve")}
        >
          Do it
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="min-h-[44px]"
          disabled={busy}
          aria-label={`Not now: ${proposal.title}`}
          onClick={() => onDecide(proposal, "reject")}
        >
          Not now
        </Button>
      </div>
      <p className="text-[13px] text-label-3">{DISCLAIMER}</p>
    </Card>
  );
}

function SuggestionsView({
  proposals,
  isLoading,
  isError,
  refetch,
  busyId,
  onDecide,
}: {
  proposals: SuggestionView[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  busyId: string | null;
  onDecide: (p: SuggestionView, decision: "approve" | "reject") => void;
}) {
  const [showAll, setShowAll] = useState(false);
  // A ticking clock, so a card whose expiry passes while the page sits open leaves the
  // list without waiting for a refetch.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const visible = visibleSuggestions(proposals, now);
  const shown = showAll ? visible : visible.slice(0, MAX_COLLAPSED);

  return (
    <section aria-label="Suggestions for you" className="space-y-4">
      <CardHeader
        title="Suggestions for you"
        trailing={
          <span className="inline-flex items-center gap-1.5 text-[13px] text-label-3">
            <Lightbulb className="h-4 w-4" aria-hidden="true" /> From your records
          </span>
        }
      />

      {isLoading ? (
        <div className="space-y-4" aria-label="Loading suggestions">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-3">
              <SkeletonLine className="h-5 w-2/3" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-10 w-40" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="space-y-3">
          <p className="text-[15px] font-medium text-label">
            Suggestions could not be loaded.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="min-h-[44px]"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <p className="text-[15px] text-label-2">{EMPTY_SUGGESTIONS_TEXT}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={busyId === p.id}
              onDecide={onDecide}
            />
          ))}
          {!showAll && visible.length > MAX_COLLAPSED && (
            <Button
              variant="secondary"
              size="md"
              className="min-h-[44px]"
              onClick={() => setShowAll(true)}
            >
              See all {visible.length} suggestions
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** Real proposals from the database (#417): pending only, decided through the database function. */
function RealSuggestions() {
  const { showToast } = useVyanaWeb();
  const { data, isLoading, isError, refetch } = useMyProposals("pending");
  const decide = useDecideProposal();

  const handleDecide = (p: SuggestionView, decision: "approve" | "reject") => {
    decide.mutate(decideArgs(p.id, decision), {
      onSuccess: () => {
        if (decision === "approve") showToast("Done", "success");
      },
      onError: (err) => showToast(err.message, "error"),
    });
  };

  return (
    <SuggestionsView
      proposals={(data ?? []).map(toSuggestionView)}
      isLoading={isLoading}
      isError={isError}
      refetch={() => void refetch()}
      busyId={decide.isPending ? (decide.variables?.id ?? null) : null}
      onDecide={handleDecide}
    />
  );
}

/** The mock store's proposals, kept for tests and NEXT_PUBLIC_USE_MOCKS mode. */
function MockSuggestions() {
  const { showToast } = useVyanaWeb();
  const { data, isLoading, isError, refetch } = useMyAgentProposals();
  const decide = useDecideAgentProposal();

  const handleDecide = (p: SuggestionView, decision: "approve" | "reject") => {
    decide.mutate(
      { id: p.id, decision },
      {
        onSuccess: (res) => {
          if (decision === "approve") {
            showToast(res.result_text ?? "Done", "success");
          }
        },
        onError: (err) => showToast(err.message, "error"),
      }
    );
  };

  return (
    <SuggestionsView
      proposals={data?.proposals ?? []}
      isLoading={isLoading}
      isError={isError}
      refetch={() => void refetch()}
      busyId={decide.isPending ? (decide.variables?.id ?? null) : null}
      onDecide={handleDecide}
    />
  );
}

export function SuggestionsForYou() {
  const { useMocks } = useVyanaWeb();
  return useMocks ? <MockSuggestions /> : <RealSuggestions />;
}
