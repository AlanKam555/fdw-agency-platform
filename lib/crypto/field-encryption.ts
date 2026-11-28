import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { loadKeyring, totpEncryptionKey } from "@/lib/crypto/keyring";

const LEGACY = "v1";

function openString(ivB64: string, tagB64: string, ctB64: string, key: Buffer): string {
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(ctB64, "base64url");
  if (tag.length !== 16) throw new Error("Unrecognised ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function seal(plaintext: string, key: Buffer): { iv: string; tag: string; ct: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ct: ciphertext.toString("base64url"),
  };
}

function keyForId(id: string, override?: Buffer): Buffer {
  if (override) return override;
  if (id === "totp") return totpEncryptionKey();
  const ring = loadKeyring();
  const found = ring.keys.get(id);
  if (!found) throw new Error("Unknown field encryption key");
  return found;
}

export function encryptString(plaintext: string, key?: Buffer): string {
  const ring = key ? null : loadKeyring();
  const keyId = key ? "totp" : ring!.activeId;
  const material = key ?? ring!.keys.get(keyId)!;
  const sealed = seal(plaintext, material);
  return ["v2", keyId, sealed.iv, sealed.tag, sealed.ct].join(":");
}

export function decryptString(payload: string, key?: Buffer): string {
  const parts = payload.split(":");
  if (parts.length === 4 && parts[0] === LEGACY) {
    return openString(parts[1], parts[2], parts[3], keyForId("v1", key));
  }
  if (parts.length === 5 && parts[0] === "v2") {
    return openString(parts[2], parts[3], parts[4], keyForId(parts[1], key));
  }
  throw new Error("Unrecognised ciphertext");
}

export function reencryptField(payload: string): { value: string; changed: boolean } {
  const activeId = loadKeyring().activeId;
  if (payload.startsWith(`v2:${activeId}:`)) return { value: payload, changed: false };
  return { value: encryptString(decryptString(payload)), changed: true };
}

export function reencryptTotp(payload: string): { value: string; changed: boolean } {
  if (payload.startsWith("v2:totp:")) return { value: payload, changed: false };
  const key = totpEncryptionKey();
  return { value: encryptString(decryptString(payload, key), key), changed: true };
}

function openBytes(payload: Buffer, offset: number, key: Buffer): Buffer {
  if (payload.length < offset + 12 + 16) throw new Error("Unrecognised binary ciphertext");
  const iv = payload.subarray(offset, offset + 12);
  const tag = payload.subarray(offset + 12, offset + 28);
  if (tag.length !== 16) throw new Error("Unrecognised binary ciphertext");
  const ciphertext = payload.subarray(offset + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptBytes(data: Buffer, key?: Buffer): Buffer {
  const ring = key ? null : loadKeyring();
  const keyIdText = key ? "totp" : ring!.activeId;
  const material = key ?? ring!.keys.get(keyIdText)!;
  const keyId = Buffer.from(keyIdText, "utf8");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", material, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([2, keyId.length]), keyId, iv, tag, ciphertext]);
}

export function decryptBytes(payload: Buffer, key?: Buffer): Buffer {
  if (payload.length < 1 + 12 + 16) throw new Error("Unrecognised binary ciphertext");
  if (payload[0] === 1) return openBytes(payload, 1, keyForId("v1", key));
  if (payload[0] !== 2) throw new Error("Unrecognised binary ciphertext");
  const idLen = payload[1];
  if (idLen < 1 || payload.length < 2 + idLen + 12 + 16) throw new Error("Unrecognised binary ciphertext");
  const keyId = payload.subarray(2, 2 + idLen).toString("utf8");
  return openBytes(payload, 2 + idLen, keyForId(keyId, key));
}

export function lastFour(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
