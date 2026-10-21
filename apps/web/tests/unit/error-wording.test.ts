// U5 (#289): an error never says only "Something went wrong" — it says what failed and what to
// do next. This scan keeps the phrase out of every app screen and component.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "api" || entry === "lib") continue;
      yield* sourceFiles(full);
    } else if (/\.tsx?$/.test(entry)) {
      yield full;
    }
  }
}

describe("error wording (U5)", () => {
  it('no app screen says "Something went wrong"', () => {
    const offenders: string[] = [];
    for (const root of [
      join(process.cwd(), "app"),
      join(process.cwd(), "components"),
      join(process.cwd(), "..", "mobile", "src"),
    ]) {
      for (const file of sourceFiles(root)) {
        if (/something went wrong/i.test(readFileSync(file, "utf8"))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
