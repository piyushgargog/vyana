import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import {
  Card,
  LargeTitle,
  SiteFooter,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Terms of Service · Vyana",
  description:
    "Plain-language Terms of Service for Vyana. Understand user responsibilities, AI assistive tools, and medical disclaimers.",
};

const SECTIONS = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "nature", title: "2. Nature of the Platform" },
  { id: "disclaimer", title: "3. Medical Disclaimer" },
  { id: "ai-verification", title: "4. AI & Human Verification" },
  { id: "user-responsibilities", title: "5. User Responsibilities" },
  { id: "third-party", title: "6. Third-Party Services" },
  { id: "data-rights", title: "7. Data Rights & Termination" },
  { id: "contact", title: "8. Modifications & Contact" },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      <PublicHeader />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <LargeTitle
            eyebrow="Terms of Service"
            title="Terms of Service"
            subtitle="Transparent, plain-language user agreement and responsibilities for using Vyana."
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">
          {/* Main Long-Form Content Column (Max Width 68ch) */}
          <article className="w-full max-w-[68ch] flex-1 space-y-8">
            <Card className="p-6 sm:p-10 space-y-8 text-[15px] sm:text-[16px] leading-relaxed text-label-2">
              {/* 1. Introduction */}
              <section id="acceptance" className="scroll-mt-24 space-y-3">
                <h2 className="text-[20px] font-semibold tracking-tight text-label flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong text-xs font-bold">
                    1
                  </span>
                  Acceptance of Terms
                </h2>
                <p>
                  By creating an account, accessing, or using the Vyana mobile or
                  web application (available at <strong>https://vyanahealth.app</strong>),
                  you agree to be bound by these Terms of Service and our{" "}
                  <Link href="/privacy" className="text-accent-strong underline font-semibold">
                    Privacy Policy
                  </Link>
                  . If you do not agree with these terms, please discontinue use of
                  the service.
                </p>
              </section>

              {/* 2. Nature of Service */}
              <section id="nature" className="scroll-mt-24 space-y-3 border-t border-separator pt-6">
                <h2 className="text-[20px] font-semibold tracking-tight text-label flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong text-xs font-bold">
                    2
                  </span>
                  Nature of the Platform
                </h2>
                <p>
                  Vyana is an informational digital healthcare management platform. It offers:
                </p>
                <ul className="list-disc pl-6 space-y-1.5 text-label">
                  <li>Personal medication schedule tracking and refill reminder alerts.</li>
                  <li>Prescription and laboratory report scanning and digitized summarization.</li>
                  <li>Emergency medical summary profile and offline-scannable QR code generation.</li>
                  <li>Transparent price comparison across Indian online pharmacies and Jan Aushadhi generic stores.</li>
                  <li>Hospital OPD discovery and token booking assistance.</li>
                </ul>
                <p className="text-[13px] text-label-3 pt-1">
                  Vyana acts as an organizational and tracking tool for your existing medical records; it is not a licensed hospital, pharmacy, or diagnostic laboratory.
                </p>
              </section>

              {/* 3. Essential Medical Disclaimer */}
              <section id="disclaimer" className="scroll-mt-24 rounded-card border border-danger-soft bg-danger-soft p-5 space-y-2 text-danger-text">
                <h2 className="text-[20px] font-semibold tracking-tight flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-danger/20 text-danger-text text-xs font-bold">
                    3
                  </span>
                  Essential Medical &amp; Emergency Disclaimer
                </h2>
                <p className="font-semibold text-[15px] sm:text-[16px]">
                  &ldquo;Vyana is not a substitute for professional medical advice; in an emergency call 108&rdquo;
                </p>
                <p className="text-[13px] leading-relaxed">
                  The content, AI summaries, and tools in Vyana are for informational purposes only. Vyana does not provide medical diagnosis, clinical treatment plans, or prescription authoring for self-medication. Never disregard professional clinical advice or delay seeking urgent medical evaluation because of information presented on Vyana. If you or someone around you experiences acute chest pain, severe trauma, or breathing distress, dial 108 or proceed to the nearest emergency hospital immediately.
                </p>
              </section>

              {/* 4. AI Assistive Features & Human-in-the-Loop */}
              <section id="ai-verification" className="scroll-mt-24 space-y-3 border-t border-separator pt-6">
                <h2 className="text-[20px] font-semibold tracking-tight text-label flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong text-xs font-bold">
                    4
                  </span>
                  Artificial Intelligence &amp; Human-in-the-Loop Verification
                </h2>
                <p>
                  Vyana uses artificial intelligence models to extract text from prescription documents and parse numerical results from diagnostic lab reports:
                </p>
                <ul className="list-disc pl-6 space-y-1.5 text-label">
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
              <section id="user-responsibilities" className="scroll-mt-24 space-y-3 border-t border-separator pt-6">
                <h2 className="text-[20px] font-semibold tracking-tight text-label flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong text-xs font-bold">
                    5
                  </span>
                  User Responsibilities &amp; Account Security
                </h2>
                <ul className="list-disc pl-6 space-y-1.5 text-label">
                  <li>You are responsible for keeping your login credentials secure.</li>
                  <li>You agree to upload only your own medical documents, or records of family members for whom you have legal authorization to act as a caregiver.</li>
                  <li>You must not use the platform to transmit unlawful material, impersonate a licensed medical practitioner, or circumvent security policies.</li>
                </ul>
              </section>

              {/* 6. External Links & Third-Party Services */}
              <section id="third-party" className="scroll-mt-24 space-y-3 border-t border-separator pt-6">
                <h2 className="text-[20px] font-semibold tracking-tight text-label flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong text-xs font-bold">
                    6
                  </span>
                  Third-Party Services &amp; External Links
                </h2>
                <p>
                  Vyana may link to third-party services—including government ORS portals, Jan Aushadhi generic stores, commercial e-pharmacies, and emergency calling services. Vyana does not own or operate these external services and is not responsible for their delivery timelines, pricing changes, or independent terms.
                </p>
              </section>

              {/* 7. Termination & Data Rights */}
              <section id="data-rights" className="scroll-mt-24 space-y-3 border-t border-separator pt-6">
                <h2 className="text-[20px] font-semibold tracking-tight text-label flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong text-xs font-bold">
                    7
                  </span>
                  Data Rights, Export &amp; Termination
                </h2>
                <p>
                  In accordance with India&apos;s DPDP Act 2023:
                </p>
                <ul className="list-disc pl-6 space-y-1.5 text-label">
                  <li>You may download your entire health data archive at any time via the Profile screen.</li>
                  <li>You may permanently delete your account and all associated records in two taps.</li>
                  <li>You may revoke shared caregiver access or time-limited doctor links at will.</li>
                </ul>
              </section>

              {/* 8. Contact & Modifications */}
              <section id="contact" className="scroll-mt-24 space-y-3 border-t border-separator pt-6">
                <h2 className="text-[20px] font-semibold tracking-tight text-label flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-strong text-xs font-bold">
                    8
                  </span>
                  Modifications &amp; Contact
                </h2>
                <p>
                  We may update these terms as platform capabilities expand. Material changes will be accompanied by an updated effective date. For legal inquiries or questions regarding these terms, reach us at:
                </p>
                <div className="rounded-card border border-separator bg-fill/50 p-4 text-[14px] text-label">
                  <p><strong>Vyana Health Operations &amp; Support</strong></p>
                  <p className="mt-1">
                    Email:{" "}
                    <a
                      href="mailto:piyushgarg@vyanahealth.app"
                      className="text-accent-strong font-semibold underline"
                    >
                      piyushgarg@vyanahealth.app
                    </a>
                  </p>
                  <p className="text-[13px] text-label-3 mt-1">
                    Website: https://vyanahealth.app
                  </p>
                </div>
              </section>

              <div className="border-t border-separator pt-6 flex flex-wrap items-center justify-between gap-4 text-[13px] text-label-3">
                <Link href="/privacy" className="text-accent-strong font-semibold hover:underline">
                  ← View Privacy Policy
                </Link>
                <span>Vyana Health · Terms Version 1.0</span>
              </div>
            </Card>
          </article>

          {/* Desktop "On this page" Anchor Navigation Sidebar */}
          <aside className="hidden lg:block lg:w-64 shrink-0 sticky top-24 self-start space-y-3">
            <div className="rounded-card border border-separator bg-surface p-4 shadow-xs space-y-3">
              <p className="px-1 text-[13px] font-semibold text-label">
                On this page
              </p>
              <nav aria-label="Terms of service sections" className="space-y-1">
                {SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="block rounded-row px-2.5 py-1.5 text-[13px] text-label-2 transition-colors hover:bg-fill hover:text-label"
                  >
                    {sec.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
