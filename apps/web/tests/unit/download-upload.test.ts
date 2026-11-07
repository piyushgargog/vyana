import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/server/errors";

// What the fake storage reports, per test: the metadata size (null means the response carries
// no size), whether the object exists, and how big the downloaded body is.
const downloads: string[] = [];
let infoSize: number | null = 10;
let infoMissing = false;
let downloadBytes = 10;

vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({
    storage: {
      from: () => ({
        info: async () =>
          infoMissing
            ? { data: null, error: new Error("Object not found") }
            : { data: infoSize === null ? {} : { size: infoSize }, error: null },
        download: async (path: string) => {
          downloads.push(path);
          return { data: new Blob([new Uint8Array(downloadBytes)]), error: null };
        },
      }),
    },
  }),
}));

const { downloadUpload, MAX_UPLOAD_BYTES } = await import("@/lib/server/documents");

const statusOf = async (p: Promise<unknown>): Promise<number | null> => {
  try {
    await p;
    return null;
  } catch (err) {
    return err instanceof AppError ? err.status : -1;
  }
};

describe("downloadUpload", () => {
  beforeEach(() => {
    downloads.length = 0;
    infoSize = 10;
    infoMissing = false;
    downloadBytes = 10;
  });

  it("refuses an oversize object from its metadata without downloading it", async () => {
    infoSize = MAX_UPLOAD_BYTES + 1;
    downloadBytes = MAX_UPLOAD_BYTES + 1;
    expect(await statusOf(downloadUpload("prescriptions", "u1/a.jpg"))).toBe(400);
    expect(downloads).toEqual([]);
  });

  it("downloads an object under the cap", async () => {
    const bytes = await downloadUpload("prescriptions", "u1/a.jpg");
    expect(bytes).toHaveLength(10);
    expect(downloads).toEqual(["u1/a.jpg"]);
  });

  it("reports a missing object without downloading it", async () => {
    infoMissing = true;
    expect(await statusOf(downloadUpload("prescriptions", "u1/a.jpg"))).toBe(404);
    expect(downloads).toEqual([]);
  });

  it("still refuses an oversize body when the metadata carries no size", async () => {
    infoSize = null;
    downloadBytes = MAX_UPLOAD_BYTES + 1;
    expect(await statusOf(downloadUpload("prescriptions", "u1/a.jpg"))).toBe(400);
    expect(downloads).toEqual(["u1/a.jpg"]);
  });
});
