/**
 * Curated red flags per condition (PLAN §2A, ADR-044): the warning signs a care plan always shows for a condition,
 * whatever the fetched pages say. Pure data + lookup, no I/O.
 *
 * Rules for every item:
 * - `quote` appears word for word on `source`. `pnpm verify:red-flags` re-fetches the pages and checks every quote;
 *   run it after any change.
 * - `text` restates the quote in plain words for the app and adds nothing it doesn't say. Numbers in `text` are in
 *   the quote. UK and US pages say "999" / "911": the app shows its own 108 / SOS button instead.
 * Changing the list needs a PROGRESS.md entry and a team review (EVALUATION §6 "Care plan red flags").
 */

export interface RedFlagSource {
  title: string;
  url: string;
}

export interface CuratedRedFlag {
  text: string;
  quote: string;
  source: RedFlagSource;
}

export interface ConditionRedFlags {
  id: string;
  condition: string;
  /** Lowercase words or phrases; the condition matches when one appears as whole words in its name. */
  match: string[];
  items: CuratedRedFlag[];
}

const MEDLINE_DIABETES: RedFlagSource = { title: "Type 2 diabetes, MedlinePlus", url: "https://medlineplus.gov/ency/article/000313.htm" };
const NHS_DKA: RedFlagSource = { title: "Diabetic ketoacidosis, NHS", url: "https://www.nhs.uk/conditions/diabetic-ketoacidosis/" };
const NHS_HYPO: RedFlagSource = { title: "Low blood sugar (hypoglycaemia), NHS", url: "https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/" };
const NHS_BP: RedFlagSource = { title: "High blood pressure (hypertension), NHS", url: "https://www.nhs.uk/conditions/high-blood-pressure-hypertension/" };
const NHS_ASTHMA: RedFlagSource = { title: "Asthma attacks, NHS", url: "https://www.nhs.uk/conditions/asthma/asthma-attack/" };
const MEDLINE_COPD: RedFlagSource = { title: "Chronic obstructive pulmonary disease (COPD), MedlinePlus", url: "https://medlineplus.gov/ency/article/000091.htm" };
const NHS_ANGINA: RedFlagSource = { title: "Angina, NHS", url: "https://www.nhs.uk/conditions/angina/" };
const NHS_HEART_FAILURE: RedFlagSource = { title: "Heart failure, NHS", url: "https://www.nhs.uk/conditions/heart-failure/" };
const NHS_EPILEPSY: RedFlagSource = { title: "Epilepsy, NHS", url: "https://www.nhs.uk/conditions/epilepsy/" };
const NHS_PRE_ECLAMPSIA: RedFlagSource = { title: "Pre-eclampsia, NHS", url: "https://www.nhs.uk/conditions/pre-eclampsia/" };
const NHS_DENGUE: RedFlagSource = { title: "Dengue, NHS", url: "https://www.nhs.uk/conditions/dengue/" };
const MEDLINE_HYPOTHYROID: RedFlagSource = { title: "Hypothyroidism, MedlinePlus", url: "https://medlineplus.gov/ency/article/000353.htm" };

const item = (text: string, quote: string, source: RedFlagSource): CuratedRedFlag => ({ text, quote, source });

export const CONDITION_RED_FLAGS: readonly ConditionRedFlags[] = [
  {
    id: "diabetes",
    condition: "Diabetes",
    match: ["diabetes", "diabetic", "madhumeh", "मधुमेह", "डायबिटीज", "sugar ki bimari", "sugar ki bimaari"],
    items: [
      item("Chest pain or pressure", "Chest pain or pressure", MEDLINE_DIABETES),
      item("Fainting, confusion or unconsciousness", "Fainting, confusion or unconsciousness", MEDLINE_DIABETES),
      item("A seizure (fit)", "Seizure", MEDLINE_DIABETES),
      item("Shortness of breath", "Shortness of breath", MEDLINE_DIABETES),
      item("Red, painful skin that is spreading quickly", "Red, painful skin that is spreading quickly", MEDLINE_DIABETES),
      item(
        "Thirst and peeing more often, feeling sleepy or confused, and breath that smells fruity",
        "feeling thirsty and needing to pee more often, feeling sleepy or confused, and breath that smells fruity",
        NHS_DKA,
      ),
      item("Very low blood sugar with not responding normally, or unconsciousness", "they're not responding normally or they're unconscious", NHS_HYPO),
    ],
  },
  {
    id: "high_blood_pressure",
    condition: "High blood pressure",
    match: ["high blood pressure", "blood pressure", "hypertension", "hypertensive", "high bp", "bp", "रक्तचाप", "bp ki bimari"],
    items: [
      item("Sudden chest pain or discomfort that does not go away", "you get sudden pain or discomfort in your chest that does not go away", NHS_BP),
      item("Pain that spreads to an arm, the neck, jaw, stomach or back", "you get pain that spreads to your left or right arm, or your neck, jaw, stomach or back", NHS_BP),
      item("Chest pain with sweating, feeling sick, light-headed or short of breath", "you have chest pain and you feel sweaty, sick, light headed or short of breath", NHS_BP),
    ],
  },
  {
    id: "asthma",
    condition: "Asthma",
    match: ["asthma", "दमा", "dama"],
    items: [
      item("An asthma attack: severe symptoms and difficulty breathing", "An asthma attack is when you have severe symptoms and it's difficult to breathe", NHS_ASTHMA),
      item("During an attack, feeling worse at any time", "start to feel worse at any time", NHS_ASTHMA),
      item("During an attack, still not better after using the reliever inhaler as fully as allowed", "do not feel better after taking the maximum dose using an asthma reliever inhaler", NHS_ASTHMA),
      item("Having an attack without an inhaler", "do not have an asthma inhaler", NHS_ASTHMA),
    ],
  },
  {
    id: "copd",
    condition: "COPD",
    match: ["copd", "chronic obstructive", "emphysema", "chronic bronchitis"],
    items: [item("Shortness of breath that gets worse quickly", "if you have a rapid increase in shortness of breath", MEDLINE_COPD)],
  },
  {
    id: "heart_disease",
    condition: "Angina / heart disease",
    match: ["angina", "heart disease", "coronary", "coronary artery disease", "ischaemic heart", "ischemic heart", "heart attack", "cad"],
    items: [
      item(
        "Chest pain that does not stop after resting for a few minutes or after taking angina medicine",
        "chest pain that does not stop after resting for a few minutes or after taking your angina medicine",
        NHS_ANGINA,
      ),
      item("Sudden chest pain or discomfort that does not go away", "you get sudden pain or discomfort in your chest that does not go away", NHS_ANGINA),
      item(
        "Pain that spreads to an arm, the neck, jaw, shoulder, stomach or back",
        "you get pain that spreads to your left or right arm, or your neck, jaw, shoulder, stomach or back",
        NHS_ANGINA,
      ),
      item("Chest pain with sweating, feeling sick, light-headed or short of breath", "you have chest pain and you feel sweaty, sick, light-headed or short of breath", NHS_ANGINA),
    ],
  },
  {
    id: "heart_failure",
    condition: "Heart failure",
    match: ["heart failure", "cardiac failure"],
    items: [
      item("Severe difficulty breathing: gasping, choking or unable to speak", "you're gasping, choking or not able to get words out", NHS_HEART_FAILURE),
      item("Lips or skin turning pale, blue or grey", "your lips or skin are pale, blue or grey", NHS_HEART_FAILURE),
      item("Passing out and not responding normally", "someone has passed out and is not responding normally", NHS_HEART_FAILURE),
      item("Coughing up frothy pink phlegm", "you're coughing up frothy pink phlegm", NHS_HEART_FAILURE),
    ],
  },
  {
    id: "epilepsy",
    condition: "Epilepsy",
    match: ["epilepsy", "epileptic", "seizure disorder", "mirgi", "मिर्गी"],
    items: [
      item(
        "A seizure longer than usual, or longer than 5 minutes when the usual length isn't known",
        "longer than 5 minutes if you do not know how long their seizures usually last",
        NHS_EPILEPSY,
      ),
      item(
        "Not recovering as usual, or another seizure without recovering in between",
        "they do not recover as usual afterwards, or they have another seizure without recovering between seizures",
        NHS_EPILEPSY,
      ),
      item("3 or more seizures in 24 hours", "they've now had 3 or more seizures in 24 hours", NHS_EPILEPSY),
    ],
  },
  {
    id: "pregnancy",
    condition: "Pregnancy (pre-eclampsia warning signs)",
    match: ["pregnancy", "pregnant", "pre-eclampsia", "preeclampsia", "pre eclampsia", "garbhavastha", "गर्भावस्था"],
    items: [
      item("A severe headache that does not go away with simple painkillers", "a severe headache that does not go away with simple painkillers", NHS_PRE_ECLAMPSIA),
      item("Blurred vision or seeing flashing lights", "vision problems, such as blurred vision or seeing flashing lights", NHS_PRE_ECLAMPSIA),
      item("Pain below the ribs", "pain below the ribs", NHS_PRE_ECLAMPSIA),
      item("Sudden swelling of the face, hands or feet", "sudden swelling of the face, hands or feet", NHS_PRE_ECLAMPSIA),
    ],
  },
  {
    id: "dengue",
    condition: "Dengue",
    match: ["dengue", "डेंगू"],
    items: [
      item("Severe stomach pain", "severe tummy pain", NHS_DENGUE),
      item("Vomiting again and again", "repeatedly being sick", NHS_DENGUE),
      item("Fast breathing", "fast breathing", NHS_DENGUE),
      item("Bleeding gums or nose", "bleeding gums or nose", NHS_DENGUE),
      item("Extreme tiredness", "extreme tiredness (fatigue)", NHS_DENGUE),
      item("Restlessness", "being unable to relax (restlessness)", NHS_DENGUE),
      item("Blood in vomit or stool", "blood in your vomit or poo", NHS_DENGUE),
    ],
  },
  {
    id: "hypothyroidism",
    condition: "Underactive thyroid",
    match: ["hypothyroidism", "hypothyroid", "underactive thyroid", "low thyroid", "myxedema", "myxoedema"],
    items: [
      item("Chest pain or a fast heartbeat while on treatment", "You develop chest pain or rapid heartbeat", MEDLINE_HYPOTHYROID),
      item("Body temperature below normal", "Below normal body temperature", MEDLINE_HYPOTHYROID),
      item("Slowed breathing", "Decreased breathing", MEDLINE_HYPOTHYROID),
      item("Not responding (unresponsive)", "Unresponsiveness", MEDLINE_HYPOTHYROID),
    ],
  },
];

function words(s: string): string[] {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

/** True when every word of `phrase` appears, in order and next to each other, among `name`'s words. */
function hasPhrase(nameWords: string[], phrase: string): boolean {
  const p = words(phrase);
  if (!p.length) return false;
  for (let i = 0; i + p.length <= nameWords.length; i++) {
    if (p.every((w, j) => nameWords[i + j] === w)) return true;
  }
  return false;
}

/** The curated entries for a condition name ("Type 2 Diabetes with high BP" → diabetes + high blood pressure). */
export function redFlagsForCondition(name: string): ConditionRedFlags[] {
  const nameWords = words(name);
  return CONDITION_RED_FLAGS.filter((c) => c.match.some((m) => hasPhrase(nameWords, m)));
}
