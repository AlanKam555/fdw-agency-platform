"use client";

import { useState, type FormEvent } from "react";
import { readCsrf } from "@/components/json-form";

export function DownloadDataForm({
  action,
  extra,
}: {
  action: string;
  extra?: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = { ...(extra ?? {}) };
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") body[key] = value;
    }
    const response = await fetch(action, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrf() },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "The export could not be prepared.");
      return;
    }
    const blob = await response.blob();
    const format = body.format || "json";
    const name = format === "pdf" ? "personal-data.pdf" : format === "html" ? "personal-data.html" : "personal-data.json";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="label">
        Password
        <input className="field" name="password" type="password" autoComplete="current-password" required minLength={8} />
      </label>
      <label className="label">
        Format
        <select className="field" name="format" defaultValue="json">
          <option value="json">JSON</option>
          <option value="html">HTML</option>
          <option value="pdf">PDF</option>
        </select>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <button className="btn" disabled={pending} type="submit">
        {pending ? "Preparing…" : "Download my data"}
      </button>
    </form>
  );
}
