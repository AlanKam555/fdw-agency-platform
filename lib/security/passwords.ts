import bcrypt from "bcryptjs";

export function bcryptCost(): number {
  const raw = Number(process.env.BCRYPT_COST ?? "12");
  if (!Number.isFinite(raw) || raw < 4 || raw > 15) return 12;
  return Math.floor(raw);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, bcryptCost());
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
