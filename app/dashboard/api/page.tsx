import { API_OPERATIONS } from "@/lib/openapi/document";

export const dynamic = "force-dynamic";

export default function ApiReferencePage() {
  return (
    <div>
      <h1 className="text-4xl">API</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6">
        This list matches the route handlers. The JSON copy is at <code>/api/staff/openapi</code> and is refused to anyone who is not signed in as staff.
      </p>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Method</th>
            <th>Path</th>
            <th>Who</th>
            <th>What</th>
          </tr>
        </thead>
        <tbody>
          {API_OPERATIONS.map((operation) => (
            <tr key={`${operation.method} ${operation.path}`}>
              <td>{operation.method.toUpperCase()}</td>
              <td>
                <code>{operation.path}</code>
              </td>
              <td>{operation.auth}</td>
              <td>{operation.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
