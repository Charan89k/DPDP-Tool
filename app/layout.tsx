import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

// Every page is rendered per request so it can carry that request's CSP script nonce (proxy.ts).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Truth Labs International — DPDP compliance assessment",
    template: "%s · Truth Labs International",
  },
  description:
    "TLI helps organisations assess their readiness for India's Digital Personal Data Protection Act, 2023, manage supporting evidence, and plan corrective actions.",
  applicationName: "Truth Labs International",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

