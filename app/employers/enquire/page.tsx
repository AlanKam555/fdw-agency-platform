import type { Metadata } from "next";
import { ConsentBox, LanguageChecks, SkillChecks } from "@/components/fields";
import { CaptchaField } from "@/components/captcha-field";
import { Honeypot } from "@/components/honeypot";
import { JsonForm } from "@/components/json-form";
import { AGENCY } from "@/content/site";

export const metadata: Metadata = {
  title: "Employer enquiry",
  description: `Tell ${AGENCY.name} about your household, languages, skills, budget, and start date.`,
};

export default function EmployerEnquirePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-5xl">Household brief</h1>
      <p className="mt-3 leading-7">
        Signed-in employers save this as a matchable requirement. Everyone else sends an enquiry for staff to read. There is no field for preferred nationality, age, religion, or race.
      </p>
      <div className="card mt-6 p-6">
        <JsonForm action="/api/employer-enquiries" submitLabel="Send brief">
          <Honeypot />
          <CaptchaField />
          <label className="label">Name<input className="field" name="fullName" required /></label>
          <label className="label">Email<input className="field" name="email" type="email" required /></label>
          <label className="label">Phone<input className="field" name="phone" required /></label>
          <label className="label">Household size<input className="field" name="householdSize" type="number" min={1} required /></label>
          <label className="label">Children<input className="field" name="childrenCount" type="number" min={0} defaultValue={0} /></label>
          <label className="label">Children under 7<input className="field" name="childrenUnder7Count" type="number" min={0} defaultValue={0} /></label>
          <label className="label">Elderly members who need care<input className="field" name="elderlyCount" type="number" min={0} defaultValue={0} /></label>
          <label className="label">
            Pets
            <select className="select" name="hasPets" defaultValue="false">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          <label className="label">Pet details<input className="field" name="petDetails" /></label>
          <LanguageChecks name="languagesPreferred[]" />
          <SkillChecks name="skillsRequired[]" />
          <label className="label">Budget minimum (SGD)<input className="field" name="budgetMinSgd" type="number" required /></label>
          <label className="label">Budget maximum (SGD)<input className="field" name="budgetMaxSgd" type="number" required /></label>
          <label className="label">Start date<input className="field" name="startDate" type="date" required /></label>
          <label className="label">
            Housing
            <select className="select" name="housingType" defaultValue="HDB">
              <option>HDB</option>
              <option>CONDO</option>
              <option>LANDED</option>
              <option>OTHER</option>
            </select>
          </label>
          <label className="label">Neighbourhood<input className="field" name="addressArea" required /></label>
          <label className="label">Your date of birth<input className="field" name="dateOfBirth" type="date" /></label>
          <label className="label">
            First time employing a helper?
            <select className="select" name="firstTimeEmployer" defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="label">
            Employers&apos; Orientation Programme completed?
            <select className="select" name="eopCompleted" defaultValue="false">
              <option value="false">Not yet</option>
              <option value="true">Yes</option>
            </select>
          </label>
          <label className="label">EOP completion date<input className="field" name="eopCompletedOn" type="date" /></label>
          <label className="label">Notes<textarea className="area" name="notes" /></label>
          <ConsentBox>I agree to the privacy notice for this household brief.</ConsentBox>
        </JsonForm>
      </div>
    </div>
  );
}
