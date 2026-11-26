import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, role: true } } },
  });
  return (
    <div>
      <h1 className="text-4xl">Audit log</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)]">
            <th className="py-2">When</th>
            <th>Who</th>
            <th>Action</th>
            <th>Record</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-[var(--line)]">
              <td className="py-2">{log.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td>{log.actor ? `${log.actor.name} (${log.actor.role})` : "system"}</td>
              <td>{log.action}</td>
              <td>
                {log.entityType} {log.entityId.slice(0, 8)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
