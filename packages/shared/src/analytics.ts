// Product events (#305). One small helper so every screen reports the same way, and a single
// place to switch real collection on later. For now track() is a table-less no-op: it writes
// nowhere, logs nothing (never console — an event must never carry patient text into a log),
// and is safe to call from anywhere.

export type ProductEvent = "plan_viewed" | "waitlist_joined" | "limit_reached";

export function track(_name: ProductEvent): void {
  // Intentionally empty until the events table exists.
}
