import { JsonForm } from "@/components/json-form";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-5xl">Stop reminders</h1>
      <p className="mt-3 text-sm leading-6">
        Confirm to stop reminder email for this address. Opening this page does not unsubscribe you.
      </p>
      {token ? (
        <div className="card mt-6 p-6">
          <JsonForm action="/api/unsubscribe" submitLabel="Unsubscribe" refresh={false}>
            <input type="hidden" name="token" value={token} />
          </JsonForm>
        </div>
      ) : (
        <p className="mt-6 text-sm">This page needs the link from a reminder email.</p>
      )}
    </div>
  );
}
