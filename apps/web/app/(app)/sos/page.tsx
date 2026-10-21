"use client";

import React, { useCallback, useState } from "react";
import {
  EMERGENCY,
  useEmergencyContacts,
  useNearbyHospitals,
  useSos,
} from "@vyana/shared";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LargeTitle,
  ListGroup,
  ListRow,
  Pill,
  Sheet,
  SkeletonLine,
} from "@/components/ui";
import { Loader2, MapPin, Phone, Send } from "lucide-react";

type Coords = { lat: number; lng: number };

export default function SosPage() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  const nearby = useNearbyHospitals();
  const sos = useSos();
  const {
    data: savedContacts = [],
    isLoading: contactsLoading,
    isError: contactsError,
    refetch: refetchContacts,
  } = useEmergencyContacts();

  const handleUseLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationDenied(true);
      return;
    }
    setLocating(true);
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setLocating(false);
        nearby.mutate(c);
      },
      () => {
        setLocating(false);
        setLocationDenied(true);
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [nearby]);

  const handleRetryHospitals = useCallback(() => {
    if (coords) nearby.mutate(coords);
  }, [nearby, coords]);

  const handlePrepareAlert = useCallback(async () => {
    if (!coords) return;
    setAlertError(null);
    try {
      await sos.mutateAsync({ lat: coords.lat, lng: coords.lng });
      setSheetOpen(false);
    } catch (err) {
      setAlertError(
        err instanceof Error ? err.message : "Could not prepare the alert"
      );
    }
  }, [sos, coords]);

  const hospitals = nearby.data?.hospitals ?? [];
  const area = nearby.data?.area ?? null;
  const sosContacts = sos.data?.contacts ?? [];
  const smsBody = sos.data?.sms_body ?? "";
  const alertReady = sos.isSuccess;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <LargeTitle title="Emergency" />

      {/* Call for help */}
      <Card>
        <CardHeader title="Call for help" />
        <div className="flex flex-col gap-3">
          <ButtonLink
            variant="destructive"
            size="lg"
            className="w-full"
            href={`tel:${EMERGENCY.ambulance}`}
          >
            Call 108 (ambulance)
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            size="lg"
            className="w-full"
            href={`tel:${EMERGENCY.all}`}
          >
            Call 112 (all emergencies)
          </ButtonLink>
        </div>
      </Card>

      {/* Find blood */}
      <Card>
        <CardHeader title="Need blood?" />
        <p className="mb-3 text-[15px] text-label-2">See which blood banks list stock for your blood group, and keep track of who you called.</p>
        <ButtonLink variant="secondary" size="lg" className="w-full" href="/blood">
          Find blood
        </ButtonLink>
      </Card>

      {/* Find hospitals near me */}
      <Card>
        <CardHeader title="Find hospitals near me" />
        {locating ? (
          <div className="space-y-3" aria-label="Getting your location">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-3/5" />
          </div>
        ) : locationDenied ? (
          <div className="flex items-start gap-3">
            <Pill tone="warn">Warning</Pill>
            <p className="text-[15px] text-label-2">Location is off. Turn it on in your browser to find hospitals near you, or call 108.</p>
          </div>
        ) : nearby.isPending ? (
          <div className="space-y-3" aria-label="Finding nearby hospitals">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-3/5" />
          </div>
        ) : nearby.isError ? (
          <ErrorState
            title="Could not find hospitals"
            body="Check your connection or try again."
            onRetry={handleRetryHospitals}
          />
        ) : nearby.data ? (
          <>
            {area && (
              <p className="mb-3 text-[15px] text-label-3">Near {area}</p>
            )}
            {hospitals.length === 0 ? (
              <EmptyState
                icon={<MapPin aria-hidden="true" />}
                title="No hospitals found nearby"
                body="Call 108 now if this is an emergency."
              />
            ) : (
              <ListGroup>
                {hospitals.map((h, idx) => (
                  <ListRow
                    key={`${h.name}-${idx}`}
                    title={h.name}
                    subtitle={h.address ?? undefined}
                    trailing={
                      <span className="flex shrink-0 flex-wrap gap-1">
                        {h.has_emergency === true && (
                          <Pill tone="accent">Emergency</Pill>
                        )}
                        {h.has_icu === true && (
                          <Pill tone="neutral">ICU</Pill>
                        )}
                      </span>
                    }
                  />
                ))}
              </ListGroup>
            )}
            {hospitals.length > 0 && (
              <div className="mt-3 space-y-3">
                {hospitals.map((h, idx) => (
                  <div key={`${h.name}-actions-${idx}`}>
                    <p className="text-[15px] font-semibold text-label">
                      {h.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {h.phone && (
                        <a
                          href={`tel:${h.phone}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-medium text-accent"
                        >
                          <Phone
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Call
                        </a>
                      )}
                      <a
                        href={h.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-medium text-accent"
                      >
                        <MapPin
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        Open in Maps
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleUseLocation}
          >
            Use my location
          </Button>
        )}
      </Card>

      {/* Alert my emergency contacts */}
      <Card>
        <CardHeader title="Alert my emergency contacts" />
        <p className="mb-3 text-[15px] text-label-2">
          This records an emergency request and prepares a message for your
          contacts. It does not call anyone.
        </p>
        {alertReady ? (
          <>
            <Pill tone="ok">Alert prepared</Pill>
            {sosContacts.length === 0 ? (
              <div className="mt-3">
                <p className="text-[15px] text-label-2">
                  You have no emergency contacts saved. Add them in your
                  health profile.
                </p>
                <ButtonLink
                  variant="secondary"
                  size="md"
                  className="mt-3"
                  href="/onboarding"
                >
                  Open health profile
                </ButtonLink>
              </div>
            ) : (
              <ListGroup header="Your contacts" className="mt-3">
                {sosContacts.map((c) => (
                  <ListRow
                    key={c.phone}
                    title={c.name}
                    subtitle={c.phone}
                    trailing={
                      <span className="flex shrink-0 gap-3">
                        <a
                          href={`sms:${c.phone}?&body=${encodeURIComponent(smsBody)}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-medium text-accent"
                        >
                          <Send
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Send message
                        </a>
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-medium text-accent"
                        >
                          <Phone
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Call
                        </a>
                      </span>
                    }
                  />
                ))}
              </ListGroup>
            )}
          </>
        ) : (
          <>
            {alertError && (
              <div className="mb-3">
                <Pill tone="warn">{alertError}</Pill>
              </div>
            )}
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => setSheetOpen(true)}
              disabled={!coords}
            >
              Prepare the alert
            </Button>
            {!coords && (
              <p className="mt-2 text-[15px] text-label-3">
                Tap &ldquo;Use my location&rdquo; first.
              </p>
            )}
          </>
        )}
      </Card>

      {/* Saved contacts */}
      <Card>
        <CardHeader title="Saved contacts" />
        {contactsLoading ? (
          <div className="space-y-3" aria-label="Loading your contacts">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
          </div>
        ) : contactsError ? (
          <ErrorState
            title="Could not load contacts"
            body="Check your connection or try again."
            onRetry={() => refetchContacts()}
          />
        ) : savedContacts.length === 0 ? (
          <EmptyState
            icon={<Phone aria-hidden="true" />}
            title="No emergency contacts yet"
            body="Add a contact in your health profile so we can reach them."
            action={
              <ButtonLink variant="secondary" href="/onboarding">
                Open health profile
              </ButtonLink>
            }
          />
        ) : (
          <ListGroup>
            {savedContacts.map((c) => (
              <ListRow
                key={c.id}
                title={c.name}
                subtitle={c.phone}
                trailing={
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-medium text-accent"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Call
                  </a>
                }
              />
            ))}
          </ListGroup>
        )}
      </Card>

      {/* Alert confirmation sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Alert your contacts?"
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handlePrepareAlert}
              disabled={sos.isPending}
            >
              {sos.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Preparing…
                </span>
              ) : (
                "Prepare the alert"
              )}
            </Button>
            <Button
              variant="plain"
              size="md"
              className="w-full"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <p className="text-[15px] text-label-2">
          This records an emergency request and prepares a message for your
          contacts. It does not call anyone.
        </p>
      </Sheet>
    </div>
  );
}
