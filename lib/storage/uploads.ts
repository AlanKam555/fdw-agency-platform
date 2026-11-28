import { MAX_UPLOAD_BYTES } from "@/lib/storage/files";

export const MAX_DOCUMENTS_PER_CANDIDATE = 20;
export const MAX_DOCUMENTS_PER_KIND = 5;
export const UPLOAD_BODY_SLACK_BYTES = 256 * 1024;

export function uploadBodyRejection(contentLength: string | null): { status: 411 | 413; error: string } | null {
  if (contentLength == null || contentLength.trim() === "") {
    return { status: 411, error: "Content-Length is required." };
  }
  const size = Number(contentLength);
  if (!Number.isInteger(size) || size < 0) {
    return { status: 411, error: "Content-Length is required." };
  }
  if (size > MAX_UPLOAD_BYTES + UPLOAD_BODY_SLACK_BYTES) {
    return { status: 413, error: "Files must be 5 MB or smaller." };
  }
  return null;
}
