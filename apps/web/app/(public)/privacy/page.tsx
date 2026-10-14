import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { MedicalDisclaimerFooter } from "@/components/ui-primitives";
import { BrandMark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy · Vyana Health",
  description:
    "Learn what data Vyana stores, why we store it, how AI is safely used, who can access your records, and how to download or delete your data under the DPDP Act 2023.",
};

export default function PrivacyPolicyPage() {
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
              Written with India&apos;s DPDP Act 2023 in mind · Plain-Language Privacy Notice
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Effective Date: October 2026 · Target Address:{" "}
              <a
                href="https://vyanahealth.app"
                className="text-teal-700 font-semibold underline"
              >
                https://vyanahealth.app
              </a>
            </p>
          </div>

          <div className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-700">
            {/* 1. Data Vyana stores */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  1
                </span>
                Data Vyana Stores
              </h2>
              <p>
                Vyana collects and stores only the minimum health and identity
                information necessary to manage your care. Specifically, Vyana stores:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-800">
                <li>
                  <strong>Profile:</strong> your name, contact phone number, date of birth, blood group, preferred language, and documented allergies.
                </li>
                <li>
                  <strong>Prescriptions:</strong> scanned and uploaded prescription images, PDF documents, digitized medicine names, strengths, dosages, schedules, and duration.
                </li>
                <li>
                  <strong>Reports:</strong> uploaded laboratory blood and diagnostic report documents, numerical test values, reference intervals, flags, and clinical summaries.
                </li>
                <li>
                  <strong>Vitals:</strong> physiological self-measurements such as blood pressure, heart rate, blood glucose, weight, and SpO2 readings over time.
                </li>
                <li>
                  <strong>Doses:</strong> scheduled medicine intake times, logs of doses marked as taken or skipped, adherence percentages, and refill status.
                </li>
                <li>
                  <strong>Chats:</strong> health assistant questions and cited responses exchanged within the application.
                </li>
              </ul>
            </section>

            {/* 2. Why it stores that data */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  2
                </span>
                Why Vyana Stores That Data
              </h2>
              <p>
                Every piece of information stored has a clear, patient-centric
                purpose:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-800">
                <li>
                  To remind you when to take scheduled medicines and alert you before your medicine supplies run out.
                </li>
                <li>
                  To track laboratory test trends over time so you and your doctor can observe improvements or changes.
                </li>
                <li>
                  To generate an instant, offline-scannable emergency Medical ID QR code for first responders during critical situations.
                </li>
                <li>
                  To enable cross-pharmacy medicine availability and Jan Aushadhi price discovery.
                </li>
                <li>
                  To support OPD appointment bookings and digital token generation across the hospital departments listed in the app.
                </li>
              </ul>
              <p className="text-xs text-slate-500 italic">
                We never sell your data, use your health records for commercial advertising, or share your identity with third-party data brokers.
              </p>
            </section>

            {/* 3. AI usage */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  3
                </span>
                How Artificial Intelligence (AI) Is Used
              </h2>
              <p>
                Vyana incorporates AI to extract text from physical prescriptions, summarize complex lab reports, and provide cited health answers. We enforce strict privacy and clinical safeguards:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-800">
                <li>
                  <strong>Document and photo processing:</strong> A photo you upload is read by an AI model from a provider that keeps no copy of the data (zero data retention). After it is read, names and contact details are removed from the text before any further AI step.
                </li>
                <li>
                  <strong>Checked answers:</strong> all AI-generated health advice is verified against clinical blocklists and curated health sources. The AI is strictly barred from diagnosing conditions or recommending prescription drug dosages.
                </li>
                <li>
                  <strong>Always requires user confirmation:</strong> AI extraction is strictly assistive. All extracted medicines, dosages, and lab numbers are presented in an editable review screen and require your explicit confirmation before being saved to your records.
                </li>
              </ul>
            </section>

            {/* 4. Who can see the data */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  4
                </span>
                Who Can See Your Data
              </h2>
              <p>
                By default, your health records are completely private to you. They can only ever be seen by:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-800">
                <li>
                  <strong>You:</strong> the authenticated account holder on your mobile device or web portal.
                </li>
                <li>
                  <strong>A caregiver you explicitly invite:</strong> a family member or guardian who inputs your temporary 6-digit invite code. Caregivers receive read-only visibility into dose adherence, active medicines, and emergency alerts. You can revoke their access at any moment.
                </li>
                <li>
                  <strong>Doctors of your booked hospital department:</strong> doctors who belong to the hospital department where you booked an appointment can see your health records (medicines, prescriptions, reports and conditions) so they can treat you. A cancelled appointment ends this access.
                </li>
                <li>
                  <strong>A doctor you choose to share with:</strong> either via an in-person consultation token or through a time-limited (24-hour) emergency share link or Medical ID QR code that you actively generate. You can revoke share links at any time.
                </li>
                <li>
                  <strong>The Vyana team (administrators):</strong> our administrative team can access records only when necessary to verify doctor credentials on official registers or to give support upon your request.
                </li>
              </ul>
              <p className="text-xs text-slate-500">
                Access rules inside our database are designed to stop anyone else from viewing or editing your data.
              </p>

              {/* Data Processors */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Third-Party Data Processors
                </h3>
                <p className="text-xs text-slate-600">
                  Vyana relies on the following infrastructure and service providers to process and deliver our services:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
                  <li>
                    <strong>Supabase:</strong> database and file storage, Mumbai.
                  </li>
                  <li>
                    <strong>Amazon Web Services:</strong> our server, Mumbai.
                  </li>
                  <li>
                    <strong>Cloudflare:</strong> in front of the site.
                  </li>
                  <li>
                    <strong>Groq:</strong> AI models, zero data retention.
                  </li>
                  <li>
                    <strong>Resend:</strong> account emails.
                  </li>
                  <li>
                    <strong>TinyFish:</strong> searches public web pages only (pharmacies, hospitals, the NMC register) and never receives your health data.
                  </li>
                </ul>
              </div>
            </section>

            {/* 5. How to download and delete data */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  5
                </span>
                How to Download and Delete Your Data
              </h2>
              <p>
                In compliance with India&apos;s Digital Personal Data Protection (DPDP) Act 2023, you retain absolute ownership over your health records:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-800">
                <li>
                  <strong>Download your data:</strong> open the <strong>Profile</strong> screen on mobile or web and tap <em>&ldquo;Download My Data (JSON)&rdquo;</em>. This immediately bundles your complete profile, active prescriptions, lab report records, vitals history, and dose logs into an exportable JSON file.
                </li>
                <li>
                  <strong>Permanent deletion:</strong> open the <strong>Profile</strong> screen and tap <em>&ldquo;Delete My Account &amp; Data&rdquo;</em>. Following a mandatory confirmation step, our system permanently erases your account, database records, and all uploaded medical files from storage. This action is irreversible.
                </li>
              </ul>
            </section>

            {/* 6. Contact */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                  6
                </span>
                Contact &amp; Grievance Redressal
              </h2>
              <p>
                If you have questions regarding this Privacy Policy, your personal health information, or wish to exercise your data rights, please contact our data fiduciary team directly at:
              </p>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-950">
                <p><strong>Vyana Health Data Protection Team</strong></p>
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
                  Web: https://vyanahealth.app
                </p>
              </div>
            </section>

            {/* 7. Exact medical disclaimer */}
            <section className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2 text-red-950">
              <h3 className="font-bold text-red-900 uppercase tracking-wider text-xs">
                Essential Medical Disclaimer
              </h3>
              <p className="font-semibold text-sm sm:text-base">
                &ldquo;Vyana is not a substitute for professional medical advice; in an emergency call 108&rdquo;
              </p>
              <p className="text-xs text-red-900 leading-relaxed">
                Always consult a registered medical practitioner or qualified healthcare provider regarding any medical condition, diagnosis, or change in prescription medications. Never delay seeking urgent medical care because of information provided by this application.
              </p>
            </section>
          </div>

          <div className="border-t border-slate-100 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <Link href="/terms" className="text-teal-700 font-semibold hover:underline">
              View Terms of Service →
            </Link>
            <span>Vyana Health · DPDP Notice Version 1.0</span>
          </div>
        </div>
      </main>

      <MedicalDisclaimerFooter />
    </div>
  );
}
