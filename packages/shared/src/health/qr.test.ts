import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import { generateQrMatrix } from "../ui-helpers";
import { buildMedicalIdQr, MEDICAL_ID_MAX_LENGTH, parseMedicalIdQr } from "./index";
import { buildQrMatrix } from "./qr";

/** Draws the matrix as a phone screen would (dark squares on white, with a 4-module quiet zone) and reads it with an independent decoder. */
function decode(matrix: boolean[][], scale = 4): string | null {
  const quiet = 4;
  const modules = matrix.length + quiet * 2;
  const side = modules * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (!matrix[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const at = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
      }
    }
  }
  return jsQR(pixels, side, side)?.data ?? null;
}

const profile = { full_name: "Aryan Sharma", blood_group: "O+", allergies: ["Penicillin"] };
const meds = [
  { medicine_name: "Metformin", strength: "500 mg" },
  { medicine_name: "Telma (Telmisartan)", strength: "40 mg" },
];
const contact = { name: "Sunita Sharma", phone: "+91 00000 00006" };
const link = "https://vyanahealth.app/share/0123456789abcdef0123456789abcdef0123456789abcdef";

describe("buildQrMatrix", () => {
  it("makes a square QR code that a decoder reads back", () => {
    const matrix = buildQrMatrix("vyana://caregiver/join?code=123456");
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    expect((matrix.length - 17) % 4).toBe(0); // 17 + 4 x version
    expect(decode(matrix)).toBe("vyana://caregiver/join?code=123456");
  });

  it("reads back text in Hindi, as UTF-8", () => {
    expect(decode(buildQrMatrix("आर्यन शर्मा, B+, पेनिसिलिन"))).toBe("आर्यन शर्मा, B+, पेनिसिलिन");
  });

  it("reads back a one-character text and a long one", () => {
    expect(decode(buildQrMatrix("A"))).toBe("A");
    const long = "x".repeat(600);
    expect(decode(buildQrMatrix(long))).toBe(long);
  });

  it("holds the real Medical ID of the demo patient, and that parses back to the person", () => {
    const text = buildMedicalIdQr(profile, meds, contact, link);
    const read = decode(buildQrMatrix(text));
    expect(read).toBe(text);
    expect(parseMedicalIdQr(read as string)).toMatchObject({ name: "Aryan Sharma", blood_group: "O+", contact: { name: "Sunita Sharma" } });
  });

  it("holds a Medical ID of the longest size the app makes", () => {
    const text = buildMedicalIdQr(
      { full_name: "Aryan Kumar Sharma-Verma", blood_group: "AB-", allergies: Array.from({ length: 20 }, (_, i) => `Allergy number ${i}`) },
      Array.from({ length: 30 }, (_, i) => ({ medicine_name: `Medicine ${i}`, strength: "500 mg" })),
      contact,
      link,
    );
    expect(text.length).toBeLessThanOrEqual(MEDICAL_ID_MAX_LENGTH);
    expect(decode(buildQrMatrix(text), 5)).toBe(text);
  });

  it("grows with the text and is the same every time", () => {
    expect(buildQrMatrix("a".repeat(500)).length).toBeGreaterThan(buildQrMatrix("a").length);
    expect(buildQrMatrix("same text")).toEqual(buildQrMatrix("same text"));
  });

  it("can use a higher error correction level, which makes a bigger code for the same text", () => {
    const text = "https://vyanahealth.app/share/0123456789abcdef";
    expect(buildQrMatrix(text, "H").length).toBeGreaterThan(buildQrMatrix(text, "L").length);
    expect(decode(buildQrMatrix(text, "H"))).toBe(text);
  });

  it("refuses text that is too long for any QR code", () => {
    expect(() => buildQrMatrix("x".repeat(5000))).toThrow();
  });
});

describe("the old generateQrMatrix", () => {
  it("is only a picture: a decoder cannot read it (use buildQrMatrix)", () => {
    expect(decode(generateQrMatrix("vyana://caregiver/join?code=123456", 25))).toBeNull();
  });
});
