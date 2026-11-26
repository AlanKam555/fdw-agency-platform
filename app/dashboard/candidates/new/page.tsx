import { ConsentBox, LanguageChecks, SkillChecks } from "@/components/fields";
import { JsonForm } from "@/components/json-form";
import { momRules } from "@/config/mom-rules";

export const dynamic = "force-dynamic";

export default function IntakePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl">Staff intake</h1>
      <p className="mt-2 text-sm">Same facts as the public application. Passport and medical notes are encrypted.</p>
      <div className="card mt-4 p-6">
        <JsonForm action="/api/staff/candidates" submitLabel="Create profile">
          <label className="label">Full name<input className="field" name="fullName" required /></label>
          <label className="label">Email<input className="field" name="email" type="email" required /></label>
          <label className="label">Phone<input className="field" name="phone" required /></label>
          <label className="label">
            Nationality
            <select className="select" name="nationality" defaultValue="Philippines">
              {momRules.fdw.approvedSourceCountries.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
          </label>
          <label className="label">Date of birth<input className="field" type="date" name="dateOfBirth" required /></label>
          <label className="label">
            Sex
            <select className="select" name="sex" defaultValue="FEMALE">
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="UNSPECIFIED">Unspecified</option>
            </select>
          </label>
          <label className="label">Education years<input className="field" type="number" name="educationYears" required /></label>
          <label className="label">Experience years<input className="field" type="number" name="experienceYears" required /></label>
          <SkillChecks />
          <LanguageChecks />
          <label className="label">Salary SGD<input className="field" type="number" name="salaryExpectationSgd" required /></label>
          <label className="label">Available from<input className="field" type="date" name="availableFrom" required /></label>
          <label className="label">Passport<input className="field" name="passportNumber" /></label>
          <label className="label">Medical notes<input className="area" name="medicalNotes" /></label>
          <label className="label">
            Fit status
            <select className="select" name="medicalFitStatus" defaultValue="PENDING">
              <option value="PENDING">Pending</option>
              <option value="FIT">Fit</option>
              <option value="UNFIT">Unfit</option>
            </select>
          </label>
          <label className="label">Internal notes<textarea className="area" name="internalNotes" /></label>
          <select className="select" name="photoConsent" defaultValue="false">
            <option value="false">No photo consent</option>
            <option value="true">Photo consent recorded</option>
          </select>
          <select className="select" name="firstTimeInSingapore" defaultValue="true">
            <option value="true">First time in Singapore</option>
            <option value="false">Has worked in Singapore</option>
          </select>
          <ConsentBox>The helper has agreed to the privacy notice for this intake.</ConsentBox>
        </JsonForm>
      </div>
    </div>
  );
}
