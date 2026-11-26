import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EnquiriesPage() {
  const enquiries = await prisma.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 80 });
  return (
    <div>
      <h1 className="text-4xl">Enquiries</h1>
      <div className="mt-6 grid gap-3">
        {enquiries.map((enquiry) => (
          <article key={enquiry.id} className="card p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--brass)]">{enquiry.kind}</p>
            <h2 className="text-2xl">
              {enquiry.name} · {enquiry.email}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">{enquiry.message}</p>
          </article>
        ))}
        {enquiries.length === 0 ? <p>No enquiries yet.</p> : null}
      </div>
    </div>
  );
}
