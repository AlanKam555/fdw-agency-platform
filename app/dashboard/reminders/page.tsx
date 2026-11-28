import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import { REMINDER_TYPES, remindersWillSend } from "@/lib/reminders/catalog";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const [optIns, recent] = await Promise.all([
    prisma.reminderTypeOptIn.findMany(),
    prisma.reminderDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const enabled = new Set(optIns.filter((row) => row.enabled).map((row) => row.code));
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Reminders</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          Nothing is emailed until a type is opted in here, or a single reminder is approved on its MOM pack.
          {remindersWillSend()
            ? " Sending is on for this environment."
            : " This environment is in dry run: the job records who would be mailed and does not send."}
        </p>
      </div>
      <section className="card p-5">
        <h2 className="text-2xl">Type opt-in</h2>
        <ul className="mt-4 grid gap-3">
          {REMINDER_TYPES.map((type) => {
            const on = enabled.has(type.code);
            return (
              <li key={type.code}>
                <JsonForm action="/api/staff/reminder-types" submitLabel={on ? "Turn off" : "Opt in"}>
                  <input type="hidden" name="code" value={type.code} />
                  <input type="hidden" name="enabled" value={on ? "false" : "true"} />
                  <span data-reminder-type={type.code}>
                    {type.label} · {on ? "opted in" : "off"}
                  </span>
                </JsonForm>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card p-5 text-sm">
        <h2 className="text-2xl">Recent delivery records</h2>
        <p className="mt-2">Addresses are not stored. Each row is a hash, a type, and a status.</p>
        <ul className="mt-3 grid gap-1">
          {recent.map((row) => (
            <li key={row.id}>
              {row.kind} · {row.dueOn} · {row.status} · {row.driver}
            </li>
          ))}
          {recent.length === 0 ? <li>No delivery records yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
