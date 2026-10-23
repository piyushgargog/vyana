"use client";

// "Suggestions for you" (#304): care-agent proposals the patient confirms or dismisses.
// Mock-first against the provisional contract in @vyana/shared; wording comes from the proposal
// itself (rules wrote it), never from this component.
import React, { useEffect, useRef, useState } from "react";
import { useDecideAgentProposal, useMyAgentProposals, type AgentProposal } from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { Button, Card, CardHeader, SkeletonLine } from "@/components/ui";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";

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
  proposal: AgentProposal;
  busy: boolean;
  onDecide: (p: AgentProposal, decision: "approve" | "reject") => void;
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
          aria-label={`Got it: ${proposal.title}`}
          onClick={() => onDecide(proposal, "approve")}
        >
          Got it
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

export function SuggestionsForYou() {
  const { showToast } = useVyanaWeb();
  const { data, isLoading, isError, refetch } = useMyAgentProposals();
  const decide = useDecideAgentProposal();
  const [showAll, setShowAll] = useState(false);
  // Every dismissal keeps its own undo slot and timer, so dismissing a second card
  // never makes the first one permanent early.
  const [undos, setUndos] = useState<{ id: string; title: string }[]>([]);
  const undoTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // A ticking clock, so a card whose expiry passes while the page sits open leaves the
  // list without waiting for a refetch.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timers = undoTimers.current;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(tick);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const proposals = (data?.proposals ?? []).filter(
    (p) => p.expires_at === null || new Date(p.expires_at).getTime() > now
  );
  const visible = showAll ? proposals : proposals.slice(0, MAX_COLLAPSED);

  const dropUndo = (id: string) => {
    const timer = undoTimers.current.get(id);
    if (timer) clearTimeout(timer);
    undoTimers.current.delete(id);
    setUndos((prev) => prev.filter((u) => u.id !== id));
  };

  const handleDecide = (p: AgentProposal, decision: "approve" | "reject") => {
    decide.mutate(
      { id: p.id, decision },
      {
        onSuccess: (res) => {
          if (decision === "approve") {
            showToast(res.result_text ?? "Done", "success");
          } else if (res.undo_seconds > 0) {
            setUndos((prev) => [...prev.filter((u) => u.id !== p.id), { id: p.id, title: p.title }]);
            undoTimers.current.set(
              p.id,
              setTimeout(() => dropUndo(p.id), res.undo_seconds * 1000)
            );
          }
        },
        onError: (err) => showToast(err.message, "error"),
      }
    );
  };

  const handleUndo = (id: string) => {
    dropUndo(id);
    decide.mutate(
      { id, decision: "restore" },
      { onError: (err) => showToast(err.message, "error") }
    );
  };

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
      ) : proposals.length === 0 ? (
        <Card>
          <p className="text-[15px] text-label-2">Nothing to suggest right now.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={decide.isPending && decide.variables?.id === p.id}
              onDecide={handleDecide}
            />
          ))}
          {!showAll && proposals.length > MAX_COLLAPSED && (
            <Button
              variant="secondary"
              size="md"
              className="min-h-[44px]"
              onClick={() => setShowAll(true)}
            >
              See all {proposals.length} suggestions
            </Button>
          )}
          {undos.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-row bg-fill px-3 py-2"
              role="status"
            >
              <span className="text-[15px] text-label-2">Dismissed: {u.title}</span>
              <Button variant="secondary" size="sm" className="min-h-11" onClick={() => handleUndo(u.id)}>
                Undo
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
