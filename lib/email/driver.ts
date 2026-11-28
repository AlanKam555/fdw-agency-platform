import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { derivedKey } from "@/lib/crypto/hkdf";
import { logEvent } from "@/lib/log";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
  template: string;
};

export type EmailDriverName = "console" | "smtp" | "resend" | "ses";

export interface EmailDriver {
  readonly name: EmailDriverName;
  send(message: OutboundEmail): Promise<{ id: string }>;
}

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

export function emailDriverName(env: NodeJS.ProcessEnv = process.env): EmailDriverName {
  const raw = (env.EMAIL_DRIVER ?? "console").trim().toLowerCase();
  if (raw === "smtp" || raw === "resend" || raw === "ses" || raw === "console") return raw;
  return "console";
}

export function emailFromAddress(env: NodeJS.ProcessEnv = process.env): string {
  return (env.EMAIL_FROM ?? env.SMTP_FROM ?? env.RESEND_FROM ?? env.SES_FROM ?? "").trim();
}

function requireFrom(env: NodeJS.ProcessEnv): string {
  const from = emailFromAddress(env);
  if (!from || !from.includes("@")) {
    throw new EmailConfigError("EMAIL_FROM must be an address for this driver.");
  }
  return from;
}

export function createConsoleDriver(): EmailDriver {
  return {
    name: "console",
    async send(message) {
      const id = `console_${randomBytes(8).toString("hex")}`;
      logEvent("info", "email.console", {
        driver: "console",
        template: message.template,
        bytes: message.text.length,
        id,
      });
      return { id };
    },
  };
}

async function createSmtpDriver(env: NodeJS.ProcessEnv): Promise<EmailDriver> {
  const host = env.SMTP_HOST?.trim() ?? "";
  const port = Number(env.SMTP_PORT ?? "587");
  if (!host || !Number.isInteger(port) || port < 1) {
    throw new EmailConfigError("SMTP_HOST and SMTP_PORT are required for the smtp driver.");
  }
  const from = requireFrom(env);
  const user = env.SMTP_USER?.trim() ?? "";
  const pass = env.SMTP_PASSWORD ?? "";
  return {
    name: "smtp",
    async send(message) {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
      });
      const info = await transport.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        headers: message.headers,
      });
      logEvent("info", "email.sent", { driver: "smtp", template: message.template });
      return { id: typeof info.messageId === "string" && info.messageId ? info.messageId : "smtp" };
    },
  };
}

function createResendDriver(env: NodeJS.ProcessEnv): EmailDriver {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = (env.RESEND_FROM ?? env.EMAIL_FROM ?? "").trim();
  if (!apiKey || !from) {
    throw new EmailConfigError("RESEND_API_KEY and RESEND_FROM (or EMAIL_FROM) are required for the resend driver.");
  }
  return {
    name: "resend",
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      if (!response.ok) {
        logEvent("error", "email.failed", { driver: "resend", template: message.template, status: response.status });
        throw new Error("Resend rejected the message.");
      }
      const payload = (await response.json().catch(() => ({}))) as { id?: string };
      logEvent("info", "email.sent", { driver: "resend", template: message.template });
      return { id: payload.id || "resend" };
    },
  };
}

function createSesDriver(env: NodeJS.ProcessEnv): EmailDriver {
  const from = (env.SES_FROM ?? env.EMAIL_FROM ?? "").trim();
  const region = (env.SES_REGION ?? env.AWS_REGION ?? "ap-southeast-1").trim();
  if (!from) throw new EmailConfigError("SES_FROM or EMAIL_FROM is required for the ses driver.");
  return {
    name: "ses",
    async send(message) {
      const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
      const client = new SESClient({ region });
      const result = await client.send(
        new SendEmailCommand({
          Source: from,
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject, Charset: "UTF-8" },
            Body: { Text: { Data: message.text, Charset: "UTF-8" } },
          },
        }),
      );
      logEvent("info", "email.sent", { driver: "ses", template: message.template });
      return { id: result.MessageId || "ses" };
    },
  };
}

export async function createEmailDriver(env: NodeJS.ProcessEnv = process.env): Promise<EmailDriver> {
  const name = emailDriverName(env);
  if (name === "smtp") return createSmtpDriver(env);
  if (name === "resend") return createResendDriver(env);
  if (name === "ses") return createSesDriver(env);
  return createConsoleDriver();
}

function unsubscribeKeys(secret?: string): string[] {
  if (secret) return [secret];
  const keys = [derivedKey("unsubscribe").toString("base64url")];
  if (process.env.EMAIL_UNSUBSCRIBE_SECRET) keys.push(process.env.EMAIL_UNSUBSCRIBE_SECRET);
  if (process.env.AUTH_SECRET) keys.push(process.env.AUTH_SECRET);
  if (process.env.AUTH_SECRET_PREVIOUS) keys.push(process.env.AUTH_SECRET_PREVIOUS);
  return keys;
}

export function signUnsubscribeToken(email: string, expiresAtSeconds: number, secret?: string): string {
  const key = secret ?? derivedKey("unsubscribe").toString("base64url");
  const payload = Buffer.from(JSON.stringify({ e: email.trim().toLowerCase(), exp: expiresAtSeconds })).toString("base64url");
  const mac = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readUnsubscribeToken(token: string, nowSeconds = Math.floor(Date.now() / 1000), secret?: string): string | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const matched = unsubscribeKeys(secret).some((key) => {
    const expected = createHmac("sha256", key).update(payload).digest("base64url");
    const left = Buffer.from(mac);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  });
  if (!matched) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { e?: unknown; exp?: unknown };
    if (typeof parsed.e !== "string" || !parsed.e.includes("@")) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < nowSeconds) return null;
    return parsed.e.trim().toLowerCase();
  } catch {
    return null;
  }
}

export function unsubscribeUrl(email: string, appUrl: string): string {
  const expires = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60;
  const token = signUnsubscribeToken(email, expires);
  const origin = appUrl.replace(/\/$/, "");
  return `${origin}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "hidden";
  return `${local.slice(0, 1)}***@${domain}`;
}
