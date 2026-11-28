import Link from "next/link";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/current";
import { homeForRole } from "@/lib/auth/current";
import { AGENCY } from "@/content/site";
import { LOCALE_LABELS, localeHasGaps, safeNextPath, t, type MessageKey } from "@/lib/i18n";
import { enabledLocales, getLocale } from "@/lib/i18n/request";

const links: [MessageKey, string][] = [
  ["nav.services", "/services"],
  ["nav.care", "/care"],
  ["nav.helpers", "/maids"],
  ["nav.journal", "/journal"],
  ["nav.stories", "/testimonials"],
  ["nav.faq", "/faq"],
  ["nav.contact", "/contact"],
];

export async function Header() {
  const session = await getSession();
  const locale = await getLocale();
  const pathname = safeNextPath((await headers()).get("x-pathname"));
  const locales = enabledLocales();
  return (
    <header className="border-b border-[var(--line)]">
      <p className="bg-[var(--lagoon)] px-4 py-2 text-center text-sm text-[#f6f0e6]">
        {AGENCY.fictionalDemo
          ? "Fictional demonstration agency. Sample helpers are not real people. "
          : `${AGENCY.name}. `}
        {AGENCY.disclaimer}
      </p>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="display flex items-center gap-3 text-2xl text-[var(--lagoon)]">
          {AGENCY.logoUrl ? (
            // Operator-supplied logo URL. Next/Image remote patterns stay off so any host the operator configures can render.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={AGENCY.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : null}
          <span>
          {AGENCY.name}
          <span className="mt-1 block font-sans text-xs font-medium tracking-[0.16em] text-[var(--brass-ink)] uppercase">
            Singapore household care
          </span>
          </span>
        </Link>
        <nav aria-label={t(locale, "nav.primary")} className="flex flex-wrap items-center gap-4 text-sm">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-[var(--brass-ink)]">
              {t(locale, label)}
            </Link>
          ))}
          <Link href="/apply" className="btn">
            {t(locale, "nav.apply")}
          </Link>
          {session ? (
            <Link href={homeForRole(session.role)} className="btn secondary">
              {t(locale, "nav.desk")}
            </Link>
          ) : (
            <Link href="/login" className="btn secondary">
              {t(locale, "nav.signIn")}
            </Link>
          )}
        </nav>
        <nav aria-label={t(locale, "nav.language")} className="flex flex-wrap gap-3 text-xs">
          {locales.map((code) => (
            <a key={code} href={`/locale?lang=${code}&next=${encodeURIComponent(pathname)}`} hrefLang={code} className="hover:text-[var(--brass-ink)]">
              {LOCALE_LABELS[code]}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export async function Footer() {
  const locale = await getLocale();
  return (
    <footer className="mt-16 border-t border-[var(--line)]">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm md:grid-cols-3">
        <div>
          <p className="display text-xl">{AGENCY.name}</p>
          <p className="mt-2 text-[var(--ink)]/80">{AGENCY.address}</p>
          <p>{AGENCY.licence}</p>
        </div>
        <div>
          <p>{AGENCY.phone}</p>
          <p>{AGENCY.email}</p>
          <Link href="/privacy" className="mt-2 inline-block underline">
            {t(locale, "footer.privacy")}
          </Link>
          <Link href="/disclaimer" className="mt-2 block underline">
            {t(locale, "footer.disclaimer")}
          </Link>
          {localeHasGaps(locale) ? <p className="mt-3">{t(locale, "locale.fallbackNote")}</p> : null}
        </div>
        <p className="text-[var(--ink)]/80">{AGENCY.disclaimer}</p>
      </div>
    </footer>
  );
}
