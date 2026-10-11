import type { AlertsCheckRes } from "../contracts";

export const alertsCheckMock: AlertsCheckRes = {
  checked_medicines: ["Metformin 500 mg", "Telma 40 mg", "Dolo 650 mg"],
  alerts: [
    {
      id: "1860d0dd-2c65-4d48-bb8e-8c6ffe0a10ed",
      medicine_name: "Metformin 500 mg",
      title: "Sample alert: a metformin batch is listed as not of standard quality",
      url: "https://cdsco.gov.in",
      snippet: "Mock data. The real check lists the batch number, manufacturer and the reason it failed.",
      created_at: "2026-10-12T08:00:00.000Z",
    },
  ],
};
