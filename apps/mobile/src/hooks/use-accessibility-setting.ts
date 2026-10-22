import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { subscribeAccessibilitySetting, type AccessibilityQuery } from './accessibility-setting-core';

function useAccessibilitySetting(setting: AccessibilityQuery): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(
    () => subscribeAccessibilitySetting(AccessibilityInfo, setting, setEnabled),
    // The setting descriptor is a stable literal per hook below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return enabled;
}

/** Whether the person has asked the system for reduced transparency; glass falls back to solid while it is on. */
export function useReduceTransparency(): boolean {
  return useAccessibilitySetting({
    query: () => AccessibilityInfo.isReduceTransparencyEnabled(),
    event: 'reduceTransparencyChanged',
  });
}

/** Whether the person has asked the system for higher text contrast; glass edges get stronger while it is on. */
export function useHighContrast(): boolean {
  return useAccessibilitySetting({
    query: () => AccessibilityInfo.isHighTextContrastEnabled(),
    event: 'highTextContrastChanged',
  });
}
