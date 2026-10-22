#!/usr/bin/env node

/**
 * Fails if the generated AndroidManifest.xml does not actively block every
 * permission listed in `android.blockedPermissions` in app.json.
 *
 * Why this exists (issue #377): the shipped 1.0.0 APK requested RECORD_AUDIO
 * and SYSTEM_ALERT_WINDOW even though the app never uses either. The block
 * works through `tools:node="remove"` entries that Expo writes into the app
 * manifest at prebuild; the Android manifest merger then strips the
 * permissions even when a library's own manifest asks for them. Nothing
 * checked that those entries survived, so the block could regress silently.
 * This script is that check: a blocked permission must appear in the
 * generated manifest ONLY as a `tools:node="remove"` entry.
 *
 * Usage:
 *   npx expo prebuild --platform android --no-install
 *   node ./scripts/check-android-permissions.mjs [path-to-AndroidManifest.xml]
 *
 * The manifest path defaults to android/app/src/main/AndroidManifest.xml
 * relative to apps/mobile.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function blockedPermissionsFromConfig(config) {
  const blocked = config?.expo?.android?.blockedPermissions ?? [];
  return blocked.map((permission) =>
    permission.includes(".") ? permission : `android.permission.${permission}`,
  );
}

export function findBlockingProblems(manifestXml, blockedPermissions) {
  const problems = [];
  const entries = manifestXml.match(/<uses-permission[^>]*>/g) ?? [];

  for (const permission of blockedPermissions) {
    const matching = entries.filter((entry) =>
      entry.includes(`android:name="${permission}"`),
    );
    const removes = matching.filter((entry) =>
      entry.includes('tools:node="remove"'),
    );
    const plain = matching.filter(
      (entry) => !entry.includes('tools:node="remove"'),
    );

    if (plain.length > 0) {
      problems.push(
        `${permission} is requested by the generated manifest (it must only appear as a tools:node="remove" entry)`,
      );
    }
    if (removes.length === 0) {
      problems.push(
        `${permission} has no tools:node="remove" entry in the generated manifest, so a library manifest merge can add it back at build time`,
      );
    }
  }

  return problems;
}

function main() {
  const manifestPath =
    process.argv[2] ?? join(mobileRoot, "android/app/src/main/AndroidManifest.xml");

  const config = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
  const blocked = blockedPermissionsFromConfig(config);
  if (blocked.length === 0) {
    console.error("app.json lists no android.blockedPermissions; nothing to check.");
    process.exit(1);
  }

  let manifestXml;
  try {
    manifestXml = readFileSync(manifestPath, "utf8");
  } catch {
    console.error(
      `Cannot read ${manifestPath}. Run \`npx expo prebuild --platform android\` first.`,
    );
    process.exit(1);
  }

  const problems = findBlockingProblems(manifestXml, blocked);
  if (problems.length > 0) {
    console.error("Blocked Android permissions are not fully blocked:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(
    `OK: ${blocked.join(", ")} appear only as tools:node="remove" entries in ${manifestPath}.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
