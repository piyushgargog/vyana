// packages/shared/src/db/queries/storage.ts
// Uploads to the private buckets and short-lived links to view them. Owner: Vaibhav Parmar

import type { BucketName } from "../../constants";
import { DbError, requireUserId, type Sb } from "./helpers";

/** A file from a web `<input type="file">`, or a picked / captured file on a phone. */
export type UploadableFile = Blob | { uri: string; mimeType: string };

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

/** A random version 4 UUID (`crypto.randomUUID` is missing on some React Native engines). */
export function randomUuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Uploads a jpg, png or pdf into the signed-in user's folder of `bucket` and returns its path
 * (`{user_id}/{uuid}.{ext}`), which is what `lab_reports.file_path` and `prescriptions.file_path` store.
 */
export async function uploadFile(sb: Sb, bucket: BucketName, file: UploadableFile, ext: string): Promise<string> {
  const extension = ext.replace(".", "").toLowerCase();
  const contentType = MIME_TYPES[extension];
  if (!contentType) throw new DbError(`Unsupported file type: ${ext}`, "unsupported_file_type");

  const userId = await requireUserId(sb);
  const path = `${userId}/${randomUuid()}.${extension}`;
  const body = "uri" in file ? await (await fetch(file.uri)).arrayBuffer() : file;

  const { error } = await sb.storage.from(bucket).upload(path, body, { contentType: "uri" in file ? file.mimeType : contentType, upsert: false });
  if (error) throw new DbError(error.message);
  return path;
}

/** A link to view a private file; it stops working after 60 minutes. */
export async function getSignedUrl(sb: Sb, bucket: BucketName, path: string): Promise<string> {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data) throw new DbError(error?.message ?? "Could not create a link");
  return data.signedUrl;
}
