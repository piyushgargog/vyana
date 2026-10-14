import React from "react";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import {
  ButtonLink,
  Card,
  CardHeader,
  Pill,
  SiteFooter,
} from "@/components/ui";
import {
  Activity,
  Building2,
  CheckCircle2,
  HeartPulse,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Vyana — Your health, in one calm place",
  description:
    "Complete healthcare that connects patients, doctors, and families. Medicine reminders, emergency SOS, whole-prescription price comparison, and doctor-approved care plans.",
};

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Careful by design", href: "#careful" },
  { label: "For doctors", href: "#doctors" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      {/* 1. Shared Public Header (DocuLens-style Liquid Glass) */}
      <PublicHeader navLinks={NAV_LINKS} />

      <main className="flex-1">
        {/* 2 & 3. Hero Section with One Headline and One Primary Call to Action */}
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1 text-[13px] font-semibold text-accent-strong mb-6">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>The calm healthcare companion for India</span>
          </div>

          <h1 className="text-[40px] sm:text-[56px] lg:text-[64px] font-bold tracking-[-0.03em] text-label leading-[1.08] max-w-4xl mx-auto">
            Your health, in one calm place.
          </h1>

          <p className="mt-5 text-[17px] sm:text-[20px] text-label-2 max-w-2xl mx-auto leading-relaxed">
            From daily dose schedules and 108 emergency SOS to whole-prescription
            pharmacy comparison and doctor-approved care plans.
          </p>

          {/* Primary CTA (Rule: one primary action per screen) */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <ButtonLink href="/signup" variant="primary" size="lg">
              Get started with Vyana
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary" size="lg">
              Open patient dashboard
            </ButtonLink>
          </div>

          {/* 4. The App Displayed Inside a Phone Frame */}
          <div className="mt-14 sm:mt-18 flex justify-center">
            <div className="relative w-full max-w-[340px] rounded-[48px] border-[8px] border-label/90 bg-canvas p-4 shadow-float text-left select-none">
              {/* Phone Dynamic Island */}
              <div className="mx-auto h-4 w-28 rounded-full bg-label/90 mb-4" />

              {/* Status Header */}
              <div className="flex items-center justify-between text-[11px] font-medium text-label-3 px-1 mb-3">
                <span>09:41</span>
                <span>5G · 100%</span>
              </div>

              {/* Patient App Header inside Phone */}
              <div className="space-y-1 mb-4">
                <p className="text-[11px] font-semibold tracking-wide uppercase text-accent-strong">
                  Tuesday, October 14
                </p>
                <p className="text-[20px] font-bold tracking-tight text-label">
                  Today
                </p>
              </div>

              {/* Simulated Doses Today Card */}
              <div className="rounded-card bg-surface p-3.5 border border-separator shadow-xs space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-label">
                    Doses today
                  </span>
                  <Pill tone="accent">2 of 3 taken</Pill>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between rounded-row bg-fill/50 px-2.5 py-1.5 text-[12px]">
                    <span className="font-medium text-label">
                      Metformin 500mg
                    </span>
                    <span className="text-ok font-semibold">Taken · 09:00</span>
                  </div>
                  <div className="flex items-center justify-between rounded-row bg-fill/50 px-2.5 py-1.5 text-[12px]">
                    <span className="font-medium text-label">
                      Amlodipine 5mg
                    </span>
                    <span className="text-label-3">Due at 21:00</span>
                  </div>
                </div>
              </div>

              {/* Simulated Lab Metric Card */}
              <div className="rounded-card bg-surface p-3.5 border border-separator shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-label">
                    HbA1c Trend
                  </span>
                  <span className="text-[11px] font-medium text-label-2">
                    Normal (4.0% – 5.6%)
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-bold text-label">5.4%</span>
                  <span className="text-[11px] text-ok font-medium">In target range</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Four Feature Cards */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-[28px] sm:text-[36px] font-bold tracking-tight text-label">
              Everything in calm order.
            </h2>
            <p className="mt-3 text-[16px] text-label-2 leading-relaxed">
              Thoughtfully engineered for patients, trusted caregivers, and Indian healthcare workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1: Prescription Comparison */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                  <Receipt className="h-6 w-6" aria-hidden="true" />
                </span>
                <CardHeader
                  title="Jan Aushadhi generic comparison"
                />
                <p className="text-[15px] leading-relaxed text-label-2">
                  Compare whole-prescription prices across verified online pharmacies
                  and discover cost-effective Pradhan Mantri Jan Aushadhi generic
                  alternatives with verified salts and exact strengths.
                </p>
              </div>

              <div className="mt-6 rounded-tile bg-fill/50 p-4 border border-separator/60">
                <div className="flex items-center justify-between text-[13px] font-semibold text-label mb-2">
                  <span>Prescription Basket Check</span>
                  <span className="text-ok font-bold">Generic savings</span>
                </div>
                <div className="space-y-1 text-[12px] text-label-3">
                  <p>• Verified therapeutic salt equivalence</p>
                  <p>• Full-basket comparison across licensed pharmacies</p>
                </div>
              </div>
            </Card>

            {/* Feature 2: Lab Value History & Trends */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                  <TrendingUp className="h-6 w-6" aria-hidden="true" />
                </span>
                <CardHeader
                  title="Laboratory trend charts with normal ranges"
                />
                <p className="text-[15px] leading-relaxed text-label-2">
                  Track fasting blood sugar, HbA1c, lipid profiles, and kidney function
                  over time. Interactive trendlines plot each test result against
                  clinical reference ranges and highlight flagged values.
                </p>
              </div>

              <div className="mt-6 rounded-tile bg-fill/50 p-4 border border-separator/60">
                <div className="flex items-center justify-between text-[13px] font-semibold text-label mb-2">
                  <span>Diagnostic Lab History</span>
                  <span className="text-accent-strong font-medium">Standardized metrics</span>
                </div>
                <div className="space-y-1 text-[12px] text-label-3">
                  <p>• Visual reference bands with abnormal flags</p>
                  <p>• Long-term tracking across test reports</p>
                </div>
              </div>
            </Card>

            {/* Feature 3: OPD Tokens & Hospital Directory */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                  <Building2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <CardHeader
                  title="Live OPD queue status and hospital schedules"
                />
                <p className="text-[15px] leading-relaxed text-label-2">
                  Book and track digital OPD tokens for public and empanelled
                  hospitals. Know your expected turn and department timings
                  without spending hours waiting in crowded corridors.
                </p>
              </div>

              <div className="mt-6 rounded-tile bg-fill/50 p-4 border border-separator/60">
                <div className="flex items-center justify-between text-[13px] font-semibold text-label mb-2">
                  <span>Hospital OPD Schedules</span>
                  <span className="text-accent-strong font-medium">Clinic timings</span>
                </div>
                <div className="space-y-1 text-[12px] text-label-3">
                  <p>• General Medicine and specialty departments</p>
                  <p>• Live token queues and operating days</p>
                </div>
              </div>
            </Card>

            {/* Feature 4: Emergency SOS & Medical ID */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger-text mb-5">
                  <HeartPulse className="h-6 w-6" aria-hidden="true" />
                </span>
                <CardHeader
                  title="One-tap 108 SOS & offline Medical ID"
                />
                <p className="text-[15px] leading-relaxed text-label-2">
                  One tap calls 108, shares your location with family, and shows
                  your medical ID. An offline lock-screen QR keeps your blood
                  group and allergies visible even without internet.
                </p>
              </div>

              <div className="mt-6 rounded-tile bg-fill/50 p-4 border border-separator/60">
                <div className="flex items-center justify-between text-[13px] font-semibold text-label mb-2">
                  <span>Offline Medical ID Summary</span>
                  <span className="text-danger-text font-bold">108 / 112 Ready</span>
                </div>
                <div className="space-y-1 text-[12px] text-label-3">
                  <p>• Blood group and verified allergies</p>
                  <p>• Emergency contacts and lock-screen QR</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* 6. “Careful by Design” Glass Strip */}
        <section id="careful" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="glass rounded-feature p-8 sm:p-10 border border-white/80 shadow-glass">
            <div className="max-w-xl mb-8">
              <h2 className="text-[26px] sm:text-[32px] font-bold tracking-tight text-label">
                Careful by design.
              </h2>
              <p className="mt-2 text-[15px] text-label-2 leading-relaxed">
                Healthcare requires a higher bar than ordinary consumer apps.
                Every assistive feature is constrained by clinical safety guardrails.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-accent-strong shrink-0" aria-hidden="true" />
                  <h3 className="text-[16px] font-semibold text-label">
                    Source-cited health notes
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed text-label-2">
                  Every informational note quotes clinical guidelines verbatim.
                  Vyana never diagnoses and never tells you a dose.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-accent-strong shrink-0" aria-hidden="true" />
                  <h3 className="text-[16px] font-semibold text-label">
                    Doctor in the loop
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed text-label-2">
                  Chronic care plans and prescription adjustments require
                  confirmation by licensed medical practitioners before being
                  activated.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent-strong shrink-0" aria-hidden="true" />
                  <h3 className="text-[16px] font-semibold text-label">
                    Explicit consent
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed text-label-2">
                  Under the Digital Personal Data Protection Act, your health data
                  is shared only with caregivers and physicians you explicitly
                  authorize.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Dark “For Doctors” Section */}
        <section id="doctors" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-feature bg-label text-white p-8 sm:p-12 lg:p-14 shadow-float">
            <div className="max-w-2xl mb-10">
              <h2 className="text-[30px] sm:text-[38px] font-bold tracking-tight text-white leading-tight">
                Built for busy Indian OPDs.
              </h2>
              <p className="mt-3 text-[16px] text-white/70 leading-relaxed">
                Streamline token queues, access patient medical histories instantly,
                and prescribe daily care plans with zero administrative overhead.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="rounded-card bg-white/5 border border-white/10 p-6 space-y-2">
                <Stethoscope className="h-6 w-6 text-accent mb-2" aria-hidden="true" />
                <h3 className="text-[17px] font-semibold text-white">
                  Live OPD Consultation Queue
                </h3>
                <p className="text-[14px] text-white/70 leading-relaxed">
                  Call next tokens, inspect active medicines and allergies, and
                  record concise consultation notes seamlessly.
                </p>
              </div>

              <div className="rounded-card bg-white/5 border border-white/10 p-6 space-y-2">
                <ShieldCheck className="h-6 w-6 text-accent mb-2" aria-hidden="true" />
                <h3 className="text-[17px] font-semibold text-white">
                  NMC Statutory Verification
                </h3>
                <p className="text-[14px] text-white/70 leading-relaxed">
                  Instant practitioner verification against the National Medical
                  Commission and State Medical Council registers.
                </p>
              </div>

              <div className="rounded-card bg-white/5 border border-white/10 p-6 space-y-2">
                <Activity className="h-6 w-6 text-accent mb-2" aria-hidden="true" />
                <h3 className="text-[17px] font-semibold text-white">
                  Chronic Care Tracking
                </h3>
                <p className="text-[14px] text-white/70 leading-relaxed">
                  Review patient dose adherence, monitor blood pressure and blood
                  sugar logs, and adapt treatment plans with confidence.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
              <ButtonLink href="/doctor" variant="primary" size="md">
                Enter doctor portal
              </ButtonLink>
              <ButtonLink
                href="/doctor/verify"
                variant="secondary"
                size="md"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                Verify NMC credentials
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Shared SiteFooter */}
      <SiteFooter />
    </div>
  );
}
