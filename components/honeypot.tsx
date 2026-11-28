export function Honeypot() {
  return (
    <div aria-hidden="true" className="sr-only">
      <label>
        Company website
        <input name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
