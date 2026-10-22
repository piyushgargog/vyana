// W3 (#297): the old web-agent vendor is gone from every user-visible string under apps/, and the
// doctor badge words are the manual-check ones. This scans the app sources so the name cannot
// quietly come back in a label, a toast or a page. One exception: the privacy page keeps its
// sub-processor line until PR X ships, because main still sends lookup data to that vendor —
// the line is a disclosure, not a product claim, and it goes when the data flow does.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const APP_ROOTS = [
  join(process.cwd(), "app"),
  join(process.cwd(), "components"),
  join(process.cwd(), "..", "mobile", "src"),
];

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "api" || entry === "lib") continue; // server internals are PR S / PR X scope
      yield* sourceFiles(full);
    } else if (/\.tsx?$/.test(entry)) {
      yield full;
    }
  }
}

describe("vendor removal (W3)", () => {
  it("no app screen or component names the old vendor", () => {
    const offenders: string[] = [];
    for (const root of APP_ROOTS) {
      for (const file of sourceFiles(root)) {
        if (file.endsWith(join("(public)", "privacy", "page.tsx"))) continue;
        if (/tinyfish/i.test(readFileSync(file, "utf8"))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the doctor badge words are the manual-check ones", () => {
    const doctorPage = readFileSync(
      join(process.cwd(), "app", "(app)", "doctor", "page.tsx"),
      "utf8"
    );
    expect(doctorPage).toContain("Checked by Vyana admin");
    expect(doctorPage).toContain("Not checked yet");
    expect(doctorPage).not.toContain("Verified Doctor");

    const adminPage = readFileSync(
      join(process.cwd(), "app", "(app)", "admin", "doctors", "page.tsx"),
      "utf8"
    );
    expect(adminPage).toContain("Open the NMC register");
    expect(adminPage).toContain("Check by hand");
    expect(adminPage).not.toContain("Refresh / Verify OPD");
  });
});
