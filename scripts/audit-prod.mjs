import { spawnSync } from "node:child_process";

// Prisma 6 ships its CLI config parser inside the client package. These two
// advisories are in that parser (effect template literals, deepmerge-ts).
// The running server uses the generated client and does not call them.
// Prisma 7 removes the chain, and that upgrade is a separate migration.
const ACCEPTED = new Set(["GHSA-7589-6fvf-x4pw", "GHSA-ggr8-5vv4-36mx"]);

const audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8" });
if (!audit.stdout) {
  console.error(audit.stderr || "npm audit produced no output");
  process.exit(1);
}
const data = JSON.parse(audit.stdout);
const vulnerabilities = data.vulnerabilities ?? {};

function advisories(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const entry = vulnerabilities[name];
  if (!entry) return [];
  const found = [];
  for (const via of entry.via ?? []) {
    if (typeof via === "string") found.push(...advisories(via, seen));
    else if (via?.url) found.push(via);
  }
  return found;
}

const blocking = [];
for (const [name, entry] of Object.entries(vulnerabilities)) {
  if (entry.severity !== "high" && entry.severity !== "critical") continue;
  const leftover = advisories(name).filter((item) => {
    const id = item.url.split("/").pop();
    return !ACCEPTED.has(id);
  });
  if (leftover.length) {
    blocking.push({ name, advisories: leftover.map((item) => item.url) });
  }
}

if (blocking.length) {
  console.error(JSON.stringify(blocking, null, 2));
  process.exit(1);
}

console.log("production audit: no unaccepted high or critical advisories");
