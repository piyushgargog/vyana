// Typed client for the Vyana API routes, used by the web and mobile apps.
// Every request body is checked against its ...Req schema and every response against its ...Res schema.
import type { ZodType } from "zod";

import {
  AlertsCheckReq,
  AlertsCheckRes,
  ApiErrorBody,
  DoctorVerifyReq,
  DoctorVerifyRes,
  EmergencyNearbyReq,
  EmergencyNearbyRes,
  EmergencySosReq,
  EmergencySosRes,
  LabsCompareReq,
  LabsCompareRes,
  MedicinesCompareReq,
  MedicinesCompareRes,
  NutritionPlanReq,
  NutritionPlanRes,
  PrescriptionExtractReq,
  PrescriptionExtractRes,
  ReportAnalyzeReq,
  ReportAnalyzeRes,
} from "../contracts";
import * as mocks from "../mocks";

/**
 * `code` is a server ErrorCode, or one of the client-side codes:
 * NETWORK_ERROR (server unreachable) and INVALID_RESPONSE (response did not match its schema).
 * `status` is the HTTP status, or 0 when no response arrived.
 */
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  useMocks?: boolean;
  /** Defaults to the global fetch. Pass `expo/fetch` on mobile or a stub in tests. */
  fetch?: typeof fetch;
  /** Random delay range for mock responses, so loading states are visible. Defaults to [800, 2500]. */
  mockDelayMs?: [number, number];
};

export type ApiClient = {
  medicines: { compare(body: MedicinesCompareReq): Promise<MedicinesCompareRes> };
  labs: { compare(body: LabsCompareReq): Promise<LabsCompareRes> };
  emergency: { nearby(body: EmergencyNearbyReq): Promise<EmergencyNearbyRes>; sos(body: EmergencySosReq): Promise<EmergencySosRes> };
  doctors: { verify(body: DoctorVerifyReq): Promise<DoctorVerifyRes> };
  prescriptions: { extract(body: PrescriptionExtractReq): Promise<PrescriptionExtractRes> };
  reports: { analyze(body: ReportAnalyzeReq): Promise<ReportAnalyzeRes> };
  nutrition: { plan(body: NutritionPlanReq): Promise<NutritionPlanRes> };
  alerts: { check(): Promise<AlertsCheckRes> };
  /** `${baseUrl}/api/assistant/chat`, for the AI SDK chat transport. */
  chatUrl: string;
  /** Authorization header for the chat transport (empty when signed out). */
  authHeaders(): Promise<Record<string, string>>;
};

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  502: "UPSTREAM_ERROR",
  504: "UPSTREAM_TIMEOUT",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const [minDelay, maxDelay] = opts.mockDelayMs ?? [800, 2500];

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await opts.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function post<Req, Res>(path: string, reqSchema: ZodType<Req>, resSchema: ZodType<Res>, body: Req, mock: Res): Promise<Res> {
    const req = reqSchema.safeParse(body);
    if (!req.success) {
      throw new ApiError("BAD_REQUEST", req.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), 400);
    }

    if (opts.useMocks) {
      await sleep(minDelay + Math.random() * (maxDelay - minDelay));
      // Copy so a screen that mutates the result never changes the shared fixture.
      return resSchema.parse(JSON.parse(JSON.stringify(mock)));
    }

    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(await authHeaders()) },
        body: JSON.stringify(req.data),
      });
    } catch {
      throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your internet connection.", 0);
    }

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const err = ApiErrorBody.safeParse(json);
      if (err.success) throw new ApiError(err.data.error.code, err.data.error.message, res.status);
      throw new ApiError(STATUS_CODES[res.status] ?? "INTERNAL", `Request failed with status ${res.status}.`, res.status);
    }

    const parsed = resSchema.safeParse(json);
    if (!parsed.success) throw new ApiError("INVALID_RESPONSE", "The server sent an unexpected response.", res.status);
    return parsed.data;
  }

  return {
    medicines: { compare: (body) => post("/api/medicines/compare", MedicinesCompareReq, MedicinesCompareRes, body, mocks.medicinesCompareMock) },
    labs: { compare: (body) => post("/api/labs/compare", LabsCompareReq, LabsCompareRes, body, mocks.labsCompareMock) },
    emergency: {
      nearby: (body) => post("/api/emergency/nearby", EmergencyNearbyReq, EmergencyNearbyRes, body, mocks.emergencyNearbyMock),
      sos: (body) => post("/api/emergency/sos", EmergencySosReq, EmergencySosRes, body, mocks.emergencySosMock),
    },
    doctors: { verify: (body) => post("/api/doctors/verify", DoctorVerifyReq, DoctorVerifyRes, body, mocks.doctorsVerifyMock) },
    prescriptions: { extract: (body) => post("/api/prescriptions/extract", PrescriptionExtractReq, PrescriptionExtractRes, body, mocks.prescriptionsExtractMock) },
    reports: { analyze: (body) => post("/api/reports/analyze", ReportAnalyzeReq, ReportAnalyzeRes, body, mocks.reportsAnalyzeMock) },
    nutrition: { plan: (body) => post("/api/nutrition/plan", NutritionPlanReq, NutritionPlanRes, body, mocks.nutritionPlanMock) },
    alerts: { check: () => post("/api/alerts/check", AlertsCheckReq, AlertsCheckRes, {}, mocks.alertsCheckMock) },
    chatUrl: `${baseUrl}/api/assistant/chat`,
    authHeaders,
  };
}
