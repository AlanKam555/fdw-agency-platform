import { NextRequest } from "next/server";
import { openApiDocument } from "@/lib/openapi/document";
import { guardRequest, json } from "@/lib/http/api";

export async function GET(req: NextRequest) {
  const guard = await guardRequest(req, {}, { permission: "dashboard:staff", csrf: false });
  if (!guard.ok) return guard.response;
  return json(openApiDocument(), 200, { "cache-control": "private, no-store" });
}
