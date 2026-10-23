import { beforeEach, describe, expect, it } from "vitest";

import {
  agentDecideMock,
  agentProposalsMock,
  resetAgentProposalsMock,
  visibleProposals,
} from "./agent-proposals";

beforeEach(() => resetAgentProposalsMock());

describe("care agent proposal mocks (#304)", () => {
  it("shows pending proposals newest first, and never an expired one", () => {
    const list = agentProposalsMock().proposals;
    expect(list.map((p) => p.id)).toEqual([
      "proposal-refill-metformin",
      "proposal-lab-hba1c",
      "proposal-notify-caregiver",
    ]);
    expect(list.some((p) => p.id === "proposal-expired-refill")).toBe(false);
  });

  it("visibleProposals honours an explicit clock for expiry", () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    expect(visibleProposals(future)).toEqual([]);
  });

  it("approving settles the card and returns the result text for the toast", () => {
    const res = agentDecideMock({ id: "proposal-refill-metformin", decision: "approve" });
    expect(res.status).toBe("approved");
    expect(res.result_text).toBe("Reminder added for Monday 9:00");
    expect(agentProposalsMock().proposals.map((p) => p.id)).not.toContain(
      "proposal-refill-metformin"
    );
  });

  it("rejecting removes the card, offers 5 seconds of undo, and restore brings it back", () => {
    const res = agentDecideMock({ id: "proposal-lab-hba1c", decision: "reject" });
    expect(res.status).toBe("rejected");
    expect(res.undo_seconds).toBe(5);
    expect(agentProposalsMock().proposals.map((p) => p.id)).not.toContain("proposal-lab-hba1c");

    const back = agentDecideMock({ id: "proposal-lab-hba1c", decision: "restore" });
    expect(back.status).toBe("pending");
    expect(agentProposalsMock().proposals.map((p) => p.id)).toContain("proposal-lab-hba1c");
  });

  it("no mock wording carries a dose or a diagnosis claim", () => {
    const text = agentProposalsMock()
      .proposals.flatMap((p) => [p.title, p.reason, ...p.evidence.flatMap((e) => [e.label, e.detail])])
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/\b\d+\s?(mg|ml|mcg)\b/);
    expect(text).not.toContain("safe");
    expect(text).not.toContain("diagnos");
  });
});
