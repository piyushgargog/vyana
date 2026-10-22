import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoctorVerifyRes } from "@vyana/shared";
import { OTHER_USER_ID, USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

// Number "slow-1" stands for a register that doesn't answer; everything else runs the real (mock-mode) lookup.
const lookups: string[] = [];
vi.mock("@/lib/server/tinyfish/nmc", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/tinyfish/nmc")>();
  return {
    ...real,
    lookupRegister: async (regNo: string, council: string, counter: { tinyfishCalls: number }) => {
      lookups.push(regNo);
      if (regNo === "slow-1") return { status: "pending", reason: "The register took too long to answer." };
      return real.lookupRegister(regNo, council, counter);
    },
  };
});

const { POST } = await import("@/app/api/doctors/verify/route");

const post = (body: unknown, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/doctors/verify", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

const delhi = { reg_no: "12345", state_council: "Delhi Medical Council" };
const me = () => db.rows.doctors.find((d) => d.id === USER_ID) as Record<string, unknown>;

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  resetDb();
  lookups.length = 0;
  Object.assign(db.rows.profiles[0], { role: "doctor", full_name: "Dr. Sneha Gupta" });
  db.rows.doctors = [{ id: USER_ID, reg_no: "old", state_council: "Delhi Medical Council", verification_status: "pending" }];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/doctors/verify", () => {
  it("verifies a doctor whose number, council and name are on the register", async () => {
    const res = await post({ ...delhi, year_of_registration: 2011 });
    expect(res.status).toBe(200);
    const body = DoctorVerifyRes.parse(await res.json());
    expect(body).toMatchObject({ status: "verified", match: { name: "SNEHA GUPTA", reg_no: "12345", year_of_registration: 2011 } });
    expect(me()).toMatchObject({ verification_status: "verified", reg_no: "12345", state_council: "Delhi Medical Council", year_of_registration: 2011 });
    expect(me().verified_at).toBeTruthy();
    expect((me().verification_json as { reason: string }).reason).toBe("matched");
  });

  it("never verifies a fake number", async () => {
    const body = DoctorVerifyRes.parse(await (await post({ reg_no: "99999", state_council: "Delhi Medical Council" })).json());
    expect(body).toMatchObject({ status: "failed", match: null });
    expect(me()).toMatchObject({ verification_status: "failed", reg_no: "old" });
    expect(me().verified_at).toBeUndefined();
  });

  it("fails a real number with someone else's name, showing the register's name", async () => {
    db.rows.profiles[0].full_name = "Dr. Rahul Verma";
    const body = DoctorVerifyRes.parse(await (await post(delhi)).json());
    expect(body).toMatchObject({ status: "failed", match: { name: "SNEHA GUPTA" } });
  });

  it("refuses a number already verified on another account, without asking the register", async () => {
    db.rows.doctors.push({ id: OTHER_USER_ID, reg_no: "12-345", state_council: "Medical Council of Delhi", verification_status: "verified" });
    const body = DoctorVerifyRes.parse(await (await post(delhi)).json());
    expect(body.status).toBe("failed");
    expect((me().verification_json as { reason: string }).reason).toBe("already linked to another account");
    expect(lookups).toEqual([]);
  });

  it("answers failed, not a server error, when the database guard refuses the verified save", async () => {
    // The read-then-write race the guard of migration 0016 exists for: the check
    // above saw the number free, but by the time this save lands another account
    // holds it, and the database answers with a unique violation (23505).
    db.failUpdate.add("doctors");
    const res = await post({ ...delhi, year_of_registration: 2011 });
    expect(res.status).toBe(200);
    const body = DoctorVerifyRes.parse(await res.json());
    expect(body).toMatchObject({ status: "failed", match: null });
    expect(me()).toMatchObject({ verification_status: "failed", reg_no: "old" });
    expect(me().verified_at).toBeUndefined();
    expect((me().verification_json as { reason: string }).reason).toBe("already linked to another account");
  });

  it("stays pending when the register doesn't answer, and doesn't cache that", async () => {
    const body = DoctorVerifyRes.parse(await (await post({ reg_no: "slow-1", state_council: "Delhi Medical Council" })).json());
    expect(body).toMatchObject({ status: "pending", match: null });
    expect(me().verification_status).toBe("pending");
    expect([...db.web_cache.keys()].some((k) => k.startsWith("nmc:"))).toBe(false);
  });

  it("reuses the register's answer for 30 days", async () => {
    await post(delhi);
    await post(delhi);
    expect(lookups).toEqual(["12345"]);
    expect([...db.web_cache.keys()]).toContain("nmc:delhi:12345");
  });

  it("is for doctors with a profile only", async () => {
    db.rows.doctors = [];
    expect((await post(delhi)).status).toBe(404);
    db.rows.profiles[0].role = "patient";
    expect((await post(delhi)).status).toBe(403);
    expect((await post(delhi, "")).status).toBe(401);
    expect((await post({ reg_no: "" , state_council: "x"})).status).toBe(400);
  });
});
