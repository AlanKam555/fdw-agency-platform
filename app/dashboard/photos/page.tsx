import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PhotoReviewPage() {
  const pending = await prisma.document.findMany({
    where: { kind: "PHOTO", reviewedAt: null, rejectedAt: null },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { candidate: { select: { fullName: true } } },
  });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">Photo review</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          A portrait stays off the public gallery until a staff member approves it. Rejected portraits are not shown.
        </p>
      </div>
      {pending.length === 0 ? <p className="card p-5 text-sm">No portraits are waiting.</p> : null}
      <ul className="grid gap-4">
        {pending.map((photo) => (
          <li key={photo.id} className="card grid gap-3 p-5">
            <p className="text-sm">
              {photo.candidate?.fullName ?? "Unlinked file"} · {photo.fileName}
            </p>
            <a className="underline" href={`/api/documents/${photo.id}`}>
              Open file
            </a>
            <div className="flex flex-wrap gap-3">
              <JsonForm action={`/api/staff/documents/${photo.id}/review`} submitLabel="Approve">
                <input type="hidden" name="decision" value="approve" />
              </JsonForm>
              <JsonForm action={`/api/staff/documents/${photo.id}/review`} submitLabel="Reject">
                <label className="label">
                  Reason
                  <input className="field" name="reason" required minLength={3} maxLength={500} />
                </label>
                <input type="hidden" name="decision" value="reject" />
              </JsonForm>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
