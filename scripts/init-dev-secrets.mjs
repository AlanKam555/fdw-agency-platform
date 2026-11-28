import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

if (process.env.NODE_ENV === "production") {
  process.exit(0);
}

const path = "/data/dev-secrets.env";
if (existsSync(path)) process.exit(0);
mkdirSync("/data", { recursive: true });

const field = randomBytes(32).toString("base64");
const body = [
  `AUTH_SECRET=${randomBytes(32).toString("base64url")}`,
  `FIELD_ENCRYPTION_KEY=${field}`,
  `FIELD_ENCRYPTION_KEY_ID=v1`,
  `FIELD_ENCRYPTION_KEYS=v1:${field}`,
  `CRON_SECRET=${randomBytes(32).toString("base64url")}`,
  `TOTP_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
  "",
].join("\n");

writeFileSync(path, body, { mode: 0o644, flag: "wx" });
