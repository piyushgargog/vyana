import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { AppError } from "./errors";

/**
 * The only place a model provider is named (DESIGN §6). The provider is chosen after the evaluation
 * (EVALUATION §6/§7, ADR-027/051). Until then routes run with `LLM_MOCK=1`.
 *
 * Wired (free tiers first, ADR-051): google, groq, nvidia, openrouter, huggingface. Which of them may see real
 * patient text is decided by PLAN §2A rule 9 and recorded in DECISIONS ADR-051; `PATIENT_DATA_PROVIDERS` below is that
 * decision in code.
 */

export type ModelKind = "vision" | "text";

export const isLlmMock = () => process.env.LLM_MOCK === "1";

/** The configured model id, for `ai_runs` and `AiMeta`. */
export function modelName(kind: ModelKind): string {
  if (isLlmMock()) return "mock";
  const id = kind === "text" ? process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL : process.env.LLM_MODEL;
  return `${process.env.LLM_PROVIDER ?? "none"}:${id ?? "none"}`;
}

/** OpenAI-compatible endpoints: where they are and which environment variable holds the key. */
const COMPATIBLE = {
  groq: { baseURL: "https://api.groq.com/openai/v1", keyVar: "GROQ_API_KEY" },
  nvidia: { baseURL: "https://integrate.api.nvidia.com/v1", keyVar: "NVIDIA_API_KEY" },
  openrouter: { baseURL: "https://openrouter.ai/api/v1", keyVar: "OPENROUTER_API_KEY" },
  huggingface: { baseURL: "https://router.huggingface.co/v1", keyVar: "HF_TOKEN" },
} as const;

export const SUPPORTED_PROVIDERS = ["google", ...Object.keys(COMPATIBLE)] as const;

/**
 * Providers whose data terms were checked and recorded (ADR-051) and that may receive **redacted patient text** in
 * production. A free tier that trains on prompts, shows them to human reviewers or has unverified terms is only for
 * synthetic data (evals, demos with the seeded users). Images are a separate gate: `LLM_VISION_APPROVED`.
 *  - groq: no retention of inference data by default; turn on Zero Data Retention in its Data Controls.
 */
export const PATIENT_DATA_PROVIDERS: readonly string[] = ["groq"];

const notConfigured = () => new AppError("INTERNAL", "The AI feature isn't configured yet. Please try again later.", 500);

export function getModel(kind: ModelKind): LanguageModel {
  const provider = process.env.LLM_PROVIDER;
  const id = kind === "text" ? process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL : process.env.LLM_MODEL;
  if (!provider || !id) throw notConfigured();

  // Rule 9: in production, only a provider with recorded terms sees patient text.
  if (process.env.NODE_ENV === "production" && process.env.LLM_ALLOW_UNAPPROVED !== "1" && !PATIENT_DATA_PROVIDERS.includes(provider)) {
    throw new AppError("INTERNAL", "The AI feature isn't available right now. Please try again later.", 500);
  }

  if (provider === "google") return createGoogleGenerativeAI()(id);
  if (provider in COMPATIBLE) {
    const { baseURL, keyVar } = COMPATIBLE[provider as keyof typeof COMPATIBLE];
    const apiKey = process.env[keyVar];
    if (!apiKey) throw notConfigured();
    return createOpenAICompatible({ name: provider, baseURL, apiKey, supportsStructuredOutputs: true })(id);
  }
  throw notConfigured();
}
