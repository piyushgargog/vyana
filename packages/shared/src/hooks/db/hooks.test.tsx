// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, configure, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeResult } from "../../db/queries/fakeSupabase";
import { AppProviders } from "../../providers/AppProviders";
import { QUERY_ROOTS } from "../api/query-roots";
import { useBookAppointment, useCarePlans, useConditions, useCreateShareLink, useDeleteMeal, useDoctorQueue, useEmergencyRequest, useMeals, useMyAppointments, useMyProfile } from "./index";

// jsdom starts slowly on a busy machine (CI, a laptop running the whole suite): be patient, not flaky
configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 20000 });

const ok = (data: unknown): FakeResult => ({ data, error: null });

function setup(fake: ReturnType<typeof fakeSupabase>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProviders supabase={fake.sb as never} apiBaseUrl="https://vyana.app/" useMocks queryClient={queryClient}>
      {children}
    </AppProviders>
  );
  return { queryClient, wrapper };
}

afterEach(() => cleanup());

describe("DB hooks", () => {
  it("do not query while signed out and run once the user signs in", async () => {
    const fake = fakeSupabase({ userId: null, responses: { profiles: [ok({ id: "user-1", full_name: "Aryan" })] } });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useMyProfile(), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fake.calls.filter((c) => c.name === "from")).toHaveLength(0);

    act(() => fake.setUser("user-1"));
    await waitFor(() => expect(result.current.data?.full_name).toBe("Aryan"));
  });

  it("drop the cached data when another user signs in", async () => {
    const fake = fakeSupabase({
      userId: "user-1",
      responses: { profiles: [ok({ id: "user-1", full_name: "First" }), ok({ id: "user-2", full_name: "Second" })] },
    });
    const { wrapper, queryClient } = setup(fake);
    const { result } = renderHook(() => useMyProfile(), { wrapper });
    await waitFor(() => expect(result.current.data?.full_name).toBe("First"));

    act(() => fake.setUser("user-2"));
    await waitFor(() => expect(result.current.data?.full_name).toBe("Second"));
    // nothing of the first user is left in the cache
    expect(queryClient.getQueryCache().getAll().some((q) => JSON.stringify(q.state.data).includes("First"))).toBe(false);
  });

  it("use the API base URL of the provider for share links", async () => {
    const fake = fakeSupabase({ responses: { share_links: [ok({ token: "tok", expires_at: "2026-10-13T00:00:00.000Z" })] } });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useCreateShareLink(), { wrapper });
    await waitFor(() => expect(result.current.isIdle).toBe(true));

    let link: { url: string } | undefined;
    await act(async () => {
      link = await result.current.mutateAsync({ kind: "medical_id", ttl_hours: 24 });
    });
    expect(link?.url).toBe("https://vyana.app/share/tok");
  });

  it("refresh appointments and the timeline after a booking", async () => {
    const fake = fakeSupabase({ responses: { "rpc:book_appointment": [ok({ id: "a-1", token_no: 3 })] } });
    const { wrapper, queryClient } = setup(fake);
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useBookAppointment(), { wrapper });
    await waitFor(() => expect(result.current.isIdle).toBe(true));

    await act(async () => {
      await result.current.mutateAsync({ hospital_id: "h", department_id: "d", appointment_date: "2026-10-13" });
    });
    const roots = spy.mock.calls.map((c) => (c[0]?.queryKey as string[])[0]);
    expect(roots).toContain(QUERY_ROOTS.appointments);
    expect(roots).toContain("timeline");
  });
});

describe("conditions list (#225)", () => {
  it("waits for the client session before reading, so the list is not cached empty", async () => {
    const fake = fakeSupabase({
      userId: "user-1",
      responses: { conditions: [ok([{ id: "c-1", name: "Type 2 Diabetes" }])] },
    });
    // The provider learns the session at once (first call). Later session loads are
    // held back, as they are while the browser client is still settling right after
    // sign-in. With the guard, the read needs two more loads (the guard's, then
    // requireUserId's inside listConditions) and the table is not touched before
    // they land; without the guard only requireUserId's load stands before the read.
    let sessionLoads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const auth = fake.sb.auth as unknown as { getSession: () => Promise<unknown> };
    const immediate = { data: { session: { user: { id: "user-1" } } }, error: null };
    auth.getSession = async () => {
      sessionLoads += 1;
      if (sessionLoads > 1) await gate;
      return immediate;
    };
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useConditions(), { wrapper });

    await waitFor(() => expect(sessionLoads).toBeGreaterThan(1));
    await act(async () => {});
    expect(fake.calls.filter((c) => c.name === "from" && c.args[0] === "conditions")).toHaveLength(0);

    release();
    await waitFor(() => expect(result.current.data?.[0]?.name).toBe("Type 2 Diabetes"));
    expect(sessionLoads).toBeGreaterThanOrEqual(3);
  });
});

describe("meal log", () => {
  it("show the day's meals again after a meal is added or removed", async () => {
    const fake = fakeSupabase({
      responses: { meal_logs: [ok([{ id: "m1", description: "Poha" }]), ok(null), ok([])] },
    });
    const { wrapper } = setup(fake);
    const meals = renderHook(() => useMeals("2026-10-13"), { wrapper });
    await waitFor(() => expect(meals.result.current.data).toEqual([{ id: "m1", description: "Poha" }]));

    const remove = renderHook(() => useDeleteMeal(), { wrapper });
    await act(async () => {
      await remove.result.current.mutateAsync("m1");
    });
    await waitFor(() => expect(meals.result.current.data).toEqual([]));
  });
});

describe("live updates", () => {
  it("share one channel per table and user across hooks, and close it when the last hook unmounts", async () => {
    const fake = fakeSupabase({ responses: { appointments: [ok([]), ok([])] } });
    const { wrapper } = setup(fake);
    const mine = renderHook(() => useMyAppointments(), { wrapper });
    const queue = renderHook(() => useDoctorQueue("2026-10-13"), { wrapper });

    await waitFor(() => expect(fake.channels.filter((c) => c.subscribed)).toHaveLength(1));
    const names = fake.channels.map((c) => c.name);
    expect(new Set(names).size).toBe(1);
    expect(names.every((n) => n.startsWith("appointments:doctor:user-1"))).toBe(true);
    expect(fake.channels[0].handlers[0].filter).toMatchObject({ event: "*", schema: "public", table: "appointments" });

    mine.unmount();
    expect(fake.channels[0].removed).toBe(false);
    queue.unmount();
    await waitFor(() => expect(fake.channels[0].removed).toBe(true));
  });

  it("keep delivering changes when a hook mounts right after the last one unmounts (React StrictMode)", async () => {
    const fake = fakeSupabase({
      responses: { care_plans: [ok([{ id: "cp-1", status: "draft" }]), ok([{ id: "cp-1", status: "approved" }])] },
    });
    const { wrapper: Inner } = setup(fake);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <React.StrictMode>
        <Inner>{children}</Inner>
      </React.StrictMode>
    );
    const { result } = renderHook(() => useCarePlans(), { wrapper });
    await waitFor(() => expect(result.current.data?.[0].status).toBe("draft"));

    const live = () => fake.channels.filter((c) => c.name.startsWith("care-plans:user-1") && c.subscribed && !c.removed);
    await waitFor(() => expect(live()).toHaveLength(1));
    act(() => fake.emitChange(live()[0].name));
    await waitFor(() => expect(result.current.data?.[0].status).toBe("approved"));
  });

  it("refetch the care plans when a doctor approves one", async () => {
    const fake = fakeSupabase({
      responses: { care_plans: [ok([{ id: "cp-1", status: "draft" }]), ok([{ id: "cp-1", status: "approved" }])] },
    });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useCarePlans(), { wrapper });
    await waitFor(() => expect(result.current.data?.[0].status).toBe("draft"));

    const channel = fake.channels.find((c) => c.name.startsWith("care-plans:user-1"));
    expect(channel).toBeDefined();
    act(() => fake.emitChange(channel!.name));
    await waitFor(() => expect(result.current.data?.[0].status).toBe("approved"));
  });

  it("push a changed SOS request straight into the cache", async () => {
    const fake = fakeSupabase({ responses: { emergency_requests: [ok({ id: "e-1", status: "requested" })] } });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useEmergencyRequest("e-1"), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("requested"));

    const channel = fake.channels.find((c) => c.name === "emergency:e-1");
    expect(channel).toBeDefined();
    act(() => fake.emitChange("emergency:e-1", { id: "e-1", status: "dispatched" }));
    await waitFor(() => expect(result.current.data?.status).toBe("dispatched"));
  });
});
