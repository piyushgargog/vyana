import { describe, expect, it } from "vitest";

import { buildMedicalIdQr, MEDICAL_ID_MAX_LENGTH, MEDICAL_ID_PREFIX, parseMedicalIdQr } from "./index";

const profile = { full_name: "Aryan Sharma", blood_group: "O+", allergies: ["Penicillin"] };
const meds = [
  { medicine_name: "Metformin", strength: "500 mg" },
  { medicine_name: "Telma (Telmisartan)", strength: "40 mg" },
];
const contact = { name: "Sunita Sharma", phone: "+91 00000 00006" };
const link = "https://vyana.app/share/0123456789abcdef0123456789abcdef0123456789abcdef";

describe("buildMedicalIdQr", () => {
  it("starts with the version prefix and uses only base64url characters", () => {
    const qr = buildMedicalIdQr(profile, meds, contact, link);
    expect(qr.startsWith(MEDICAL_ID_PREFIX)).toBe(true);
    expect(qr.slice(MEDICAL_ID_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("fits a QR that any phone reads", () => {
    const qr = buildMedicalIdQr(profile, meds, contact, link);
    expect(qr.length).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
  });

  it("is the same every time for the same person", () => {
    expect(buildMedicalIdQr(profile, meds, contact, link)).toBe(buildMedicalIdQr(profile, meds, contact, link));
  });

  it("round-trips through parseMedicalIdQr", () => {
    const parsed = parseMedicalIdQr(buildMedicalIdQr(profile, meds, contact, link));
    expect(parsed).toEqual({
      name: "Aryan Sharma",
      blood_group: "O+",
      allergies: ["Penicillin"],
      medicines: ["Metformin 500 mg", "Telma (Telmisartan) 40 mg"],
      contact: { name: "Sunita Sharma", phone: "+91 00000 00006" },
      url: link,
    });
  });

  it("keeps names in Hindi and other scripts", () => {
    const hindi = buildMedicalIdQr({ full_name: "आर्यन शर्मा", blood_group: "B+", allergies: ["पेनिसिलिन"] }, [{ medicine_name: "मेटफॉर्मिन" }], { name: "सुनीता", phone: "9876500000" });
    expect(parseMedicalIdQr(hindi)).toMatchObject({ name: "आर्यन शर्मा", allergies: ["पेनिसिलिन"], medicines: ["मेटफॉर्मिन"], contact: { name: "सुनीता", phone: "9876500000" } });
  });

  it("works with nothing but a name", () => {
    expect(parseMedicalIdQr(buildMedicalIdQr({ full_name: "A", blood_group: null, allergies: [] }, [], null))).toEqual({
      name: "A",
      blood_group: null,
      allergies: [],
      medicines: [],
      contact: null,
      url: null,
    });
  });

  it("leaves out the contact when it has no phone, and a colon in the contact's name does not break the split", () => {
    expect(parseMedicalIdQr(buildMedicalIdQr(profile, [], { name: "Mother", phone: "  " }))?.contact).toBeNull();
    expect(parseMedicalIdQr(buildMedicalIdQr(profile, [], { name: "Dr: Gupta", phone: "98765" }))?.contact).toEqual({ name: "Dr Gupta", phone: "98765" });
  });

  it("gives up the last medicines first when the list is long, and keeps name, blood group, contact and allergies", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ medicine_name: `Medicine number ${i + 1}`, strength: "500 mg tablet" }));
    const qr = buildMedicalIdQr(profile, many, contact, link);
    expect(qr.length).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
    const parsed = parseMedicalIdQr(qr);
    expect(parsed?.name).toBe("Aryan Sharma");
    expect(parsed?.blood_group).toBe("O+");
    expect(parsed?.allergies).toEqual(["Penicillin"]);
    expect(parsed?.contact).toEqual({ name: "Sunita Sharma", phone: "+91 00000 00006" });
    expect(parsed?.url).toBe(link);
    const kept = parsed?.medicines ?? [];
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(30);
    expect(kept).toEqual(many.slice(0, kept.length).map((m) => `${m.medicine_name} ${m.strength}`)); // the first ones stay, in order
  });

  it("drops the allergies and then the link only after all medicines are gone, and never the essentials", () => {
    const longAllergies = Array.from({ length: 20 }, (_, i) => `Allergy to substance number ${i + 1} with a long name`);
    const qr = buildMedicalIdQr(profile, meds, contact, link, 200);
    expect(qr.length).toBeLessThanOrEqual(200);
    const tight = parseMedicalIdQr(buildMedicalIdQr({ ...profile, allergies: longAllergies }, meds, contact, link, 160));
    expect(tight?.medicines).toEqual([]);
    expect(tight?.name).toBe("Aryan Sharma");
    expect(tight?.blood_group).toBe("O+");
    expect(tight?.contact?.phone).toBe("+91 00000 00006");
  });

  it("cleans up whitespace and cuts very long values", () => {
    const parsed = parseMedicalIdQr(buildMedicalIdQr({ full_name: "  Aryan \n  Sharma  ", blood_group: " O+ ", allergies: ["", "  ", "Penicillin"] }, [{ medicine_name: "x".repeat(300) }], null));
    expect(parsed?.name).toBe("Aryan Sharma");
    expect(parsed?.blood_group).toBe("O+");
    expect(parsed?.allergies).toEqual(["Penicillin"]);
    expect(parsed?.medicines[0].length).toBe(80);
  });
});

describe("parseMedicalIdQr", () => {
  const good = buildMedicalIdQr(profile, meds, contact, link);

  it("accepts the text with surrounding spaces", () => {
    expect(parseMedicalIdQr(`  ${good}\n`)?.name).toBe("Aryan Sharma");
  });

  it("returns null for another kind of QR, another version or an empty text", () => {
    expect(parseMedicalIdQr("https://example.com")).toBeNull();
    expect(parseMedicalIdQr("")).toBeNull();
    expect(parseMedicalIdQr(good.replace("VYANA-ID:1:", "VYANA-ID:2:"))).toBeNull();
    expect(parseMedicalIdQr(MEDICAL_ID_PREFIX)?.name ?? null).toBeNull(); // nothing after the prefix is not a record
  });

  it("returns null for damaged text", () => {
    expect(parseMedicalIdQr(`${MEDICAL_ID_PREFIX}@@@not-base64`)).toBeNull();
    expect(parseMedicalIdQr(`${MEDICAL_ID_PREFIX}abcde`)).toBeNull(); // length % 4 === 1
    expect(parseMedicalIdQr(good.slice(0, good.length - 7))).toBeNull(); // cut off: the JSON is broken
    expect(parseMedicalIdQr(`${MEDICAL_ID_PREFIX}${"A".repeat(5000)}`)).toBeNull(); // far longer than a QR can be
  });

  it("returns null for data of the wrong shape", () => {
    const wrap = (value: unknown) => MEDICAL_ID_PREFIX + Buffer.from(JSON.stringify(value)).toString("base64url");
    expect(parseMedicalIdQr(wrap([1, 2]))).toBeNull();
    expect(parseMedicalIdQr(wrap("text"))).toBeNull();
    expect(parseMedicalIdQr(wrap({ n: 5 }))).toBeNull();
    expect(parseMedicalIdQr(wrap({ a: "Penicillin" }))).toBeNull();
    expect(parseMedicalIdQr(wrap({ m: Array.from({ length: 31 }, () => "x") }))).toBeNull();
    expect(parseMedicalIdQr(wrap({ n: "x".repeat(81) }))).toBeNull();
  });

  it("accepts a QR made by hand in the documented format", () => {
    const text = MEDICAL_ID_PREFIX + Buffer.from(JSON.stringify({ n: "Test", b: "A-", a: ["Dust"], m: ["Dolo 650 mg"], c: "Home:011 0000 0000" })).toString("base64url");
    expect(parseMedicalIdQr(text)).toEqual({ name: "Test", blood_group: "A-", allergies: ["Dust"], medicines: ["Dolo 650 mg"], contact: { name: "Home", phone: "011 0000 0000" }, url: null });
  });

  it("keeps a link only when it is https", () => {
    const wrap = (u: string) => MEDICAL_ID_PREFIX + Buffer.from(JSON.stringify({ n: "T", u })).toString("base64url");
    expect(parseMedicalIdQr(wrap("https://vyana.app/share/abc"))?.url).toBe("https://vyana.app/share/abc");
    expect(parseMedicalIdQr(wrap("http://vyana.app/share/abc"))?.url).toBeNull();
    expect(parseMedicalIdQr(wrap("javascript:alert(1)"))?.url).toBeNull();
    expect(parseMedicalIdQr(wrap("intent://evil"))?.url).toBeNull();
  });

  it("does not trust the contact when it has no phone or no name", () => {
    const wrap = (c: string) => MEDICAL_ID_PREFIX + Buffer.from(JSON.stringify({ n: "T", c })).toString("base64url");
    expect(parseMedicalIdQr(wrap("NoPhone:"))?.contact).toBeNull();
    expect(parseMedicalIdQr(wrap(":123"))?.contact).toBeNull();
    expect(parseMedicalIdQr(wrap("nocolon"))?.contact).toBeNull();
  });
});
