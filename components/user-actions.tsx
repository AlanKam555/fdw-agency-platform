"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readCsrf } from "@/components/json-form";

type SessionRow = { id: string; createdAt: string; lastSeenAt: string };

export function UserActions({
  userId,
  disabled,
  sessions,
}: {
  userId: string;
  disabled: boolean;
  sessions: SessionRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");

  async function send(body: Record<string, string>) {
    setError("");
    const response = await fetch("/api/staff/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, csrf: readCsrf() }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; next?: string };
    if (!response.ok) {
      setError(result.error || "That action failed.");
      return;
    }
    if (result.next) {
      router.push(result.next);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 grid gap-2 text-sm">
      <div className="flex flex-wrap gap-2">
        {!disabled ? (
          <button className="button" type="button" onClick={() => send({ action: "disable", userId })}>
            Disable account
          </button>
        ) : (
          <span>Disabled</span>
        )}
        <button className="button" type="button" onClick={() => send({ action: "sign_out_everywhere", userId })}>
          Sign out everywhere
        </button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length < 10) {
            setError("Use at least 10 characters, with upper and lower case and a number.");
            return;
          }
          void send({ action: "set_password", userId, password });
          setPassword("");
        }}
      >
        <label className="label">
          New password
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button" type="submit">
          Set password
        </button>
      </form>
      {sessions.length ? (
        <ul className="grid gap-1">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-2">
              <span>
                Session started {session.createdAt} · last seen {session.lastSeenAt}
              </span>
              <button className="underline" type="button" onClick={() => send({ action: "revoke_session", sessionId: session.id })}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No active sessions.</p>
      )}
      {error ? <p className="text-red-800">{error}</p> : null}
    </div>
  );
}
