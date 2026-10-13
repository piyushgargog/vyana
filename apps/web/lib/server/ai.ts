import "server-only";
import { NoObjectGeneratedError, Output, generateText, type ModelMessage } from "ai";
import type { z } from "zod";
import type { AiMeta, SourceLink } from "@vyana/shared";
import { upstream } from "./errors";
import { POOL_KEY, getModel, isLlmMock, modelName, type DataClass, type ModelKind } from "./llm";
import { log } from "./log";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Every AI call goes through `runAi` (DESIGN §10, PLAN §2A): structured output at temperature 0, one retry when
 * the output doesn't match the schema, and one `ai_runs` row per result. Routes never call the AI SDK directly.
 */

export type AiRunStatus = "ok" | "needs_review" | "rejected";

interface RunAiBase<T> {
  /** What this run is for, e.g. "rx_extract", "hospitals_nearby" (stored in ai_runs.feature). */
  feature: string;
  kind: ModelKind;
  /** "public" only when the call sends no patient data (public web pages, a condition name): any wired provider may answer it (ADR-056). Default "patient". */
  data?: DataClass;
  schema: z.ZodType<T>;
  system?: string;
  /** Versioned with the prompt file, e.g. "hospitals-nearby@1". */
  promptVersion: string;
  /** Pages the model was given; stored with the run. */
  sources: SourceLink[];
  userId: string | null;
  /** A storage path or a hash, never the content itself (DATABASE.md). */
  inputRef?: string;
  /** What `LLM_MOCK=1` returns instead of calling a model. */
  mock: T;
  /** The caller's verdict after its own checks (verbatim, citations, blocklists). Default "ok". */
  statusOf?: (object: T) => AiRunStatus;
}

export type RunAiInput<T> = RunAiBase<T> & ({ prompt: string; messages?: never } | { messages: ModelMessage[]; prompt?: never });

export interface RunAiResult<T> {
  object: T;
  ai: AiMeta;
  /** The ai_runs row, or null when it couldn't be written. */
  runId: string | null;
}

/** Sent to the user when the model's answer can't be used: never a half-guess (PLAN §2A rule 2). */
export const UNREADABLE_MESSAGE = "Couldn't read this. Please enter it manually.";

async function generate<T>(input: RunAiInput<T>): Promise<{ object: T; fallback: string | null }> {
  const call = () =>
    generateText({
      model: getModel(input.kind, { data: input.data ?? "patient" }),
      output: Output.object({ schema: input.schema }),
      temperature: 0,
      maxRetries: 1,
      ...(input.system ? { system: input.system } : {}),
      ...(input.messages ? { messages: input.messages } : { prompt: input.prompt as string }),
    });
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await call();
      const used = (result.providerMetadata?.[POOL_KEY] as { fallback?: string } | undefined)?.fallback;
      return { object: result.output as T, fallback: used ?? null };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && attempt === 1) {
        log({ event: "ai_retry", feature: input.feature });
        continue;
      }
      if (NoObjectGeneratedError.isInstance(err)) throw upstream(UNREADABLE_MESSAGE);
      throw err;
    }
  }
}

type RunRecord = Pick<RunAiBase<unknown>, "feature" | "userId" | "promptVersion" | "inputRef" | "sources">;

async function recordRun(input: RunRecord, model: string, object: unknown, status: AiRunStatus): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("ai_runs")
      .insert({
        user_id: input.userId,
        feature: input.feature,
        model,
        prompt_version: input.promptVersion,
        input_ref: input.inputRef ?? null,
        output_json: object,
        sources: input.sources,
        status,
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  } catch {
    // Traceability must not break the feature; the failure is visible in the logs.
    log({ event: "ai_run_insert_failed", feature: input.feature });
    return null;
  }
}

/**
 * For streamed output (the assistant): the `ai_runs` row is created before streaming, so its id can go to the
 * client for "Report a mistake", then completed by `finishAiRun`.
 */
export async function startAiRun(input: RunRecord, kind: ModelKind): Promise<string | null> {
  return recordRun(input, modelName(kind), null, "ok");
}

export async function finishAiRun(runId: string | null, result: { output: unknown; sources: SourceLink[]; status: AiRunStatus }): Promise<void> {
  if (!runId) return;
  try {
    const { error } = await supabaseAdmin()
      .from("ai_runs")
      .update({ output_json: result.output, sources: result.sources, status: result.status })
      .eq("id", runId);
    if (error) throw error;
  } catch {
    log({ event: "ai_run_update_failed" });
  }
}

export async function runAi<T>(input: RunAiInput<T>): Promise<RunAiResult<T>> {
  const started = Date.now();
  const configured = modelName(input.kind);
  const out = isLlmMock() ? { object: input.schema.parse(input.mock), fallback: null } : await generate(input);
  const object = out.object;
  // The model that actually answered (ADR-056): a fallback shows up in ai_runs as "fallback:<id>".
  const model = out.fallback ? `fallback:${out.fallback}` : configured;
  const status = input.statusOf?.(object) ?? "ok";
  const runId = await recordRun(input, model, object, status);
  log({ event: "ai_run", feature: input.feature, model, status, duration_ms: Date.now() - started });
  return { object, ai: { model, prompt_version: input.promptVersion, generated_at: new Date().toISOString() }, runId };
}
