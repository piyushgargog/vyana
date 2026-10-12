import type { PrescriptionExtractRes } from "../contracts";
import { mockAiMeta } from "./ai-meta";

// The third item shows the review state: its duration wasn't printed, so it needs the patient's check.
export const prescriptionsExtractMock: PrescriptionExtractRes = {
  prescription_id: "a19e05ec-fc5f-42a3-b98f-336bc77813b2",
  doctor_name: "Dr. Ananya Kapoor",
  diagnosis: "Type 2 diabetes mellitus; hypertension",
  issued_on: "2026-10-12",
  items: [
    { id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4", medicine_name: "Metformin", strength: "500 mg", form: "tablet", dose: "1 tablet", frequency: "BD", times: ["09:00", "21:00"], with_food: "after", duration_days: 30, start_date: "2026-10-12", end_date: "2026-11-10", instructions: null, needs_review: false, evidence: "Tab Metformin 500mg 1-0-1 after food x 30 days" },
    { id: "43508d0e-a51a-40a4-8df0-202c0b07c06f", medicine_name: "Telma", strength: "40 mg", form: "tablet", dose: "1 tablet", frequency: "OD", times: ["09:00"], with_food: "any", duration_days: 30, start_date: "2026-10-12", end_date: "2026-11-10", instructions: "Take at the same time every day", needs_review: false, evidence: "Tab Telma 40 1-0-0 x 30 days" },
    { id: "6e1da4a4-a5cb-4b56-861b-a32ebe348ed5", medicine_name: "Dolo", strength: "650 mg", form: "tablet", dose: "1 tablet", frequency: "SOS", times: [], with_food: "after", duration_days: null, start_date: "2026-10-12", end_date: null, instructions: "Only if fever above 100°F", needs_review: true, evidence: "Tab Dolo 650 SOS for fever" },
  ],
  warnings: ["Duration for Dolo 650 is not written on the prescription. Please check it."],
  ai: mockAiMeta,
};
