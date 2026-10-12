/**
 * Output checks for AI text (PLAN §2A rules 1 and 6, DESIGN §10): the app never diagnoses and never gives a dose.
 * Used on lab summaries, triage advice, care plans and assistant replies. Pure functions, no I/O.
 *
 * Both checks are deliberately strict: a hit means "regenerate once, else fall back to safe wording". A false
 * hit costs a retry; a miss could tell a patient they have a disease or how much medicine to take.
 */

export interface BlocklistHit {
  /** What matched, as written in the text. */
  text: string;
  rule: string;
}

function lower(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

/** Finds every match of the global regex and records it under `rule`. */
function collect(text: string, re: RegExp, rule: string, hits: BlocklistHit[]) {
  for (const m of text.matchAll(re)) hits.push({ text: m[0], rule });
}

// ---------------------------------------------------------------- diagnosis

/** Sentences that tell the reader what they have. */
const DIAGNOSIS_PHRASES: [RegExp, string][] = [
  [/\byou(?:'ve| have| has| are| re|'re)[ \t]+(?:got[ \t]+)?(?:suffering[ \t]+from|diagnosed[ \t]+with|developed|a[ \t]+case[ \t]+of)\b/g, "you have / are suffering from"],
  [/\byou(?:'ve| have)[ \t]+(?:a[ \t]+|an[ \t]+)?(?:condition|disease|disorder|infection|illness)\b/g, "you have a condition"],
  [/\b(?:this|these|it|that|your[ \t]+(?:results?|report|values?|symptoms?))[ \t]+(?:means?|shows?|indicates?|suggests?|confirms?|points?[ \t]+to)[ \t]+(?:that[ \t]+)?you[ \t]+(?:have|are|may[ \t]+have|might[ \t]+have|probably[ \t]+have)\b/g, "this means you have"],
  [/\b(?:consistent|compatible)[ \t]+with[ \t]+(?:a[ \t]+)?(?:diagnosis|disease|condition)\b/g, "consistent with a diagnosis"],
  [/\b(?:you|patient)[ \t]+(?:is|are)[ \t]+(?:diabetic|hypertensive|anaemic|anemic|asthmatic|hypothyroid|hyperthyroid)\b/g, "you are diabetic / hypertensive"],
  [/\bdiagnos(?:is|ed|e)[ \t]+(?:is|of|with|as)\b/g, "diagnosis of / diagnosed with"],
];

/**
 * "aapko diabetes hai" / "आपको मधुमेह है": "you" + up to 5 words + "is". Checked word by word, so it can't backtrack.
 * Only counts when one of those words is a condition name, so "aapko doctor se milna hai" (you should see a doctor)
 * is fine.
 */
const YOU_WORDS = new Set(["aapko", "आपको"]);
const IS_WORDS = new Set(["hai", "hain", "है", "हैं"]);
function findYouHaveX(t: string, hits: BlocklistHit[]) {
  const words = t.split(/[^\p{L}\p{M}\p{N}-]+/u).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const startsYou = YOU_WORDS.has(words[i]) || (words[i] === "aap" && words[i + 1] === "ko");
    if (!startsYou) continue;
    const from = words[i] === "aap" ? i + 2 : i + 1;
    const window = words.slice(from, from + 6);
    const end = window.findIndex((w) => IS_WORDS.has(w));
    if (end <= 0) continue;
    const middle = window.slice(0, end).join(" ");
    if (DISEASE_TESTS.some((re) => re.test(middle))) {
      hits.push({ text: words.slice(i, from + end + 1).join(" "), rule: "aapko … hai" });
    }
  }
}

/**
 * Conditions a model must not name in triage, lab summaries or assistant replies. Care plans may name the
 * condition they are about; their caller removes it from the list.
 */
export const DISEASE_TERMS: readonly string[] = [
  "diabetes", "diabetic", "prediabetes", "pre-diabetes", "hypertension", "hypotension", "anaemia", "anemia",
  "hypothyroidism", "hyperthyroidism", "thyroiditis", "cancer", "carcinoma", "tumour", "tumor", "malignancy",
  "leukaemia", "leukemia", "lymphoma", "tuberculosis", "pneumonia", "covid", "covid-19", "dengue", "malaria",
  "typhoid", "hepatitis", "cirrhosis", "fatty liver", "jaundice", "chronic kidney disease", "kidney failure",
  "renal failure", "kidney stones", "gallstones", "heart attack", "myocardial infarction", "heart failure",
  "coronary artery disease", "angina", "arrhythmia", "atrial fibrillation", "stroke", "asthma", "copd",
  "bronchitis", "arthritis", "gout", "pcos", "pcod", "migraine", "appendicitis", "peptic ulcer", "gastritis",
  "sepsis", "hiv", "aids", "depression", "anxiety disorder", "schizophrenia", "bipolar disorder", "epilepsy",
  "dementia", "alzheimer", "parkinson", "obesity", "osteoporosis", "urinary tract infection", "uti",
  "hypercholesterolemia", "hypercholesterolaemia", "dyslipidemia", "dyslipidaemia",
  // Hindi / Hinglish
  "मधुमेह", "डायबिटीज", "कैंसर", "टीबी", "क्षय रोग", "दमा", "पीलिया", "हार्ट अटैक", "लकवा",
  "sugar ki bimari", "sugar ki bimaari", "bp ki bimari", "dil ka daura",
];

function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[ \\t-]+");
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "gu");
}
const DISEASE_REGEXES = DISEASE_TERMS.map((t) => [termRegex(t), t] as const);
/** Same terms without the global flag, for yes/no tests (a global regex keeps state between calls). */
const DISEASE_TESTS = DISEASE_REGEXES.map(([re]) => new RegExp(re.source, "u"));

export interface DiagnosisCheck {
  /** Sentences telling the reader what they have. */
  phrases: BlocklistHit[];
  /** Condition names mentioned at all. */
  diseases: BlocklistHit[];
}

/**
 * Finds diagnosis wording and condition names. `allowedConditions` (e.g. the care plan's own condition) are not
 * reported as disease mentions.
 */
export function checkDiagnosisLanguage(text: string, allowedConditions: string[] = []): DiagnosisCheck {
  const t = lower(text);
  const phrases: BlocklistHit[] = [];
  for (const [re, rule] of DIAGNOSIS_PHRASES) collect(t, re, rule, phrases);
  findYouHaveX(t, phrases);
  const allowed = allowedConditions.map(lower);
  const diseases: BlocklistHit[] = [];
  for (const [re, term] of DISEASE_REGEXES) {
    if (allowed.some((a) => a.includes(term) || term.includes(a))) continue;
    collect(t, re, `condition: ${term}`, diseases);
  }
  return { phrases, diseases };
}

/** True when the text diagnoses: a diagnosis sentence, or any condition name not in `allowedConditions`. */
export function hasDiagnosisLanguage(text: string, allowedConditions: string[] = []): boolean {
  const c = checkDiagnosisLanguage(text, allowedConditions);
  return c.phrases.length > 0 || c.diseases.length > 0;
}

// ---------------------------------------------------------------- doses

const NUM = "(?:\\d{1,4}(?:[.,]\\d{1,3})?|half|one|two|three|four|ek|do|teen|char|aadhi|आधी|एक|दो|तीन)";
/** `measure` = units also used for food and drink (ml, spoons), which a care plan's diet section may mention. */
const DOSE_PATTERNS: [RegExp, string, "dose" | "measure"][] = [
  // "mg/dL" is a lab concentration, not a dose, hence the "/" in the lookahead.
  [new RegExp(`(?<![\\p{L}\\d])\\d{1,5}(?:[.,]\\d{1,3})?[ \\t]?(?:mg|mcg|µg|iu|units?)(?![\\p{L}/])`, "gu"), "amount + unit", "dose"],
  [new RegExp(`(?<![\\p{L}\\d])\\d{1,5}(?:[.,]\\d{1,3})?[ \\t]?ml(?![\\p{L}])`, "gu"), "amount in ml", "measure"],
  [new RegExp(`(?<![\\p{L}])${NUM}[ \\t]+(?:tablets?|tabs?|capsules?|caps?|pills?|drops?|puffs?|sachets?|goli|goliyan|गोली|गोलियां)(?![\\p{L}])`, "gu"), "count + form", "dose"],
  [new RegExp(`(?<![\\p{L}])${NUM}[ \\t]+(?:teaspoons?|tablespoons?|spoons?|chammach|चम्मच)(?![\\p{L}])`, "gu"), "count + spoon", "measure"],
  [/(?<![\d])[0-2](?:[.-]|[ \t]-[ \t])[0-2](?:[.-]|[ \t]-[ \t])[0-2](?![\d])/g, "1-0-1 schedule", "dose"],
  [/\b(?:once|twice|thrice|one[ \t]+time|two[ \t]+times|three[ \t]+times|[1-6][ \t]+times)[ \t]+(?:a|per|in[ \t]+a|each)[ \t]+(?:day|daily|week)\b/g, "times a day", "dose"],
  [/\b(?:once|twice|thrice)[ \t]+daily\b/g, "once / twice daily", "dose"],
  [/\bevery[ \t]+\d{1,2}[ \t]+(?:hours?|hrs?)\b/g, "every N hours", "dose"],
  // Prescription shorthand. "SOS" is left out: the app's emergency button is called SOS.
  [/\b(?:od|bd|bid|tds|tid|qid|qds|hs)\b(?=[ \t]*(?:$|[.,;)]|after|before|with|for|x))/gm, "OD / BD / TDS", "dose"],
  [/\b(?:din[ \t]+(?:mein|me)|roz)[ \t]+(?:ek|do|teen|char|1|2|3|4)[ \t]+(?:baar|bar|goli)\b/g, "din mein do baar", "dose"],
  [/(?:दिन[ \t]+में|रोज़?)[ \t]+(?:एक|दो|तीन|चार|\d)[ \t]+(?:बार|गोली)/g, "दिन में दो बार", "dose"],
  [/\b(?:double|halve|increase|decrease|reduce|skip)[ \t]+(?:the[ \t]+|your[ \t]+)?(?:dose|dosage)\b/g, "change the dose", "dose"],
];

export interface DoseCheckOptions {
  /** Ignore ml and spoon amounts (a care plan's diet may say "a glass (200 ml) of milk"). */
  allowMeasures?: boolean;
}

/** Dose amounts, counts, schedules and dose-change advice. */
export function findDosePatterns(text: string, opts: DoseCheckOptions = {}): BlocklistHit[] {
  const t = lower(text);
  const hits: BlocklistHit[] = [];
  for (const [re, rule, kind] of DOSE_PATTERNS) {
    if (kind === "measure" && opts.allowMeasures) continue;
    collect(t, re, rule, hits);
  }
  return hits;
}

export function hasDosePattern(text: string, opts: DoseCheckOptions = {}): boolean {
  return findDosePatterns(text, opts).length > 0;
}
