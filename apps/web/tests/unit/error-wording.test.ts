// U5 (#289): an error never says only "Something went wrong" — it says what failed and what to
// do next. This scan keeps the phrase out of every user-visible string: the app screens and
// components, and the web lib too, because the server writes messages the patient reads
// (the assistant's streamed error, the API error shape).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function* sourceFiles(dir: string, skipDirs: string[] = []): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (skipDirs.includes(entry)) continue;
      yield* sourceFiles(full, skipDirs);
    } else if (/\.tsx?$/.test(entry)) {
      yield full;
    }
  }
}

describe("error wording (U5)", () => {
  it('no user-visible string says "Something went wrong"', () => {
    const offenders: string[] = [];
    const scans: { root: string; skipDirs?: string[] }[] = [
      // app/ holds the route handlers under api/; those return the lib error shape, which
      // the lib scan below covers directly.
      { root: join(process.cwd(), "app"), skipDirs: ["api"] },
      { root: join(process.cwd(), "components") },
      { root: join(process.cwd(), "lib") },
      { root: join(process.cwd(), "..", "mobile", "src") },
    ];
    for (const { root, skipDirs } of scans) {
      for (const file of sourceFiles(root, skipDirs)) {
        if (/something went wrong/i.test(readFileSync(file, "utf8"))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
