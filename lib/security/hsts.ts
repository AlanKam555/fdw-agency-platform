export function hstsValue(appUrl = process.env.APP_URL ?? ""): string | null {
  if (!appUrl.startsWith("https://")) return null;
  return "max-age=15552000; includeSubDomains";
}
