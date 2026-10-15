import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — Vyana",
  description:
    "Sign in to Vyana to access your health records, medicine reminders, and doctor OPD queue.",
};

export default function LoginPage() {
  return <LoginForm />;
}
