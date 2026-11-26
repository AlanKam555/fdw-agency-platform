import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type ServerSideEncryption,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { decryptBytes, encryptBytes } from "@/lib/crypto/field-encryption";
import { logEvent } from "@/lib/log";

export type DetectedFile = {
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  extension: "pdf" | "jpg" | "png";
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const PRESIGN_SECONDS = 300;

const ALLOWED_TYPES = new Set<DetectedFile["contentType"]>([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export function detectFileType(data: Buffer): DetectedFile | null {
  if (data.subarray(0, 4).toString("utf8") === "%PDF") {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  return null;
}

export function validateUpload(
  bytes: Buffer,
  declaredType?: string | null,
): { ok: true; file: DetectedFile } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "Files must be 5 MB or smaller." };
  const declared = declaredType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared && !ALLOWED_TYPES.has(declared as DetectedFile["contentType"])) {
    return { ok: false, error: "Upload a PDF, JPEG, or PNG." };
  }
  const detected = detectFileType(bytes);
  if (!detected) return { ok: false, error: "Upload a PDF, JPEG, or PNG." };
  if (declared && declared !== detected.contentType) {
    return { ok: false, error: "The file contents do not match the declared type." };
  }
  return { ok: true, file: detected };
}

export function newObjectKey(): string {
  return `obj/${randomBytes(32).toString("hex")}`;
}

export function attachmentFileName(name: string): string {
  const cleaned = name.replace(/[\r\n"\\]/g, "").replace(/[^\w.\- ]+/g, "").trim().slice(0, 120);
  return cleaned || "document";
}

type PutMeta = { contentType?: string };
type PresignMeta = { contentType?: string; fileName?: string };

export type BlobStore = {
  put(key: string, data: Buffer, meta?: PutMeta): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  presign?(key: string, expiresInSeconds: number, meta?: PresignMeta): Promise<string>;
  /** Local disk keeps an application-layer ciphertext. S3 uses server-side encryption instead. */
  wrapsWithFieldEncryption: boolean;
};

export type StorageEnv = Record<string, string | undefined>;

export function storageRefusal(env: StorageEnv = process.env): string | null {
  const driver = (env.STORAGE_DRIVER ?? "local").trim().toLowerCase();
  if (driver === "s3") {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      return "S3 storage is selected but S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required.";
    }
    const sse = (env.S3_SSE ?? "AES256").trim();
    if (sse === "aws:kms" && !env.S3_KMS_KEY_ID) {
      return "S3_KMS_KEY_ID is required when S3_SSE=aws:kms.";
    }
    if (sse !== "AES256" && sse !== "SSE-S3" && sse !== "aws:kms" && sse !== "SSE-KMS") {
      return "S3_SSE must be AES256 or aws:kms.";
    }
    return null;
  }
  if (env.NODE_ENV === "production" && env.ALLOW_LOCAL_STORAGE !== "true") {
    return "Refusing local document storage in production. Set STORAGE_DRIVER=s3 for a private bucket, or ALLOW_LOCAL_STORAGE=true to keep the disk driver explicitly.";
  }
  return null;
}

export function assertStorageReady(env: StorageEnv = process.env): void {
  const reason = storageRefusal(env);
  if (!reason) return;
  logEvent("error", "storage.refused", { driver: (env.STORAGE_DRIVER ?? "local").trim().toLowerCase() });
  throw new Error(reason);
}

export type S3ObjectBody = { Body?: { transformToByteArray?: () => Promise<Uint8Array> } };

export type S3Sender = {
  send(command: unknown): Promise<S3ObjectBody>;
};

export type S3StoreOptions = {
  bucket: string;
  sse: ServerSideEncryption;
  kmsKeyId?: string;
  send: S3Sender["send"];
  presign: (command: unknown, expiresIn: number) => Promise<string>;
};

export function sseMode(env: StorageEnv = process.env): {
  ServerSideEncryption: ServerSideEncryption;
  SSEKMSKeyId?: string;
} {
  const sse = (env.S3_SSE ?? "AES256").trim();
  if (sse === "aws:kms" || sse === "SSE-KMS") {
    if (!env.S3_KMS_KEY_ID) throw new Error("S3_KMS_KEY_ID is required when S3_SSE=aws:kms.");
    return { ServerSideEncryption: "aws:kms", SSEKMSKeyId: env.S3_KMS_KEY_ID };
  }
  return { ServerSideEncryption: "AES256" };
}

export function createS3ObjectStore(options: S3StoreOptions): BlobStore {
  return {
    wrapsWithFieldEncryption: false,
    async put(key, data, meta) {
      await options.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: key,
          Body: data,
          ContentType: meta?.contentType,
          CacheControl: "private, no-store",
          ServerSideEncryption: options.sse,
          SSEKMSKeyId: options.kmsKeyId,
        }),
      );
    },
    async get(key) {
      const result = await options.send(
        new GetObjectCommand({ Bucket: options.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray?.();
      if (!bytes) throw new Error("Stored object was empty");
      return Buffer.from(bytes);
    },
    async delete(key) {
      await options.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }));
    },
    async presign(key, expiresInSeconds, meta) {
      const expires = Math.min(Math.max(1, expiresInSeconds), PRESIGN_SECONDS);
      const command = new GetObjectCommand({
        Bucket: options.bucket,
        Key: key,
        ResponseContentType: meta?.contentType,
        ResponseContentDisposition: meta?.fileName
          ? `attachment; filename="${attachmentFileName(meta.fileName)}"`
          : undefined,
      });
      return options.presign(command, expires);
    },
  };
}

function storageSegment(): string {
  const raw = process.env.STORAGE_LOCAL_DIR || "private";
  const segment = raw.split("/").filter(Boolean).pop() || "private";
  if (!/^[a-z0-9_-]+$/i.test(segment)) {
    throw new Error("STORAGE_LOCAL_DIR must be a simple directory name under storage/");
  }
  return segment;
}

function localFile(key: string): string {
  if (key.includes("..") || path.isAbsolute(key)) {
    throw new Error("Invalid storage key");
  }
  return path.join(process.cwd(), "storage", storageSegment(), key);
}

function localStore(): BlobStore {
  return {
    wrapsWithFieldEncryption: true,
    async put(key, data) {
      const file = localFile(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async get(key) {
      return readFile(localFile(key));
    },
    async delete(key) {
      await rm(localFile(key), { force: true });
    },
  };
}

function liveS3Store(): BlobStore {
  assertStorageReady();
  const bucket = process.env.S3_BUCKET as string;
  const region = process.env.S3_REGION || "ap-southeast-1";
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE
    ? process.env.S3_FORCE_PATH_STYLE === "true"
    : Boolean(endpoint);
  const sse = sseMode();
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return createS3ObjectStore({
    bucket,
    sse: sse.ServerSideEncryption,
    kmsKeyId: sse.SSEKMSKeyId,
    send: (command) => client.send(command as never) as Promise<S3ObjectBody>,
    presign: (command, expiresIn) =>
      getSignedUrl(client, command as never, { expiresIn }),
  });
}

let testStore: BlobStore | null = null;

export function setBlobStoreForTests(store: BlobStore | null): void {
  testStore = store;
}

export function blobStore(): BlobStore {
  if (testStore) return testStore;
  if ((process.env.STORAGE_DRIVER ?? "local").trim().toLowerCase() === "s3") return liveS3Store();
  assertStorageReady();
  return localStore();
}

export async function saveStoredObject(
  plaintext: Buffer,
  meta?: PutMeta,
): Promise<{ storageKey: string; sha256: string }> {
  const storageKey = newObjectKey();
  const store = blobStore();
  const body = store.wrapsWithFieldEncryption ? encryptBytes(plaintext) : plaintext;
  await store.put(storageKey, body, meta);
  return { storageKey, sha256: createHash("sha256").update(plaintext).digest("hex") };
}

export async function readStoredObject(storageKey: string): Promise<Buffer> {
  const store = blobStore();
  const stored = await store.get(storageKey);
  return store.wrapsWithFieldEncryption ? decryptBytes(stored) : stored;
}

export async function deleteObject(storageKey: string): Promise<void> {
  await blobStore().delete(storageKey);
}

export async function presignObject(
  storageKey: string,
  seconds = PRESIGN_SECONDS,
  meta?: PresignMeta,
): Promise<string | null> {
  const store = blobStore();
  if (!store.presign) return null;
  return store.presign(storageKey, seconds, meta);
}

export function safeDownloadUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
