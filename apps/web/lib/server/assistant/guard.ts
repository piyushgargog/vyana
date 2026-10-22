import "server-only";
import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";
import type { Language, SourceLink } from "@vyana/shared";
import { checkDiagnosisLanguage, findDosePatterns } from "../safety/blocklists";
import { canonicalUrl, filterCitationsInText, findUrls } from "../safety/citations";
import { restore } from "../safety/redact";
import { ASK_DOCTOR_NOTE, DOSE_NOTE, NO_SOURCE_NOTE } from "./system-prompt";

/**
 * Everything the assistant's reply passes through before the user sees it (PLAN §2A rule 5, ADR-043): links our
 * tools didn't return are removed while the text streams, placeholders from redaction are restored, and fixed
 * notes are added at the end when the reply has no source or contains dose-change or diagnosis wording.
 * A sentence with a dose amount, count or schedule is never shown unless it repeats the patient's own saved
 * medicine (ADR-065).
 */

/** Tools that answer from the user's own records or our price checks, so the reply needs no web source. */
const DATA_TOOLS = new Set(["get_my_medicines", "get_my_lab_values", "get_my_conditions"]);

/** Shorter replies (greetings, a clarifying question) don't need a source. */
const MIN_CHARS_NEEDING_SOURCE = 200;

/** A markdown link longer than this is treated as plain text, so a stray "[" can't hold the stream forever. */
const MAX_HELD_LINK = 600;

/** `s` starts with "[": is the markdown link (or plain bracket) it starts complete? */
function bracketClosed(s: string): boolean {
  const close = s.indexOf("]");
  if (close === -1) return false;
  if (s[close + 1] !== "(") return close + 1 < s.length; // "[1] " is plain text
  return s.indexOf(")", close + 2) !== -1;
}

/**
 * How much of `buffer` can be shown now: up to the last whitespace (a word, and so a URL, is complete only then),
 * but not past the start of a markdown link that isn't closed yet. The rest waits for more text.
 */
export function readyLength(buffer: string): number {
  let cut = 0;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (/\s/.test(buffer[i])) {
      cut = i + 1;
      break;
    }
  }
  if (cut === 0) return 0;
  const open = buffer.lastIndexOf("[", cut - 1);
  if (open !== -1 && cut - open <= MAX_HELD_LINK && !bracketClosed(buffer.slice(open, cut))) return open;
  return cut;
}

/** How much of `text` is whole sentences: up to the last ". ", "! ", "? ", "। " or line break. */
function sentencesLength(text: string): number {
  let end = 0;
  for (const m of text.matchAll(/[.!?।](?=\s)\s*|\n+/gu)) end = (m.index ?? 0) + m[0].length;
  return end;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export class ReplyGuard {
  private readonly allowed = new Set<string>();
  private readonly titles = new Map<string, string>();
  private readonly shown = new Map<string, SourceLink>();
  private usedDataTool = false;
  private modelText = "";
  /** The patient's own medicines (strength, dose, frequency), which the reply may repeat. */
  private readonly ownDoses: string[] = [];
  /** Text per stream part that waits for the end of its sentence. */
  private readonly sentenceBuffers = new Map<string, string>();
  /** The last character `clean` returned (the sentence stage may still hold it). */
  private cleanTail = "";
  /** Sentences held back because they gave a dose. */
  droppedSentences = 0;
  /** URLs the model wrote that our tools never returned. */
  readonly removed: string[] = [];
  /** Fixed lines added at the end of the reply. */
  notes: string[] = [];

  constructor(private readonly opts: { language: Language; placeholders: Record<string, string>; doseQuestion?: boolean }) {}

  /** Called by `get_my_medicines`: the patient's own strengths, doses and frequencies may be read back to them. */
  allowOwnDoses(values: (string | null | undefined)[]): void {
    for (const v of values) if (v && v.trim()) this.ownDoses.push(squash(v));
  }

  /** A sentence gives a dose that is not the patient's own medicine. "Don't double the dose" only adds the note. */
  givesDose(sentence: string): boolean {
    const hits = findDosePatterns(sentence).filter((h) => h.rule !== "change the dose");
    return hits.some((h) => !this.ownDoses.some((own) => own.includes(squash(h.text))));
  }

  /** The whole sentences of `text` (all of it when `flush`), without the ones that give a dose. */
  private sentences(id: string, text: string, flush: boolean): string {
    const buffer = (this.sentenceBuffers.get(id) ?? "") + text;
    const n = flush ? buffer.length : sentencesLength(buffer);
    this.sentenceBuffers.set(id, buffer.slice(n));
    let out = "";
    for (const sentence of buffer.slice(0, n).split(/(?<=[.!?।]\s+|\n+)(?=\S)/u)) {
      if (this.givesDose(sentence)) this.droppedSentences++;
      else out += sentence;
    }
    this.modelText += out;
    return out;
  }

  /** Called by the tools for every URL they return in this request. */
  allow(url: string | null | undefined, title?: string | null): void {
    const c = url ? canonicalUrl(url) : null;
    if (!c) return;
    this.allowed.add(c);
    if (title && !this.titles.has(c)) this.titles.set(c, title);
  }

  /** Removes unfetched links, restores placeholders and records the links that stay. */
  clean(text: string): string {
    const { cleaned, removed } = filterCitationsInText(text, this.allowed);
    this.removed.push(...removed);
    for (const { url } of findUrls(cleaned)) {
      const c = canonicalUrl(url);
      if (c && !this.shown.has(c)) this.shown.set(c, { title: this.titles.get(c) ?? url, url });
    }
    let out = restore(cleaned, this.opts.placeholders);
    // A removed link leaves its surrounding spaces behind; don't show two in a row.
    if (removed.length && /\s$/.test(this.cleanTail)) out = out.replace(/^[ \t]+/, "");
    this.cleanTail = (this.cleanTail + out).slice(-1);
    return out;
  }

  /** The notes for the finished reply (ADR-043). */
  closingNotes(): string {
    const lang = this.opts.language;
    const notes: string[] = [];
    if (this.shown.size === 0 && !this.usedDataTool && this.modelText.trim().length >= MIN_CHARS_NEEDING_SOURCE) {
      notes.push(NO_SOURCE_NOTE[lang]);
    }
    const doseChange = findDosePatterns(this.modelText).some((h) => h.rule === "change the dose");
    const diagnosis = checkDiagnosisLanguage(this.modelText).phrases.length > 0;
    if (this.droppedSentences > 0 || this.opts.doseQuestion) notes.push(DOSE_NOTE[lang]);
    else if (doseChange || diagnosis) notes.push(ASK_DOCTOR_NOTE[lang]);
    this.notes = notes;
    return notes.join("");
  }

  noteToolCall(toolName: string): void {
    if (DATA_TOOLS.has(toolName)) this.usedDataTool = true;
  }

  /** The reply as the user saw it, without the emergency notice (that is written outside the model stream). */
  get text(): string {
    return this.modelText + this.notes.join("");
  }

  get sources(): SourceLink[] {
    return [...this.shown.values()];
  }

  get needsReview(): boolean {
    return this.removed.length > 0 || this.notes.length > 0 || this.droppedSentences > 0;
  }

  /**
   * The `experimental_transform` for `streamText`. Only text is held back; every other part passes straight
   * through, because `streamText` waits for its own step events before it goes on. The notes are written by the
   * caller after the model stream ends (`closingNotes`).
   */
  transform<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
    return () => {
      const pending = new Map<string, string>();
      return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
        transform: (part, controller) => {
          switch (part.type) {
            case "text-delta": {
              const buffer = (pending.get(part.id) ?? "") + part.text;
              const n = readyLength(buffer);
              pending.set(part.id, buffer.slice(n));
              const shown = n > 0 ? this.sentences(part.id, this.clean(buffer.slice(0, n)), false) : "";
              if (shown) controller.enqueue({ ...part, text: shown });
              return;
            }
            case "text-end": {
              const rest = pending.get(part.id) ?? "";
              pending.delete(part.id);
              const shown = this.sentences(part.id, rest ? this.clean(rest) : "", true);
              this.sentenceBuffers.delete(part.id);
              if (shown) controller.enqueue({ type: "text-delta", id: part.id, text: shown } as TextStreamPart<TOOLS>);
              controller.enqueue(part);
              return;
            }
            case "tool-call":
              this.noteToolCall(part.toolName);
              break;
          }
          controller.enqueue(part);
        },
      });
    };
  }
}
