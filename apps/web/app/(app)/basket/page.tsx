"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useActiveItems,
  useBasketCompare,
  useBasketJob,
  type PharmacyBasket,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { AiSafetyBanner } from "@/components/ui-primitives";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  LargeTitle,
  ListGroup,
  ListRow,
  Pill,
  Reveal,
  Sheet,
  SkeletonLine,
  cn,
} from "@/components/ui";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  ShoppingBasket,
} from "lucide-react";

/** The basket API prices at most 10 items per request. */
const MAX_ITEMS = 10;

function formatSource(source: string): string {
  switch (source) {
    case "1mg":
      return "Tata 1mg";
    case "pharmeasy":
      return "PharmEasy";
    case "netmeds":
      return "Netmeds";
    case "apollo":
      return "Apollo Pharmacy";
    case "janaushadhi":
      return "Jan Aushadhi";
    default:
      return source.toUpperCase();
  }
}

function formatTotal(total: number | null): string {
  return total === null ? "—" : `₹${total.toFixed(2)}`;
}

function StatusPill({ status }: { status: PharmacyBasket["status"] }) {
  switch (status) {
    case "ok":
      return <Pill tone="ok">Available</Pill>;
    case "partial":
      return <Pill tone="warn">Partial</Pill>;
    case "pending":
      return <Pill tone="neutral">Checking</Pill>;
    case "not_found":
      return <Pill tone="neutral">Not found</Pill>;
    case "timeout":
      return <Pill tone="warn">Timed out</Pill>;
    case "error":
      return <Pill tone="danger">Failed</Pill>;
  }
}

export default function BasketPage() {
  const { showToast } = useVyanaWeb();
  const {
    data: activeItems,
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useActiveItems();

  const items = useMemo(
    () =>
      (activeItems ?? []).slice(0, MAX_ITEMS).map((m) => ({
        id: m.id,
        medicine: m.medicine_name,
        strength: m.strength ?? undefined,
        quantity: 1,
      })),
    [activeItems]
  );
  const truncated = (activeItems?.length ?? 0) > MAX_ITEMS;

  const compareMutation = useBasketCompare();
  const jobId = compareMutation.data?.job_id;
  const {
    data: jobData,
    isError: jobError,
    refetch: refetchJob,
  } = useBasketJob(jobId);

  const [orderBasket, setOrderBasket] = useState<PharmacyBasket | null>(null);

  const handleStart = useCallback(() => {
    if (items.length === 0) return;
    compareMutation.mutate(
      {
        items: items.map(({ medicine, strength, quantity }) => ({
          medicine,
          strength,
          quantity,
        })),
      },
      {
        onError: (err) =>
          showToast(
            err instanceof Error ? err.message : "Could not price the basket",
            "error"
          ),
      }
    );
  }, [compareMutation, items, showToast]);

  // Start one price check as soon as the active medicines are known.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (itemsLoading || items.length === 0) return;
    startedRef.current = true;
    handleStart();
  }, [handleStart, itemsLoading, items.length]);

  const currentResult = jobData ?? compareMutation.data ?? null;
  const isRunning = currentResult?.status === "running";
  const recheckDisabled = compareMutation.isPending || isRunning;

  const handleConfirmOrder = useCallback(() => {
    const url = orderBasket?.checkout_url;
    if (!url) {
      showToast("No checkout link available for this pharmacy", "warning");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    setOrderBasket(null);
  }, [orderBasket, showToast]);

  const titleBlock = (
    <LargeTitle
      eyebrow="Medicine prices"
      title="Basket"
      subtitle="Live prices for your active medicines, across pharmacies."
      actions={
        <Button
          variant="secondary"
          size="md"
          icon={
            recheckDisabled ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )
          }
          onClick={handleStart}
          disabled={recheckDisabled || items.length === 0}
        >
          {isRunning ? "Checking…" : "Re-check prices"}
        </Button>
      }
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
        <Card>
          <div className="space-y-3" aria-label="Loading price comparison">
            <SkeletonLine className="w-1/3" />
            <SkeletonLine />
            <SkeletonLine />
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
          <p className="text-[17px] font-semibold text-label">
            Could not load your medicines
          </p>
          <p className="mt-1 text-[15px] text-label-2">
            Your active prescriptions could not be loaded. Check your connection and try again.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="mt-4"
            onClick={() => refetchItems()}
          >
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        {titleBlock}
        <Card>
          <EmptyState
            icon={<ShoppingBasket aria-hidden="true" />}
            title="Your basket is empty"
            body="Add medicines from your prescriptions, then come back to compare prices across pharmacies."
            action={
              <ButtonLink variant="primary" href="/dashboard">
                View my medicines
              </ButtonLink>
            }
          />
        </Card>
        <AiSafetyBanner feature="prescriptions_basket" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {titleBlock}

      {/* Medicines being priced */}
      <Reveal>
        <Card>
          <CardHeader
            title={`Medicines in basket (${items.length})`}
            trailing={
              truncated
                ? `First ${MAX_ITEMS} of ${activeItems?.length}`
                : undefined
            }
          />
          <div className="flex flex-wrap gap-2">
            {items.map((m) => (
              <Pill key={m.id} tone="accent">
                {m.medicine}
                {m.strength ? ` ${m.strength}` : ""}
              </Pill>
            ))}
          </div>
        </Card>
      </Reveal>

      {/* Agents still checking */}
      {isRunning && (
        <Reveal>
          <Card>
            <div className="flex items-center gap-3">
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin text-accent"
                aria-hidden="true"
              />
              <div>
                <p className="text-[15px] font-semibold text-label">
                  Checking pharmacies…
                </p>
                <p className="text-[13px] text-label-3">
                  Comparing live prices across Tata 1mg, PharmEasy, Netmeds
                  and Apollo.
                </p>
              </div>
            </div>
          </Card>
        </Reveal>
      )}

      {/* Price check failed to start */}
      {compareMutation.isError && !currentResult && (
        <Card>
          <p className="text-[17px] font-semibold text-label">
            Could not check prices
          </p>
          <p className="mt-1 text-[15px] text-label-2">
            The price check did not start. Please try again.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="mt-4"
            onClick={handleStart}
          >
            Try again
          </Button>
        </Card>
      )}

      {/* Price check hit an error while polling */}
      {jobError && (
        <Card>
          <p className="text-[17px] font-semibold text-label">
            The price check hit a snag
          </p>
          <p className="mt-1 text-[15px] text-label-2">
            We lost track of the running check. You can retry it.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="mt-4"
            onClick={() => refetchJob()}
          >
            Try again
          </Button>
        </Card>
      )}

      {/* Still waiting for the first result */}
      {!currentResult && !compareMutation.isError && (
        <Card>
          <div className="flex items-center gap-3">
            <Loader2
              className="h-5 w-5 shrink-0 animate-spin text-accent"
              aria-hidden="true"
            />
            <p className="text-[15px] text-label-2">
              Comparing medicine prices across pharmacies…
            </p>
          </div>
        </Card>
      )}

      {currentResult && (
        <>
          {/* Best price highlight */}
          {currentResult.cheapest_source && (
            <Reveal>
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <Pill tone="ok">Best price</Pill>
                  <p className="text-xl font-semibold text-label">
                    {formatSource(currentResult.cheapest_source)}
                  </p>
                </div>
                {currentResult.savings_vs_highest !== null &&
                  currentResult.savings_vs_highest > 0 && (
                    <p className="mt-2 text-[15px] text-label-2">
                      Save ₹{currentResult.savings_vs_highest.toFixed(2)} vs
                      the highest pharmacy
                    </p>
                  )}
              </Card>
            </Reveal>
          )}

          {/* Jan Aushadhi generic basket */}
          {currentResult.generic && (
            <Reveal>
              <Card>
                <CardHeader
                  title="Jan Aushadhi generics"
                  trailing={
                    currentResult.generic.total !== null
                      ? `${formatTotal(currentResult.generic.total)} total`
                      : undefined
                  }
                />
                <p className="mb-3 text-[13px] text-label-3">
                  Government generic equivalents for the same medicines.
                </p>
                <ListGroup>
                  {currentResult.generic.lines.map((line, li) => (
                    <ListRow
                      key={`${line.medicine}-${li}`}
                      title={
                        line.product_name || `${line.medicine} generic`
                      }
                      subtitle={line.pack_size ?? "Standard pack"}
                      trailing={
                        <span className="shrink-0 text-[15px] font-semibold text-label">
                          {line.unit_price !== null
                            ? `₹${line.unit_price}`
                            : "—"}
                        </span>
                      }
                    />
                  ))}
                </ListGroup>
                <ButtonLink
                  variant="secondary"
                  size="md"
                  className="mt-4 w-full"
                  href="https://janaushadhi.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Find a Jan Aushadhi store
                </ButtonLink>
              </Card>
            </Reveal>
          )}

          {/* Pharmacy comparison */}
          <section aria-label="Pharmacy comparison">
            <h2 className="text-xl font-semibold tracking-tight text-label">
              Pharmacy comparison
            </h2>
            <div className="mt-3 space-y-4">
              {currentResult.baskets.map((basket, bi) => {
                const isCheapest =
                  currentResult.cheapest_source === basket.source &&
                  basket.status === "ok";
                const isPending = basket.status === "pending";
                const hasUnconfirmed = basket.lines.some(
                  (l) => !l.price_verified
                );
                return (
                  <Reveal key={basket.source} delay={Math.min(bi, 4) * 0.05}>
                    <Card
                      className={cn(isCheapest && "bg-ok-soft/40")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="text-[17px] font-semibold text-label">
                            {formatSource(basket.source)}
                          </h3>
                          {isCheapest && (
                            <Pill tone="ok">Cheapest</Pill>
                          )}
                          <StatusPill status={basket.status} />
                        </div>
                        <div className="shrink-0 text-right">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-label-3">
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                              Checking…
                            </span>
                          ) : (
                            <>
                              <p
                                className={cn(
                                  "text-xl font-bold",
                                  isCheapest ? "text-ok" : "text-label"
                                )}
                              >
                                {formatTotal(basket.total)}
                              </p>
                              <p className="text-[13px] text-label-3">
                                Verified total
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {basket.missing.length > 0 && (
                        <p className="mt-3 text-[13px] text-label-2">
                          Not available here: {basket.missing.join(", ")}
                        </p>
                      )}

                      {basket.lines.length > 0 && (
                        <ListGroup header="Items" className="mt-3">
                          {basket.lines.map((line, li) => {
                            const unconfirmed = !line.price_verified;
                            return (
                              <ListRow
                                key={`${line.medicine}-${li}`}
                                title={
                                  line.product_name ||
                                  `${line.medicine}${
                                    line.strength
                                      ? ` ${line.strength}`
                                      : ""
                                  }`
                                }
                                subtitle={`${line.pack_size ?? "Pack"} · Qty ${line.quantity}`}
                                trailing={
                                  <span className="flex shrink-0 flex-col items-end gap-1">
                                    <span
                                      className={cn(
                                        "text-[15px] font-semibold",
                                        unconfirmed
                                          ? "text-label-3 line-through"
                                          : "text-label"
                                      )}
                                    >
                                      {line.unit_price !== null
                                        ? `₹${line.unit_price}`
                                        : "—"}
                                    </span>
                                    {unconfirmed && (
                                      <Pill tone="warn">
                                        Price not confirmed
                                      </Pill>
                                    )}
                                    {line.in_stock === false && (
                                      <Pill tone="danger">Out of stock</Pill>
                                    )}
                                  </span>
                                }
                              />
                            );
                          })}
                        </ListGroup>
                      )}
                      {hasUnconfirmed && (
                        <p className="mt-2 text-[13px] text-label-3">
                          Unconfirmed prices are excluded from the verified
                          total.
                        </p>
                      )}

                      {basket.checkout_url && !isPending && (
                        <Button
                          variant="secondary"
                          size="md"
                          className="mt-4 min-h-[44px] w-full"
                          icon={
                            <ExternalLink
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          }
                          onClick={() => setOrderBasket(basket)}
                        >
                          Order on {formatSource(basket.source)}
                        </Button>
                      )}
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </section>
        </>
      )}

      <AiSafetyBanner feature="prescriptions_basket" />

      {/* Order confirmation */}
      <Sheet
        open={orderBasket !== null}
        onClose={() => setOrderBasket(null)}
        title={
          orderBasket
            ? `Order on ${formatSource(orderBasket.source)}`
            : "Order"
        }
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleConfirmOrder}
            >
              Continue to{" "}
              {orderBasket ? formatSource(orderBasket.source) : "pharmacy"}
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => setOrderBasket(null)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        {orderBasket && (
          <div className="space-y-3">
            <p className="text-[15px] text-label-2">
              {orderBasket.lines.length}{" "}
              {orderBasket.lines.length === 1 ? "item" : "items"} · Verified
              total {formatTotal(orderBasket.total)}
            </p>
            <p className="text-[13px] leading-relaxed text-label-3">
              You will continue on the pharmacy&apos;s website to review the
              basket and pay. Vyana does not handle the payment.
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
