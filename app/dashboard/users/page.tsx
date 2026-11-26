import { JsonForm } from "@/components/json-form";
import { UserActions } from "@/components/user-actions";
import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireUser(["ADMIN"]);
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      disabledAt: true,
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, lastSeenAt: true },
      },
    },
  });
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl">Staff accounts</h1>
      <ul className="grid gap-4 text-sm">
        {users.map((user) => (
          <li key={user.id} className="card p-4">
            <p>
              {user.name} · {user.email} · {user.role}
              {user.disabledAt ? " · disabled" : ""}
            </p>
            <UserActions
              userId={user.id}
              disabled={Boolean(user.disabledAt)}
              sessions={user.sessions.map((session) => ({
                id: session.id,
                createdAt: session.createdAt.toISOString().slice(0, 16),
                lastSeenAt: session.lastSeenAt.toISOString().slice(0, 16),
              }))}
            />
          </li>
        ))}
      </ul>
      <section className="card max-w-lg p-5">
        <h2 className="text-2xl">Create a staff login</h2>
        <div className="mt-3">
          <JsonForm action="/api/staff/users" submitLabel="Create account">
            <label className="label">
              Name
              <input className="field" name="name" required />
            </label>
            <label className="label">
              Email
              <input className="field" name="email" type="email" required />
            </label>
            <label className="label">
              Password
              <input className="field" name="password" type="password" required minLength={10} autoComplete="new-password" />
            </label>
            <label className="label">
              Role
              <select className="select" name="role" defaultValue="STAFF">
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
          </JsonForm>
        </div>
      </section>
    </div>
  );
}
