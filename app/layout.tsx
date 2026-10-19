import type { Metadata } from "next";
import "./globals.css";

// Every page is rendered per request so it can carry that request's CSP script nonce (proxy.ts).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "CloudE5 — DPDP compliance self-assessment",
    template: "%s · CloudE5",
  },
  description:
    "CloudE5 helps organisations assess their readiness for India's Digital Personal Data Protection Act, 2023, manage supporting evidence, and plan corrective actions.",
  applicationName: "CloudE5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

