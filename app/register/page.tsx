import type { Metadata } from "next";
import { CaptchaField } from "@/components/captcha-field";
import { Honeypot } from "@/components/honeypot";
import { JsonForm } from "@/components/json-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-5xl">Create an account</h1>
      <p className="mt-3 text-sm text-[var(--ink)]/80">
        Staff accounts are created by an administrator. This form is for employers and helpers.
        The response is the same whether or not the email is new. Confirm the email before signing in.
      </p>
      <div className="card mt-6 p-6">
        <JsonForm action="/api/auth/register" submitLabel="Create account" refresh={false} success="Check the message below, then confirm the email.">
          <Honeypot />
          <CaptchaField />
          <label className="label">
            I am
            <select className="select" name="role" defaultValue="EMPLOYER">
              <option value="EMPLOYER">An employer</option>
              <option value="CANDIDATE">A helper</option>
            </select>
          </label>
          <label className="label">
            Name
            <input className="field" name="name" required />
          </label>
          <label className="label">
            Email
            <input className="field" name="email" type="email" required />
          </label>
          <label className="label">
            Password
            <input className="field" name="password" type="password" required minLength={10} autoComplete="new-password" />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="hidden" name="pdpaConsent" value="false" />
            <input type="checkbox" name="pdpaConsent" value="true" required />
            I agree to the privacy notice for creating an account.
          </label>
        </JsonForm>
      </div>
    </div>
  );
}
