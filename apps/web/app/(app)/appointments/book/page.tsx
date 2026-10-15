import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, SkeletonLine } from "@/components/ui";
import { AppointmentBookForm } from "./appointment-book-form";

export const metadata: Metadata = {
  title: "Book OPD Token · Vyana",
  description:
    "Select an affiliated hospital and department to book an outpatient department (OPD) queue token.",
};

function BookingSkeletonFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="h-10 w-64" />
        <SkeletonLine className="h-4 w-96 max-w-full" />
      </div>

      <Card className="space-y-4">
        <SkeletonLine className="h-6 w-44" />
        <SkeletonLine className="h-14 w-full" />
        <SkeletonLine className="h-14 w-full" />
      </Card>

      <Card className="space-y-4">
        <SkeletonLine className="h-6 w-52" />
        <SkeletonLine className="h-12 w-full" />
      </Card>
    </div>
  );
}

export default function AppointmentBookPage() {
  return (
    <Suspense fallback={<BookingSkeletonFallback />}>
      <AppointmentBookForm />
    </Suspense>
  );
}
