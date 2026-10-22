// Typed client for the Vyana API routes, used by the web and mobile apps.
// Every request body is checked against its ...Req schema and every response against its ...Res schema.
import type { ZodType } from "zod";

import {
  AiUsageTodayRes,
  ApiErrorBody,
  BloodSearchReq,
  BloodSearchRes,
  DoctorVerifyReq,
  DoctorVerifyRes,
  EmergencyNearbyReq,
  EmergencyNearbyRes,
  EmergencySosReq,
  EmergencySosRes,
  GenerateCarePlanReq,
  GenerateCarePlanRes,
  InteractionsReq,
  InteractionsRes,
  JoinWaitlistReq,
  JoinWaitlistRes,
  MeExportRes,
  OkRes,
  PlansRes,
  PrescriptionExtractReq,
  PrescriptionExtractRes,
  ReportAnalyzeReq,
  LabValueCorrectReq,
  LabValueCorrectRes,
  ReportAnalyzeRes,
  ShareRes,
  TriageReq,
  TriageRes,
} from "../contracts";
import * as mocks from "../mocks";

export type RateLimitEvent = {
  message: string;
  retryAfterSeconds?: number;
};

/**
 * `code` is a server ErrorCode, or one of the client-side codes:
 * NETWORK_ERROR (server unreachable) and INVALID_RESPONSE (response did not match its schema).
 * `status` is the HTTP status, or 0 when no response arrived.
 * `retryAfterSeconds` is present on 429 RATE_LIMITED responses when the server sent a Retry-After header.
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryAfterSeconds?: number,
  ) {
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
  /** Callback fired when a 429 RATE_LIMITED response is received. */
  onRateLimit?: (event: RateLimitEvent) => void;
};

export type ApiClient = {
  /** RapidBlood: `search` starts a blood bank search job; poll `job(job_id)` until `status === "done"`. */
  blood: { search(body: BloodSearchReq): Promise<BloodSearchRes>; job(jobId: string): Promise<BloodSearchRes> };
  emergency: { nearby(body: EmergencyNearbyReq): Promise<EmergencyNearbyRes>; sos(body: EmergencySosReq): Promise<EmergencySosRes> };
  doctors: { verify(body: DoctorVerifyReq): Promise<DoctorVerifyRes> };
  /** Plans, the Family waitlist and today's AI usage (#305, provisional contract). */
  plans: { current(): Promise<PlansRes> };
  waitlist: { join(body: JoinWaitlistReq): Promise<JoinWaitlistRes> };
  aiUsage: { today(): Promise<AiUsageTodayRes> };
  prescriptions: { extract(body: PrescriptionExtractReq): Promise<PrescriptionExtractRes> };
  reports: { analyze(body: ReportAnalyzeReq): Promise<ReportAnalyzeRes>; correctValue(body: LabValueCorrectReq): Promise<LabValueCorrectRes> };
  carePlans: { generate(body: GenerateCarePlanReq): Promise<GenerateCarePlanRes> };
  interactions: { check(body: InteractionsReq): Promise<InteractionsRes> };
  triage: { assess(body: TriageReq): Promise<TriageRes> };
  /** Public, token-based read of a shared medical ID / timeline. Sends no auth header. */
  share: { get(token: string): Promise<ShareRes> };
  me: { exportData(): Promise<MeExportRes>; deleteAccount(): Promise<OkRes> };
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
  429: "RATE_LIMITED",
  502: "UPSTREAM_ERROR",
  504: "UPSTREAM_TIMEOUT",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RequestSpec<Res> = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  resSchema: ZodType<Res>;
  /** A mock value, or a thunk producing one — a thunk is only called in mock mode, so a
   *  mock with side effects (a store write) never runs against the real API. */
  mock: Res | (() => Res);
  body?: { schema: ZodType<unknown>; value: unknown };
  auth?: boolean;
};

export function createApiClient(opts: ApiClientOptions): ApiClient {
  let baseUrl = opts.baseUrl;
  while (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
  const doFetch = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const [minDelay, maxDelay] = opts.mockDelayMs ?? [800, 2500];

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await opts.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function request<Res>({ method, path, resSchema, mock, body, auth = true }: RequestSpec<Res>): Promise<Res> {
    let payload: unknown;
    if (body) {
      const req = body.schema.safeParse(body.value);
      if (!req.success) {
        throw new ApiError("BAD_REQUEST", req.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), 400);
      }
      payload = req.data;
    }

    if (opts.useMocks) {
      await sleep(minDelay + Math.random() * (maxDelay - minDelay));
      // Copy so a screen that mutates the result never changes the shared fixture.
      const mockValue = typeof mock === "function" ? (mock as () => Res)() : mock;
      return resSchema.parse(JSON.parse(JSON.stringify(mockValue)));
    }

    const headers: Record<string, string> = { Accept: "application/json", ...(auth ? await authHeaders() : {}) };
    if (body) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(payload) : undefined });
    } catch {
      throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your internet connection.", 0);
    }

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      let retryAfterSeconds: number | undefined;
      const retryHeader = res.headers?.get?.("retry-after") ?? res.headers?.get?.("Retry-After");
      if (retryHeader) {
        const asSec = parseInt(retryHeader, 10);
        if (!isNaN(asSec) && asSec >= 0) {
          retryAfterSeconds = asSec;
        } else {
          const asDate = Date.parse(retryHeader);
          if (!isNaN(asDate)) {
            retryAfterSeconds = Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
          }
        }
      }

      const err = ApiErrorBody.safeParse(json);
      let code = err.success ? err.data.error.code : (STATUS_CODES[res.status] ?? "INTERNAL");
      let message = err.success ? err.data.error.message : `Request failed with status ${res.status}.`;

      if (res.status === 429 || code === "RATE_LIMITED") {
        code = "RATE_LIMITED";
        if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
          const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
          const wait = `Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
          message = err.success ? `${message.replace(/\.?$/, ".")} ${wait}` : `You've reached the limit for now. ${wait}`;
        } else if (!err.success) {
          message = "You've reached the limit for now. Try again later.";
        }
        const event: RateLimitEvent = { message, retryAfterSeconds };
        opts.onRateLimit?.(event);
      }

      throw new ApiError(code, message, res.status, retryAfterSeconds);
    }

    const parsed = resSchema.safeParse(json);
    if (!parsed.success) throw new ApiError("INVALID_RESPONSE", "The server sent an unexpected response.", res.status);
    return parsed.data;
  }

  const post = <Req, Res>(path: string, reqSchema: ZodType<Req>, resSchema: ZodType<Res>, value: Req, mock: Res | (() => Res)) =>
    request({ method: "POST", path, resSchema, mock, body: { schema: reqSchema, value } });

  return {
    blood: {
      search: (body) => post("/api/blood/search", BloodSearchReq, BloodSearchRes, body, mocks.bloodJobRunningMock),
      job: (jobId) => {
        if (!jobId.trim()) return Promise.reject(new ApiError("BAD_REQUEST", "job_id: missing", 400));
        return request({ method: "GET", path: `/api/blood/search/${encodeURIComponent(jobId)}`, resSchema: BloodSearchRes, mock: mocks.bloodSearchMock });
      },
    },
    emergency: {
      nearby: (body) => post("/api/emergency/nearby", EmergencyNearbyReq, EmergencyNearbyRes, body, mocks.emergencyNearbyMock),
      sos: (body) => post("/api/emergency/sos", EmergencySosReq, EmergencySosRes, body, mocks.emergencySosMock),
    },
    doctors: { verify: (body) => post("/api/doctors/verify", DoctorVerifyReq, DoctorVerifyRes, body, mocks.doctorsVerifyMock) },
    plans: {
      current: () =>
        request({ method: "GET", path: "/api/plans/me", resSchema: PlansRes, mock: mocks.plansMock }),
    },
    waitlist: {
      // Mock mode uses the store so "already on the list" works within the session.
      join: async (body) => {
        const req = JoinWaitlistReq.safeParse(body);
        if (!req.success) {
          throw new ApiError("BAD_REQUEST", req.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "), 400);
        }
        if (opts.useMocks) {
          await sleep(minDelay + Math.random() * (maxDelay - minDelay));
          return JoinWaitlistRes.parse(mocks.joinWaitlistMock(req.data));
        }
        return post("/api/waitlist", JoinWaitlistReq, JoinWaitlistRes, req.data, () => mocks.joinWaitlistMock(req.data));
      },
    },
    aiUsage: {
      today: () =>
        request({ method: "GET", path: "/api/ai/usage-today", resSchema: AiUsageTodayRes, mock: mocks.aiUsageTodayMock }),
    },
    prescriptions: { extract: (body) => post("/api/prescriptions/extract", PrescriptionExtractReq, PrescriptionExtractRes, body, mocks.prescriptionsExtractMock) },
    reports: {
      analyze: (body) => post("/api/reports/analyze", ReportAnalyzeReq, ReportAnalyzeRes, body, mocks.reportsAnalyzeMock),
      correctValue: (body) => post("/api/reports/values/correct", LabValueCorrectReq, LabValueCorrectRes, body, mocks.labValueCorrectMock),
    },
    carePlans: { generate: (body) => post("/api/care-plan", GenerateCarePlanReq, GenerateCarePlanRes, body, mocks.carePlanMock) },
    interactions: { check: (body) => post("/api/medicines/interactions", InteractionsReq, InteractionsRes, body, mocks.interactionsMock) },
    triage: { assess: (body) => post("/api/triage", TriageReq, TriageRes, body, mocks.triageMock) },
    share: {
      get: (token) => {
        if (!token.trim()) return Promise.reject(new ApiError("BAD_REQUEST", "token: missing", 400));
        return request({ method: "GET", path: `/api/share/${encodeURIComponent(token)}`, resSchema: ShareRes, mock: mocks.shareMock, auth: false });
      },
    },
    me: {
      exportData: () => request({ method: "GET", path: "/api/me/export", resSchema: MeExportRes, mock: { profiles: [] } }),
      deleteAccount: () => request({ method: "DELETE", path: "/api/me", resSchema: OkRes, mock: { ok: true as const } }),
    },
    chatUrl: `${baseUrl}/api/assistant/chat`,
    authHeaders,
  };
}
