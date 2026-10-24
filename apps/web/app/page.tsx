import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthActions, LandingActions } from "@/components/auth-actions";
import {
  BrandMark,
  ButtonLink,
  Card,
  Pill,
  RevealOnScroll,
  SiteFooter,
} from "@/components/ui";
import {
  Activity,
  CheckCircle2,
  Clock,
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
    "Complete healthcare that connects patients, doctors, and families. Medicine reminders, emergency SOS, pharmacy and lab links, and doctor-approved care plans.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      {/* 1. Glass Navigation Bar */}
      <header className="glass-bar sticky top-0 z-30 border-b border-separator">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-4">
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

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AuthActions plainSignIn />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2 & 3. Hero: a full-bleed calm gradient, one headline, one primary action (issue #492) */}
        <section className="bg-gradient-to-b from-accent-soft via-canvas to-canvas">
          <div className="mx-auto max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-surface/70 px-3.5 py-1 text-footnote font-semibold text-accent-strong mb-6">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>The calm healthcare companion for India</span>
          </div>

          <h1 className="text-display max-w-4xl mx-auto text-label">
            Your health, in one calm place.
          </h1>

          <p className="mt-5 text-body sm:text-title-3 font-normal text-label-2 max-w-2xl mx-auto leading-relaxed">
            From daily dose schedules and 108 emergency SOS to links for finding
            your medicines and doctor-approved care plans.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <LandingActions />
          </div>
          <p className="mt-3 text-footnote text-label-3">
            The Android app is a direct download (APK). On iPhone, use vyanahealth.app in your browser.
          </p>

          {/* 4. The App Displayed Inside a Phone Frame */}
          <div className="mt-14 sm:mt-18 flex justify-center">
            <div aria-hidden="true" className="relative w-full max-w-[340px] rounded-[48px] border-[8px] border-label/90 bg-canvas p-4 shadow-float text-left select-none">
              {/* Phone Dynamic Island */}
              <div className="mx-auto mb-4 h-4 w-24 rounded-full bg-label/90" aria-hidden="true" />

              {/* Today Header */}
              <div className="flex items-end justify-between pb-3">
                <div>
                  <p className="text-[26px] font-bold tracking-tight text-label">
                    Today
                  </p>
                </div>
                <Pill tone="danger">SOS 108</Pill>
              </div>

              {/* Doses Card */}
              <Card padded={false} className="p-4 mb-3">
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
              </Card>

              {/* Your Health Group */}
              <Card padded={false} className="overflow-hidden mb-3 text-[13px]">
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
              </Card>

              {/* Floating Glass Scan Button */}
              <div className="glass rounded-full py-2.5 px-4 flex items-center justify-center gap-2 text-[13px] font-semibold text-accent-strong shadow-glass">
                <Receipt className="h-4 w-4" aria-hidden="true" />
                <span>Scan a prescription</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-footnote text-label-3">
            The Vyana app
          </p>
          </div>
        </section>

        {/* 5. Four ideas, one per section (issue #492): Doses, Reports, Family, Emergency */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-title-1 text-label">
              Clinical tools designed for real Indian families
            </h2>
            <p className="mt-2 text-body text-label-2 leading-relaxed">
              Every feature is built around the everyday steps patients, doctors,
              and caregivers actually navigate.
            </p>
          </div>

          <div className="space-y-14">
            <RevealOnScroll>
              <div className="grid items-center gap-6 md:grid-cols-2">
                <div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                    <Clock className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-title-1 text-label">Doses</h3>
                  <p className="mt-2 text-body leading-relaxed text-label-2">
                    Every dose on time, with a gentle nudge when one is late — and an
                    Undo when a tap was a mistake, never a dead end.
                  </p>
                </div>
                <Card>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-row bg-ok-soft/40 p-3 text-callout">
                      <div>
                        <span className="font-semibold text-label block">Morning dose</span>
                        <span className="text-footnote text-label-3">Marked taken</span>
                      </div>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok text-white text-caption font-bold">✓</span>
                    </div>
                    <div className="flex items-center justify-between rounded-row bg-fill/60 p-3 text-callout">
                      <div>
                        <span className="font-semibold text-label block">Evening dose</span>
                        <span className="text-footnote text-label-3">Not yet marked</span>
                      </div>
                      <span className="text-footnote font-semibold text-label-3">Due</span>
                    </div>
                  </div>
                </Card>
              </div>
            </RevealOnScroll>

            <RevealOnScroll>
              <div className="grid items-center gap-6 md:grid-cols-2">
                <div className="md:order-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                    <TrendingUp className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-title-1 text-label">Reports</h3>
                  <p className="mt-2 text-body leading-relaxed text-label-2">
                    Lab values become trends you can follow — every point labelled,
                    the reference range drawn in, and a headline that says what changed.
                  </p>
                </div>
                <Card className="md:order-1">
                  <div className="flex items-center justify-between text-callout font-semibold text-label mb-2">
                    <span>Your reports, as trends</span>
                    <span className="text-accent-strong font-medium">One chart</span>
                  </div>
                  <div className="space-y-1 text-footnote text-label-3">
                    <p>• Compared against the standard reference range</p>
                    <p>• The same chart on the phone and here</p>
                  </div>
                </Card>
              </div>
            </RevealOnScroll>

            <RevealOnScroll>
              <div className="grid items-center gap-6 md:grid-cols-2">
                <div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong mb-5">
                    <UserCheck className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-title-1 text-label">Family</h3>
                  <p className="mt-2 text-body leading-relaxed text-label-2">
                    A caregiver sees only what you share — labs, vitals, medicines,
                    adherence, each its own switch — and a missed dose reaches them
                    only when it matters.
                  </p>
                </div>
                <Card>
                  <div className="flex items-center justify-between text-callout font-semibold text-label mb-2">
                    <span>Shared with your caregiver</span>
                    <span className="text-accent-strong font-medium">You choose</span>
                  </div>
                  <div className="space-y-1 text-footnote text-label-3">
                    <p>• Four scopes, each a switch, off by default</p>
                    <p>• Stop sharing sits next to the link itself</p>
                  </div>
                </Card>
              </div>
            </RevealOnScroll>

            <RevealOnScroll>
              <div className="grid items-center gap-6 md:grid-cols-2">
                <div className="md:order-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger-text mb-5">
                    <HeartPulse className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-title-1 text-label">Emergency</h3>
                  <p className="mt-2 text-body leading-relaxed text-label-2">
                    One tap calls 108 and shows your Medical ID — blood group,
                    allergies, medicines, one contact — even offline, even on the
                    lock screen.
                  </p>
                </div>
                <Card className="md:order-1">
                  <div className="flex items-center justify-between text-callout font-semibold text-label mb-2">
                    <span>Offline Medical ID</span>
                    <span className="text-danger-text font-bold">Works offline</span>
                  </div>
                  <div className="space-y-1 text-footnote text-label-3">
                    <p>• Blood group and verified allergies</p>
                    <p>• Emergency contacts and a lock-screen QR</p>
                  </div>
                </Card>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* 6. "Careful by Design" strip — a content section, so a solid surface like every other card (issue #288). */}
        <section id="careful" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="rounded-feature bg-surface p-8 sm:p-10 border border-separator">
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
                  Registration checked by an admin
                </h3>
                <p className="text-[14px] text-white/70 leading-relaxed">
                  Every doctor&apos;s registration number is checked by a Vyana admin
                  against the public medical council register before the doctor
                  is marked verified.
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
                Send your registration
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
