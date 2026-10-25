// The Today brief card (#488), at the top of Today. Its words come from
// `buildTodayBrief` in @vyana/shared — computed in code from the day's own data
// (next dose, resting heart rate trend, a waiting care suggestion), never from
// a model. When there is nothing to say the card is not rendered at all, and no
// part of it ever shows an empty suggestions section.

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { buildTodayBrief, useMyAgentProposals, type DayValue } from "@vyana/shared";

import { Card, Text } from "@/components/ui";
import { useDeviceActivity } from "@/hooks/use-device-activity";
import { T } from "@/constants/theme";

export function BriefCard({
  nextDose,
  dosesScheduled,
}: {
  /** The next dose of today still to take or skip, or null when none is left. */
  nextDose: { medicineName: string; time: string } | null;
  /** How many doses were scheduled for today. */
  dosesScheduled: number;
}) {
  const { data: proposalsData } = useMyAgentProposals();
  const { today, days } = useDeviceActivity();

  // The ticking clock suggestions.tsx keeps: the time is re-read every 30 s,
  // so a proposal that expires while Today stays open stops counting here too
  // and its "Ask your doctor" line drops without waiting for a refetch
  // (#525 review).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);
  const hasCareSuggestion = (proposalsData?.proposals ?? []).some(
    (p) => p.expires_at === null || new Date(p.expires_at).getTime() > nowMs,
  );

  const hrValues: DayValue[] = days.flatMap((d) =>
    d.resting_hr !== null ? [{ day: d.day, value: d.resting_hr }] : [],
  );

  const brief = buildTodayBrief({
    nextDose,
    dosesScheduled,
    restingHeartRate: hrValues.length > 0 ? { values: hrValues, today } : null,
    hasCareSuggestion,
  });

  if (brief.lines.length === 0) return null;

  return (
    <Card>
      <View style={styles.lines}>
        {brief.doseLine ? <Text variant="headline">{brief.doseLine}</Text> : null}
        {brief.changeLine ? (
          <Text variant="subhead" tone="secondary">
            {brief.changeLine}
          </Text>
        ) : null}
        {brief.doctorLine ? <Text variant="subhead">{brief.doctorLine}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  lines: { gap: T.space.xs },
});
