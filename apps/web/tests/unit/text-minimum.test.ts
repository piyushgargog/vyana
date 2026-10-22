// U1 (#285): no text below 11 px / 11 pt anywhere in the apps, and icon-only buttons are never
// under the 44 px tap target. Scans the sources so a small size cannot slip back in.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.tsx?$/.test(entry)) yield full;
  }
}

describe("minimum text and targets (U1)", () => {
  it("no web class sets text under 11 px", () => {
    const offenders: string[] = [];
    for (const root of [join(process.cwd(), "app"), join(process.cwd(), "components")]) {
      for (const file of sourceFiles(root)) {
        if (/text-\[(8|9|10)(\.\d)?px\]/.test(readFileSync(file, "utf8"))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no phone style sets a font under 11 pt", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "..", "mobile", "src"))) {
      if (/fontSize:\s*(8|9|10)(?![\d.])/.test(readFileSync(file, "utf8"))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("the small icon button is still a 44 px target", () => {
    const button = readFileSync(join(process.cwd(), "components", "ui", "button.tsx"), "utf8");
    expect(button).toContain('sm: "h-11 w-11 p-0"');
  });
});
