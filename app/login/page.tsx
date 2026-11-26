import type { Metadata } from "next";
import Link from "next/link";
import { JsonForm } from "@/components/json-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-5xl">Sign in</h1>
      <div className="card mt-6 p-6">
        <JsonForm action="/api/auth/login" submitLabel="Sign in" refresh={false}>
          <label className="label">
            Email
            <input className="field" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="label">
            Password
            <input className="field" name="password" type="password" autoComplete="current-password" required />
          </label>
        </JsonForm>
      </div>
      <p className="mt-4 text-sm">
        New employer or helper? <Link className="underline" href="/register">Create an account</Link>
      </p>
    </div>
  );
}
