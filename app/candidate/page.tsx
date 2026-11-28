import Link from "next/link";
import { UploadForm } from "@/components/json-form";
import { requireUser } from "@/lib/auth/current";
import { DOCUMENT_KIND_LABELS, INTERVIEW_STATUS_LABELS, documentReviewLabel, helperNextStep } from "@/lib/candidates/portal";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CandidateHome() {
  const { user } = await requireUser(["CANDIDATE"]);
  const locale = await getLocale();
  const candidate = await prisma.candidate.findUnique({
    where: { userId: user.id },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, approvedById: true, rejectedAt: true },
      },
      interviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          preferredWindow: true,
          employer: { select: { addressArea: true } },
        },
      },
    },
  });
  if (!candidate || candidate.redactedAt) {
    return (
      <div>
        <h1 className="text-4xl">{t(locale, "candidate.missingTitle")}</h1>
        <p className="mt-3">
          <Link className="underline" href="/apply">
            {t(locale, "nav.apply")}
          </Link>
          . {t(locale, "candidate.missingBody")}
        </p>
      </div>
    );
  }
  const uploadKinds = ["PASSPORT", "EDUCATIONAL_CERTIFICATE", ...(candidate.photoConsent ? ["PHOTO" as const] : [])];
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-4xl">{candidate.fullName}</h1>
        <p className="mt-3 text-lg">{STATUS_LABELS[candidate.status]}</p>
        <p className="mt-2 max-w-xl text-sm leading-6">{t(locale, "candidate.privateNote")}</p>
      </div>
      <section className="card p-5">
        <h2 className="text-2xl">{t(locale, "candidate.nextTitle")}</h2>
        <p className="mt-2 text-sm leading-6">{helperNextStep(candidate.status)}</p>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">{t(locale, "candidate.interviews")}</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {candidate.interviews.map((interview) => (
            <li key={interview.id}>
              {INTERVIEW_STATUS_LABELS[interview.status]} · {interview.preferredWindow} · {t(locale, "candidate.area")}{" "}
              {interview.employer.addressArea}
            </li>
          ))}
          {candidate.interviews.length === 0 ? <li>{t(locale, "candidate.noInterviews")}</li> : null}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="text-2xl">{t(locale, "candidate.documents")}</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {candidate.documents.map((document) => (
            <li key={document.id}>
              {DOCUMENT_KIND_LABELS[document.kind]} · {documentReviewLabel(document)}
            </li>
          ))}
          {candidate.documents.length === 0 ? <li>{t(locale, "candidate.noDocuments")}</li> : null}
        </ul>
        <h3 className="mt-4 text-xl">{t(locale, "candidate.upload")}</h3>
        <UploadForm candidateId={candidate.id} kinds={uploadKinds} />
      </section>
      <section className="card p-5 text-sm leading-6">
        <h2 className="text-2xl">{t(locale, "candidate.consent")}</h2>
        <p className="mt-2">{candidate.pdpaConsentAt ? t(locale, "candidate.privacyOn") : t(locale, "candidate.privacyOff")}</p>
        <p>{candidate.photoConsent ? t(locale, "candidate.photoOn") : t(locale, "candidate.photoOff")}</p>
        <Link className="mt-2 inline-block underline" href="/privacy">
          {t(locale, "footer.privacy")}
        </Link>
      </section>
    </div>
  );
}
