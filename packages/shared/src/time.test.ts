import { describe, expect, it, vi } from "vitest";
import { sleep } from "./time";

describe("sleep", () => {
  it("resolves only once the given delay has passed", async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const p = sleep(100).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(99);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
