import "server-only";
import { z } from "zod";
import type { AiMeta } from "@vyana/shared";
import { runAi } from "./ai";
import { badRequest, forbidden, notFound, upstream } from "./errors";
import { isLlmMock } from "./llm";
import { log } from "./log";
import { TRANSCRIBE_PROMPT_VERSION, TRANSCRIBE_SYSTEM, transcribePrompt } from "./prompts/documents";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Uploaded prescriptions and lab reports (SPEC §3, §4, ADR-041): path checks, download, and the document text
 * that every extracted value must quote.
 */

export type Bucket = "prescriptions" | "lab-reports";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MIN_TEXT_LAYER_CHARS = 40;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** `{user_id}/{name}.{jpg|jpeg|png|webp|pdf}` only; anything else is 403 (SPEC §3 step 1). */
export function checkUploadPath(userId: string, filePath: string): { mime: string } {
  const ext = filePath.toLowerCase().split(".").pop() ?? "";
  if (!filePath.startsWith(`${userId}/`) || filePath.includes("..") || !MIME[ext]) {
    throw forbidden("You can only use files you uploaded yourself (JPG, PNG, WEBP or PDF).");
  }
  return { mime: MIME[ext] };
}

export async function downloadUpload(bucket: Bucket, filePath: string): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(filePath);
  if (error || !data) throw notFound("That file wasn't found. Please upload it again.");
  if (data.size > MAX_UPLOAD_BYTES) throw badRequest("The file is larger than 10 MB.");
  return new Uint8Array(await data.arrayBuffer());
}

async function pdfTextLayer(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(bytes), { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch {
    log({ event: "pdf_text_layer_failed" });
    return "";
  }
}

const Transcript = z.object({ text: z.string() });

export interface DocumentText {
  text: string;
  /** "text_layer" for a PDF with real text, "transcription" when a vision model copied it. */
  source: "text_layer" | "transcription";
  ai: AiMeta | null;
}

/**
 * The document's own words. PDFs use their text layer; images (and scanned PDFs) are transcribed by a vision
 * model, which is allowed only after a provider's data terms are approved (rule 9).
 */
export async function readDocumentText(input: {
  bytes: Uint8Array;
  mime: string;
  feature: "rx" | "report";
  userId: string;
  inputRef: string;
  mockTranscript: string;
  unavailableMessage: string;
}): Promise<DocumentText> {
  if (input.mime === "application/pdf") {
    const text = await pdfTextLayer(input.bytes);
    if (text.length >= MIN_TEXT_LAYER_CHARS) return { text, source: "text_layer", ai: null };
  }
  if (!isLlmMock() && process.env.LLM_VISION_APPROVED !== "1") throw upstream(input.unavailableMessage);

  const { object, ai } = await runAi({
    feature: `${input.feature}_transcribe`,
    kind: "vision",
    schema: Transcript,
    system: TRANSCRIBE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: transcribePrompt(input.feature) },
          { type: "file", mediaType: input.mime, data: input.bytes },
        ],
      },
    ],
    promptVersion: TRANSCRIBE_PROMPT_VERSION,
    sources: [],
    userId: input.userId,
    inputRef: input.inputRef,
    mock: { text: input.mockTranscript },
    statusOf: (o) => (o.text.trim().length < MIN_TEXT_LAYER_CHARS ? "needs_review" : "ok"),
  });
  return { text: object.text, source: "transcription", ai };
}
