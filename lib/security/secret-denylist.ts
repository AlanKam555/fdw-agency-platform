const DENIED = new Set([
  "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  "0123456789abcdef0123456789abcdef",
  "dev-auth-secret-not-for-production-use-32",
  "dev-cron-secret-not-for-production",
  "ci-auth-secret-not-for-production-use-32",
  "test-auth-secret-not-for-production-32",
  "replace-with-a-long-random-string",
  "minio-dev-not-for-production",
  "reminder",
]);

export function isDeniedSecret(value: string | undefined | null): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  if (DENIED.has(trimmed)) return true;
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length > 0 && decoded.toString("base64") === trimmed && DENIED.has(decoded.toString("utf8"))) {
    return true;
  }
  return false;
}
