// The Activity card on Today (issue #328): today's steps, resting heart rate and last
// night's sleep, straight from the connected device. Every value names the device it
// came from, and nothing is coloured as good or bad — the accent is the only colour.
// The heart-rate arrow is a plain direction against the 7-day average, and it appears
// only when at least 4 of the last 7 days have a reading (the gate inside
// `buildActivityCard`, from `computeTrend`).

import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Card, CardHeader, Text } from "@/components/ui";
import { T } from "@/constants/theme";
import { useActivityCard } from "@/hooks/use-device-activity";

const ARROWS = { up: "↑", down: "↓", same: "→" } as const;

/**
 * The steps ring, drawn from views (the app ships no SVG on mobile). Two clipped
 * halves each hold a half-coloured circle; rotating them sweeps the accent arc
 * clockwise from the top. Rendered only when a goal exists — with no goal the card
 * shows the plain number and the ring makes no fill claim.
 */
function StepsRing({ fill, value }: { fill: number; value: number }) {
  const size = 92;
  const stroke = 9;
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: stroke,
  };
  const rightDeg = -180 + Math.min(fill, 0.5) * 360;
  const leftDeg = 180 + Math.max(0, fill - 0.5) * 360;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="summary"
      accessibilityLabel={`Steps today: ${value.toLocaleString("en-IN")}`}
    >
      <View style={[circle, styles.ringTrack]} />
      <View style={[styles.ringHalf, { right: 0, width: size / 2, height: size }]}>
        <View
          style={[
            circle,
            styles.ringArcRight,
            { marginLeft: -size / 2, transform: [{ rotate: `${rightDeg}deg` }] },
          ]}
        />
      </View>
      {fill > 0.5 ? (
        <View style={[styles.ringHalf, { left: 0, width: size / 2, height: size }]}>
          <View
            style={[circle, styles.ringArcLeft, { transform: [{ rotate: `${leftDeg}deg` }] }]}
          />
        </View>
      ) : null}
      <View style={styles.ringCenter}>
        <Text variant="title3">{value.toLocaleString("en-IN")}</Text>
        <Text variant="caption" tone="tertiary">
          steps
        </Text>
      </View>
    </View>
  );
}

export function ActivityCard() {
  const router = useRouter();
  // No step goal exists in the profile yet, so the goal is null and the card shows
  // the plain number (issue #328 leaves the goal's home as a question on the PR).
  const model = useActivityCard(null);
  const { steps, resting_hr: hr, sleep } = model;

  return (
    <Card>
      <CardHeader title="Activity" />
      {!model.has_data ? (
        <View style={styles.empty}>
          <Text variant="subhead" tone="secondary">
            No device readings yet. When a watch or band is connected, steps, resting heart
            rate and sleep appear here.
          </Text>
          <Button
            title="Connected devices"
            variant="secondary"
            size="sm"
            onPress={() => router.push("/devices")}
          />
        </View>
      ) : (
        <>
          {steps ? (
            <View style={styles.stepsRow}>
              {steps.fill !== null ? (
                <StepsRing fill={steps.fill} value={steps.value} />
              ) : (
                <View style={styles.stepsPlain}>
                  <Text variant="title1">{steps.value.toLocaleString("en-IN")}</Text>
                  <Text variant="caption" tone="tertiary">
                    steps
                  </Text>
                </View>
              )}
              <View style={styles.rowMeta}>
                <Text variant="headline">Steps today</Text>
                {steps.goal !== null ? (
                  <Text variant="footnote" tone="secondary">
                    Goal {steps.goal.toLocaleString("en-IN")}
                  </Text>
                ) : null}
                <Text variant="footnote" tone="tertiary">
                  from {steps.from}
                </Text>
              </View>
            </View>
          ) : null}

          {hr ? (
            <View style={styles.row}>
              <View style={styles.rowMeta}>
                <Text variant="headline">Resting heart rate</Text>
                <Text variant="footnote" tone="tertiary">
                  from {hr.from}
                </Text>
              </View>
              <View style={styles.valueCol}>
                <Text variant="title3">{hr.value} bpm</Text>
                {hr.arrow !== null && hr.average_7d !== null ? (
                  <Text variant="footnote" tone="secondary">
                    {ARROWS[hr.arrow]} 7-day average {Math.round(hr.average_7d)}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {sleep ? (
            <View style={styles.row}>
              <View style={styles.rowMeta}>
                <Text variant="headline">Sleep last night</Text>
                <Text variant="footnote" tone="tertiary">
                  from {sleep.from}
                </Text>
              </View>
              <Text variant="title3">{sleep.text}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Button
              title="Health trends"
              variant="secondary"
              size="sm"
              onPress={() => router.push("/health-trends")}
            />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: { gap: T.space.md, alignItems: "flex-start" },
  stepsRow: { flexDirection: "row", alignItems: "center", gap: T.space.lg },
  stepsPlain: { minWidth: 92, alignItems: "flex-start", gap: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: T.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.color.separator,
    paddingTop: T.space.md,
  },
  rowMeta: { flex: 1, gap: 2 },
  valueCol: { alignItems: "flex-end", gap: 2 },
  footer: { alignItems: "flex-start" },
  ringTrack: { position: "absolute", borderColor: T.color.fillStrong },
  ringHalf: { position: "absolute", top: 0, overflow: "hidden" },
  ringArcRight: {
    borderColor: "transparent",
    borderTopColor: T.color.accent,
    borderRightColor: T.color.accent,
  },
  ringArcLeft: {
    borderColor: "transparent",
    borderTopColor: T.color.accent,
    borderLeftColor: T.color.accent,
  },
  ringCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
