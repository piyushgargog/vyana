// packages/shared/src/health/medical-id.ts
// The offline Medical ID QR (plan 6.5): what a first responder can read without internet.
// Owner: Vaibhav Parmar

/**
 * The QR holds plain text, so any phone camera shows it as it is, with no app and no internet: a first responder reads
 * the lines straight from the scan result. (It used to be base64-encoded JSON, which a camera shows as gibberish.)
 */
export const MEDICAL_ID_TITLE = "VYANA EMERGENCY ID";

/** Any phone camera reads a QR of about this many bytes (UTF-8); a denser code needs a steady hand. */
export const MEDICAL_ID_MAX_LENGTH = 400;

export interface MedicalIdProfile {
  full_name: string | null;
  blood_group: string | null;
  allergies: string[];
}

export interface MedicalIdMedicine {
  medicine_name: string;
  strength?: string | null;
}

export interface MedicalIdContact {
  name: string;
  phone: string;
}

const NOT_RECORDED = "not recorded";

const clean = (text: string | null | undefined, max: number) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/** "A; B; +3 more" when only the first `kept.length` of `total` entries fit. */
function listLine(label: string, kept: string[], total: number): string {
  if (total === 0) return `${label}: ${NOT_RECORDED}`;
  const more = total - kept.length;
  return `${label}: ${[...kept, ...(more > 0 ? [`+${more} more`] : [])].join("; ")}`;
}

/**
 * Builds the QR text from the basics of a patient: name, blood group, allergies, medicines and one emergency
 * contact, one per line. Nothing in it needs the internet. It is meant to fit in `MEDICAL_ID_MAX_LENGTH` bytes, so it
 * gives things up in this order until it does: the medicines from the last one on, then the allergies from the last
 * one on (the line says "+N more" so nobody thinks the list is complete). The name, the blood group and the contact
 * always stay. Whatever is missing says "not recorded", never "none".
 */
export function buildMedicalIdQr(
  profile: MedicalIdProfile,
  meds: MedicalIdMedicine[],
  contact: MedicalIdContact | null,
  maxLength: number = MEDICAL_ID_MAX_LENGTH,
): string {
  const medicines = meds
    .map((m) => clean(m.strength ? `${m.medicine_name} ${m.strength}` : m.medicine_name, 80))
    .filter((m) => m !== "")
    .slice(0, 30);
  const allergies = profile.allergies.map((a) => clean(a, 60)).filter((a) => a !== "").slice(0, 20);

  const name = clean(profile.full_name, 80) || NOT_RECORDED;
  const blood = clean(profile.blood_group, 10) || NOT_RECORDED;
  const phone = contact ? clean(contact.phone, 30) : "";
  const contactLine = contact && phone ? `Emergency contact: ${clean(contact.name, 50) || "contact"} ${phone}` : `Emergency contact: ${NOT_RECORDED}`;

  const make = (m: number, a: number) =>
    [
      MEDICAL_ID_TITLE,
      `Name: ${name}`,
      `Blood group: ${blood}`,
      listLine("Allergies", allergies.slice(0, a), allergies.length),
      listLine("Medicines", medicines.slice(0, m), medicines.length),
      contactLine,
    ].join("\n");

  let keptMedicines = medicines.length;
  let keptAllergies = allergies.length;
  while (byteLength(make(keptMedicines, keptAllergies)) > maxLength) {
    if (keptMedicines > 0) keptMedicines--;
    else if (keptAllergies > 0) keptAllergies--;
    else break;
  }
  return make(keptMedicines, keptAllergies);
}
