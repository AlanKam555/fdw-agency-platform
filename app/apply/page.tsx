import type { Metadata } from "next";
import { ConsentBox, LanguageChecks, SkillChecks } from "@/components/fields";
import { CaptchaField } from "@/components/captcha-field";
import { Honeypot } from "@/components/honeypot";
import { JsonForm } from "@/components/json-form";
import { momRules } from "@/config/mom-rules";
import { AGENCY } from "@/content/site";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";

export const metadata: Metadata = {
  title: "Helper application",
  description: `Apply to ${AGENCY.name} as a foreign domestic worker. Religion, race, and pregnancy are not requested.`,
};

export default async function ApplyPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-5xl">{t(locale, "apply.title")}</h1>
      <p className="mt-3 leading-7 text-[var(--ink)]/80">
        We ask for identity, work history, skills, languages, availability, and an optional passport number so staff can prepare a file. We do not ask about religion, race, or pregnancy. Sex and date of birth are collected only because current MOM eligibility rules use them as pass/fail checks ({momRules.meta.verificationStatus}). The confirmation does not say whether this email is already registered.
      </p>
      <div className="card mt-6 p-6">
        <JsonForm action="/api/applications" submitLabel="Submit application" refresh={false}>
          <Honeypot />
          <CaptchaField />
          <label className="label">Full name<input className="field" name="fullName" required /></label>
          <label className="label">Email<input className="field" name="email" type="email" required /></label>
          <label className="label">Phone<input className="field" name="phone" required minLength={8} /></label>
          <label className="label">
            Password for tracking your status
            <input className="field" name="password" type="password" minLength={10} autoComplete="new-password" />
          </label>
          <label className="label">
            Nationality
            <select className="select" name="nationality" defaultValue="Philippines">
              {momRules.fdw.approvedSourceCountries.map((country) => (
                <option key={country}>{country}</option>
              ))}
              <option>Other</option>
            </select>
          </label>
          <label className="label">Date of birth<input className="field" name="dateOfBirth" type="date" required /></label>
          <label className="label">
            Sex, for the statutory eligibility check
            <select className="select" name="sex" defaultValue="FEMALE">
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="UNSPECIFIED">Unspecified</option>
            </select>
          </label>
          <label className="label">Years of formal education<input className="field" name="educationYears" type="number" min={0} required /></label>
          <label className="label">Years of household experience<input className="field" name="experienceYears" type="number" min={0} required /></label>
          <SkillChecks />
          <LanguageChecks />
          <label className="label">Expected monthly salary (SGD)<input className="field" name="salaryExpectationSgd" type="number" min={0} required /></label>
          <label className="label">Available from<input className="field" name="availableFrom" type="date" required /></label>
          <label className="label">
            First time working in Singapore as a helper?
            <select className="select" name="firstTimeInSingapore" defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="label">Household experience<textarea className="area" name="householdExperience" /></label>
          <label className="label">Passport number (optional, encrypted)<input className="field" name="passportNumber" /></label>
          <label className="label">
            Photo consent
            <select className="select" name="photoConsent" defaultValue="false">
              <option value="false">Do not publish a portrait</option>
              <option value="true">I consent to a portrait on the gallery</option>
            </select>
          </label>
          <ConsentBox>I agree to the privacy notice for processing this application.</ConsentBox>
        </JsonForm>
      </div>
    </div>
  );
}
