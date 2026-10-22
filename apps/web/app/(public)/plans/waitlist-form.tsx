"use client";

// "Tell me when Family opens" (#305): email + an optional note, one join per email. The email
// is used only for this — the line under the form says so, and nothing else is sent anywhere.
import React, { useState } from "react";
import { track, useJoinWaitlistPage } from "@vyana/shared";
import { Button, Field, TextAreaField } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";

export function WaitlistForm() {
  const join = useJoinWaitlistPage();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<"joined" | "already_on_list" | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || join.isPending) return;
    join.mutate(
      { email: email.trim(), note: note.trim() || undefined },
      {
        onSuccess: (res) => {
          setDone(res.status);
          if (res.status === "joined") track("waitlist_joined");
        },
      }
    );
  };

  if (done === "joined") {
    return (
      <div className="flex items-start gap-3 rounded-tile bg-ok-soft p-4" role="status">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden="true" />
        <div>
          <p className="text-[15px] font-semibold text-label">You are on the list.</p>
          <p className="text-[15px] text-label-2">
            We will email {email.trim()} when Family opens. Nothing is charged —
            there is nothing to pay yet.
          </p>
        </div>
      </div>
    );
  }

  if (done === "already_on_list") {
    return (
      <div className="rounded-tile bg-fill p-4" role="status">
        <p className="text-[15px] font-semibold text-label">
          That email is already on the list.
        </p>
        <p className="text-[15px] text-label-2">
          One entry is enough — we will write to you when Family opens.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field
        id="waitlist-email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextAreaField
        id="waitlist-note"
        label="Anything you want Family to do? (optional)"
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder="For example: we are a family of four"
      />
      {join.isError && (
        <p className="text-[15px] text-danger-text" role="alert">
          {join.error.message}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="min-h-[44px] w-full"
        disabled={join.isPending || !email.trim()}
      >
        Tell me when Family opens
      </Button>
      <p className="text-[13px] text-label-3">
        Your email is used only to tell you when Family opens. It is not shared
        and not used for anything else. The note is read only to understand what
        families want from the plan — please do not put health details in it.
      </p>
    </form>
  );
}
