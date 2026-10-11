import type { EmergencyNearbyRes, Hospital } from "../contracts";

// Fictional hospitals and placeholder numbers: mocks must never show a real number someone might call.
const maps = (name: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

export const mockHospitals: Hospital[] = [
  { name: "Sanjeevani Multispeciality Hospital", address: "Sector 9, Mock Nagar, East Delhi 110092", phone: "+91 11 4000 0101", has_emergency: true, has_icu: true, maps_url: maps("Sanjeevani Multispeciality Hospital East Delhi"), source_url: null },
  { name: "Arogya Heart & Trauma Centre", address: "Main Road, Demo Vihar, East Delhi 110091", phone: "+91 11 4000 0102", has_emergency: true, has_icu: true, maps_url: maps("Arogya Heart Trauma Centre East Delhi"), source_url: null },
  { name: "Prana Community Hospital", address: "Block C, Sample Enclave, Delhi 110032", phone: "+91 11 4000 0103", has_emergency: true, has_icu: false, maps_url: maps("Prana Community Hospital Delhi"), source_url: null },
  { name: "Dhanvantari Clinic & Nursing Home", address: "Market Lane, Test Colony, Delhi 110095", phone: null, has_emergency: null, has_icu: null, maps_url: maps("Dhanvantari Clinic Delhi"), source_url: null },
];

export const emergencyNearbyMock: EmergencyNearbyRes = {
  area: "Mock Nagar, East Delhi",
  hospitals: mockHospitals,
  cached: false,
};
