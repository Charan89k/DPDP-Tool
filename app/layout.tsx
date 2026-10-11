import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TLI DPDP Compliance Gap Analysis Tool",
  description:
    "Truth Labs International — Multi-tenant compliance assessment platform evaluating corporate preparedness against India's Digital Personal Data Protection Act, 2023.",
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

