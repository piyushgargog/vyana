/** The two things the hooks need from React Native's accessibility service, and nothing more. */
export type AccessibilitySource = {
  addEventListener: (
    event: 'reduceTransparencyChanged' | 'highTextContrastChanged' | 'reduceMotionChanged',
    listener: (enabled: boolean) => void,
  ) => { remove: () => void };
};

export type AccessibilityQuery = {
  /** The initial read: isReduceTransparencyEnabled, isHighTextContrastEnabled, … */
  query: () => Promise<boolean>;
  /** The change event for the same setting. */
  event: 'reduceTransparencyChanged' | 'highTextContrastChanged' | 'reduceMotionChanged';
};

/**
 * The plumbing behind the accessibility hooks: read the setting once, then
 * follow its change events until the component goes away. It takes the
 * accessibility service as a parameter (structurally — the import of
 * react-native itself only happens in the hooks below) so it can be
 * unit-tested with a fake source, without loading React Native.
 */
export function subscribeAccessibilitySetting(
  source: AccessibilitySource,
  { query, event }: AccessibilityQuery,
  onChange: (enabled: boolean) => void,
): () => void {
  let live = true;
  query()
    .then((enabled) => {
      if (live) onChange(enabled);
    })
    .catch(() => undefined);
  const sub = source.addEventListener(event, onChange);
  return () => {
    live = false;
    sub.remove();
  };
}

