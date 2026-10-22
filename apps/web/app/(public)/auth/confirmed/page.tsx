import type { Metadata } from "next";
import { ConfirmedEmail } from "./confirmed-email";

export const metadata: Metadata = {
  title: "Email confirmed — Vyana",
  description:
    "Your Vyana email address is confirmed. Sign in or continue to DPDP consent.",
};

export default function ConfirmedEmailPage() {
  return <ConfirmedEmail />;
}
