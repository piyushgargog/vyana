import { describe, expect, it } from "vitest";
import { latestVitalLine } from "@/components/share/share-utils";

const manual = { at: "2026-10-01T08:00:00Z", value: 120, value2: 80 };

describe("latestVitalLine", () => {
  it("renders nothing for manual-only readings", () => {
    expect(latestVitalLine([manual, { ...manual, at: "2026-10-02T08:00:00Z" }], "mmHg")).toBeNull();
    expect(latestVitalLine([{ ...manual, from_device: false }], "mmHg")).toBeNull();
  });
  it("marks a latest device reading", () => {
    const line = latestVitalLine([manual, { ...manual, at: "2026-10-02T08:00:00Z", from_device: true }], "mmHg");
    expect(line).toContain("Latest: 120/80 mmHg");
    expect(line).toMatch(/· from device$/);
  });
  it("says some readings when only an older one is from a device", () => {
    const line = latestVitalLine([{ ...manual, from_device: true }, { ...manual, at: "2026-10-02T08:00:00Z" }], null);
    expect(line).toMatch(/some readings from device$/);
  });
});
