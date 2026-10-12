import { describe, expect, it } from "vitest";
import { redact, restore } from "@/lib/server/safety/redact";

const values = (map: Record<string, string>) => Object.values(map);

describe("redact: identifiers are removed", () => {
  it("removes a lab report header but keeps age, sex, tests and values", () => {
    const report = [
      "Patient Name: Aryan Sharma        Age/Sex: 34 Y / M",
      "UHID: DL2024001234   Lab No: 55123",
      "Mobile: +91 98765 43210   Email: aryan.sharma@example.com",
      "Address: 42, Preet Vihar, East Delhi - 110092",
      "DOB: 15/05/1990    Report date: 10/10/2026",
      "HbA1c 7.4 % (4.0 - 5.6)   Fasting Blood Sugar 142 mg/dL (70 - 100)",
      "Platelet count 250000 /cumm",
    ].join("\n");
    const { text, map } = redact(report);
    for (const secret of ["Aryan", "Sharma", "DL2024001234", "55123", "98765", "aryan.sharma@example.com", "Preet Vihar", "110092", "15/05/1990"]) {
      expect(text).not.toContain(secret);
    }
    for (const kept of ["Age/Sex: 34 Y / M", "Report date: 10/10/2026", "HbA1c 7.4 % (4.0 - 5.6)", "142 mg/dL (70 - 100)", "Platelet count 250000 /cumm"]) {
      expect(text).toContain(kept);
    }
    expect(values(map)).toEqual(expect.arrayContaining(["Aryan Sharma", "+91 98765 43210", "aryan.sharma@example.com", "15/05/1990"]));
  });

  it("removes a prescription header but keeps every medicine line", () => {
    const rx = [
      "Dr. Rajesh Mehta, MBBS, MD   Reg No: DMC-67890",
      "Mehta Clinic, Ph: 011-2658 8500",
      "Name: Sunita Devi   Age: 52   W/O Ramesh Kumar",
      "Rx",
      "1. Tab. Metformin 500 mg 1-0-1 after food x 30 days",
      "2. Tab. Telma 40 mg 0-0-1",
      "3. Pan 40mg OD before breakfast",
    ].join("\n");
    const { text } = redact(rx);
    for (const secret of ["Rajesh", "Mehta", "DMC-67890", "2658", "Sunita", "Ramesh"]) expect(text).not.toContain(secret);
    for (const kept of ["Tab. Metformin 500 mg 1-0-1 after food x 30 days", "Tab. Telma 40 mg 0-0-1", "Pan 40mg OD before breakfast", "Age: 52", "MBBS, MD"]) {
      expect(text).toContain(kept);
    }
  });

  it("removes Indian ID numbers", () => {
    const { text, map } = redact("Aadhaar 2345 6789 0123, ABHA 91-1234-5678-9012, ABHA address aryan.s@abdm, PAN no ABCDE1234F");
    expect(text).not.toMatch(/2345|1234-5678|aryan\.s@abdm|ABCDE1234F/);
    expect(Object.keys(map).every((k) => k.startsWith("[ID_"))).toBe(true);
  });

  it("removes phone numbers in common formats", () => {
    for (const phone of ["9876543210", "+91-9876543210", "+91 98765 43210", "098765 43210", "011-26588500", "0124 4141414"]) {
      const { text } = redact(`call me on ${phone} please`);
      expect(text, phone).toBe("call me on [PHONE_1] please");
    }
  });

  it("removes names from chat in English, Hinglish and Hindi", () => {
    expect(redact("Hi, my name is Aryan Sharma and I have a headache").text).toBe("Hi, my name is [NAME_1] and I have a headache");
    expect(redact("mera naam Aryan hai, sir dard ho raha hai").text).toBe("mera naam [NAME_1] hai, sir dard ho raha hai");
    expect(redact("मेरा नाम आर्यन है").text).not.toContain("आर्यन");
    expect(redact("श्रीमती सुनीता देवी की रिपोर्ट").text).not.toContain("सुनीता");
  });

  it("removes the person's known names wherever they appear", () => {
    const { text, map } = redact("aryan ko kal se bukhar hai, SHARMA ji ne bola", { knownNames: ["Aryan Sharma"] });
    expect(text).toMatch(/^\[NAME_\d\] ko kal se bukhar hai, \[NAME_\d\] ji ne bola$/);
    expect(values(map).sort()).toEqual(["SHARMA", "aryan"]);
  });

  it("gives the same value the same placeholder", () => {
    const { text, map } = redact("Mr. Amit Verma called. Later Mr. Amit Verma called again.");
    expect(text).toBe("Mr. [NAME_1] called. Later Mr. [NAME_1] called again.");
    expect(map).toEqual({ "[NAME_1]": "Amit Verma" });
  });
});

describe("redact: nothing else changes", () => {
  it("leaves medicines, doses, lab values and ordinary dates alone", () => {
    const texts = [
      "Dolo 650 mg twice daily for 3 days",
      "Can I take Pan 40 with Telma 40?",
      "Hemoglobin 13.5 g/dL, WBC 7800 /cumm, Platelets 150000 - 450000",
      "BP was 140/90 on 10/10/2026 and 130/85 on 12/10/2026",
      "Medicine name: Glycomet 500 SR",
      "Test name: Lipid profile",
      "How do I address the side effects of metformin?",
      "abha card kaise banaye?",
      "My sugar is 180 after food",
    ];
    for (const t of texts) expect(redact(t), t).toEqual({ text: t, map: {} });
  });

  it("never spreads a non-name label value across the text", () => {
    const { text } = redact("Name: Not provided\nThe sample was not provided on time");
    expect(text).toBe("Name: [NAME_1]\nThe sample was not provided on time");
  });

  it("also removes a found surname elsewhere, e.g. in a clinic name", () => {
    expect(redact("Dr. Rajesh Mehta\nMehta Clinic, Preet Vihar").text).toBe("Dr. [NAME_1]\n[NAME_2] Clinic, Preet Vihar");
  });

  it("doesn't redact a placeholder twice", () => {
    const once = redact("Name: Aryan Sharma, Mobile 9876543210");
    expect(redact(once.text).text).toBe(once.text);
  });
});

describe("restore", () => {
  it("puts the original values back", () => {
    const original = "Patient Name: Neha Gupta\nMobile: 9811122233";
    const { text, map } = redact(original);
    expect(restore(text, map)).toBe(original);
  });

  it("leaves text without placeholders unchanged", () => {
    expect(restore("no placeholders here", { "[NAME_1]": "X" })).toBe("no placeholders here");
  });
});
