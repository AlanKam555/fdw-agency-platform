"use client";

import { useState } from "react";
import { readCsrf } from "@/components/json-form";

export function MfaSetup({ enabled, staff }: { enabled: boolean; staff: boolean }) {
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function post(method: string, body: Record<string, string>) {
    setError("");
    const response = await fetch("/api/auth/mfa", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, csrf: readCsrf() }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      secret?: string;
      otpauthUrl?: string;
      recoveryCodes?: string[];
    };
    if (!response.ok) {
      setError(result.error || "That request failed.");
      return null;
    }
    return result;
  }

  return (
    <section className="card max-w-lg p-5">
      <h2 className="text-2xl">Two-factor authentication</h2>
      <p className="mt-2 text-sm">
        {enabled
          ? "An authenticator app is required for this account."
          : staff
            ? "Staff and admin accounts must add an authenticator before the grace period ends. The desk stays available until then."
            : "An authenticator app is optional for employer and helper accounts."}
      </p>
      {!enabled ? (
        <button
          className="button mt-3"
          type="button"
          onClick={async () => {
            const result = await post("POST", {});
            if (!result?.secret || !result.otpauthUrl) return;
            setSecret(result.secret);
            setOtpauthUrl(result.otpauthUrl);
            setMessage("Add this secret to an authenticator app, then enter a code.");
          }}
        >
          Start setup
        </button>
      ) : null}
      {secret ? (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="break-all font-mono">{secret}</p>
          <p className="break-all">{otpauthUrl}</p>
          <form
            className="grid gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const code = String(new FormData(event.currentTarget).get("code") ?? "");
              const result = await post("PUT", { code });
              if (!result?.recoveryCodes) return;
              setCodes(result.recoveryCodes);
              setSecret("");
              setMessage("Two-factor authentication is on. Store these recovery codes. They are shown once.");
            }}
          >
            <label className="label">
              Code from the app
              <input className="field" name="code" inputMode="numeric" required pattern="\d{6}" />
            </label>
            <button className="button" type="submit">
              Confirm
            </button>
          </form>
        </div>
      ) : null}
      {enabled ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const code = String(new FormData(event.currentTarget).get("code") ?? "");
            const result = await post("PATCH", { code });
            if (!result?.recoveryCodes) return;
            setCodes(result.recoveryCodes);
            setMessage("New recovery codes replace the previous ones.");
          }}
        >
          <label className="label">
            Current code, to replace recovery codes
            <input className="field" name="code" inputMode="numeric" required pattern="\d{6}" />
          </label>
          <button className="button" type="submit">
            Replace recovery codes
          </button>
        </form>
      ) : null}
      {codes.length ? (
        <ul className="mt-3 font-mono text-sm">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
    </section>
  );
}
