export const ROLES = ["ADMIN", "STAFF", "EMPLOYER", "CANDIDATE"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard:staff",
  "candidates:read",
  "candidates:write",
  "candidates:sensitive",
  "candidates:delete",
  "employers:read",
  "employers:write",
  "enquiries:read",
  "matching:run",
  "matching:decide",
  "mom:prepare",
  "marketing:draft",
  "marketing:review",
  "audit:read",
  "users:manage",
  "employer:portal",
  "candidate:portal",
  "documents:staff",
  "reminders:manage",
  "holidays:manage",
  "rules:review",
  "rules:manage",
  "outcomes:write",
  "privacy:export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Permission, readonly Role[]> = {
  "dashboard:staff": ["ADMIN", "STAFF"],
  "candidates:read": ["ADMIN", "STAFF"],
  "candidates:write": ["ADMIN", "STAFF"],
  "candidates:sensitive": ["ADMIN", "STAFF"],
  "candidates:delete": ["ADMIN"],
  "employers:read": ["ADMIN", "STAFF"],
  "employers:write": ["ADMIN", "STAFF"],
  "enquiries:read": ["ADMIN", "STAFF"],
  "matching:run": ["ADMIN", "STAFF"],
  "matching:decide": ["ADMIN", "STAFF"],
  "mom:prepare": ["ADMIN", "STAFF"],
  "marketing:draft": ["ADMIN", "STAFF"],
  "marketing:review": ["ADMIN", "STAFF"],
  "audit:read": ["ADMIN", "STAFF"],
  "users:manage": ["ADMIN"],
  "employer:portal": ["EMPLOYER"],
  "candidate:portal": ["CANDIDATE"],
  "documents:staff": ["ADMIN", "STAFF"],
  "reminders:manage": ["ADMIN", "STAFF"],
  "holidays:manage": ["ADMIN", "STAFF"],
  "rules:review": ["ADMIN", "STAFF"],
  "rules:manage": ["ADMIN"],
  "outcomes:write": ["ADMIN", "STAFF"],
  "privacy:export": ["ADMIN", "STAFF"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[permission].includes(role);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    const error = new Error("Forbidden");
    error.name = "ForbiddenError";
    throw error;
  }
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
