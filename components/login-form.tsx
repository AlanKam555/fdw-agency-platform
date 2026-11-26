"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCsrf } from "@/components/json-form";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      csrf: readCsrf(),
    };
    const code = String(data.get("code") ?? "").trim();
    const recoveryCode = String(data.get("recoveryCode") ?? "").trim();
    if (code) body.code = code;
    if (recoveryCode) body.recoveryCode = recoveryCode;
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      next?: string;
      mfa?: string;
    };
    setPending(false);
    if (!response.ok) {
      if (result.mfa === "totp") setNeedsCode(true);
      setError(result.error || "Sign-in failed.");
      return;
    }
    router.push(result.next || "/dashboard");
    router.refresh();
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <label className="label">
        Email
        <input className="field" name="email" type="email" autoComplete="username" required />
      </label>
      <label className="label">
        Password
        <input className="field" name="password" type="password" autoComplete="current-password" required />
      </label>
      {needsCode ? (
        <>
          <label className="label">
            Authentication code
            <input className="field" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" />
          </label>
          <label className="label">
            Recovery code
            <input className="field" name="recoveryCode" autoComplete="off" />
          </label>
          <p className="text-sm">Enter the six-digit code from your authenticator, or one unused recovery code.</p>
        </>
      ) : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
