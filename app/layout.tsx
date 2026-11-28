import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, Outfit } from "next/font/google";
import { Footer, Header } from "@/components/chrome";
import { brand } from "@/config/brand";
import { AGENCY } from "@/content/site";
import { HTML_LANG, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/request";
import { brandStyleSheet } from "@/lib/security/brand-style";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: `${AGENCY.name} — household helpers in Singapore`,
    template: `%s · ${AGENCY.name}`,
  },
  description:
    `${AGENCY.name} is ${AGENCY.fictionalDemo ? "a fictional demonstration of " : ""}a Singapore employment agency workspace for foreign domestic workers. Browse consented profiles, send an employer brief, and let staff prepare a MOM work permit pack.`,
  openGraph: {
    title: `${AGENCY.name} — household helpers in Singapore`,
    description: `${AGENCY.name} introduces foreign domestic workers to families in Singapore. Staff decide every match and prepare the Ministry of Manpower file.`,
    locale: "en_SG",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = await getLocale();
  return (
    <html
      lang={HTML_LANG[locale]}
      nonce={nonce}
      className={`${outfit.variable} ${fraunces.variable} brand-colours`}
    >
      <body>
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: brandStyleSheet(brand) }} />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-white focus:p-2">
          {t(locale, "skip")}
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
