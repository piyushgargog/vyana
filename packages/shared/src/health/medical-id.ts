// packages/shared/src/health/medical-id.ts
// The offline Medical ID QR (plan 6.5): what a first responder can read without internet.
// Owner: Vaibhav Parmar

import { z } from "zod";

/** The QR text starts with this; the number is the format version. */
export const MEDICAL_ID_PREFIX = "VYANA-ID:1:";

/** Any phone camera reads a QR of about this many characters; a denser code needs a steady hand. */
export const MEDICAL_ID_MAX_LENGTH = 600;

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

/** What `parseMedicalIdQr` returns. */
export interface MedicalIdData {
  name: string;
  blood_group: string | null;
  allergies: string[];
  medicines: string[];
  contact: MedicalIdContact | null;
  /** An expiring link to the full record (https only). */
  url: string | null;
}

/** The short keys inside the QR: n name, b blood group, a allergies, m medicines, c "contact name:phone", u share URL. */
const Payload = z.object({
  n: z.string().max(80).optional(),
  b: z.string().max(10).optional(),
  a: z.array(z.string().max(60)).max(20).optional(),
  m: z.array(z.string().max(80)).max(30).optional(),
  c: z.string().max(120).optional(),
  u: z.string().max(200).optional(),
});
type Payload = z.infer<typeof Payload>;

// ---- base64url without Buffer or btoa: React Native's engine and the browser differ in what they provide ----

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[n & 63];
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }
  return new Uint8Array(bytes);
}

const encode = (payload: Payload) => MEDICAL_ID_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

const clean = (text: string | null | undefined, max: number) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Builds the QR text from the basics of a patient: name, blood group, allergies, medicines, one emergency
 * contact ("name:phone") and, optionally, a link to the full record. It is meant to fit in
 * `MEDICAL_ID_MAX_LENGTH` characters, so it gives things up in this order until it does: the medicines
 * from the last one on, then the allergies from the last one on, then the link. The name, the blood group and the
 * contact always stay.
 */
export function buildMedicalIdQr(
  profile: MedicalIdProfile,
  meds: MedicalIdMedicine[],
  contact: MedicalIdContact | null,
  shareUrl?: string | null,
  maxLength: number = MEDICAL_ID_MAX_LENGTH,
): string {
  const medicines = meds
    .map((m) => clean(m.strength ? `${m.medicine_name} ${m.strength}` : m.medicine_name, 80))
    .filter((m) => m !== "")
    .slice(0, 30);
  const allergies = profile.allergies.map((a) => clean(a, 60)).filter((a) => a !== "").slice(0, 20);
  const link = shareUrl ? clean(shareUrl, 200) : "";

  const payload: Payload = {};
  const name = clean(profile.full_name, 80);
  if (name) payload.n = name;
  const blood = clean(profile.blood_group, 10);
  if (blood) payload.b = blood;
  if (contact && contact.phone.trim() !== "") payload.c = clean(`${clean(contact.name, 50).replace(/:/g, " ")}:${clean(contact.phone, 30)}`, 120);

  const make = (m: string[], a: string[], u: string): Payload => ({
    ...payload,
    ...(a.length ? { a } : {}),
    ...(m.length ? { m } : {}),
    ...(u ? { u } : {}),
  });

  let keptMedicines = medicines;
  let keptAllergies = allergies;
  let keptLink = link;
  while (encode(make(keptMedicines, keptAllergies, keptLink)).length > maxLength) {
    if (keptMedicines.length > 0) keptMedicines = keptMedicines.slice(0, -1);
    else if (keptAllergies.length > 0) keptAllergies = keptAllergies.slice(0, -1);
    else if (keptLink) keptLink = "";
    else break;
  }
  return encode(make(keptMedicines, keptAllergies, keptLink));
}

/**
 * Reads a QR text made by `buildMedicalIdQr`. Returns null for anything else: another QR, another version,
 * damaged text, or data of the wrong shape. A link is kept only if it is `https://`, because the scan screen may
 * open it.
 */
export function parseMedicalIdQr(text: string): MedicalIdData | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(MEDICAL_ID_PREFIX) || trimmed.length > 4000) return null;
  const bytes = fromBase64Url(trimmed.slice(MEDICAL_ID_PREFIX.length));
  if (!bytes) return null;

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  const parsed = Payload.safeParse(json);
  if (!parsed.success) return null;
  const p = parsed.data;

  let contact: MedicalIdContact | null = null;
  if (p.c) {
    const at = p.c.lastIndexOf(":");
    if (at > 0 && at < p.c.length - 1) contact = { name: p.c.slice(0, at).trim(), phone: p.c.slice(at + 1).trim() };
  }
  return {
    name: p.n ?? "",
    blood_group: p.b ?? null,
    allergies: p.a ?? [],
    medicines: p.m ?? [],
    contact,
    url: p.u && p.u.startsWith("https://") ? p.u : null,
  };
}
