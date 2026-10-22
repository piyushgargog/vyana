import { describe, expect, it } from "vitest";

import {
  blockedPermissionsFromConfig,
  findBlockingProblems,
} from "./check-android-permissions.mjs";

const BLOCKED = [
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW",
];

const manifestWith = (entries) => `<manifest>${entries.join("\n")}</manifest>`;

describe("blockedPermissionsFromConfig", () => {
  it("reads the blocked list from app.json shape", () => {
    expect(
      blockedPermissionsFromConfig({
        expo: { android: { blockedPermissions: BLOCKED } },
      }),
    ).toEqual(BLOCKED);
  });

  it("expands shorthand names", () => {
    expect(
      blockedPermissionsFromConfig({
        expo: { android: { blockedPermissions: ["RECORD_AUDIO"] } },
      }),
    ).toEqual(["android.permission.RECORD_AUDIO"]);
  });
});

describe("findBlockingProblems", () => {
  it("passes when each blocked permission is only a remove entry", () => {
    const xml = manifestWith([
      '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>',
      '<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>',
      '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/>',
    ]);
    expect(findBlockingProblems(xml, BLOCKED)).toEqual([]);
  });

  it("fails when a blocked permission is requested outright", () => {
    const xml = manifestWith([
      '<uses-permission android:name="android.permission.RECORD_AUDIO"/>',
      '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/>',
    ]);
    const problems = findBlockingProblems(xml, BLOCKED);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("RECORD_AUDIO");
  });

  it("fails when a blocked permission has no remove entry at all", () => {
    const xml = manifestWith([
      '<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>',
    ]);
    const problems = findBlockingProblems(xml, BLOCKED);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("SYSTEM_ALERT_WINDOW");
  });
});
