export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type ApiOperation = {
  method: HttpMethod;
  path: string;
  summary: string;
  auth: string;
};

/** Hand-written catalogue. tests/unit/openapi.test.ts fails when a route file drifts from this list. */
export const API_OPERATIONS: ApiOperation[] = [
  { method: "post", path: "/api/applications", summary: "Submit a helper application", auth: "public" },
  { method: "post", path: "/api/auth/login", summary: "Sign in", auth: "public" },
  { method: "post", path: "/api/auth/logout", summary: "Sign out the current session", auth: "session" },
  { method: "post", path: "/api/auth/mfa", summary: "Start authenticator enrolment", auth: "session" },
  { method: "put", path: "/api/auth/mfa", summary: "Confirm authenticator enrolment", auth: "session" },
  { method: "patch", path: "/api/auth/mfa", summary: "Verify an authenticator code", auth: "session" },
  { method: "delete", path: "/api/auth/mfa", summary: "Turn off an employer authenticator", auth: "session" },
  { method: "post", path: "/api/auth/password", summary: "Change password and revoke sessions", auth: "session" },
  { method: "post", path: "/api/auth/register", summary: "Register an employer or helper", auth: "public" },
  { method: "get", path: "/api/auth/verify-email", summary: "Confirm an email address from a link", auth: "public" },
  { method: "post", path: "/api/auth/verify-email", summary: "Request another confirmation email", auth: "public" },
  { method: "post", path: "/api/contact", summary: "Send a contact enquiry", auth: "public" },
  { method: "get", path: "/api/cron/reminders", summary: "List or send due reminders", auth: "cron" },
  { method: "get", path: "/api/cron/retention", summary: "Run retention and purge stale sessions", auth: "cron" },
  { method: "post", path: "/api/documents/{id}", summary: "Request a document download with a reason", auth: "documents:staff" },
  { method: "get", path: "/api/documents/{id}", summary: "Download a document by staff session or signed link", auth: "staff or signed link" },
  { method: "post", path: "/api/documents", summary: "Upload a document", auth: "session" },
  { method: "post", path: "/api/employer/interviews", summary: "Request an interview", auth: "employer" },
  { method: "post", path: "/api/employer/shortlist", summary: "Shortlist a helper", auth: "employer" },
  { method: "post", path: "/api/employer-enquiries", summary: "Send an employer brief", auth: "public" },
  { method: "get", path: "/api/health", summary: "Process health", auth: "public" },
  { method: "post", path: "/api/privacy/consent", summary: "Grant or withdraw a consent purpose", auth: "employer or helper" },
  { method: "post", path: "/api/privacy/export", summary: "Export the signed-in person's data", auth: "employer or helper" },
  { method: "get", path: "/api/portraits/{id}", summary: "Public portrait after staff approval", auth: "public" },
  { method: "post", path: "/api/staff/campaigns", summary: "Save a campaign", auth: "marketing:draft" },
  { method: "post", path: "/api/staff/candidates", summary: "Create a helper profile", auth: "candidates:write" },
  { method: "post", path: "/api/staff/candidates/{id}/assign", summary: "Assign a helper file to a staff member", auth: "users:manage" },
  { method: "post", path: "/api/staff/candidates/{id}/redact", summary: "Redact a helper profile", auth: "candidates:delete" },
  { method: "post", path: "/api/staff/candidates/{id}/sensitive", summary: "Reveal a sensitive field", auth: "candidates:sensitive" },
  { method: "post", path: "/api/staff/candidates/{id}/status", summary: "Change helper status", auth: "candidates:write" },
  { method: "get", path: "/api/staff/contracts", summary: "List service contracts", auth: "billing:manage" },
  { method: "post", path: "/api/staff/contracts", summary: "Create a service contract", auth: "billing:manage" },
  { method: "get", path: "/api/staff/contracts/{id}", summary: "Read one service contract", auth: "billing:manage" },
  { method: "post", path: "/api/staff/contracts/{id}", summary: "Update a service contract", auth: "billing:manage" },
  { method: "post", path: "/api/staff/contracts/{id}/invoices", summary: "Add an invoice", auth: "billing:manage" },
  { method: "post", path: "/api/staff/documents/{id}/review", summary: "Review an uploaded document", auth: "documents:staff" },
  { method: "post", path: "/api/staff/employers/{id}/redact", summary: "Redact a household profile", auth: "candidates:delete" },
  { method: "post", path: "/api/staff/employers/{id}/sensitive", summary: "Reveal an employer NRIC", auth: "employers:read" },
  { method: "post", path: "/api/staff/holidays", summary: "Add or suppress a holiday", auth: "holidays:manage" },
  { method: "post", path: "/api/staff/interviews/{id}", summary: "Update an interview", auth: "employers:write" },
  { method: "post", path: "/api/staff/interviews/{id}/feedback", summary: "Record interview feedback", auth: "matching:decide" },
  { method: "post", path: "/api/staff/invoices/{id}", summary: "Change invoice status", auth: "billing:manage" },
  { method: "post", path: "/api/staff/invoices/{id}/payments", summary: "Record a payment", auth: "billing:manage" },
  { method: "post", path: "/api/staff/marketing", summary: "Draft marketing copy", auth: "marketing:draft" },
  { method: "post", path: "/api/staff/marketing/{id}", summary: "Review a marketing draft", auth: "marketing:review" },
  { method: "post", path: "/api/staff/matching", summary: "Run matching", auth: "matching:run" },
  { method: "post", path: "/api/staff/matching/{id}/decision", summary: "Decide a match", auth: "matching:decide" },
  { method: "post", path: "/api/staff/matching/weights", summary: "Save match weights", auth: "matching:run" },
  { method: "post", path: "/api/staff/mom/{matchId}", summary: "Prepare a MOM pack", auth: "mom:prepare" },
  { method: "get", path: "/api/staff/mom/{matchId}/pdf", summary: "Download a MOM pack PDF", auth: "mom:prepare" },
  { method: "post", path: "/api/staff/mom-rules", summary: "Verify or override a MOM rule", auth: "rules:manage" },
  { method: "get", path: "/api/staff/openapi", summary: "This document", auth: "dashboard:staff" },
  { method: "post", path: "/api/staff/outcomes", summary: "Record a placement outcome", auth: "outcomes:write" },
  { method: "post", path: "/api/staff/privacy/export", summary: "Export a person's data for a recorded reason", auth: "privacy:export" },
  { method: "post", path: "/api/staff/reminder-types", summary: "Update a reminder type", auth: "reminders:manage" },
  { method: "post", path: "/api/staff/reminders/{id}", summary: "Update a reminder", auth: "mom:prepare" },
  { method: "post", path: "/api/staff/reminders/{id}/approve", summary: "Approve one reminder", auth: "reminders:manage" },
  { method: "post", path: "/api/staff/settings", summary: "Save agency voice", auth: "users:manage" },
  { method: "post", path: "/api/staff/testimonials", summary: "Publish or hide a story", auth: "marketing:review" },
  { method: "post", path: "/api/staff/users", summary: "Create a staff account", auth: "users:manage" },
  { method: "patch", path: "/api/staff/users", summary: "Disable, unlock, or reset a staff account", auth: "users:manage" },
  { method: "post", path: "/api/staff/utm", summary: "Save a UTM link", auth: "marketing:draft" },
  { method: "post", path: "/api/testimonials", summary: "Submit a public story", auth: "public" },
  { method: "post", path: "/api/unsubscribe", summary: "Confirm an unsubscribe", auth: "public" },
];

export function openApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of API_OPERATIONS) {
    const path = (paths[operation.path] ??= {});
    path[operation.method] = {
      summary: operation.summary,
      description: `Authorisation: ${operation.auth}.`,
      responses: {
        "200": { description: "Success" },
        "400": { description: "Invalid input" },
        "401": { description: "Sign in required" },
        "403": { description: "Not allowed" },
      },
    };
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "FDW agency platform API",
      version: "0.6.0",
      description:
        "Catalogue of App Router handlers. The HTTP copy is served only to signed-in staff. Amounts on billing routes are decimal strings stored as integer cents. Card numbers are rejected.",
    },
    paths,
  };
}
