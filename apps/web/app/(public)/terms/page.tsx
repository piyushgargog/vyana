import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { MedicalDisclaimerFooter } from "@/components/ui-primitives";
import { BrandMark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Terms of Service · Vyana Health",
  description:
    "Plain-language Terms of Service for Vyana (https://vyanahealth.app). Understand user responsibilities, AI assistive tools, and medical disclaimers.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white py-4 px-4 sticky top-0 z-20">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <span className="text-base font-bold text-slate-900">
              Vyana
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <Link
              href="/login"
              className="font-medium text-slate-700 hover:text-teal-800"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-teal-700 px-3.5 py-1.5 font-semibold text-white hover:bg-teal-800"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm space-y-8">
          {/* Title Header */}
          <div className="border-b border-slate-100 pb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-900 mb-3">
              Plain-Language Terms · Transparent User Agreement
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Effective Date: October 2026 · Website:{" "}
              <a
                href="https://vyanahealth.app"
                className="text-teal-700 font-semibold underline"
              >
                https://vyanahealth.app
              </a>
            </p>
          </div>

          <div className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-700">
            {/* 1. Introduction */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  1
                </span>
                Acceptance of Terms
              </h2>
              <p>
                By creating an account, accessing, or using the Vyana mobile or
                web application (available at <strong>https://vyanahealth.app</strong>),
                you agree to be bound by these Terms of Service and our{" "}
                <Link href="/privacy" className="text-teal-700 underline font-medium">
                  Privacy Policy
                </Link>
                . If you do not agree with these terms, please discontinue use of
                the service.
              </p>
            </section>

            {/* 2. Nature of Service */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  2
                </span>
                Nature of the Platform
              </h2>
              <p>
                Vyana is an informational digital healthcare management platform. It offers:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-800">
                <li>Personal medication schedule tracking and refill reminder alerts.</li>
                <li>Prescription and laboratory report scanning and digitized summarization.</li>
                <li>Emergency medical summary profile and offline-scannable QR code generation.</li>
                <li>Transparent price comparison across Indian online pharmacies and Jan Aushadhi generic stores.</li>
                <li>Hospital OPD discovery and token booking assistance.</li>
              </ul>
              <p className="text-xs text-slate-500">
                Vyana acts as an organizational and tracking tool for your existing medical records; it is not a licensed hospital, pharmacy, or diagnostic laboratory.
              </p>
            </section>

            {/* 3. Essential Medical Disclaimer */}
            <section className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2 text-red-950">
              <h3 className="font-bold text-red-900 uppercase tracking-wider text-xs">
                3. Essential Medical & Emergency Disclaimer
              </h3>
              <p className="font-semibold text-sm sm:text-base">
                &ldquo;Vyana is not a substitute for professional medical advice; in an emergency call 108&rdquo;
              </p>
              <p className="text-xs text-red-900 leading-relaxed">
                The content, AI summaries, and tools in Vyana are for informational purposes only. Vyana does not provide medical diagnosis, clinical treatment plans, or prescription authoring for self-medication. Never disregard professional clinical advice or delay seeking urgent medical evaluation because of information presented on Vyana. If you or someone around you experiences acute chest pain, severe trauma, or breathing distress, dial 108 or proceed to the nearest emergency hospital immediately.
              </p>
            </section>

            {/* 4. AI Assistive Features & Human-in-the-Loop */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  4
                </span>
                Artificial Intelligence &amp; Human-in-the-Loop Verification
              </h2>
              <p>
                Vyana uses artificial intelligence models to extract text from prescription documents and parse numerical results from diagnostic lab reports:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-800">
                <li>
                  <strong>Assistive, Not Authoritative:</strong> Machine learning optical character recognition may occasionally misread handwritten doctor notes, complex unit names, or blurred values.
                </li>
                <li>
                  <strong>Mandatory Verification:</strong> You must review, verify, and correct all extracted medicine dosages and lab numbers before confirming them into your health profile.
                </li>
                <li>
                  <strong>Drug Interaction Inquiries:</strong> Interaction warnings are based on reviewed clinical tables and trusted open medical literature. Absence of an interaction warning does not guarantee that a medicine combination is clinically safe for your specific condition.
                </li>
              </ul>
            </section>

            {/* 5. User Responsibilities & Account Security */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  5
                </span>
                User Responsibilities &amp; Account Security
              </h2>
              <ul className="list-disc pl-6 space-y-1 text-slate-800">
                <li>You are responsible for keeping your login credentials secure.</li>
                <li>You agree to upload only your own medical documents, or records of family members for whom you have legal authorization to act as a caregiver.</li>
                <li>You must not use the platform to transmit unlawful material, impersonate a licensed medical practitioner, or circumvent security policies.</li>
              </ul>
            </section>

            {/* 6. External Links & Third-Party Services */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  6
                </span>
                Third-Party Services &amp; External Links
              </h2>
              <p>
                Vyana may link to third-party services—including government ORS portals, Jan Aushadhi generic stores, commercial e-pharmacies, and emergency calling services. Vyana does not own or operate these external services and is not responsible for their delivery timelines, pricing changes, or independent terms.
              </p>
            </section>

            {/* 7. Termination & Data Rights */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  7
                </span>
                Data Rights, Export &amp; Termination
              </h2>
              <p>
                In accordance with India&apos;s DPDP Act 2023:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-800">
                <li>You may download your entire health data archive at any time via the Profile screen.</li>
                <li>You may permanently delete your account and all associated records in two taps.</li>
                <li>You may revoke shared caregiver access or time-limited doctor links at will.</li>
              </ul>
            </section>

            {/* 8. Contact & Modifications */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  8
                </span>
                Modifications &amp; Contact
              </h2>
              <p>
                We may update these terms as platform capabilities expand. Material changes will be accompanied by an updated effective date. For legal inquiries or questions regarding these terms, reach us at:
              </p>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-950">
                <p><strong>Vyana Health Operations &amp; Support</strong></p>
                <p className="mt-1">
                  Email:{" "}
                  <a
                    href="mailto:piyushgarg@vyanahealth.app"
                    className="text-teal-800 font-bold underline"
                  >
                    piyushgarg@vyanahealth.app
                  </a>
                </p>
                <p className="text-xs text-teal-800 mt-1">
                  Website: https://vyanahealth.app
                </p>
              </div>
            </section>
          </div>

          <div className="border-t border-slate-100 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <Link href="/privacy" className="text-teal-700 font-semibold hover:underline">
              ← View Privacy Policy
            </Link>
            <span>Vyana Health · Terms Version 1.0</span>
          </div>
        </div>
      </main>

      <MedicalDisclaimerFooter />
    </div>
  );
}
