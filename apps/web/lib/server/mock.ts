import "server-only";

/**
 * Mock mode, the one place that reads the mock flags. Tests and local development run with no network and no
 * provider keys: `LLM_MOCK=1` answers model calls from fixtures, `WEB_MOCK=1` answers web reads from fixture
 * pages. A new mock flag belongs here, so callers never read `process.env` for mock mode themselves.
 */

/** Model calls are answered from fixtures instead of calling a provider. */
export const isLlmMock = (): boolean => process.env.LLM_MOCK === "1";

/** Web reads are answered from fixture pages instead of fetching. */
export const isWebMock = (): boolean => process.env.WEB_MOCK === "1";

/** Either mock flag is set. Mock runs cost nothing, so they are not counted by the rate limiter. */
export const isMockRun = (): boolean => isLlmMock() || isWebMock();
