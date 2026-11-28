import { loadKeyring, totpEncryptionKey } from "@/lib/crypto/keyring";
import { isDeniedSecret } from "@/lib/security/secret-denylist";

export { isDeniedSecret } from "@/lib/security/secret-denylist";

function requireLongSecret(value: string | undefined, name: string): void {
  const trimmed = value?.trim() ?? "";
  if (Buffer.byteLength(trimmed) < 32) {
    throw new Error(`${name} must be at least 32 bytes in production.`);
  }
  if (isDeniedSecret(trimmed)) {
    throw new Error(`${name} is a published default and cannot be used in production.`);
  }
}

export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  requireLongSecret(env.AUTH_SECRET, "AUTH_SECRET");
  requireLongSecret(env.CRON_SECRET, "CRON_SECRET");
  const ring = loadKeyring(env);
  for (const [id, material] of ring.keys) {
    if (isDeniedSecret(material.toString("utf8")) || isDeniedSecret(material.toString("base64"))) {
      throw new Error(`Field encryption key ${id} is a published default.`);
    }
  }
  const totp = totpEncryptionKey(env);
  for (const material of ring.keys.values()) {
    if (material.equals(totp)) {
      throw new Error("TOTP_ENCRYPTION_KEY must be distinct from the field encryption keys.");
    }
  }
  if (env.APP_URL?.startsWith("https://") && isDeniedSecret(env.S3_SECRET_ACCESS_KEY)) {
    throw new Error("S3_SECRET_ACCESS_KEY is a published default.");
  }
}
