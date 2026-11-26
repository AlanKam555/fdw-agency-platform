import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http/api";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("db") !== "1") return json({ ok: true });
  await prisma.$queryRaw`SELECT 1`;
  return json({ ok: true, database: true });
}
