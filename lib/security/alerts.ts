import { logEvent } from "@/lib/log";

export type AnomalyKind =
  | "access.quota_exceeded"
  | "access.bulk_reveal"
  | "access.bulk_download"
  | "auth.mfa_spike"
  | "auth.lockout_spike";

/** Sends a short JSON body. No names, emails, or document numbers. */
export async function notifyAnomaly(input: {
  kind: AnomalyKind;
  actorId?: string | null;
  count?: number;
}): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) {
    logEvent("warn", "security.anomaly", {
      kind: input.kind,
      count: input.count ?? 0,
    });
    return;
  }
  const body = JSON.stringify({
    kind: input.kind,
    actorId: input.actorId ?? null,
    count: input.count ?? 0,
    at: new Date().toISOString(),
  });
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    logEvent("warn", "security.alert_failed", {
      kind: input.kind,
      error: error instanceof Error ? error.name : "Error",
    });
  }
}
