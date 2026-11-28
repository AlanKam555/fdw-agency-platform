import { randomBytes } from "node:crypto";

const field = randomBytes(32).toString("base64");
const totp = randomBytes(32).toString("base64");
const lines = [
  `AUTH_SECRET=${randomBytes(32).toString("base64url")}`,
  `FIELD_ENCRYPTION_KEY=${field}`,
  `FIELD_ENCRYPTION_KEY_ID=v1`,
  `FIELD_ENCRYPTION_KEYS=v1:${field}`,
  `CRON_SECRET=${randomBytes(32).toString("base64url")}`,
  `TOTP_ENCRYPTION_KEY=${totp}`,
];
process.stdout.write(`${lines.join("\n")}\n`);
