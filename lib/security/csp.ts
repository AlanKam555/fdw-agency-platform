function botHosts(): { script: string; frame: string; connect: string } | null {
  const mode = process.env.BOT_PROTECTION?.trim().toLowerCase();
  if (mode === "turnstile") {
    return {
      script: "https://challenges.cloudflare.com",
      frame: "https://challenges.cloudflare.com",
      connect: "https://challenges.cloudflare.com",
    };
  }
  if (mode === "hcaptcha") {
    return {
      script: "https://js.hcaptcha.com",
      frame: "https://hcaptcha.com https://*.hcaptcha.com",
      connect: "https://hcaptcha.com",
    };
  }
  return null;
}

const SCRIPT = (nonce: string, dev: boolean) =>
  dev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

/**
 * Per-request Content-Security-Policy.
 *
 * Next.js reads the nonce from this header and stamps its scripts and style tags.
 * `strict-dynamic` lets those nonced scripts load the rest of the framework.
 * Style elements use the same nonce. Style attributes are refused.
 * `upgrade-insecure-requests` is added only when APP_URL is https, so the
 * local Docker demo on http://localhost still loads.
 */
export function contentSecurityPolicy(
  nonce: string,
  dev = process.env.NODE_ENV !== "production",
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(nonce)) {
    throw new Error("CSP nonce must be base64url.");
  }
  const bot = botHosts();
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'none'",
    bot ? `${SCRIPT(nonce, dev)} ${bot.script}` : SCRIPT(nonce, dev),
    `${dev ? "connect-src 'self' ws: wss:" : "connect-src 'self'"}${bot ? ` ${bot.connect}` : ""}`,
  ];
  if (bot) directives.push(`frame-src 'self' ${bot.frame}`);
  if (!dev && process.env.APP_URL?.startsWith("https://")) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

export function scriptSrcDirective(policy: string): string {
  return (
    policy
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src ")) ?? ""
  );
}
