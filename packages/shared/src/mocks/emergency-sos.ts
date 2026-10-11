import type { EmergencySosRes } from "../contracts";
import { mockHospitals } from "./emergency-nearby";

export const emergencySosMock: EmergencySosRes = {
  request_id: "2f6dc6e5-7936-4292-a870-ac6ef8333d6b",
  status: "requested",
  eta_minutes: 11,
  hospitals: mockHospitals.slice(0, 3),
  contacts: [
    { name: "Ravi (brother)", phone: "+91 90000 00001" },
    { name: "Meera (mother)", phone: "+91 90000 00002" },
  ],
  sms_body: "EMERGENCY: Aarav Mehta needs help. Location: https://maps.google.com/?q=28.6280,77.2950. Sent from Vyana.",
};
