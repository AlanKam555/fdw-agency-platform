import { LANGUAGES, SKILL_LABELS } from "@/lib/labels";

export function SkillChecks({ name = "skills[]" }: { name?: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm">Skills</legend>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(SKILL_LABELS).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="checkbox" name={name} value={value} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LanguageChecks({ name = "languages[]" }: { name?: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm">Languages</legend>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {LANGUAGES.map((language) => (
          <label key={language} className="flex items-center gap-2">
            <input type="checkbox" name={name} value={language} />
            {language}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ConsentBox({ children }: { children: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="hidden" name="pdpaConsent" value="false" />
      <input type="checkbox" name="pdpaConsent" value="true" required />
      {children}
    </label>
  );
}
