import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WebAppProviders } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vyanahealth.app"),
  title: "Vyana · व्यान — Complete Healthcare Companion",
  description:
    "Vyana (व्यान) — Complete healthcare platform for patients, doctors, and caregivers in India. Real-time medication reminders, prescription scanning, lab reports, and emergency Medical ID.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Vyana · व्यान — Complete Healthcare Companion",
    description:
      "One-stop healthcare platform in India: dose reminders, scannable Medical ID, lab trend analysis, hospital OPD tokens, and Jan Aushadhi generic savings.",
    url: "https://vyanahealth.app",
    siteName: "Vyana Health",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Vyana · व्यान — Complete Healthcare Companion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vyana · व्यान — Complete Healthcare Companion",
    description:
      "One-stop healthcare platform in India: dose reminders, scannable Medical ID, lab trend analysis, hospital OPD tokens, and Jan Aushadhi generic savings.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <WebAppProviders>{children}</WebAppProviders>
      </body>
    </html>
  );
}
