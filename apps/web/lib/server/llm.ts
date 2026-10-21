import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import { AppError } from "./errors";
import { log } from "./log";

/**
 * The only place a model provider is named (DESIGN §6, §14). Which providers may see what is decided by PLAN §2A rule 9
 * and recorded in DECISIONS ADR-051 and ADR-056. Until a provider is configured, routes run with `LLM_MOCK=1`.
 *
 * Wired (free tiers first, ADR-051): google, groq, nvidia, openrouter, huggingface.
 *
 * ADR-056: one call can use **several keys, models and providers**. The candidates are the primary model
 * (`LLM_PROVIDER` + `LLM_MODEL` / `LLM_TEXT_MODEL`), then the entries of `LLM_FALLBACKS` (`LLM_VISION_FALLBACKS` for
 * images), each expanded over the provider's keys (`<KEY_VAR>` and `<KEY_VAR>S`, rotated round-robin per call). A
 * candidate is skipped only on a retryable failure (413, 429, 5xx, timeout, network); any other error is thrown.
 */

export type ModelKind = "vision" | "text";

/**
 * `"patient"` (the default) = the call may carry patient text or documents. `"public"` = it sends no patient data
 * (public web pages, a condition name), so any wired provider may answer it.
 */
export type DataClass = "patient" | "public";

export const isLlmMock = () => process.env.LLM_MOCK === "1";

/** The configured primary model id, for `ai_runs` and `AiMeta`. */
export function modelName(kind: ModelKind): string {
  if (isLlmMock()) return "mock";
  const id = kind === "text" ? process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL : process.env.LLM_MODEL;
  return `${process.env.LLM_PROVIDER ?? "none"}:${id ?? "none"}`;
}

/** OpenAI-compatible endpoints. */
const COMPATIBLE = {
  groq: { baseURL: "https://api.groq.com/openai/v1" },
  nvidia: { baseURL: "https://integrate.api.nvidia.com/v1" },
  openrouter: { baseURL: "https://openrouter.ai/api/v1" },
  huggingface: { baseURL: "https://router.huggingface.co/v1" },
} as const;

/** The environment variable that holds a provider's key; a comma separated list of more keys is `<name>S`. */
const KEY_VAR = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  groq: "GROQ_API_KEY",
  nvidia: "NVIDIA_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  huggingface: "HF_TOKEN",
} as const;

export const SUPPORTED_PROVIDERS = ["google", "groq", "nvidia", "openrouter", "huggingface"] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Providers whose data terms were checked and recorded (ADR-051, ADR-055) and that may receive **redacted patient
 * text** in production. A free tier that trains on prompts, shows them to human reviewers or has unverified terms is
 * only for synthetic data (evals, demos with the seeded users) and for `data: "public"` calls. Images are a separate
 * gate: `LLM_VISION_APPROVED`.
 *  - groq: no retention of inference data by default; Zero Data Retention is switched on in its Data Controls.
 */
export const PATIENT_DATA_PROVIDERS: readonly string[] = ["groq"];

const notConfigured = () => new AppError("INTERNAL", "The AI feature isn't configured yet. Please try again later.", 500);
const notAvailable = () => new AppError("INTERNAL", "The AI feature isn't available right now. Please try again later.", 500);

const isProvider = (p: string): p is Provider => (SUPPORTED_PROVIDERS as readonly string[]).includes(p);
const splitList = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Every key of a provider: the single key plus the comma separated list, without duplicates. */
export function keysFor(provider: Provider): string[] {
  const name = KEY_VAR[provider];
  return [...new Set([...splitList(process.env[name]), ...splitList(process.env[`${name}S`])])];
}

/** Round-robin start per provider, so several keys share the load (a free-tier limit is per account). */
const rotation = new Map<string, number>();

/** For tests: start every provider at its first key again. */
export const resetKeyRotation = () => rotation.clear();
function rotated<T>(provider: string, items: T[]): T[] {
  if (items.length < 2) return items;
  const start = (rotation.get(provider) ?? 0) % items.length;
  rotation.set(provider, start + 1);
  return [...items.slice(start), ...items.slice(0, start)];
}

interface Candidate {
  provider: Provider;
  id: string;
  apiKey: string;
}

/** `provider:model` entries; the model id may itself contain colons. */
function parseEntries(value: string | undefined): { provider: Provider; id: string }[] {
  const out: { provider: Provider; id: string }[] = [];
  for (const entry of splitList(value)) {
    const at = entry.indexOf(":");
    const provider = entry.slice(0, at);
    const id = entry.slice(at + 1);
    if (at > 0 && id && isProvider(provider)) out.push({ provider, id });
  }
  return out;
}

const mayCarry = (provider: string, data: DataClass) =>
  data === "public" ||
  process.env.NODE_ENV !== "production" ||
  process.env.LLM_ALLOW_UNAPPROVED === "1" ||
  PATIENT_DATA_PROVIDERS.includes(provider);

/** The model interface the AI SDK calls (what `wrapLanguageModel` returns). */
type ModelV4 = ReturnType<typeof wrapLanguageModel>;

function build({ provider, id, apiKey }: Candidate): ModelV4 {
  const model = provider === "google" ? createGoogleGenerativeAI({ apiKey })(id) : createOpenAICompatible({ name: provider, baseURL: COMPATIBLE[provider].baseURL, apiKey, supportsStructuredOutputs: true })(id);
  return model as unknown as ModelV4;
}

/** A failure another key, model or provider may not have: a key that is dead, revoked or out of credit (401, 402, 403), timeout (408), too large for the limit (413), rate limit (429), server errors, network. */
export function isRetryable(err: unknown): boolean {
  const e = err as { statusCode?: unknown; name?: unknown; isRetryable?: unknown; cause?: unknown } | null;
  if (typeof e?.statusCode === "number") return [401, 402, 403, 408, 413, 429].includes(e.statusCode) || e.statusCode >= 500;
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return true;
  if (e instanceof TypeError) return true; // `fetch failed`
  return e?.isRetryable === true;
}

const label = (c: Candidate) => `${c.provider}:${c.id}`;

/**
 * The prompt without the reasoning parts of earlier assistant steps. Groq refuses reasoning sent back to it
 * (`'reasoning_content' is unsupported`), whichever model wrote it, so no call carries it (P24). The models do not
 * need it: each step reasons again from the visible text and tool results.
 */
export function withoutReasoning<P extends { prompt: unknown }>(params: P): P {
  const prompt = (params.prompt as { role: string; content: unknown }[]).flatMap((m) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return [m];
    const content = (m.content as { type: string }[]).filter((p) => p.type !== "reasoning");
    return content.length ? [{ ...m, content }] : [];
  });
  return { ...params, prompt };
}

/** Where a fallback leaves its name in the result's provider metadata, so `ai_runs` records the model that really answered. */
export const POOL_KEY = "vyana_pool";

export function getModel(kind: ModelKind, options: { data?: DataClass } = {}): LanguageModel {
  const data = options.data ?? "patient";
  const provider = process.env.LLM_PROVIDER;
  const id = kind === "text" ? process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL : process.env.LLM_MODEL;
  if (!provider || !id || !isProvider(provider)) throw notConfigured();

  const entries = [{ provider, id }, ...parseEntries(kind === "vision" ? process.env.LLM_VISION_FALLBACKS : process.env.LLM_FALLBACKS)];
  const withKeys: Candidate[] = [];
  const keyOrder = new Map<Provider, string[]>(); // rotated once per provider per call: all its entries start from the same key
  for (const entry of entries) {
    if (!keyOrder.has(entry.provider)) keyOrder.set(entry.provider, rotated(entry.provider, keysFor(entry.provider)));
    for (const apiKey of keyOrder.get(entry.provider) ?? []) withKeys.push({ ...entry, apiKey });
  }
  if (!withKeys.some((c) => c.provider === provider)) throw notConfigured(); // the primary needs a key

  // Rule 9: patient data only goes to providers with recorded terms (ADR-051, ADR-056).
  const candidates = withKeys.filter((c) => mayCarry(c.provider, data));
  if (candidates.length === 0) throw notAvailable();

  const [first, ...rest] = candidates;
  const primary = build(first);
  const dropReasoning: LanguageModelMiddleware = { transformParams: async ({ params }) => withoutReasoning(params) };
  if (rest.length === 0) return wrapLanguageModel({ model: primary, middleware: dropReasoning });

  const others = rest.map((c) => ({ c, model: build(c) }));
  // Tries the other candidates in order after a retryable failure of the first; an unretryable error is thrown at once.
  async function fallBack<T>(err: unknown, aborted: boolean, call: (m: ModelV4, c: Candidate) => PromiseLike<T>): Promise<T> {
    let last = err;
    if (!isRetryable(err) || aborted) throw err;
    let from = first;
    for (const { c, model } of others) {
      log({ event: "llm_fallback", from: label(from), to: label(c), status: (last as { statusCode?: number })?.statusCode ?? null });
      try {
        return await call(model, c);
      } catch (next) {
        last = next;
        from = c;
        if (!isRetryable(next) || aborted) throw next;
      }
    }
    throw last;
  }

  return wrapLanguageModel({
    model: primary,
    middleware: {
      ...dropReasoning,
      wrapGenerate: async ({ doGenerate, params }) => {
        try {
          return await doGenerate();
        } catch (err) {
          return fallBack(err, params.abortSignal?.aborted === true, (m, c) => m.doGenerate(params).then((r) => ({ ...r, providerMetadata: { ...r.providerMetadata, [POOL_KEY]: { fallback: label(c) } } })));
        }
      },
      wrapStream: async ({ doStream, params }) => {
        try {
          return await doStream();
        } catch (err) {
          return fallBack(err, params.abortSignal?.aborted === true, (m) => m.doStream(params));
        }
      },
    },
  });
}
