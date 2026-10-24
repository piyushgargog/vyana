import type { Language, MealType, VitalType } from '@vyana/shared';

/**
 * The care plan screen's own words (issue #489). The plan's *content* arrives from the
 * server in the patient's language and is never touched here; this dictionary covers
 * only the screen's chrome — headings, badges, buttons, form text — so the headings
 * follow the plan's language instead of staying English around a Hindi plan. English
 * is the fallback when there is no plan yet (its language is not known before then).
 */
export interface PlanStrings {
  eyebrow: string;
  noPlanTitle: string;
  approvedBadge: string;
  approvedNote: string;
  generatedBadge: string;
  generatedNote: string;
  emptyTitle: string;
  emptyBody: string;
  generate: string;
  generateLabel: string;
  generatedToast: string;
  generateFailed: string;
  summary: string;
  whatToDo: string;
  whatToAvoid: string;
  diet: string;
  eatMore: string;
  limit: string;
  sampleDay: string;
  mealLog: string;
  todayTracking: (date: string) => string;
  openMealLog: string;
  mealsWithoutCalories: (count: number) => string;
  noCalories: string;
  logMealTitle: string;
  mealDescriptionLabel: string;
  mealPlaceholder: string;
  caloriesLabel: string;
  caloriesPlaceholder: string;
  mealEmptyError: string;
  mealTooLong: (max: number) => string;
  caloriesRange: (max: number) => string;
  mealLogFailed: string;
  mealLogged: string;
  mealRemoved: string;
  mealRemoveFailed: string;
  logMeal: string;
  logMealLabel: string;
  deleteMeal: (mealLabel: string) => string;
  pickMeal: (mealLabel: string) => string;
  redFlags: string;
  redFlagsNote: string;
  followUpTests: string;
  everyDays: (days: number) => string;
  sources: string;
  openSource: (title: string) => string;
  vitalsTitle: string;
  selectVital: (vitalLabel: string) => string;
  enterVital: (vitalLabel: string) => string;
  enterValue: (unit: string) => string;
  logVital: string;
  logVitalLabel: string;
  vitalInvalid: string;
  vitalLogged: (vitalLabel: string) => string;
  vitalLogFailed: string;
  mealTypes: Record<MealType, string>;
  vitalTypes: Partial<Record<VitalType, string>>;
}

const EN: PlanStrings = {
  eyebrow: 'Care plan',
  noPlanTitle: 'Chronic Care Plan',
  approvedBadge: 'Doctor reviewed and approved',
  approvedNote: 'Approved by your doctor. Follow this plan as advised.',
  generatedBadge: 'Patient generated — not reviewed by a doctor',
  generatedNote:
    'Created from verified health guidelines. Please discuss these guidelines with your doctor.',
  emptyTitle: 'No care plan active yet',
  emptyBody:
    'Generate an evidence-based daily plan with diet, exercise, red flags, and follow-up test reminders from WHO and ICMR guidelines.',
  generate: 'Generate care plan',
  generateLabel: 'Generate personalized care plan',
  generatedToast: 'Generated evidence-based care plan',
  generateFailed: 'Could not generate care plan',
  summary: 'Summary',
  whatToDo: 'What to do',
  whatToAvoid: 'What to avoid',
  diet: 'Diet and nutrition',
  eatMore: 'Eat more',
  limit: 'Limit or avoid',
  sampleDay: 'Sample day',
  mealLog: 'Daily meal log',
  todayTracking: (date) => `Today’s diet tracking (${date})`,
  openMealLog: 'Open full meal log',
  mealsWithoutCalories: (count) => `${count} ${count === 1 ? 'meal' : 'meals'} without calories`,
  noCalories: 'No calories',
  logMealTitle: 'Log today’s meal',
  mealDescriptionLabel: 'Meal description',
  mealPlaceholder: 'What did you eat? (e.g. 2 Roti, Sabzi)',
  caloriesLabel: 'Calories',
  caloriesPlaceholder: 'Calories in kcal (optional, 0–5000)',
  mealEmptyError: 'Say what you ate',
  mealTooLong: (max) => `Keep it under ${max} characters`,
  caloriesRange: (max) => `Calories must be a whole number from 0 to ${max}`,
  mealLogFailed: 'Could not log meal',
  mealLogged: 'Meal logged in care plan',
  mealRemoved: 'Meal entry removed',
  mealRemoveFailed: 'Could not remove meal',
  logMeal: 'Log meal',
  logMealLabel: 'Log meal entry',
  deleteMeal: (mealLabel) => `Delete ${mealLabel} entry`,
  pickMeal: (mealLabel) => `Pick meal ${mealLabel}`,
  redFlags: 'Critical red flags',
  redFlagsNote: 'Seek immediate help or call 108',
  followUpTests: 'Follow-up tests',
  everyDays: (days) => `Every ${days} days`,
  sources: 'Verified medical sources',
  openSource: (title) => `Open source ${title}`,
  vitalsTitle: 'Track daily health vitals',
  selectVital: (vitalLabel) => `Select vital ${vitalLabel}`,
  enterVital: (vitalLabel) => `Enter ${vitalLabel} reading`,
  enterValue: (unit) => `Enter value (${unit})`,
  logVital: 'Log vital',
  logVitalLabel: 'Log vital reading',
  vitalInvalid: 'Please enter a valid vital reading',
  vitalLogged: (vitalLabel) => `Logged ${vitalLabel} reading`,
  vitalLogFailed: 'Could not log vital',
  mealTypes: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' },
  vitalTypes: {
    sugar_fasting: 'Fasting Sugar',
    sugar_random: 'Random Sugar',
    bp: 'Blood Pressure',
    heart_rate: 'Heart Rate',
    weight: 'Weight',
    spo2: 'SpO2',
  },
};

const HI: PlanStrings = {
  eyebrow: 'देखभाल योजना',
  noPlanTitle: 'दीर्घकालिक देखभाल योजना',
  approvedBadge: 'डॉक्टर ने देखकर मंज़ूरी दी है',
  approvedNote: 'आपके डॉक्टर ने मंज़ूरी दी है। सलाह के अनुसार इस योजना का पालन करें।',
  generatedBadge: 'मरीज़ द्वारा बनाया गया — डॉक्टर ने नहीं देखा है',
  generatedNote:
    'सत्यापित स्वास्थ्य दिशानिर्देशों से बनाया गया है। कृपया अपने डॉक्टर से इन दिशानिर्देशों पर चर्चा करें।',
  emptyTitle: 'अभी कोई देखभाल योजना सक्रिय नहीं है',
  emptyBody:
    'WHO और ICMR दिशानिर्देशों से आहार, व्यायाम, चेतावनी संकेतों और फ़ॉलो-अप जाँच की याद के साथ प्रमाण-आधारित रोज़ की योजना बनाएँ।',
  generate: 'देखभाल योजना बनाएँ',
  generateLabel: 'अपनी देखभाल योजना बनाएँ',
  generatedToast: 'प्रमाण-आधारित देखभाल योजना बन गई',
  generateFailed: 'देखभाल योजना नहीं बन सकी',
  summary: 'सारांश',
  whatToDo: 'क्या करें',
  whatToAvoid: 'क्या न करें',
  diet: 'आहार और पोषण',
  eatMore: 'ज़्यादा खाएँ',
  limit: 'कम करें या न खाएँ',
  sampleDay: 'नमूना दिन',
  mealLog: 'रोज़ का भोजन लॉग',
  todayTracking: (date) => `आज की आहार ट्रैकिंग (${date})`,
  openMealLog: 'पूरा भोजन लॉग खोलें',
  mealsWithoutCalories: (count) => `${count} भोजन बिना कैलोरी के`,
  noCalories: 'कैलोरी नहीं',
  logMealTitle: 'आज का भोजन लिखें',
  mealDescriptionLabel: 'भोजन का विवरण',
  mealPlaceholder: 'आपने क्या खाया? (जैसे 2 रोटी, सब्ज़ी)',
  caloriesLabel: 'कैलोरी',
  caloriesPlaceholder: 'कैलोरी किलो कैलोरी में (वैकल्पिक, 0–5000)',
  mealEmptyError: 'बताएँ कि आपने क्या खाया',
  mealTooLong: (max) => `${max} अक्षरों से कम में रखें`,
  caloriesRange: (max) => `कैलोरी 0 से ${max} के बीच की पूर्ण संख्या होनी चाहिए`,
  mealLogFailed: 'भोजन दर्ज नहीं हो सका',
  mealLogged: 'भोजन देखभाल योजना में दर्ज हो गया',
  mealRemoved: 'भोजन प्रविष्टि हट गई',
  mealRemoveFailed: 'भोजन नहीं हट सका',
  logMeal: 'भोजन दर्ज करें',
  logMealLabel: 'भोजन प्रविष्टि दर्ज करें',
  deleteMeal: (mealLabel) => `${mealLabel} प्रविष्टि हटाएँ`,
  pickMeal: (mealLabel) => `${mealLabel} चुनें`,
  redFlags: 'गंभीर चेतावनी संकेत',
  redFlagsNote: 'तुरंत मदद लें या 108 पर कॉल करें',
  followUpTests: 'फ़ॉलो-अप जाँच',
  everyDays: (days) => `हर ${days} दिन`,
  sources: 'सत्यापित चिकित्सा स्रोत',
  openSource: (title) => `स्रोत खोलें ${title}`,
  vitalsTitle: 'रोज़ के स्वास्थ्य संकेत दर्ज करें',
  selectVital: (vitalLabel) => `${vitalLabel} चुनें`,
  enterVital: (vitalLabel) => `${vitalLabel} की रीडिंग लिखें`,
  enterValue: (unit) => `मान लिखें (${unit})`,
  logVital: 'रीडिंग दर्ज करें',
  logVitalLabel: 'वाइटल रीडिंग दर्ज करें',
  vitalInvalid: 'कृपया सही रीडिंग लिखें',
  vitalLogged: (vitalLabel) => `${vitalLabel} की रीडिंग दर्ज हो गई`,
  vitalLogFailed: 'रीडिंग दर्ज नहीं हो सकी',
  mealTypes: { breakfast: 'नाश्ता', lunch: 'दोपहर का खाना', dinner: 'रात का खाना', snack: 'हल्का नाश्ता' },
  vitalTypes: {
    sugar_fasting: 'उपवास शुगर',
    sugar_random: 'रैंडम शुगर',
    bp: 'ब्लड प्रेशर',
    heart_rate: 'हृदय गति',
    weight: 'वज़न',
    spo2: 'SpO2',
  },
};

const HINGLISH: PlanStrings = {
  eyebrow: 'Care plan',
  noPlanTitle: 'Chronic Care Plan',
  approvedBadge: 'Doctor ne review karke approve kiya hai',
  approvedNote: 'Aapke doctor ne approve kiya hai. Salah ke hisaab se is plan ko follow karein.',
  generatedBadge: 'Patient generated — doctor ne review nahi kiya hai',
  generatedNote:
    'Verified health guidelines se banaya gaya hai. Kripya apne doctor se in guidelines par baat karein.',
  emptyTitle: 'Abhi koi care plan active nahi hai',
  emptyBody:
    'WHO aur ICMR guidelines se diet, exercise, red flags aur follow-up test reminders ke saath evidence-based daily plan banayein.',
  generate: 'Care plan banayein',
  generateLabel: 'Apna care plan banayein',
  generatedToast: 'Evidence-based care plan ban gaya',
  generateFailed: 'Care plan nahi ban saka',
  summary: 'Summary',
  whatToDo: 'Kya karein',
  whatToAvoid: 'Kya na karein',
  diet: 'Diet aur nutrition',
  eatMore: 'Zyada khayein',
  limit: 'Kam karein ya na khayein',
  sampleDay: 'Sample day',
  mealLog: 'Roz ka meal log',
  todayTracking: (date) => `Aaj ki diet tracking (${date})`,
  openMealLog: 'Poora meal log kholein',
  mealsWithoutCalories: (count) =>
    count === 1 ? '1 meal bina calories ke' : `${count} meals bina calories ke`,
  noCalories: 'Calories nahi',
  logMealTitle: 'Aaj ka meal likhein',
  mealDescriptionLabel: 'Meal ka description',
  mealPlaceholder: 'Aapne kya khaya? (jaise 2 Roti, Sabzi)',
  caloriesLabel: 'Calories',
  caloriesPlaceholder: 'Calories kcal mein (optional, 0–5000)',
  mealEmptyError: 'Batayein aapne kya khaya',
  mealTooLong: (max) => `${max} characters se kam mein likhein`,
  caloriesRange: (max) => `Calories 0 se ${max} ke beech ki poori sankhya honi chahiye`,
  mealLogFailed: 'Meal log nahi ho saka',
  mealLogged: 'Meal care plan mein log ho gaya',
  mealRemoved: 'Meal entry hat gayi',
  mealRemoveFailed: 'Meal nahi hat saka',
  logMeal: 'Meal log karein',
  logMealLabel: 'Meal entry log karein',
  deleteMeal: (mealLabel) => `${mealLabel} entry hatayein`,
  pickMeal: (mealLabel) => `${mealLabel} chunein`,
  redFlags: 'Critical red flags',
  redFlagsNote: 'Turant madad lein ya 108 par call karein',
  followUpTests: 'Follow-up tests',
  everyDays: (days) => `Har ${days} din`,
  sources: 'Verified medical sources',
  openSource: (title) => `Source kholein ${title}`,
  vitalsTitle: 'Roz ke health vitals track karein',
  selectVital: (vitalLabel) => `${vitalLabel} chunein`,
  enterVital: (vitalLabel) => `${vitalLabel} reading likhein`,
  enterValue: (unit) => `Value likhein (${unit})`,
  logVital: 'Vital log karein',
  logVitalLabel: 'Vital reading log karein',
  vitalInvalid: 'Kripya sahi vital reading likhein',
  vitalLogged: (vitalLabel) => `${vitalLabel} reading log ho gayi`,
  vitalLogFailed: 'Vital log nahi ho saka',
  mealTypes: { breakfast: 'Nashta', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' },
  vitalTypes: {
    sugar_fasting: 'Fasting Sugar',
    sugar_random: 'Random Sugar',
    bp: 'Blood Pressure',
    heart_rate: 'Heart Rate',
    weight: 'Wazan',
    spo2: 'SpO2',
  },
};

const PLAN_STRINGS: Record<Language, PlanStrings> = { en: EN, hi: HI, hinglish: HINGLISH };

/** The screen's words in the plan's language; English when the language is unknown. */
export function planStrings(language: Language | null | undefined): PlanStrings {
  return language ? PLAN_STRINGS[language] : EN;
}

/** The label of a stored meal value; a value outside the known set passes through as stored. */
export function planMealLabel(strings: PlanStrings, meal: string): string {
  return strings.mealTypes[meal as MealType] ?? meal;
}
