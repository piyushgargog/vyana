import type { PmjayHospitalsRes } from "../contracts";

// Fictional hospitals: mocks never show a real hospital's scheme status.
export const pmjayHospitalsMock: PmjayHospitalsRes = {
  area: "Mock Nagar, East Delhi",
  hospitals: [
    { name: "Sanjeevani Multispeciality Hospital", address: "Sector 9, Mock Nagar, East Delhi 110092", specialities: ["General Medicine", "Cardiology"], source_url: null },
    { name: "Prana Community Hospital", address: "Block C, Sample Enclave, Delhi 110032", specialities: ["General Surgery", "Orthopaedics"], source_url: null },
  ],
  cached: false,
};
