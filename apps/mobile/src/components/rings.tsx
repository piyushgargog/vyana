// Care rings on Today (#488, Apple Fitness style): doses taken today, steps against
// their goal, and last night's sleep — one glance, no judgement colours. A ring whose
// data is missing is not drawn at all; when neither device ring has data, one
// "Connect a device" line stands in for both. Drawn with views, like the Activity
// card's steps ring — the app ships no SVG library. Every ring is a button with a
// full VoiceOver / TalkBack label ("Doses, 2 of 3 taken").

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card, Text } from "@/components/ui";
import { T } from "@/constants/theme";

const SIZE = 92;
const STROKE = 9;

/** One ring: a track circle and an accent arc swept clockwise from the top.
 *  A null fill draws the track with NO arc at all: the ring makes no fill claim. */
function RingArc({ fill, color }: { fill: number | null; color: string }) {
  const circle = {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: STROKE,
  };
  if (fill === null) {
    return (
      <View style={{ width: SIZE, height: SIZE }} pointerEvents="none">
        <View style={[circle, styles.track]} />
      </View>
    );
  }
  const clamped = Math.min(1, Math.max(0, fill));
  const rightDeg = -180 + Math.min(clamped, 0.5) * 360;
  const leftDeg = 180 + Math.max(0, clamped - 0.5) * 360;
  return (
    <View style={{ width: SIZE, height: SIZE }} pointerEvents="none">
      <View style={[circle, styles.track]} />
      <View style={[styles.half, { right: 0, width: SIZE / 2, height: SIZE }]}>
        <View
          style={[
            circle,
            styles.arcRight,
            { borderTopColor: color, borderRightColor: color, marginLeft: -SIZE / 2, transform: [{ rotate: `${rightDeg}deg` }] },
          ]}
        />
      </View>
      {clamped > 0.5 ? (
        <View style={[styles.half, { left: 0, width: SIZE / 2, height: SIZE }]}>
          <View
            style={[
              circle,
              styles.arcLeft,
              { borderTopColor: color, borderLeftColor: color, transform: [{ rotate: `${leftDeg}deg` }] },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function Ring({
  label,
  center,
  caption,
  fill,
  color,
  onPress,
}: {
  /** The full screen-reader label, e.g. "Doses, 2 of 3 taken". */
  label: string;
  center: React.ReactNode;
  caption: string;
  /** Fraction of the ring filled, 0–1; null draws the track with no arc (no fill claim). */
  fill: number | null;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.ringPressable}
    >
      <View style={styles.ringWrap}>
        <RingArc fill={fill} color={color} />
        <View style={styles.ringCenter}>{center}</View>
      </View>
      <Text variant="footnote" tone="secondary">
        {caption}
      </Text>
    </Pressable>
  );
}

export interface RingsProps {
  /** Doses taken of those due today; null when nothing was scheduled. */
  doses: { taken: number; due: number } | null;
  /** Today's steps and their goal; null unless device data AND a goal both exist. */
  steps: { value: number; goal: number } | null;
  /** Last night's sleep; null when there is no device data. `text` is `formatSleep`'s words. */
  sleep: { minutes: number; text: string } | null;
  /** Neither device ring has data: show the one "Connect a device" line instead. */
  showConnectLine: boolean;
  onDosesPress: () => void;
  onStepsPress: () => void;
  onSleepPress: () => void;
  onConnectPress: () => void;
}

export function Rings({
  doses,
  steps,
  sleep,
  showConnectLine,
  onDosesPress,
  onStepsPress,
  onSleepPress,
  onConnectPress,
}: RingsProps) {
  if (!doses && !steps && !sleep && !showConnectLine) return null;

  return (
    <Card>
      <View style={styles.row}>
        {doses ? (
          <Ring
            label={`Doses, ${doses.taken} of ${doses.due} taken`}
            fill={doses.due > 0 ? doses.taken / doses.due : 0}
            color={T.color.accent}
            caption="Doses"
            onPress={onDosesPress}
            center={
              <>
                <Text variant="title3">{doses.taken}</Text>
                <Text variant="caption" tone="tertiary">
                  of {doses.due}
                </Text>
              </>
            }
          />
        ) : null}

        {steps ? (
          <Ring
            label={`Steps, ${steps.value.toLocaleString("en-IN")} of ${steps.goal.toLocaleString("en-IN")} goal`}
            fill={steps.value / steps.goal}
            color={T.color.tile.blue}
            caption="Steps"
            onPress={onStepsPress}
            center={
              <>
                <Text variant="title3">{steps.value.toLocaleString("en-IN")}</Text>
                <Text variant="caption" tone="tertiary">
                  steps
                </Text>
              </>
            }
          />
        ) : null}

        {sleep ? (
          <Ring
            label={`Sleep, ${sleep.text} last night`}
            // No sleep goal exists in the data, so any fill would invent a
            // completion ("you slept 100%") that nothing measured. The ring
            // draws its track with no arc at all; the duration in the centre
            // is the whole claim, until a real sleep goal exists to fill
            // against (#525 review).
            fill={null}
            color={T.color.tile.indigo}
            caption="Sleep"
            onPress={onSleepPress}
            center={
              <Text variant="subhead" style={styles.sleepCenter}>
                {sleep.text}
              </Text>
            }
          />
        ) : null}
      </View>

      {showConnectLine ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Connect a device"
          onPress={onConnectPress}
          style={styles.connectLine}
        >
          <Text variant="subhead" tone="accent" style={styles.connectText}>
            Connect a device
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: T.space.md,
  },
  ringPressable: {
    alignItems: "center",
    gap: T.space.xs,
    minHeight: 44,
  },
  ringWrap: { width: SIZE, height: SIZE },
  track: { position: "absolute", borderColor: T.color.fillStrong },
  half: { position: "absolute", top: 0, overflow: "hidden" },
  arcRight: { borderColor: "transparent" },
  arcLeft: { borderColor: "transparent" },
  ringCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: STROKE + 2,
  },
  sleepCenter: { textAlign: "center", fontWeight: "600" },
  connectLine: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  connectText: { fontWeight: "600" },
});
