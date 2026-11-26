const REDACTED_KEY = /password|secret|token|totp|recovery|otp|authorization|cookie|email|key/i;

/** One JSON line. Keys that look like secrets or contact data are dropped. */
export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, string | number | boolean | null> = {},
) {
  const safe: Record<string, string | number | boolean | null> = { level, event };
  for (const [key, value] of Object.entries(fields)) {
    if (REDACTED_KEY.test(key)) continue;
    safe[key] = value;
  }
  const line = JSON.stringify(safe);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
