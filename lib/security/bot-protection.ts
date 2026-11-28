import { logEvent } from "@/lib/log";

let warned = false;

const BOT_KEYS = ["company_website", "website", "captchaToken", "cf-turnstile-response", "h-captcha-response"] as const;

export function honeypotTripped(payload: Record<string, unknown>): boolean {
  for (const key of ["company_website", "website"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) return true;
  }
  return false;
}

export function stripBotFields(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  for (const key of BOT_KEYS) delete next[key];
  return next;
}

function tokenFrom(payload: Record<string, unknown>): string {
  for (const key of ["captchaToken", "cf-turnstile-response", "h-captcha-response"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function botProtectionMode(env: NodeJS.ProcessEnv = process.env): "off" | "turnstile" | "hcaptcha" {
  const raw = (env.BOT_PROTECTION ?? "off").trim().toLowerCase();
  if (raw === "turnstile" || raw === "hcaptcha") return raw;
  return "off";
}

export async function assertHuman(
  payload: Record<string, unknown>,
  ip: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const mode = botProtectionMode(env);
  if (mode === "off") {
    if (env.NODE_ENV === "production" && !warned) {
      warned = true;
      logEvent("warn", "bot.protection_off", {});
    }
    return true;
  }
  const secret = mode === "turnstile" ? env.TURNSTILE_SECRET_KEY : env.HCAPTCHA_SECRET_KEY;
  const token = tokenFrom(payload);
  if (!secret || !token) return false;
  const endpoint =
    mode === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      : "https://hcaptcha.com/siteverify";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    logEvent("error", "bot.verify_failed", { provider: mode });
    return false;
  }
}
