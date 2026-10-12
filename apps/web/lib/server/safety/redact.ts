/**
 * Privacy before AI (PLAN §2A rule 9, ADR-032): replaces personal identifiers in text with placeholders before
 * the text goes to any model. Pure functions, no I/O.
 *
 * Removed: names (from labels like "Name:", honorifics like "Mr."/"Dr."/"श्री", "S/o"-style relations, "my name is",
 * and the caller's known names), phone numbers, emails, addresses (after an address label), Aadhaar / ABHA / PAN
 * and other labelled or long ID numbers, and exact dates of birth (after a DOB label).
 * Kept: age, sex, medicine names, doses, lab values and other dates, because the model needs them and they don't
 * identify the person on their own.
 *
 * Regexes here run on user and document text, so each one is bounded and has no nested or overlapping repeats.
 */

export type PlaceholderKind = "NAME" | "PHONE" | "EMAIL" | "ADDRESS" | "ID" | "DOB";

export interface Redaction {
  text: string;
  /** Placeholder (e.g. "[NAME_1]") → the original text it replaced. */
  map: Record<string, string>;
}

export interface RedactOptions {
  /** Names we already know belong to this person or their contacts (profile name, emergency contacts). */
  knownNames?: string[];
}

class Redactor {
  private readonly byValue = new Map<string, string>();
  private readonly counts = new Map<PlaceholderKind, number>();
  readonly map: Record<string, string> = {};

  /** Same value → same placeholder, so the model can still tell that two mentions are the same person. */
  placeholder(kind: PlaceholderKind, original: string): string {
    const value = original.trim();
    const key = `${kind}:${value.toLowerCase()}`;
    const existing = this.byValue.get(key);
    if (existing) return existing;
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const ph = `[${kind}_${n}]`;
    this.byValue.set(key, ph);
    this.map[ph] = value;
    return ph;
  }
}

const PLACEHOLDER = /\[(?:NAME|PHONE|EMAIL|ADDRESS|ID|DOB)_\d+\]/;

// ---------------------------------------------------------------- helpers

/** Replaces each match of `re` (must be global) with a placeholder for the given group (0 = whole match). */
function replaceGroup(text: string, re: RegExp, kind: PlaceholderKind, r: Redactor, group = 0, accept?: (value: string) => boolean): string {
  return text.replace(re, (...args: unknown[]) => {
    const match = args[0] as string;
    const value = args[group] as string | undefined;
    if (!value || PLACEHOLDER.test(value) || (accept && !accept(value))) return match;
    const at = match.indexOf(value);
    return match.slice(0, at) + r.placeholder(kind, value) + match.slice(at + value.length);
  });
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Words that end a labelled value: the next field on the same line ("Name: Aryan Sharma  Age: 34"). */
const NEXT_FIELD = /\s{2,}|\t|\b(?:age|sex|gender|dob|d\.o\.b|date|uhid|mrn|mobile|phone|ph|tel|contact|email|e-mail|address|ref|referred|reg|id|ip|op|bed|ward|w\/o|s\/o|d\/o|c\/o)\b|आयु|उम्र|लिंग/i;

/** Cuts a captured label value at the next field and to at most `maxWords` words. */
function trimValue(raw: string, maxWords: number): string {
  const cut = raw.search(NEXT_FIELD);
  const value = (cut >= 0 ? raw.slice(0, cut) : raw).replace(/[\s,;:.|-]+$/, "");
  return value.split(/\s+/).slice(0, maxWords).join(" ");
}

/** Replaces the value after a label, using `trimValue` to decide where it ends. */
function replaceLabelled(text: string, label: RegExp, kind: PlaceholderKind, r: Redactor, maxWords: number): string {
  return text.replace(label, (match: string, ...rest: unknown[]) => {
    const raw = rest[rest.length - 3] as string; // the last capture group = the value
    const value = trimValue(raw, maxWords);
    if (!value || PLACEHOLDER.test(value)) return match;
    const at = match.lastIndexOf(raw);
    return match.slice(0, at) + raw.replace(value, r.placeholder(kind, value));
  });
}

// ---------------------------------------------------------------- patterns

const EMAIL = /(?<![\w.+-])[\w.+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,4}(?![\w-])/g;
const ABHA_ADDRESS = /(?<![\w.])[\w.]{3,40}@(?:abdm|sbx)(?![\w])/gi;
const PAN = /(?<![A-Za-z0-9])[A-Z]{5}\d{4}[A-Z](?![A-Za-z0-9])/g;
const ABHA_NUMBER = /(?<![\d])\d{2}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}(?![\d])/g;
const AADHAAR = /(?<![\d])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![\d])/g;
const MOBILE = /(?<![\d+])(?:\+91[ -]?|0091[ -]?|91[ -]|0)?[6-9]\d{4}[ -]?\d{5}(?![\d])/g;
/** STD code with its leading 0 (or +91), then the number: "011-2658 8500" style needs the 0, so lab values never match. */
const LANDLINE = /(?<![\d+])(?:\+91[ -]?|0)[1-8]\d{1,3}[ -]?\d{2,4}[ -]?\d{4}(?![\d])/g;
/** 9 or more digits in a row that weren't caught above: record numbers, IDs. Decimals and dates don't match. */
const LONG_NUMBER = /(?<![\d.,/-])\d{9,18}(?![\d.,/-])/g;

const LABEL_SEP = "(?:[ \\t]*[:\\-][ \\t]*|[ \\t]+)";
const ID_LABEL = new RegExp(
  `\\b(?:uhid|mrn|cr\\s?no|reg(?:istration)?\\.?\\s?no|patient\\s?id|ip\\s?no|op\\s?no|lab\\s?no|sample\\s?id|aadhaar|aadhar|abha(?:\\s?(?:no|number|id))?|pan\\s?(?:no|number|card)|passport(?:\\s?no)?)\\.?${LABEL_SEP}([A-Za-z0-9][A-Za-z0-9/._-]{2,40})`,
  "gi",
);

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]{0,6}";
const DATE = `(?:\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?[ \\t]+${MONTH},?[ \\t]+\\d{4}|${MONTH}[ \\t]+\\d{1,2}(?:st|nd|rd|th)?,?[ \\t]+\\d{4})`;
const DOB = new RegExp(`(?:\\bd\\.?\\s?o\\.?\\s?b\\.?|\\bdate\\s+of\\s+birth|\\bbirth\\s+date|\\bborn\\s+on|जन्म\\s?तिथि)${LABEL_SEP}(${DATE})`, "gi");

/** Label words that are NOT about a person, so "Medicine name: Dolo" or "Test name: HbA1c" stay. */
const NOT_A_PERSON = /(?:medicine|drug|brand|generic|test|product|hospital|lab|laboratory|clinic|company|file|user|item|investigation|department|ward)\s*$/i;
const NAME_LABEL = /(\b(?:patient(?:'s)?\s+name|pt\.?\s*name|name\s+of\s+(?:the\s+)?patient|name)|नाम)[ \t]*[:\-][ \t]*([^\s,;|][^\n,;|]{0,79})/gi;
const ADDRESS_LABEL = /(\b(?:address|addr\.?|residence)|पता)[ \t]*[:\-][ \t]*([^\s,;|][^\n]{0,199})/gi;
const RESIDENT_OF = /(\bR\/[Oo])(?:[ \t]*[:\-][ \t]*|[ \t]+)([^\s,;|][^\n]{0,199})/g;

const CAP_WORD = "[A-Z][a-zA-Z'’]{1,30}";
const HONORIFIC = new RegExp(
  `(?<![A-Za-z])(?:Mr|Mrs|Ms|Miss|Master|Shri|Smt|Sh|Kumari|Km|Dr|Prof)\\.?[ \\t]+(${CAP_WORD}(?:[ \\t]+${CAP_WORD}){0,2})`,
  "g",
);
const RELATION = new RegExp(`(?<![A-Za-z])(?:[SDWC]\\/[Oo]|[SDWC]\\.[Oo]\\.)[ \\t]*(${CAP_WORD}(?:[ \\t]+${CAP_WORD}){0,2})`, "g");
const DEVANAGARI_WORD = "[\\u0900-\\u097F]{1,30}";
const HINDI_HONORIFIC = new RegExp(`(?:श्रीमती|श्री|कुमारी|सुश्री|डॉ\\.?|डॉक्टर)[ \\t]+(${DEVANAGARI_WORD}(?:[ \\t]+${DEVANAGARI_WORD}){0,2})`, "g");
const SELF_NAME = /\b(?:my name is|mera naam|mera nam|i am called)[ \t]+([A-Za-z][A-Za-z'’]{1,30}(?:[ \t]+[A-Za-z][A-Za-z'’]{1,30}){0,2})/gi;
const SELF_NAME_HI = new RegExp(`मेरा नाम[ \\t]+(${DEVANAGARI_WORD}(?:[ \\t]+${DEVANAGARI_WORD}){0,2})`, "g");
/** Never treated as a name on their own, even when they appear inside a captured name. */
const NOT_NAME_PARTS = new Set([
  "dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "shri", "smt", "not", "provided", "unknown", "patient",
  "male", "female", "clinic", "hospital", "kumar", "kumari", "devi", "the", "and",
]);

/** Words after "my name is" that aren't part of the name ("mera naam Aryan hai"). */
const NOT_NAME_WORDS = new Set(["hai", "hain", "and", "aur", "i", "im", "am", "is", "my", "from", "ka", "ki", "ke", "se"]);

// ---------------------------------------------------------------- main

/**
 * Replaces identifiers in `text` with placeholders like "[NAME_1]". Returns the safe text and the map needed by
 * `restore()`. Never throws; text with nothing to remove comes back unchanged.
 */
export function redact(text: string, opts: RedactOptions = {}): Redaction {
  const r = new Redactor();
  let t = text;

  // Emails and ABHA addresses first, before their parts look like names or numbers.
  t = replaceGroup(t, ABHA_ADDRESS, "ID", r);
  t = replaceGroup(t, EMAIL, "EMAIL", r);

  // Labelled values.
  t = replaceGroup(t, ID_LABEL, "ID", r, 1, (v) => /\d/.test(v));
  t = replaceGroup(t, DOB, "DOB", r, 1);
  t = replaceLabelled(t, ADDRESS_LABEL, "ADDRESS", r, 30);
  t = replaceLabelled(t, RESIDENT_OF, "ADDRESS", r, 30);
  t = t.replace(NAME_LABEL, (match: string, label: string, raw: string, offset: number, whole: string) => {
    const before = whole.slice(Math.max(0, offset - 30), offset) + label.replace(/name$/i, "");
    if (/^name$/i.test(label.trim()) && NOT_A_PERSON.test(before)) return match;
    const value = trimValue(raw, 5);
    if (!value || PLACEHOLDER.test(value)) return match;
    return match.slice(0, match.lastIndexOf(raw)) + raw.replace(value, r.placeholder("NAME", value));
  });

  // ID and phone number formats.
  t = replaceGroup(t, PAN, "ID", r);
  t = replaceGroup(t, ABHA_NUMBER, "ID", r);
  t = replaceGroup(t, AADHAAR, "ID", r);
  t = replaceGroup(t, MOBILE, "PHONE", r);
  t = replaceGroup(t, LANDLINE, "PHONE", r);
  t = replaceGroup(t, LONG_NUMBER, "ID", r);

  // Names introduced by an honorific, a relation, or "my name is".
  t = replaceGroup(t, HONORIFIC, "NAME", r, 1);
  t = replaceGroup(t, RELATION, "NAME", r, 1);
  t = replaceGroup(t, HINDI_HONORIFIC, "NAME", r, 1);
  for (const re of [SELF_NAME, SELF_NAME_HI]) {
    t = t.replace(re, (match: string, raw: string) => {
      const words = raw.split(/[ \t]+/);
      const end = words.findIndex((w) => NOT_NAME_WORDS.has(w.toLowerCase()));
      const value = (end === -1 ? words : words.slice(0, end)).join(" ");
      if (!value) return match;
      return match.slice(0, match.lastIndexOf(raw)) + raw.replace(value, r.placeholder("NAME", value));
    });
  }

  // Names we know, plus every name found above, so a surname also goes from "Mehta Clinic".
  // The full name first, then each part of 3+ letters ("Aryan", "Sharma").
  const parts = new Set<string>();
  for (const n of (opts.knownNames ?? []).map((x) => x.trim()).filter((x) => x.length >= 2)) {
    parts.add(n);
    for (const p of n.split(/\s+/)) if (p.length >= 3 && !NOT_NAME_PARTS.has(p.toLowerCase())) parts.add(p);
  }
  // A found name's parts only when they look like a name: capitalised (or Devanagari) and not a common word,
  // so a label value like "Name: Not provided" can't wipe "not" from the whole text.
  const found = Object.entries(r.map).filter(([ph]) => ph.startsWith("[NAME_")).map(([, v]) => v);
  for (const n of found) {
    for (const p of n.split(/\s+/)) {
      if (p.length >= 3 && (/^[A-Z]/.test(p) || /^\p{Script=Devanagari}/u.test(p)) && !NOT_NAME_PARTS.has(p.toLowerCase())) parts.add(p);
    }
  }
  for (const name of [...parts].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegex(name)}(?![\\p{L}\\p{M}\\p{N}])`, "giu");
    t = replaceGroup(t, re, "NAME", r);
  }

  return { text: t, map: r.map };
}

/** Puts the original values back (e.g. in text shown to the same user). Unknown placeholders are left as they are. */
export function restore(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [ph, original] of Object.entries(map)) out = out.split(ph).join(original);
  return out;
}
