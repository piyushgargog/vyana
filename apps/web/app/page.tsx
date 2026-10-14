"use client";

import React from "react";
import Link from "next/link";
import { MedicalDisclaimerFooter } from "@/components/ui-primitives";
import { BrandMark } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Emergency Top Strip */}
      <div className="bg-red-700 text-white px-4 py-2 text-xs sm:text-sm">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">
            Medical Emergency? Call India National Ambulance Service immediately.
          </span>
          <div className="flex items-center gap-2">
            <a
              href="tel:108"
              aria-label="Call 108 Free Emergency Ambulance"
              className="rounded-lg bg-white px-3 py-1 font-bold text-red-700 hover:bg-red-50"
            >
              Call 108 (Ambulance)
            </a>
            <a
              href="tel:112"
              aria-label="Call 112 National Emergency Number"
              className="rounded-lg border border-red-200 px-3 py-1 font-semibold text-white hover:bg-red-800"
            >
              Call 112
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Vyana
              </span>
              <p className="text-xs text-slate-500">
                Your health, in one calm place.
              </p>
            </div>
          </div>

          <nav
            aria-label="Primary navigation"
            className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm"
          >
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
            >
              Patient Dashboard
            </Link>
            <Link
              href="/doctor"
              className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
            >
              Doctor Portal
            </Link>
            <Link
              href="/admin/doctors"
              className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
            >
              Admin Registry
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 shadow-sm"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold text-teal-800">
                <span>One-Stop Healthcare Platform for India</span>
                <span>·</span>
                <span>DPDP Act 2023 Compliant</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
                Complete healthcare that connects{" "}
                <span className="text-teal-700">
                  patients, doctors, and families
                </span>{" "}
                in one calm companion.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                From 108 emergency response and offline Medical ID QR to
                prescription scanning, live full-basket pharmacy comparison with
                Jan Aushadhi generic savings, government OPD token booking, lab
                trend tracking, and doctor-approved chronic care plans.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 shadow-sm"
                >
                  Open Patient Web Dashboard →
                </Link>
                <Link
                  href="/doctor"
                  className="rounded-xl border border-teal-700 bg-white px-5 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-50"
                >
                  Open Doctor OPD Portal →
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Sign In to Your Account
                </Link>
              </div>
            </div>

            {/* Interactive Role & Flow Quick-Launch Card */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Explore Vyana Workflows
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sign in to access your role-specific clinical workspace
                  </p>
                </div>
                <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
                  DPDP Protected
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                <Link
                  href="/dashboard"
                  className="w-full text-left rounded-xl border border-slate-200 p-3.5 hover:border-teal-500 hover:bg-teal-50/40 transition flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      Patient Companion
                    </div>
                    <div className="text-xs text-slate-500">
                      Doses, full-basket Rx price compare, OPD tokens, lab trends, care plan
                    </div>
                  </div>
                  <span className="text-teal-700 font-bold">→</span>
                </Link>

                <Link
                  href="/doctor"
                  className="w-full text-left rounded-xl border border-slate-200 p-3.5 hover:border-teal-500 hover:bg-teal-50/40 transition flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      Doctor Portal
                    </div>
                    <div className="text-xs text-slate-500">
                      Live token queue, patient chart, e-Prescription, care plan approval
                    </div>
                  </div>
                  <span className="text-teal-700 font-bold">→</span>
                </Link>

                <Link
                  href="/doctor/verify"
                  className="w-full text-left rounded-xl border border-slate-200 p-3.5 hover:border-teal-500 hover:bg-teal-50/40 transition flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      NMC Indian Medical Register Verification
                    </div>
                    <div className="text-xs text-slate-500">
                      Live TinyFish web agent lookup against NMC IMR registry
                    </div>
                  </div>
                  <span className="text-teal-700 font-bold">→</span>
                </Link>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href="/consent"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 text-center"
                  >
                    DPDP Consent Screen
                  </Link>
                  <Link
                    href="/onboarding"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 text-center"
                  >
                    Role Onboarding
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Pillars Grid */}
        <section className="bg-white border-t border-slate-200 py-12 px-4">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-slate-900">
                Built for Real Indian Healthcare Workflows
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Every AI output is source-cited, safety-checked, and paired with
                mandatory human verification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-200 p-5 space-y-2">
                <span className="inline-block rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                  Emergency & Offline Medical ID
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  1-Tap 108/112 SOS & Lock-Screen QR
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  3-second countdown dials 108 ambulance, texts GPS location to
                  family contacts, shows nearby emergency hospitals, and encodes
                  blood group, allergies, and active meds in an offline QR code.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 space-y-2">
                <span className="inline-block rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800">
                  Prescriptions & Basket Compare
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Whole-Prescription Pharmacy + Jan Aushadhi Compare
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Scan handwritten or printed prescriptions, verify extracted
                  items with verbatim evidence, and compare the entire basket
                  across 1mg, PharmEasy, Apollo, Netmeds, and PMBJP Jan Aushadhi.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 space-y-2">
                <span className="inline-block rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  OPD Tokens & Doctor Loop
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  ORS-Style OPD Queue & Doctor-Approved Care Plans
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Book government or private department OPD tokens, receive
                  e-Prescriptions from NMC-verified doctors, and follow daily
                  Indian diet & vitals care plans approved by your physician.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MedicalDisclaimerFooter />
    </div>
  );
}
