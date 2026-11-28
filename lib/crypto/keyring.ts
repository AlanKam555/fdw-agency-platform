import { hkdfSync } from "node:crypto";
import { derivedKey } from "@/lib/crypto/hkdf";
import { isDeniedSecret } from "@/lib/security/secret-denylist";

const SALT = Buffer.from("fdw-agency-platform.hkdf.v1", "utf8");

export type FieldKeyring = {
  activeId: string;
  keys: Map<string, Buffer>;
};

function decode32(raw: string, name: string): Buffer {
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new Error(`${name} must be 32 bytes, base64-encoded`);
  }
  return key;
}

export function loadKeyring(env: NodeJS.ProcessEnv = process.env): FieldKeyring {
  const keys = new Map<string, Buffer>();
  const packed = env.FIELD_ENCRYPTION_KEYS?.trim() ?? "";
  if (packed) {
    for (const part of packed.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const splitAt = trimmed.indexOf(":");
      if (splitAt <= 0) throw new Error("FIELD_ENCRYPTION_KEYS entries must be id:base64");
      const id = trimmed.slice(0, splitAt);
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new Error("Invalid field key id");
      const material = decode32(trimmed.slice(splitAt + 1), `FIELD_ENCRYPTION_KEYS ${id}`);
      keys.set(id, material);
    }
  }
  const legacy = env.FIELD_ENCRYPTION_KEY?.trim() ?? "";
  if (legacy) {
    const material = decode32(legacy, "FIELD_ENCRYPTION_KEY");
    const existing = keys.get("v1");
    if (existing && !existing.equals(material)) {
      throw new Error("FIELD_ENCRYPTION_KEY does not match key id v1");
    }
    keys.set("v1", material);
  }
  if (keys.size === 0) throw new Error("FIELD_ENCRYPTION_KEY is not set");
  const activeId = env.FIELD_ENCRYPTION_KEY_ID?.trim() || (legacy ? "v1" : [...keys.keys()][0]);
  if (!keys.has(activeId)) throw new Error("FIELD_ENCRYPTION_KEY_ID is not in the keyring");
  return { activeId, keys };
}

export function totpEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.TOTP_ENCRYPTION_KEY?.trim() ?? "";
  if (raw) {
    if (env.NODE_ENV === "production" && isDeniedSecret(raw)) {
      throw new Error("TOTP_ENCRYPTION_KEY is a published default.");
    }
    return decode32(raw, "TOTP_ENCRYPTION_KEY");
  }
  if (env.NODE_ENV === "production") {
    throw new Error("TOTP_ENCRYPTION_KEY is required in production");
  }
  const ring = loadKeyring(env);
  return ring.keys.get(ring.activeId)!;
}

export function recoveryMacKey(keyId?: string, env: NodeJS.ProcessEnv = process.env): { id: string; key: Buffer } {
  const ring = loadKeyring(env);
  const id = keyId ?? ring.activeId;
  const material = ring.keys.get(id);
  if (!material) throw new Error("Unknown recovery key id");
  return {
    id,
    key: Buffer.from(hkdfSync("sha256", material, SALT, `recovery-code:${id}`, 32)),
  };
}

export function authPurposeKey(purpose: "session" | "doc-token" | "unsubscribe" | "client-hash" | "reminder-hash" | "email-verify" | "recovery-code") {
  return derivedKey(purpose);
}
