import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { resolveRequestSession, type SessionUser } from "@/lib/auth/sessions";
import type { Role } from "@/lib/security/rbac";
import { mfaSetupBlocks } from "@/lib/security/totp";

export async function getSession() {
  const jar = await cookies();
  try {
    const resolved = await resolveRequestSession(jar.get(SESSION_COOKIE)?.value);
    return resolved.kind === "active" ? resolved.payload : null;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: readonly Role[], options?: { allowMfaSetup?: boolean }) {
  const jar = await cookies();
  let user: SessionUser | null = null;
  let session = null as Awaited<ReturnType<typeof resolveRequestSession>> | null;
  try {
    session = await resolveRequestSession(jar.get(SESSION_COOKIE)?.value);
  } catch {
    session = null;
  }
  if (!session || session.kind !== "active") redirect("/login");
  user = session.user;
  if (roles && !roles.includes(user.role)) redirect("/forbidden");
  if (!options?.allowMfaSetup && mfaSetupBlocks(user)) redirect("/account/security");
  return { session: session.payload, user };
}

export function homeForRole(role: Role): string {
  if (role === "EMPLOYER") return "/employer";
  if (role === "CANDIDATE") return "/candidate";
  return "/dashboard";
}
