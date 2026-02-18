import type { Metadata } from "next";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prenews.news";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PreNews";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Tomorrow's Front Page, Today`,
    template: `%s — ${SITE_NAME}`,
  },
  description: "Market-implied probabilities for tomorrow's headlines. Real-time prediction market data from Polymarket and Kalshi, transformed into premium news coverage.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Tomorrow's Front Page, Today`,
    description: "Market-implied probabilities for tomorrow's headlines. Real-time prediction market data transformed into premium news coverage.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — Tomorrow's Front Page, Today`,
    description: "Market-implied probabilities for tomorrow's headlines.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LayoutShell>{children}</LayoutShell>
        <footer className="border-t border-border py-4 px-4 text-center text-xs text-text-muted">
          <p>Market-implied probabilities, not facts. Not financial advice. Thin markets can be manipulated.</p>
        </footer>
      </body>
    </html>
  );
}
