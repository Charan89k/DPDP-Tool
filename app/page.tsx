import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  ListChecks,
  Lock,
  Server,
  Users,
} from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { BrandMark } from "@/components/ui/brand-mark";
import { getCanonicalQuestionnaireSections } from "@/lib/questionnaire/data";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Create your workspace",
    body: "Register your organisation, verify your email and invite the colleagues who own privacy, security and operations.",
  },
  {
    title: "Answer the assessment",
    body: "Work through 60 questions across eight areas, from notice and consent to security safeguards and processors. Progress saves as you go.",
  },
  {
    title: "Attach evidence",
    body: "Upload the policies, records and reports that support each answer. Files stay private to your organisation.",
  },
  {
    title: "Review gaps and act",
    body: "See prioritised findings with the answers that produced them, then assign corrective actions with owners and due dates.",
  },
];

const OUTPUTS = [
  { icon: BarChart3, title: "Readiness and coverage metrics", body: "Completeness, response coverage, evidence coverage and a provisional readiness score, each calculated from your saved answers." },
  { icon: ListChecks, title: "Explainable gap register", body: "Every finding links back to the question, your answer, the mapped control and the reason it was raised." },
  { icon: FileCheck2, title: "Evidence trail", body: "A record of which documents support which answers and how each was reviewed." },
  { icon: ClipboardCheck, title: "Corrective action plan", body: "Remediation tasks with priority, owner, target date and status for each gap." },
];

const PRINCIPLES = [
  { icon: Lock, title: "Organisation-scoped data", body: "Every record is isolated to the organisation that owns it and checked on the server for every request." },
  { icon: Users, title: "Role-based access", body: "Administrators, contributors and viewers see and do only what their role allows." },
  { icon: Server, title: "Self-hostable", body: "Runs on a server you control with a local SQLite database and file storage. No external database required." },
];

export default async function HomePage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0F172A]">
      <header className="bg-[#0B192C] text-white">
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between" aria-label="Main">
          <BrandMark variant="dark" size="sm" />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="px-3 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
              Sign in
            </Link>
            <Link href="/register" className="px-4 py-2 rounded-lg bg-[#0066FF] hover:bg-[#0052CC] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
              Get started
            </Link>
          </div>
        </nav>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Digital Personal Data Protection Act, 2023</p>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              Assess your DPDP readiness and know exactly what to fix.
            </h1>
            <p className="mt-5 text-base text-slate-300 max-w-xl leading-relaxed">
              CloudE5 guides your organisation through a structured DPDP self-assessment, keeps supporting evidence in one
              private workspace, and turns your answers into an explainable gap register and corrective action plan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0066FF] hover:bg-[#0052CC] font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                Create an organisation account <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex items-center px-5 py-3 rounded-lg border border-white/20 hover:bg-white/10 font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                Sign in
              </Link>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-sm font-semibold text-white">What the assessment covers</p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
              {getCanonicalQuestionnaireSections().map((section) => section.title).map((area) => (
                <li key={area} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-300 flex-shrink-0" aria-hidden="true" />
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-white rounded-xl border border-slate-200 p-5">
                <span className="w-8 h-8 rounded-full bg-blue-50 text-[#0066FF] font-bold text-sm flex items-center justify-center">{index + 1}</span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-white border-y border-slate-200" aria-labelledby="outputs-heading">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
            <h2 id="outputs-heading" className="text-2xl font-bold tracking-tight">What you get</h2>
            <div className="mt-8 grid sm:grid-cols-2 gap-5">
              {OUTPUTS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4 p-5 rounded-xl border border-slate-200">
                  <Icon className="w-6 h-6 text-[#0066FF] flex-shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16" aria-labelledby="trust-heading">
          <h2 id="trust-heading" className="text-2xl font-bold tracking-tight">Built for sensitive compliance data</h2>
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white rounded-xl border border-slate-200 p-5">
                <Icon className="w-5 h-5 text-[#0066FF]" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-slate-500 max-w-3xl leading-relaxed">
            CloudE5 is a self-assessment tool. Scores and findings are generated from the information your organisation
            provides using a documented, provisional methodology. They are not legal advice, are not a determination of
            compliance with the DPDP Act or the DPDP Rules, and do not replace review by qualified legal counsel.
          </p>
        </section>
      </main>

      <footer className="bg-[#0B192C] text-slate-400 text-xs">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-3">
          <BrandMark variant="dark" size="sm" />
          <span>Compliance self-assessment for India&apos;s DPDP Act, 2023.</span>
        </div>
      </footer>
    </div>
  );
}
