"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const BOOLEAN_FIELDS = new Set([
  "pdpaConsent",
  "photoConsent",
  "hasPets",
  "firstTimeInSingapore",
  "firstTimeEmployer",
  "eopCompleted",
  "notRelated",
  "fdwOutsideSingapore",
  "securityBondArranged",
  "medicalInsuranceArranged",
  "personalAccidentArranged",
  "addressIsNricRegistered",
  "includeScreened",
  "measlesVaccinatedUnder7",
  "isUndischargedBankrupt",
]);

function readCsrf() {
  const match = document.cookie.match(/(?:^|; )hl_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function JsonForm({
  action,
  children,
  submitLabel = "Submit",
  success = "Saved.",
  refresh = true,
}: {
  action: string;
  children: ReactNode;
  submitLabel?: string;
  success?: string;
  refresh?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [rawKey, rawValue] of form.entries()) {
      if (typeof rawValue !== "string") continue;
      const arrayField = rawKey.endsWith("[]");
      const key = arrayField ? rawKey.slice(0, -2) : rawKey;
      if (arrayField) {
        const current = body[key];
        body[key] = Array.isArray(current) ? [...current, rawValue] : [rawValue];
        continue;
      }
      if (BOOLEAN_FIELDS.has(key)) {
        body[key] = rawValue === "true";
        continue;
      }
      if (rawValue === "") continue;
      body[key] = rawValue;
    }
    const response = await fetch(action, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": readCsrf(),
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      next?: string;
      value?: string;
      note?: string;
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    if (data.next) {
      window.location.href = data.next;
      return;
    }
    if (typeof data.value === "string") {
      setMessage(data.value ? data.value : "Nothing is stored for that field.");
      return;
    }
    if (refresh) {
      window.location.reload();
      return;
    }
    setError(null);
    setMessage(data.note ?? success);
  }

  return (
    <form method="post" action={action} onSubmit={onSubmit} className="grid gap-4">
      {children}
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
      <button className="btn" disabled={pending} type="submit">
        {pending ? "Working…" : submitLabel}
      </button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn secondary mt-4 w-full"
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": readCsrf(),
          },
          body: "{}",
        });
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function UploadForm({ candidateId }: { candidateId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    form.set("csrf", readCsrf());
    form.set("candidateId", candidateId);
    const response = await fetch("/api/documents", { method: "POST", body: form });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="label">
        Document type
        <select className="select" name="kind" defaultValue="PASSPORT">
          <option value="PASSPORT">Passport</option>
          <option value="EDUCATIONAL_CERTIFICATE">Education certificate</option>
          <option value="MEDICAL">Medical</option>
          <option value="PHOTO">Consented photo</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="label">
        File
        <input className="field" type="file" name="file" accept="application/pdf,image/jpeg,image/png" required />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button className="btn secondary" disabled={pending} type="submit">
        {pending ? "Uploading…" : "Upload private file"}
      </button>
    </form>
  );
}
