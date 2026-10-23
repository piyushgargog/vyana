import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ALL_DEVICE_METRICS, DEVICE_METRIC_EXPLAINER, DEVICE_METRIC_LABELS } from '@vyana/shared';
import { Text } from './ui';
import { T } from '@/constants/theme';

/**
 * What connecting a device means, in plain lines (#327): one line per metric saying
 * what Vyana uses it for, then the two standing lines from ADR-073. Shown before the
 * system permission dialog and linked from the "Device health data" consent item.
 * No readings, no thresholds, no advice — this explains data use only.
 */
export function DeviceExplainer() {
  return (
    <View style={styles.root}>
      {ALL_DEVICE_METRICS.map((metric) => (
        <View key={metric} style={styles.row}>
          <Text variant="subhead" style={styles.metricName}>
            {DEVICE_METRIC_LABELS[metric]}
          </Text>
          <Text variant="subhead" tone="secondary" style={styles.metricLine}>
            {DEVICE_METRIC_EXPLAINER[metric]}
          </Text>
        </View>
      ))}
      <Text variant="footnote" tone="secondary">
        Vyana stores daily totals and single readings, never second-by-second data.
      </Text>
      <Text variant="footnote" tone="secondary">
        A device reading is not a medical test.
      </Text>
      <Text variant="footnote" tone="secondary">
        You can turn this off at any time.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: T.space.md },
  row: { gap: 2 },
  metricName: { fontWeight: '600' },
  metricLine: { lineHeight: 20 },
});
