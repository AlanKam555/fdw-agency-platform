import Link from "next/link";
import { getSession } from "@/lib/auth/current";
import { homeForRole } from "@/lib/auth/current";
import { AGENCY } from "@/content/site";

const links = [
  ["Services", "/services"],
  ["Care", "/care"],
  ["Helpers", "/maids"],
  ["Journal", "/journal"],
  ["Stories", "/testimonials"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
];

export async function Header() {
  const session = await getSession();
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
          <span className="mt-1 block font-sans text-xs font-medium tracking-[0.16em] text-[var(--brass)] uppercase">
            Singapore household care
          </span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-[var(--brass)]">
              {label}
            </Link>
          ))}
          <Link href="/apply" className="btn">
            Helper application
          </Link>
          {session ? (
            <Link href={homeForRole(session.role)} className="btn secondary">
              Your desk
            </Link>
          ) : (
            <Link href="/login" className="btn secondary">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
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
            Privacy notice
          </Link>
          <Link href="/disclaimer" className="mt-2 block underline">
            Disclaimer
          </Link>
        </div>
        <p className="text-[var(--ink)]/80">{AGENCY.disclaimer}</p>
      </div>
    </footer>
  );
}
