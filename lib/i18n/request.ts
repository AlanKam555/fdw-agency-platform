import { cookies } from "next/headers";
import { brand } from "@/config/brand";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n";

export const LOCALE_COOKIE = "hl_locale";

export function enabledLocales(): Locale[] {
  const configured = brand.locales.filter(isLocale);
  const list = configured.length ? configured : [...LOCALES];
  return list.includes("en") ? list : ["en", ...list];
}

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}
