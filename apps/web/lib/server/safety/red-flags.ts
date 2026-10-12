/**
 * Emergency warning signs (PLAN §2A rule 4, DESIGN §10). Fixed rules run in code BEFORE any model call, so an
 * emergency is never missed because a model misread it. Used by triage, the assistant and care plans.
 *
 * Every rule comes from the source below, written as English, Hindi and Hinglish phrases. Matching is deliberately
 * cautious: a false alarm only shows the 108 notice, a miss could cost a life, so negations ("no chest pain")
 * still match. Changing a rule needs a PROGRESS.md entry and a safety eval re-run (EVALUATION §6).
 */

export const RED_FLAG_SOURCE = {
  title: "Recognizing medical emergencies (MedlinePlus, U.S. National Library of Medicine)",
  url: "https://medlineplus.gov/ency/article/001927.htm",
} as const;

export interface RedFlagRule {
  id: string;
  /** Plain-English warning sign, shown to the user. */
  label: string;
  /** The rule matches when every term of ANY one pattern appears in the text. */
  patterns: string[][];
}

export const RED_FLAG_RULES: readonly RedFlagRule[] = [
  {
    id: "chest_pain",
    label: "Chest pain or pressure",
    patterns: [
      ["chest", "pain"], ["chest", "tight"], ["chest", "pressure"], ["chest", "discomfort"], ["chest", "heavy"],
      ["seene", "dard"], ["seeney", "dard"], ["chhati", "dard"], ["chati", "dard"],
      ["सीने", "दर्द"], ["छाती", "दर्द"],
    ],
  },
  {
    id: "breathing",
    label: "Trouble breathing",
    patterns: [
      ["short", "breath"], ["shortness", "breath"], ["breathless"], ["cant", "breathe"], ["cannot", "breathe"],
      ["difficulty", "breathing"], ["trouble", "breathing"], ["not", "breathing"], ["hard", "breathe"],
      ["saans", "nahi"], ["saans", "taklif"], ["saans", "takleef"], ["saans", "dikkat"], ["saans", "phool"],
      ["सांस", "नहीं"], ["सांस", "तकलीफ"], ["सांस", "दिक्कत"], ["सांस", "फूल"], ["साँस", "नहीं"], ["साँस", "तकलीफ"],
    ],
  },
  {
    id: "choking",
    label: "Choking",
    patterns: [["choking"], ["choked"], ["gale", "atak"], ["गले", "अटक"]],
  },
  {
    id: "unconscious",
    label: "Fainting or loss of consciousness",
    patterns: [
      ["unconscious"], ["fainted"], ["fainting"], ["passed", "out"], ["not", "responding"], ["unresponsive"],
      ["behosh"], ["बेहोश"],
    ],
  },
  {
    id: "bleeding",
    label: "Bleeding that won't stop",
    patterns: [
      ["heavy", "bleeding"], ["bleeding", "heavily"], ["uncontrolled", "bleeding"], ["bleeding", "wont", "stop"],
      ["bleeding", "not", "stopping"], ["khoon", "band", "nahi"], ["khoon", "ruk", "nahi"],
      ["खून", "बंद", "नहीं"], ["खून", "रुक", "नहीं"],
    ],
  },
  {
    id: "blood_vomit_cough",
    label: "Coughing up or vomiting blood",
    patterns: [
      ["vomiting", "blood"], ["vomit", "blood"], ["coughing", "blood"], ["cough", "blood"], ["blood", "vomit"],
      ["khoon", "ulti"], ["khoon", "khansi"], ["खून", "उल्टी"], ["खून", "खांसी"],
    ],
  },
  {
    id: "stroke_signs",
    label: "Sudden weakness, numbness, confusion, trouble speaking or vision changes",
    patterns: [
      ["sudden", "weakness"], ["sudden", "numbness"], ["sudden", "confusion"], ["sudden", "vision"],
      ["face", "drooping"], ["slurred", "speech"], ["cant", "speak"], ["unable", "speak"], ["paralysis"],
      ["lakwa"], ["लकवा"],
    ],
  },
  {
    id: "seizure",
    label: "Seizure",
    patterns: [["seizure"], ["convulsion"], ["having", "fits"], ["mirgi"], ["daura", "pada"], ["मिर्गी"], ["दौरा", "पड़ा"]],
  },
  {
    id: "self_harm",
    label: "Thoughts of suicide or harming others",
    patterns: [
      ["suicide"], ["suicidal"], ["kill", "myself"], ["end", "my", "life"], ["harm", "myself"], ["want", "to", "die"],
      ["khudkushi"], ["aatmahatya"], ["marna", "chahta"], ["marna", "chahti"],
      ["आत्महत्या"], ["ख़ुदकुशी"], ["खुदकुशी"], ["मरना", "चाहता"], ["मरना", "चाहती"],
    ],
  },
  {
    id: "poisoning",
    label: "Swallowed poison or an overdose",
    patterns: [["poison"], ["overdose"], ["zeher"], ["zehar"], ["jahar"], ["जहर"], ["ज़हर"]],
  },
  {
    id: "face_swelling",
    label: "Swelling of the face, eyes or tongue",
    patterns: [
      ["swelling", "face"], ["swollen", "face"], ["swelling", "tongue"], ["swollen", "tongue"], ["swollen", "lips"],
      ["swelling", "eyes"], ["throat", "closing"], ["anaphylaxis"], ["chehre", "sujan"], ["चेहरे", "सूजन"],
    ],
  },
  {
    id: "head_spine_injury",
    label: "Head or spine injury",
    patterns: [["head", "injury"], ["hit", "head"], ["spine", "injury"], ["sir", "chot"], ["सिर", "चोट"]],
  },
  {
    id: "severe_pain",
    label: "Sudden, severe pain (including the belly or head)",
    patterns: [
      ["severe", "abdominal", "pain"], ["severe", "stomach", "pain"], ["severe", "belly", "pain"],
      ["sudden", "severe", "pain"], ["worst", "headache"], ["sudden", "severe", "headache"],
    ],
  },
  {
    id: "serious_injury",
    label: "Serious injury: accident, burn, near-drowning or deep wound",
    patterns: [["accident"], ["burns"], ["burned"], ["drowning"], ["deep", "wound"], ["smoke", "inhalation"]],
  },
  {
    id: "child_warning",
    label: "Child with bluish skin, or fever with a stiff neck",
    patterns: [["bluish"], ["blue", "lips"], ["fever", "stiff", "neck"]],
  },
];

/** Lowercase, NFKC, drop apostrophes ("can't" → "cant"), split into words (Latin and Devanagari). */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

/** A term matches a word exactly, or as its start when the term has 4+ characters ("breath" → "breathing"). */
function hasTerm(words: string[], term: string): boolean {
  const t = term.normalize("NFKC");
  return words.some((w) => w === t || (t.length >= 4 && w.startsWith(t)));
}

/** Returns the ids of every rule that matches, in rule order. Empty array = no red flag found. */
export function matchRedFlags(text: string): string[] {
  const words = tokenize(text);
  if (words.length === 0) return [];
  return RED_FLAG_RULES.filter((rule) => rule.patterns.some((p) => p.every((term) => hasTerm(words, term)))).map((r) => r.id);
}

export function redFlagLabels(ids: string[]): string[] {
  return ids.map((id) => RED_FLAG_RULES.find((r) => r.id === id)?.label).filter((l): l is string => Boolean(l));
}
