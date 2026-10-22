import { useEffect, useState } from 'react';
import { AccessibilityInfo, type EmitterSubscription } from 'react-native';

type AccessibilityQuery = {
  /** The initial read: isReduceTransparencyEnabled, isHighTextContrastEnabled, … */
  query: () => Promise<boolean>;
  /** The change event for the same setting. */
  event: 'reduceTransparencyChanged' | 'highTextContrastChanged';
};

/**
 * The plumbing behind the accessibility hooks: read the setting once, then
 * follow its change events until the component goes away. Kept separate from
 * React Native's component tree so it can be unit-tested with a fake source.
 */
export function subscribeAccessibilitySetting(
  source: typeof AccessibilityInfo,
  { query, event }: AccessibilityQuery,
  onChange: (enabled: boolean) => void,
): () => void {
  let live = true;
  query()
    .then((enabled) => {
      if (live) onChange(enabled);
    })
    .catch(() => undefined);
  const sub: EmitterSubscription = source.addEventListener(event, onChange);
  return () => {
    live = false;
    sub.remove();
  };
}

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
