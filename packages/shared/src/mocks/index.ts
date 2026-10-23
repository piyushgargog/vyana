// Fixture responses for every API route, used when the client runs with useMocks.
export { mockAiMeta } from "./ai-meta";
export { bloodSearchMock, bloodJobRunningMock } from "./blood";
export { emergencyNearbyMock, mockHospitals } from "./emergency-nearby";
export { emergencySosMock } from "./emergency-sos";
export { doctorsVerifyMock } from "./doctors-verify";
export { agentProposalsMock, agentDecideMock, visibleProposals, resetAgentProposalsMock } from "./agent-proposals";
export { prescriptionsExtractMock } from "./prescriptions-extract";
export { reportsAnalyzeMock } from "./reports-analyze";
export { labValueCorrectMock } from "./lab-value-correct";
export { carePlanMock } from "./care-plan";
export { interactionsMock } from "./interactions";
export { triageMock, triageEmergencyMock, TRIAGE_DISCLAIMER } from "./triage";
export { shareMock, shareMemoryMock } from "./share";
export {
  connectDeviceMock,
  disconnectDeviceMock,
  deviceConnectionsMock,
  pauseDeviceMock,
  resetDevicesMock,
  resumeDeviceMock,
  setDeviceConsentMock,
  syncDeviceMock,
} from "./devices";
