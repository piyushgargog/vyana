import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Medical Record · Vyana",
  description: "Temporary, time-limited emergency medical record access.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShareRecordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
