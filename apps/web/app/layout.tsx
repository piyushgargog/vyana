import type { Metadata } from "next";
import "./globals.css";
import { WebAppProviders } from "@/components/providers";


export const metadata: Metadata = {
  metadataBase: new URL("https://vyanahealth.app"),
  title: "Vyana: your health, in one calm place",
  description:
    "Prescriptions and reminders, lab reports in plain words, the best price for your medicines, hospital tokens and help in an emergency. With an assistant that shows the source of every answer.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Vyana: your health, in one calm place",
    description:
      "Prescriptions and reminders, lab reports in plain words, the best price for your medicines, hospital tokens and help in an emergency. With an assistant that shows the source of every answer.",
    url: "https://vyanahealth.app",
    siteName: "Vyana",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Vyana: your health, in one calm place",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vyana: your health, in one calm place",
    description:
      "Prescriptions and reminders, lab reports in plain words, the best price for your medicines, hospital tokens and help in an emergency. With an assistant that shows the source of every answer.",
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
      className="h-full"
    >
      <body className="min-h-full flex flex-col bg-canvas text-label">
        <WebAppProviders>{children}</WebAppProviders>
      </body>
    </html>
  );
}
