import Link from "next/link";
import { notFound } from "next/navigation";
import { momRules } from "@/config/mom-rules";
import { JsonForm } from "@/components/json-form";
import { toMatchable } from "@/lib/candidates/dto";
import { rankCandidates } from "@/lib/matching/score";
import { DEFAULT_WEIGHTS, WEIGHT_KEYS, coerceWeights, weightsAreValid } from "@/lib/matching/weights";
import { prisma } from "@/lib/db";
import { requestFromPayload } from "@/lib/services/employers";
import { outcomeSuggestion } from "@/lib/services/outcomes";

export const dynamic = "force-dynamic";

export default async function RequirementMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ requirementId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { requirementId } = await params;
  const query = await searchParams;
  const requirement = await prisma.employerRequirement.findUnique({
    where: { id: requirementId },
    include: {
      employer: true,
      matches: { include: { candidate: true }, orderBy: [{ eligible: "desc" }, { score: "desc" }] },
    },
  });
  if (!requirement) notFound();
  const stored = await prisma.matchWeightProfile.findUnique({ where: { requirementId } });
  const savedWeights = coerceWeights(stored?.weights ?? DEFAULT_WEIGHTS);
  const advice = await outcomeSuggestion(requirement.employerId, savedWeights);
  const previewWeights = coerceWeights({
    ...savedWeights,
    ...Object.fromEntries(
      WEIGHT_KEYS.flatMap((key) => {
        const value = query[key];
        return typeof value === "string" && value !== "" ? [[key, Number(value)]] : [];
      }),
    ),
  });
  const request = requestFromPayload(requirement.id, requirement.payload);
  const showPreview = query.preview === "1" && request && weightsAreValid(previewWeights);
  const preview = showPreview
    ? rankCandidates(
        (
          await prisma.candidate.findMany({
            where: { status: "AVAILABLE", redactedAt: null },
            take: 20,
          })
        ).map(toMatchable),
        request,
        momRules,
        { weights: previewWeights },
      ).slice(0, 5)
    : [];
  const left = typeof query.left === "string" ? requirement.matches.find((match) => match.candidateId === query.left) : undefined;
  const right = typeof query.right === "string" ? requirement.matches.find((match) => match.candidateId === query.right) : undefined;
  return (
    <div>
      <h1 className="text-4xl">{requirement.title}</h1>
      <p className="mt-2 text-sm">{requirement.employer.fullName}</p>
      <div className="mt-4">
        <JsonForm action="/api/staff/matching" submitLabel="Re-rank">
          <input type="hidden" name="requirementId" value={requirement.id} />
        </JsonForm>
      </div>
      <div className="mt-6 grid gap-4">
        {requirement.matches.map((match) => (
          <article key={match.id} className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl">
                <Link className="underline" href={`/dashboard/candidates/${match.candidateId}`}>
                  {match.candidate.fullName}
                </Link>
              </h2>
              <p className="text-sm">
                {match.eligible ? `Score ${match.score ?? "—"}` : "Not eligible"} · {match.decision} · {match.explanationSource}
              </p>
            </div>
            {!match.eligible ? (
              <p className="mt-2 text-sm">Gates: {match.ineligibleReasons.join(", ")}</p>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6">{match.explanation}</p>
                <SemanticLine breakdown={match.breakdown} />
              </>
            )}
            {match.decision === "SUGGESTED" ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <JsonForm action={`/api/staff/matching/${match.id}/decision`} submitLabel="Approve match">
                  <input type="hidden" name="decision" value="STAFF_APPROVED" />
                </JsonForm>
                <JsonForm action={`/api/staff/matching/${match.id}/decision`} submitLabel="Reject suggestion">
                  <input type="hidden" name="decision" value="STAFF_REJECTED" />
                </JsonForm>
              </div>
            ) : match.decision === "STAFF_APPROVED" ? (
              <p className="mt-3 text-sm">
                <Link className="underline" href={`/dashboard/mom/${match.id}`}>
                  Prepare the MOM pack
                </Link>
              </p>
            ) : null}
          </article>
        ))}
        {requirement.matches.length === 0 ? <p>Run a ranking to see suggestions.</p> : null}
      </div>
      <section className="card mt-6 p-4">
        <h2 className="text-2xl">Weights</h2>
        <p className="mt-1 text-sm">
          Outcome evidence: {advice.evidenceCount}. Suggested skills {advice.suggestion.skills}. These suggestions are not applied until you save them.
        </p>
        <p className="mt-1 text-sm">Preview does not save. Save, then re-rank, when the numbers should stick. They must sum to 100.</p>
        <form className="mt-3 grid gap-3" method="get">
          <input type="hidden" name="preview" value="1" />
          <div className="grid gap-2 sm:grid-cols-3">
            {WEIGHT_KEYS.map((key) => (
              <label key={key} className="label">
                {key}
                <input className="field" name={key} type="number" min={0} max={100} defaultValue={savedWeights[key]} />
              </label>
            ))}
          </div>
          <button className="btn secondary" type="submit">Preview what-if</button>
        </form>
        <JsonForm action="/api/staff/matching/weights" submitLabel="Save weights">
          <input type="hidden" name="requirementId" value={requirement.id} />
          {WEIGHT_KEYS.map((key) => (
            <input key={key} type="hidden" name={key} value={String(previewWeights[key])} />
          ))}
        </JsonForm>
        {preview.length ? (
          <ul className="mt-3 text-sm">
            {preview.map((row) => (
              <li key={row.candidateId}>
                {row.candidateId.slice(0, 6)} · {row.eligible ? (row.breakdown?.total ?? "—") : "ineligible"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="card mt-6 p-4">
        <h2 className="text-2xl">Side by side</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" method="get">
          <label className="label">
            Left
            <select className="select" name="left" defaultValue={left?.candidateId ?? ""}>
              <option value="">Choose</option>
              {requirement.matches.map((match) => (
                <option key={match.id} value={match.candidateId}>{match.candidate.fullName}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Right
            <select className="select" name="right" defaultValue={right?.candidateId ?? ""}>
              <option value="">Choose</option>
              {requirement.matches.map((match) => (
                <option key={match.id} value={match.candidateId}>{match.candidate.fullName}</option>
              ))}
            </select>
          </label>
          <button className="btn secondary" type="submit">Compare</button>
        </form>
        {left && right ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            {[left, right].map((match) => (
              <article key={match.id}>
                <h3 className="text-xl">{match.candidate.fullName}</h3>
                <p>Score {match.score ?? "—"} · {match.decision}</p>
                <p className="mt-2 leading-6">{match.explanation}</p>
                <SemanticLine breakdown={match.breakdown} />
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SemanticLine({ breakdown }: { breakdown: unknown }) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const record = breakdown as { semantic?: number; semanticDetail?: Record<string, unknown> | null };
  const detail = record.semanticDetail;
  if (!detail) return null;
  const charsUsed = Number(detail.charsUsed ?? 0);
  const original = Number(detail.originalChars ?? 0);
  const cap = Number(detail.cap ?? 0);
  return (
    <p className="mt-2 text-sm">
      Semantic contribution: {record.semantic ?? "—"} points. Source {String(detail.source ?? "none")}. {charsUsed} of {original} characters used (cap {cap}). Employer text is embedded once. Cache {detail.cached ? "hit" : "miss"}.
    </p>
  );
}
