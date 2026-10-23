"use client";

import React, { useMemo, useState } from "react";
import {
  buildMedicalIdQr,
  isShareUrlDead,
  useActiveItems,
  useCreateShareLink,
  useEmergencyContacts,
  useMyProfile,
  useShareLinks,
} from "@vyana/shared";
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  LargeTitle,
  ListGroup,
  ListRow,
  Pill,
  SkeletonLine,
} from "@/components/ui";
import { QrCodeSvg } from "@/components/ui-primitives";
import { useVyanaWeb } from "@/components/providers";

export default function MedicalIdPage() {
  const { showToast } = useVyanaWeb();

  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useMyProfile();
  const { data: activeItems = [], isLoading: itemsLoading } = useActiveItems();
  const { data: contacts = [], isLoading: contactsLoading } = useEmergencyContacts();
  const { data: shareLinks = [] } = useShareLinks();
  const createShareMutation = useCreateShareLink();

  const [createdUrl, setShareUrl] = useState<string | null>(null);
  // A link turned off (or expired) in Profile must not keep showing here as active.
  const shareUrl = createdUrl && !isShareUrlDead(shareLinks, createdUrl) ? createdUrl : null;

  const primaryContact = contacts[0] ? { name: contacts[0].name, phone: contacts[0].phone } : null;

  const qrData = useMemo(
    () =>
      buildMedicalIdQr(
        {
          full_name: profile?.full_name ?? null,
          blood_group: profile?.blood_group ?? null,
          allergies: profile?.allergies ?? [],
        },
        activeItems.map((item) => ({ medicine_name: item.medicine_name, strength: item.strength })),
        primaryContact,
      ),
    [profile, activeItems, primaryContact],
  );

  const handleCreateShareLink = async () => {
    try {
      const res = await createShareMutation.mutateAsync({ kind: "medical_id", ttl_hours: 24 });
      setShareUrl(res.url || `${window.location.origin}/share/${res.token}`);
      showToast("24-hour doctor share link generated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not generate share link", "error");
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied for your doctor", "success");
    } catch {
      showToast("Could not copy the link", "error");
    }
  };

  const allergies = profile?.allergies ?? [];
  const loading = profileLoading || itemsLoading || contactsLoading;

  return (
    <div className="space-y-6">
      <LargeTitle eyebrow="Emergency · Works offline" title="Medical ID" />

      <Card className="bg-ok-soft">
        <CardHeader title="Offline scannable" />
        <p className="text-[14px] leading-relaxed text-label-2">
          Self-contained offline QR code. Any phone camera or first responder can scan it to read
          your name, blood group, allergies, medicines and one emergency contact as plain text,
          without internet. A long medicine list is cut, and the text then says how many more
          there are.
        </p>
      </Card>

      {profileError ? (
        <ErrorState
          title="Your Medical ID could not be loaded"
          body="Check your connection and try again."
          retryLabel="Try again"
          onRetry={() => void refetchProfile()}
        />
      ) : (
        <>
          <Card className="flex flex-col items-center gap-4">
            {loading ? (
              <SkeletonLine className="h-[270px] w-[270px] rounded-xl" />
            ) : (
              <QrCodeSvg data={qrData} size={270} label="Offline Emergency Medical ID QR Code" />
            )}
            <p className="text-center text-[13px] text-label-3">
              Any phone camera shows the details as plain text, no internet needed. The 24h link
              below needs internet.
            </p>
          </Card>

          <ListGroup header="Emergency details">
            <ListRow
              title="Name"
              value={loading ? "…" : profile?.full_name || "—"}
            />
            <ListRow
              title="Blood group"
              trailing={<Pill tone="danger">{loading ? "…" : profile?.blood_group || "—"}</Pill>}
            />
            <ListRow
              title="Known allergies"
              subtitle={
                loading
                  ? "…"
                  : allergies.length > 0
                    ? allergies.join(", ")
                    : "No known drug allergies recorded"
              }
            />
          </ListGroup>

          <ListGroup header={`Active medicines (${activeItems.length})`}>
            {loading ? (
              <ListRow title="Loading…" />
            ) : activeItems.length === 0 ? (
              <ListRow title="No active medicines" />
            ) : (
              activeItems.map((item) => (
                <ListRow
                  key={item.id}
                  title={`${item.medicine_name} ${item.strength || ""}`.trim()}
                  subtitle={item.frequency || undefined}
                  value={item.dose || "1 dose"}
                />
              ))
            )}
          </ListGroup>

          <ListGroup header="Emergency contact">
            <ListRow
              title={loading ? "…" : primaryContact ? primaryContact.name : "No contact recorded"}
              subtitle={loading ? undefined : primaryContact ? primaryContact.phone : "Add one in your health profile."}
            />
          </ListGroup>
        </>
      )}

      <Card>
        <CardHeader title="Doctor share link" trailing="24h" />
        <p className="text-[14px] leading-relaxed text-label-3">
          Generates a 24-hour expiring link to your Medical ID details (name, blood group,
          allergies, medicines and one emergency contact) for doctors and hospitals.
        </p>
        {shareUrl ? (
          <div className="mt-3 space-y-3 rounded-2xl bg-accent-soft p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-accent-strong">
              Active 24h expiring link
            </p>
            <p className="break-all text-[14px] font-semibold text-accent-strong">{shareUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleCopyLink}>
                Copy link
              </Button>
              <Button
                variant="plain"
                onClick={() => window.open(shareUrl, "_blank", "noopener")}
              >
                Preview page
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <Button onClick={handleCreateShareLink} disabled={createShareMutation.isPending}>
              {createShareMutation.isPending ? "Generating…" : "Create link (24h)"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="bg-accent-soft">
        <CardHeader title="Lock screen wallpaper" />
        <p className="text-[14px] leading-relaxed text-label-2">
          Take a screenshot of this QR screen and set it as your lock screen wallpaper. In an
          emergency, first responders can scan your phone without unlocking it.
        </p>
      </Card>
    </div>
  );
}
