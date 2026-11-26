import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { decryptBytes, encryptBytes } from "@/lib/crypto/field-encryption";

export type DetectedFile = {
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  extension: "pdf" | "jpg" | "png";
};

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

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type BlobStore = {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  presign?(key: string, expiresInSeconds: number): Promise<string>;
};

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

function s3Store(): BlobStore {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || "ap-southeast-1";
  if (!bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 storage is selected but bucket credentials are missing");
  }
  const client = new S3Client({
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  return {
    async put(key, data) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ServerSideEncryption: "AES256",
        }),
      );
    },
    async get(key) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error("Stored object was empty");
      return Buffer.from(bytes);
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async presign(key, expiresInSeconds) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    },
  };
}

export function blobStore(): BlobStore {
  if ((process.env.STORAGE_DRIVER ?? "local") === "s3") return s3Store();
  return localStore();
}

export async function saveEncryptedObject(plaintext: Buffer): Promise<{
  storageKey: string;
  sha256: string;
}> {
  const storageKey = `docs/${new Date().getUTCFullYear()}/${randomBytes(16).toString("hex")}`;
  await blobStore().put(storageKey, encryptBytes(plaintext));
  return { storageKey, sha256: createHash("sha256").update(plaintext).digest("hex") };
}

export async function readEncryptedObject(storageKey: string): Promise<Buffer> {
  const stored = await blobStore().get(storageKey);
  return decryptBytes(stored);
}

export async function deleteObject(storageKey: string): Promise<void> {
  await blobStore().delete(storageKey);
}

export async function presignObject(storageKey: string, seconds = 120): Promise<string | null> {
  const store = blobStore();
  if (!store.presign) return null;
  return store.presign(storageKey, seconds);
}
