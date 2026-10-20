import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/download/android/route";

const APK = "https://github.com/piyushgargog/vyana/releases/download/v1.0.0/vyana-1.0.0.apk";
const PAGE = "https://github.com/piyushgargog/vyana/releases/latest";

function release(assets: unknown) {
  return vi.fn(async () => new Response(JSON.stringify({ assets }), { status: 200 }));
}

afterEach(() => vi.unstubAllGlobals());

describe("GET /download/android", () => {
  it("redirects to the .apk of the latest release", async () => {
    vi.stubGlobal("fetch", release([{ name: "notes.txt", browser_download_url: "https://github.com/piyushgargog/vyana/x" }, { name: "vyana-1.0.0.apk", browser_download_url: APK }]));
    const res = await GET();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(APK);
  });

  it("falls back to the release page when no .apk is attached", async () => {
    vi.stubGlobal("fetch", release([]));
    expect((await GET()).headers.get("location")).toBe(PAGE);
  });

  it("ignores an .apk that is not hosted in our repository", async () => {
    vi.stubGlobal("fetch", release([{ name: "vyana.apk", browser_download_url: "https://evil.example/vyana.apk" }]));
    expect((await GET()).headers.get("location")).toBe(PAGE);
  });

  it("falls back to the release page when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect((await GET()).headers.get("location")).toBe(PAGE);
  });
});
