import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthActions, HeroActions } from "@/components/auth-actions";
import {
  BrandMark,
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
  Download,
  HeartPulse,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserCheck,
} from "lucide-react";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "Vyana — Your health, in one calm place",
  description:
    "Complete healthcare that connects patients, doctors, and families. Medicine reminders, emergency SOS, whole-prescription price comparison, and doctor-approved care plans.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      {/* 1. Glass Navigation Bar */}
      <header className="glass-bar sticky top-0 z-30 border-b border-separator">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-full outline-none">
            <BrandMark size={32} />
            <span className="text-[19px] font-semibold tracking-tight text-label">
              Vyana
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-6 text-[15px] font-medium text-label-2"
          >
            <a href="#features" className="hover:text-label transition-colors">
              Features
            </a>
            <a href="#careful" className="hover:text-label transition-colors">
              Careful by design
            </a>
            <a href="#doctors" className="hover:text-label transition-colors">
              For doctors
            </a>
            <a href="/download/android" className="hover:text-label transition-colors">
              Android app
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <AuthActions plainSignIn />
          </div>
        </div>
      </header>

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
            <HeroActions />
            <ButtonLink href="/download/android" native variant="secondary" size="lg" icon={<Download className="h-5 w-5" aria-hidden="true" />}>
              Download for Android
            </ButtonLink>
          </div>
          <p className="mt-3 text-[13px] text-label-3">
            The Android app is a direct download (APK). On iPhone, use vyanahealth.app in your browser.
          </p>

          {/* 4. The App Displayed Inside a Phone Frame */}
          <div className="mt-14 sm:mt-18 flex justify-center">
            <div className="relative w-full max-w-[340px] rounded-[48px] border-[8px] border-label/90 bg-canvas p-4 shadow-float text-left select-none">
              {/* Phone Dynamic Island */}
              <div className="mx-auto mb-4 h-4 w-24 rounded-full bg-label/90" aria-hidden="true" />

              {/* Today Header */}
              <div className="flex items-end justify-between pb-3">
                <div>
                  <p className="text-[26px] font-bold tracking-tight text-label">
                    Today
                  </p>
                </div>
                <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-bold text-danger-text">
                  SOS 108
                </span>
              </div>

              {/* Doses Card */}
              <div className="rounded-card bg-surface p-4 shadow-[0_2px_8px_rgb(0_0_0/0.04)] mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[15px] font-semibold text-label">
                    Doses today
                  </span>
                  <span className="text-[12px] text-label-3">2 of 3 taken</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px] rounded-row bg-ok-soft/40 p-2">
                    <div>
                      <span className="font-semibold text-label block">Metformin 500mg</span>
                      <span className="text-[11px] text-label-3">8:00 AM · After breakfast</span>
                    </div>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok text-white text-[11px] font-bold">
                      ✓
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] rounded-row bg-ok-soft/40 p-2">
                    <div>
                      <span className="font-semibold text-label block">Telmisartan 40mg</span>
                      <span className="text-[11px] text-label-3">9:00 AM · Morning</span>
                    </div>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok text-white text-[11px] font-bold">
                      ✓
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] rounded-row bg-fill/50 p-2">
                    <div>
                      <span className="font-semibold text-label block">Atorvastatin 10mg</span>
                      <span className="text-[11px] text-label-3">9:00 PM · At bedtime</span>
                    </div>
                    <span className="text-[11px] font-semibold text-label-3">Due</span>
                  </div>
                </div>
              </div>

              {/* Your Health Group */}
              <div className="rounded-card bg-surface overflow-hidden shadow-[0_2px_8px_rgb(0_0_0/0.04)] mb-3 text-[13px]">
                <div className="px-3.5 pt-3 pb-1 text-[11px] font-semibold text-label-3">
                  Your health
                </div>
                <div className="divide-y divide-separator">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="font-medium text-label">HbA1c Blood Test</span>
                    <Pill tone="ok" className="text-[11px]">Report added</Pill>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="font-medium text-label">OPD Token · City Hospital</span>
                    <Pill tone="accent" className="text-[11px]">Token #14</Pill>
                  </div>
                </div>
              </div>

              {/* Floating Glass Scan Button */}
              <div className="glass rounded-full py-2.5 px-4 flex items-center justify-center gap-2 text-[13px] font-semibold text-accent-strong shadow-glass">
                <Receipt className="h-4 w-4" aria-hidden="true" />
                <span>Scan a prescription</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-label-3">
            The Vyana app
          </p>
        </section>

        {/* 5. Four Large Feature Cards */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="text-[28px] sm:text-[36px] font-bold tracking-[-0.02em] text-label leading-tight">
              Clinical tools designed for real Indian families
            </h2>
            <p className="mt-2 text-[16px] text-label-2 leading-relaxed">
              Every feature is built around the everyday steps patients, doctors,
              and caregivers actually navigate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1: Prescriptions & Basket Compare */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                  <Receipt className="h-6 w-6" aria-hidden="true" />
                </span>
                <CardHeader
                  title="Whole-prescription pharmacy comparison"
                />
                <p className="text-[15px] leading-relaxed text-label-2">
                  Scan printed or handwritten prescriptions. Vyana checks every
                  medicine against the photo and compares your whole prescription
                  on 1mg, PharmEasy, Netmeds and Apollo.
                </p>
              </div>

              <div className="mt-6 rounded-tile bg-fill/50 p-4 border border-separator/60">
                <div className="flex items-center justify-between text-[13px] font-semibold text-label mb-2">
                  <span>Whole-Prescription Basket</span>
                  <span className="text-accent-strong font-medium">Live prices</span>
                </div>
                <div className="space-y-1 text-[12px] text-label-3">
                  <p>• Compares 1mg, PharmEasy, Netmeds and Apollo</p>
                  <p>• A price counts only when it is on the product page</p>
                </div>
              </div>
            </Card>

            {/* Feature 2: Diagnostic Lab Reports */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                  <TrendingUp className="h-6 w-6" aria-hidden="true" />
                </span>
                <CardHeader
                  title="Lab trend tracking over time"
                />
                <p className="text-[15px] leading-relaxed text-label-2">
                  Upload PDF reports or scan physical test sheets. Vyana graphs
                  your key biomarkers over time against standard Indian reference
                  ranges, turning isolated lab values into meaningful health
                  progress you can discuss with your physician.
                </p>
              </div>

              <div className="mt-6 rounded-tile bg-fill/50 p-4 border border-separator/60">
                <div className="flex items-center justify-between text-[13px] font-semibold text-label mb-2">
                  <span>Tracked Lab Markers</span>
                  <span className="text-ok font-medium">Trends graphed</span>
                </div>
                <div className="space-y-1 text-[12px] text-label-3">
                  <p>• HbA1c and Blood Glucose over time</p>
                  <p>• Compared against standard reference ranges</p>
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
                  title="Hospital OPD queues & verified timings"
                />
                <p className="text-[15px] leading-relaxed text-label-2">
                  Book government and private hospital OPD tokens before leaving
                  home. Check real operating schedules and clinic timings checked
                  on the hospital&apos;s own pages, so you wait less at the hospital.
                </p>
              </div>

              <div className="mt-6 rounded-tile bg-fill/50 p-4 border border-separator/60">
                <div className="flex items-center justify-between text-[13px] font-semibold text-label mb-2">
                  <span>Hospital OPD Schedules</span>
                  <span className="text-accent-strong font-medium">Clinic timings</span>
                </div>
                <div className="space-y-1 text-[12px] text-label-3">
                  <p>• General Medicine and specialty departments</p>
                  <p>• Token booking and operating days</p>
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
                  <span className="text-danger-text font-bold">Works offline</span>
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
                  Every health note shows the guideline it comes from.
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
                  A care plan your doctor prepares is reviewed by that doctor. A
                  plan you generate yourself is marked &ldquo;Not reviewed by a
                  doctor&rdquo;. Vyana never changes your prescription: only your
                  doctor does.
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
                  Your health data
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
                and prescribe daily care plans with less paperwork.
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
                  Registration checked against the National Medical
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
                  sugar logs, and update treatment plans.
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
