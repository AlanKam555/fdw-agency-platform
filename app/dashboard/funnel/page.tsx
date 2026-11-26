import { funnelSnapshot } from "@/lib/services/growth";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const funnel = await funnelSnapshot();
  const steps = [
    ["Enquiries", funnel.enquiries],
    ["Requirements", funnel.requirements],
    ["Approved matches", funnel.approved],
    ["Deployments", funnel.deployed],
  ] as const;
  return (
    <div>
      <h1 className="text-4xl">Funnel</h1>
      <p className="mt-2 max-w-2xl text-sm">Counts from this database. Source is the UTM value stored on the enquiry, when the visitor arrived with one.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {steps.map(([label, count]) => (
          <article key={label} className="card p-4">
            <p className="text-sm">{label}</p>
            <p className="display text-4xl">{count}</p>
          </article>
        ))}
      </div>
      <ul className="mt-6 grid gap-2 text-sm">
        {funnel.sources.map((row) => (
          <li key={row.source}>
            {row.source}: {row.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
