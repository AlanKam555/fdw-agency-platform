import { headers } from "next/headers";
import { botProtectionMode } from "@/lib/security/bot-protection";

export async function CaptchaField() {
  const mode = botProtectionMode();
  if (mode === "off") return null;
  const siteKey = mode === "turnstile" ? process.env.TURNSTILE_SITE_KEY : process.env.HCAPTCHA_SITE_KEY;
  if (!siteKey) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  if (mode === "turnstile") {
    return (
      <div>
        <div className="cf-turnstile" data-sitekey={siteKey} />
        <script nonce={nonce} src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      </div>
    );
  }
  return (
    <div>
      <div className="h-captcha" data-sitekey={siteKey} />
      <script nonce={nonce} src="https://js.hcaptcha.com/1/api.js" async defer />
    </div>
  );
}
