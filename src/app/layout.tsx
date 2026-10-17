import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "LuxuryStay | A quieter kind of luxury",
    template: "%s | LuxuryStay"
  },
  description: "Find your still point at LuxuryStay Hotel & Resort. Considered rooms, thoughtful dining and restorative experiences.",
  metadataBase: new URL(process.env.AUTH_URL || "http://localhost:3000"),
  openGraph: {
    title: "LuxuryStay Hotel & Resort",
    description: "A quieter kind of luxury.",
    type: "website"
  }
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
