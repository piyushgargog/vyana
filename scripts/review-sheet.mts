/**
 * Writes docs/REVIEW-SHEET.md (private: docs/ is not in git): every entry of the three medically reviewed lists, with its
 * plain-words text, the exact quote and a link to the source, as tick boxes for the human review (#50, EVALUATION §6).
 * Regenerate it after any change to a list.
 *
 *   pnpm review:sheet
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BRAND_SALTS } from "../apps/web/lib/server/safety/brand-salts";
import { CONDITION_RED_FLAGS } from "../apps/web/lib/server/safety/condition-red-flags";
import { INTERACTION_TABLE, TABLE_ADVICE } from "../apps/web/lib/server/safety/interactions-table";

const cell = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const out: string[] = [];
const add = (...lines: string[]) => out.push(...lines);

add(
  "# Review sheet: the three medically reviewed lists",
  "",
  `Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm review:sheet\`. Private (docs/ is not in git).`,
  "",
  "**How to review (about 45 minutes for two people).** Each entry has a quote copied from its source page; `pnpm verify:*` already checked that the quote is really on the page. What a machine can't judge, and you must: **does the plain-words text say the same as the quote, and is the severity right for a patient?** Tick the box when you agree. If not, write the fix next to it. Anything unticked blocks the release (EVALUATION §6).",
  "",
  "Reviewers: Piyush + one teammate. Don't review alone.",
  "",
);

// ---------------------------------------------------------------- 1. interactions
add("## 1. Drug interaction table (`interactions-table.ts`)", "", `Shown to the patient with this advice: "${TABLE_ADVICE}"`, "");
let n = 0;
for (const e of INTERACTION_TABLE) {
  n++;
  add(
    `- [ ] **${n}. ${e.salts[0]} + ${e.salts[1]}** · severity **${e.severity}**`,
    `  - Text shown to the patient: ${e.effect}`,
    `  - Quote: "${e.quote}"`,
    `  - Sources: ${e.sources.map((s) => `[${s.title}](${s.url})`).join("; ")}`,
  );
}

// ---------------------------------------------------------------- 2. red flags
add("", "## 2. Care plan warning signs (`condition-red-flags.ts`)", "", "Shown in every care plan for the condition, next to the SOS button.", "");
for (const c of CONDITION_RED_FLAGS) {
  add(`### ${c.condition}`, "", `Matched when the condition name contains: ${c.match.join(", ")}`, "");
  for (const i of c.items) {
    add(`- [ ] **${i.text}**`, `  - Quote: "${i.quote}"`, `  - Source: [${i.source.title}](${i.source.url})`);
  }
  add("");
}

// ---------------------------------------------------------------- 3. brands
add("## 3. Brand → salt list (`brand-salts.ts`)", "", "A wrong salt here means a wrong interaction answer. Check each brand against what you know; the link is its product page.", "", "| Done | Brand | Salts | Product page |", "|---|---|---|---|");
for (const b of BRAND_SALTS) add(`| [ ] | ${cell(b.brand)} | ${cell(b.salts.join(" + "))} | [page](${b.url}) |`);

add(
  "",
  "## Sign-off",
  "",
  "- [ ] Reviewer 1 (name, date): ",
  "- [ ] Reviewer 2 (name, date): ",
  "- [ ] Changes needed (list): ",
  "",
);

const path = fileURLToPath(new URL("../docs/REVIEW-SHEET.md", import.meta.url));
mkdirSync(fileURLToPath(new URL("../docs/", import.meta.url)), { recursive: true });
writeFileSync(path, out.join("\n"));
console.log(`wrote ${path}: ${INTERACTION_TABLE.length} interactions, ${CONDITION_RED_FLAGS.reduce((s, c) => s + c.items.length, 0)} warning signs, ${BRAND_SALTS.length} brands`);
