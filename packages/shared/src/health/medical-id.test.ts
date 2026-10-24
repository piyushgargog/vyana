import { describe, expect, it } from "vitest";

import { buildMedicalIdQr, MEDICAL_ID_MAX_LENGTH, MEDICAL_ID_TITLE } from "./index";
import { buildQrMatrix } from "./qr";

const profile = { full_name: "Aryan Sharma", blood_group: "O+", allergies: ["Penicillin"] };
const meds = [
  { medicine_name: "Metformin", strength: "500 mg" },
  { medicine_name: "Telma (Telmisartan)", strength: "40 mg" },
];
const contact = { name: "Sunita Sharma", phone: "+91 00000 00006" };
const bytes = (text: string) => new TextEncoder().encode(text).length;

describe("buildMedicalIdQr", () => {
  it("is plain readable text, one fact per line", () => {
    expect(buildMedicalIdQr(profile, meds, contact)).toBe(
      [
        "VYANA EMERGENCY ID",
        "Name: Aryan Sharma",
        "Blood group: O+",
        "Allergies: Penicillin",
        "Medicines: Metformin 500 mg; Telma (Telmisartan) 40 mg",
        "Emergency contact: Sunita Sharma +91 00000 00006",
      ].join("\n"),
    );
  });

  it("needs no link and no internet: nothing in it is a URL", () => {
    expect(buildMedicalIdQr(profile, meds, contact)).not.toMatch(/https?:/);
  });

  it("is the same every time for the same person", () => {
    expect(buildMedicalIdQr(profile, meds, contact)).toBe(buildMedicalIdQr(profile, meds, contact));
  });

  it("keeps names in Hindi and other scripts", () => {
    const hindi = buildMedicalIdQr({ full_name: "आर्यन शर्मा", blood_group: "B+", allergies: ["पेनिसिलिन"] }, [{ medicine_name: "मेटफॉर्मिन" }], { name: "सुनीता", phone: "9876500000" });
    expect(hindi).toContain("Name: आर्यन शर्मा");
    expect(hindi).toContain("Allergies: पेनिसिलिन");
    expect(hindi).toContain("Medicines: मेटफॉर्मिन");
    expect(hindi).toContain("Emergency contact: सुनीता 9876500000");
    expect(bytes(hindi)).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
  });

  it("says 'not recorded', never 'none', for what is missing", () => {
    expect(buildMedicalIdQr({ full_name: null, blood_group: null, allergies: [] }, [], null)).toBe(
      [
        MEDICAL_ID_TITLE,
        "Name: not recorded",
        "Blood group: not recorded",
        "Allergies: not recorded",
        "Medicines: not recorded",
        "Emergency contact: not recorded",
      ].join("\n"),
    );
  });

  it("leaves out a contact that has no phone", () => {
    expect(buildMedicalIdQr(profile, [], { name: "Mother", phone: "  " })).toContain("Emergency contact: not recorded");
  });

  it("gives up the last medicines first and says how many are missing; name, blood group, allergies and contact stay", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ medicine_name: `Medicine number ${i + 1}`, strength: "500 mg tablet" }));
    const text = buildMedicalIdQr(profile, many, contact);
    expect(bytes(text)).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
    expect(text).toContain("Name: Aryan Sharma");
    expect(text).toContain("Blood group: O+");
    expect(text).toContain("Allergies: Penicillin");
    expect(text).toContain("Emergency contact: Sunita Sharma +91 00000 00006");
    const line = text.split("\n").find((l) => l.startsWith("Medicines: "))!;
    expect(line).toMatch(/; \+\d+ more$/);
    expect(line).toContain("Medicine number 1 500 mg tablet");
    expect(line).not.toContain("Medicine number 30 ");
  });

  it("says how many are missing when the lists are over the cap before any trimming", () => {
    const many = Array.from({ length: 35 }, (_, i) => ({ medicine_name: `Med ${i + 1}` }));
    const allergies = Array.from({ length: 25 }, (_, i) => `Allergy ${i + 1}`);
    const text = buildMedicalIdQr({ ...profile, allergies }, many, contact, 2000);
    const medLine = text.split("\n").find((l) => l.startsWith("Medicines: "))!;
    const allergyLine = text.split("\n").find((l) => l.startsWith("Allergies: "))!;
    expect(medLine).toMatch(/; \+5 more$/);
    expect(allergyLine).toMatch(/; \+5 more$/);
    expect(text).not.toContain("Med 31");
    expect(text).not.toContain("Allergy 21");
  });

  it("drops the allergies only after all medicines are gone, and never the essentials", () => {
    const longAllergies = Array.from({ length: 20 }, (_, i) => `Allergy to substance number ${i + 1} with a long name`);
    const text = buildMedicalIdQr({ ...profile, allergies: longAllergies }, meds, contact, 230);
    expect(bytes(text)).toBeLessThanOrEqual(230);
    expect(text).toContain("Medicines: +2 more");
    expect(text).toContain("Allergies: ");
    expect(text).toContain("Name: Aryan Sharma");
    expect(text).toContain("Blood group: O+");
    expect(text).toContain("Emergency contact: Sunita Sharma +91 00000 00006");
  });

  it("cleans up whitespace and cuts very long values", () => {
    const text = buildMedicalIdQr({ full_name: "  Aryan \n  Sharma  ", blood_group: " O+ ", allergies: ["", "  ", "Penicillin"] }, [{ medicine_name: "x".repeat(300) }], null);
    expect(text).toContain("Name: Aryan Sharma");
    expect(text).toContain("Blood group: O+");
    expect(text).toContain("Allergies: Penicillin");
    expect(text).toContain(`Medicines: ${"x".repeat(80)}`);
    expect(text).not.toContain("x".repeat(81));
  });

  it("leaves ordinary payloads byte-for-byte unchanged, in any script", () => {
    const text = buildMedicalIdQr(
      { full_name: "आर्यन शर्मा", blood_group: "B+", allergies: ["पेनिसिलिन"] },
      [{ medicine_name: "मेटफॉर्मिन" }],
      { name: "सुनीता", phone: "9876500000" },
    );
    expect(text).toBe(
      [
        "VYANA EMERGENCY ID",
        "Name: आर्यन शर्मा",
        "Blood group: B+",
        "Allergies: पेनिसिलिन",
        "Medicines: मेटफॉर्मिन",
        "Emergency contact: सुनीता 9876500000",
      ].join("\n"),
    );
  });

  it("fits the cap when the names alone are at their longest in a three-byte script", () => {
    const longName = "अ".repeat(80); // the clean() cap for a name, three bytes a character
    const longContactName = "स".repeat(50); // the clean() cap for a contact name
    const text = buildMedicalIdQr({ full_name: longName, blood_group: "O+", allergies: [] }, [], { name: longContactName, phone: "+91 98765 43210" });
    expect(bytes(text)).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
    expect(text).toContain("Blood group: O+");
    expect(text).toContain("+91 98765 43210"); // the number a responder dials stays whole
    expect(text).toContain(`Name: ${longName}`); // the patient's name is given up last, so it survives here
    expect(text).not.toContain(longContactName); // the contact's name is what gave way
  });

  it("fits the cap at the worst case: longest names with the longest lists", () => {
    const text = buildMedicalIdQr(
      { full_name: "अ".repeat(80), blood_group: "O+", allergies: Array.from({ length: 20 }, () => "क".repeat(60)) },
      Array.from({ length: 30 }, () => ({ medicine_name: "म".repeat(80) })),
      { name: "स".repeat(50), phone: "+91 98765 43210" },
    );
    expect(bytes(text)).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
    expect(text).toContain("Blood group: O+");
    expect(text).toContain("+91 98765 43210");
  });

  it("shortens the patient's name too when nothing else is left to give up", () => {
    const longName = "अ".repeat(80);
    const text = buildMedicalIdQr(
      { full_name: longName, blood_group: "AB-", allergies: ["पेनिसिलिन"] },
      [{ medicine_name: "मेटफॉर्मिन", strength: "500 mg" }],
      { name: "स".repeat(50), phone: "+91 98765 43210" },
      200,
    );
    expect(bytes(text)).toBeLessThanOrEqual(200);
    expect(text).toContain("Blood group: AB-");
    expect(text).toContain("Emergency contact: +91 98765 43210"); // the contact's name went first, the number stayed
    expect(text).not.toContain(longName); // then the patient's own name had to give way
  });

  it("always fits a QR code that a phone camera reads", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ medicine_name: `Medicine number ${i + 1}`, strength: "500 mg tablet" }));
    const text = buildMedicalIdQr({ ...profile, allergies: Array.from({ length: 20 }, (_, i) => `Allergy ${i + 1}`) }, many, contact);
    expect(bytes(text)).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
    expect(() => buildQrMatrix(text, "M")).not.toThrow();
    expect(buildQrMatrix(text, "M").length).toBeLessThanOrEqual(77); // version 14 at level M: squares big enough for a quick scan from a phone screen
  });
});
