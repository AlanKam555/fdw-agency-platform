import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
