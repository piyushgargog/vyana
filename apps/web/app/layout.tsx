import type { Metadata, Viewport } from "next";
import "./globals.css";
import { KeyboardGuard } from "@/components/keyboard-guard";
import { WebAppProviders } from "@/components/providers";

/**
 * `interactiveWidget: "resizes-content"` (#245: the page shrinks when the phone keyboard opens, so a field at the
 * bottom is never hidden under it) is deliberately not set here. WebKit does not know that viewport key and logs
 * it as a console error on every page load (#362), so the key is kept out of the static meta tag and
 * `KeyboardGuard` adds it at runtime in Chromium, the engine that understands it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://vyanahealth.app"),
  title: "Vyana: your health, in one calm place",
  description:
    "Prescriptions and reminders, lab reports in plain words, the best price for your medicines, hospital tokens and help in an emergency. With an assistant that shows the source of every answer.",
  openGraph: {
    title: "Vyana: your health, in one calm place",
    description:
      "Prescriptions and reminders, lab reports in plain words, the best price for your medicines, hospital tokens and help in an emergency. With an assistant that shows the source of every answer.",
    url: "https://vyanahealth.app",
    siteName: "Vyana",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vyana: your health, in one calm place",
    description:
      "Prescriptions and reminders, lab reports in plain words, the best price for your medicines, hospital tokens and help in an emergency. With an assistant that shows the source of every answer.",
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
      className="h-full"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "globalThis.__zod_globalConfig={jitless:true};",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-label">
        <WebAppProviders>{children}</WebAppProviders>
        <KeyboardGuard />
      </body>
    </html>
  );
}
