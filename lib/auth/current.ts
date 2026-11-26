import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import type { Role } from "@/lib/security/rbac";

export async function getSession() {
  const jar = await cookies();
  try {
    return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function requireUser(roles?: readonly Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles && !roles.includes(session.role)) redirect("/forbidden");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || user.disabledAt) redirect("/login");
  return { session, user };
}

export function homeForRole(role: Role): string {
  if (role === "EMPLOYER") return "/employer";
  if (role === "CANDIDATE") return "/candidate";
  return "/dashboard";
}
