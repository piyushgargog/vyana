import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create an account — Vyana",
  description:
    "Register for a Vyana patient or doctor account. Track medications, OPD tokens, and lab trends in one calm place.",
};

export default function SignupPage() {
  return <SignupForm />;
}
