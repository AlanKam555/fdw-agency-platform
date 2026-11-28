import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const verified = query.verified;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-5xl">Sign in</h1>
      {verified === "1" ? <p className="mt-3 text-sm">Email confirmed. You can sign in.</p> : null}
      {verified === "0" ? <p className="mt-3 text-sm">That confirmation link is not valid.</p> : null}
      <div className="card mt-6 p-6">
        <LoginForm />
      </div>
      <p className="mt-4 text-sm">
        New employer or helper? <Link className="underline" href="/register">Create an account</Link>
      </p>
    </div>
  );
}
