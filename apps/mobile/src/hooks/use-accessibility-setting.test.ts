import { describe, expect, it, vi } from 'vitest';

import { subscribeAccessibilitySetting } from './use-accessibility-setting';

type Listener = (enabled: boolean) => void;

/** A fake AccessibilityInfo: a scripted initial value and a hand-fired change event. */
function fakeSource(initial: boolean) {
  const listeners = new Set<Listener>();
  const removed: string[] = [];
  const source = {
    addEventListener: vi.fn((_event: string, listener: Listener) => {
      listeners.add(listener);
      return {
        remove: () => {
          listeners.delete(listener);
          removed.push('removed');
        },
      };
    }),
  };
  return {
    source,
    removed,
    fire: (enabled: boolean) => listeners.forEach((listener) => listener(enabled)),
    query: () => Promise.resolve(initial),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('subscribeAccessibilitySetting — the plumbing behind useReduceTransparency (#288)', () => {
  it('reports the initial system value once it lands', async () => {
    const fake = fakeSource(true);
    const seen: boolean[] = [];
    subscribeAccessibilitySetting(fake.source as never, { query: fake.query, event: 'reduceTransparencyChanged' }, (v) =>
      seen.push(v),
    );
    await flush();
    expect(seen).toEqual([true]);
    expect(fake.source.addEventListener).toHaveBeenCalledWith('reduceTransparencyChanged', expect.any(Function));
  });

  it('follows change events and stops after unsubscribe', async () => {
    const fake = fakeSource(false);
    const seen: boolean[] = [];
    const stop = subscribeAccessibilitySetting(
      fake.source as never,
      { query: fake.query, event: 'reduceTransparencyChanged' },
      (v) => seen.push(v),
    );
    await flush();
    fake.fire(true);
    expect(seen).toEqual([false, true]);
    stop();
    expect(fake.removed).toEqual(['removed']);
    fake.fire(false);
    expect(seen).toEqual([false, true]);
  });

  it('ignores a slow initial answer that lands after unsubscribe', async () => {
    const fake = fakeSource(true);
    const seen: boolean[] = [];
    const stop = subscribeAccessibilitySetting(
      fake.source as never,
      { query: fake.query, event: 'highTextContrastChanged' },
      (v) => seen.push(v),
    );
    stop();
    await flush();
    expect(seen).toEqual([]);
  });

  it('stays silent when the initial read fails', async () => {
    const fake = fakeSource(false);
    const seen: boolean[] = [];
    subscribeAccessibilitySetting(
      fake.source as never,
      { query: () => Promise.reject(new Error('not on this platform')), event: 'reduceTransparencyChanged' },
      (v) => seen.push(v),
    );
    await flush();
    expect(seen).toEqual([]);
  });
});
