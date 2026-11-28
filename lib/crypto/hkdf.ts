import { hkdfSync } from "node:crypto";

const SALT = Buffer.from("fdw-agency-platform.hkdf.v1", "utf8");

export const KEY_PURPOSES = [
  "session",
  "doc-token",
  "unsubscribe",
  "recovery-code",
  "client-hash",
  "reminder-hash",
  "email-verify",
] as const;

export type KeyPurpose = (typeof KEY_PURPOSES)[number];

export function derivedKey(purpose: KeyPurpose, secret = process.env.AUTH_SECRET ?? ""): Buffer {
  if (secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to a string of at least 16 characters");
  }
  return Buffer.from(hkdfSync("sha256", secret, SALT, purpose, 32));
}
