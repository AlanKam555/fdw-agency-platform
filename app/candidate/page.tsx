import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CandidateHome() {
  const { user } = await requireUser(["CANDIDATE"]);
  const candidate = await prisma.candidate.findUnique({ where: { userId: user.id } });
  if (!candidate || candidate.redactedAt) {
    return (
      <div>
        <h1 className="text-4xl">Your application</h1>
        <p className="mt-3">
          <Link className="underline" href="/apply">
            Start an application
          </Link>
          . Use the same email as this account so the file is linked.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-4xl">{candidate.fullName}</h1>
      <p className="mt-3 text-lg">{STATUS_LABELS[candidate.status]}</p>
      <p className="mt-2 max-w-xl text-sm leading-6">
        Staff move the file through screening, availability, matching, and the Ministry of Manpower steps. This page does not show passport or medical details.
      </p>
    </div>
  );
}
