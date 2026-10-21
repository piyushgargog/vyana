"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui";
import { expiryCountdown } from "./share-utils";

/**
 * The header card's expiry countdown (issue #238): how long the link stays valid,
 * refreshed every 30 seconds, reading "Expired" once the deadline has passed.
 */
export function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { expired, text } = expiryCountdown(expiresAt, now);
  return <Pill tone={expired ? "danger" : "ok"}>{text}</Pill>;
}
