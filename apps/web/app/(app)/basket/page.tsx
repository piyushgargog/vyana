"use client";

import React, { useMemo, useState } from "react";
import {
  pharmacySearchLinks,
  useActiveItems,
  type LookupLink,
} from "@vyana/shared";
import { AiSafetyBanner } from "@/components/ui-primitives";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LargeTitle,
  Pill,
  Reveal,
  SkeletonLine,
} from "@/components/ui";
import { ChevronDown, ExternalLink, ShoppingBasket } from "lucide-react";

/** One medicine, with the four pharmacy searches a tap away. */
function PharmacyButtons({ query }: { query: string }) {
  const links: LookupLink[] = useMemo(
    () => pharmacySearchLinks(query),
    [query]
  );
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <ButtonLink
          key={link.id}
          variant="secondary"
          size="md"
          className="min-h-[44px]"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Search on ${link.name} for ${query}`}
          icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
        >
          Search on {link.name}
        </ButtonLink>
      ))}
    </div>
  );
}

export default function BasketPage() {
  const {
    data: activeItems,
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useActiveItems();

  const medicines = useMemo(
    () =>
      (activeItems ?? []).map((m) => ({
        id: m.id,
        label: m.strength
          ? `${m.medicine_name} ${m.strength}`
          : m.medicine_name,
      })),
    [activeItems]
  );

  // The first medicine starts open so the four searches are visible at once;
  // tapping another medicine opens its searches instead.
  const [openId, setOpenId] = useState<string | null>(null);
  const openMedId = openId ?? medicines[0]?.id ?? null;

  const [other, setOther] = useState("");

  const titleBlock = (
    <LargeTitle
      eyebrow="Medicine prices"
      title="Compare medicine prices"
      subtitle="Your active medicines, looked up on the pharmacy sites themselves."
    />
  );

  if (itemsLoading) {
    return (
      <div className="space-y-6">
        {titleBlock}
        <Card>
          <div className="space-y-3" aria-label="Loading your medicines">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-3/5" />
          </div>
        </Card>
      </div>
    );
  }

  if (itemsError) {
    return (
      <div className="space-y-6">
        {titleBlock}
        <Card>
          <ErrorState
            title="Could not load your medicines"
            body="Your active prescriptions could not be loaded. Check your connection and try again."
            onRetry={() => refetchItems()}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {titleBlock}

      {medicines.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingBasket aria-hidden="true" />}
            title="No active medicines yet"
            body="Add medicines from your prescriptions, then come back to look them up on the pharmacy sites."
            action={
              <ButtonLink variant="primary" href="/dashboard">
                View my medicines
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <Reveal>
          <Card>
            <CardHeader
              title={`Your medicines (${medicines.length})`}
              trailing="Tap one to see its searches"
            />
            <div className="space-y-3">
              {medicines.map((m) => {
                const open = openMedId === m.id;
                return (
                  <div
                    key={m.id}
                    className="rounded-row border border-separator bg-canvas/60 p-3"
                  >
                    <button
                      type="button"
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
                      aria-expanded={open}
                      aria-label={`Show pharmacy searches for ${m.label}`}
                      onClick={() => setOpenId(open ? "" : m.id)}
                    >
                      <span className="flex items-center gap-2">
                        <Pill tone="accent">{m.label}</Pill>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-label-3 transition-transform ${open ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                    {open && (
                      <div className="mt-3">
                        <PharmacyButtons query={m.label} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[13px] text-label-3">
              Prices are on the shop&apos;s own page. Vyana does not show or
              check prices.
            </p>
          </Card>
        </Reveal>
      )}

      <Reveal>
        <Card>
          <CardHeader title="Any other medicine" />
          <Field
            label="Medicine name"
            placeholder="Type a medicine name"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            aria-label="Any other medicine name"
          />
          {other.trim().length > 0 && (
            <div className="mt-4">
              <PharmacyButtons query={other} />
            </div>
          )}
          <p className="mt-4 text-[13px] text-label-3">
            Prices are on the shop&apos;s own page. Vyana does not show or
            check prices.
          </p>
        </Card>
      </Reveal>

      <AiSafetyBanner feature="prescriptions_basket" />
    </div>
  );
}
