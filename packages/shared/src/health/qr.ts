// packages/shared/src/health/qr.ts
// A real, scannable QR code for the Medical ID and for invite links. Owner: Vaibhav Parmar
//
// A pattern that only looks like a QR code (finder squares and a pattern made from a hash of the text) cannot be
// read by any phone. This builds the real thing (Reed-Solomon error correction,
// masking), and the tests decode it again with an independent decoder.

import qrcode from "qrcode-generator";

/** UTF-8 bytes of a text. (The library's own conversion keeps only the low byte of each character, which ruins Hindi.) */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0) as number;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return bytes;
}

// Names and allergies can be in Hindi, so the text goes in as UTF-8 (what phone scanners expect).
qrcode.stringToBytes = utf8Bytes;

/** How much damage the code survives: L 7%, M 15%, Q 25%, H 30%. Lower levels hold more text in fewer, bigger squares. */
export type QrErrorLevel = "L" | "M" | "Q" | "H";

/**
 * The modules of a QR code for `text`, `true` for a dark one. The code is a square: `matrix.length` modules on each side
 * (21 to 177, chosen by the length of the text). Draw it with a light border of 4 modules (the quiet zone) around it, or
 * scanners may not find it. Throws if the text is too long for any QR code (about 2,900 bytes at level L).
 */
export function buildQrMatrix(text: string, level: QrErrorLevel = "L"): boolean[][] {
  const qr = qrcode(0, level);
  qr.addData(text, "Byte");
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}
