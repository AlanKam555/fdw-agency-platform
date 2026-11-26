import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Footer, Header } from "@/components/chrome";
import { brand } from "@/config/brand";
import { AGENCY } from "@/content/site";
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
    description:
      "Matching, interviews, and Ministry of Manpower work permit preparation for foreign domestic workers. Demonstration data is fictional.",
    locale: "en_SG",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-SG"
      className={`${outfit.variable} ${fraunces.variable}`}
      style={{
        ["--lagoon" as string]: brand.primary,
        ["--brass" as string]: brand.accent,
        ["--paper" as string]: brand.paper,
      }}
    >
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-white focus:p-2">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
