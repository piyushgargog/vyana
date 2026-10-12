import "server-only";
import type { LanguageModel } from "ai";
import { AppError } from "./errors";

/**
 * The only place a model provider is named (DESIGN §6). The provider is chosen after the evaluation
 * (EVALUATION §6/§7, ADR-034), and only the winning package gets installed and a `case` here. Until then
 * routes run with `LLM_MOCK=1`.
 */

export type ModelKind = "vision" | "text";

export const isLlmMock = () => process.env.LLM_MOCK === "1";

/** The configured model id, for `ai_runs` and `AiMeta`. */
export function modelName(kind: ModelKind): string {
  if (isLlmMock()) return "mock";
  const id = kind === "text" ? process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL : process.env.LLM_MODEL;
  return `${process.env.LLM_PROVIDER ?? "none"}:${id ?? "none"}`;
}

export function getModel(kind: ModelKind): LanguageModel {
  const provider = process.env.LLM_PROVIDER;
  const id = kind === "text" ? process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL : process.env.LLM_MODEL;
  if (!provider || !id) {
    throw new AppError("INTERNAL", "The AI feature isn't configured yet. Please try again later.", 500);
  }
  switch (provider) {
    // The provider that wins the evaluation is added here, e.g. `case "google": return google(id);`
    default:
      throw new AppError("INTERNAL", "The AI feature isn't configured yet. Please try again later.", 500);
  }
}
