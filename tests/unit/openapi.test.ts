import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { API_OPERATIONS, openApiDocument } from "@/lib/openapi/document";

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry === "route.ts") found.push(full);
  }
  return found;
}

function operationsOnDisk(): string[] {
  const root = path.join(process.cwd(), "app/api");
  const keys: string[] = [];
  for (const file of routeFiles(root)) {
    const relative = path.relative(root, path.dirname(file));
    const url =
      "/api/" +
      relative
        .split(path.sep)
        .map((segment) => (segment.startsWith("[") ? `{${segment.slice(1, -1)}}` : segment))
        .join("/");
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)) {
      keys.push(`${match[1]} ${url}`);
    }
  }
  return keys.sort();
}

describe("OpenAPI catalogue", () => {
  it("matches the route files", () => {
    const declared = API_OPERATIONS.map((operation) => `${operation.method.toUpperCase()} ${operation.path}`).sort();
    expect(declared).toEqual(operationsOnDisk());
  });

  it("is an OpenAPI document without a public server", () => {
    const document = openApiDocument();
    expect(document.openapi).toBe("3.0.3");
    expect(document.paths["/api/health"]?.get).toBeTruthy();
    expect(document).not.toHaveProperty("servers");
  });
});
