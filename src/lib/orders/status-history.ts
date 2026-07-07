/**
 * Order status-history helper — ElektrK
 *
 * Appends an entry to an order's `statusHistory` array (audit trail: who moved
 * the order to which status, when, and why). Chosen over Payload `versions` to
 * keep the schema small and purpose-built.
 *
 * NOTE: relative import chain only. This module is imported by the Orders
 * collection (loaded by the Payload CLI under plain Node ESM where the "@/"
 * path alias is unavailable) as well as by the orders repository. Keep it and
 * anything it imports alias-free — it deliberately has no imports.
 *
 * Best-effort: callers wrap this so a history-write failure never blocks the
 * status change that triggered it.
 */

/** Who caused a status change. */
export type StatusHistoryActor = "customer" | "admin" | "system";

export interface StatusHistoryEntry {
  /** Order status the row moved INTO (same enum as Orders.status). */
  status: string;
  /** Actor that made the change. */
  changedBy: StatusHistoryActor;
  /** Optional human note (reason). */
  note?: string | null;
  /** ISO timestamp; defaults to now. */
  changedAt?: string;
}

interface AppendArgs {
  /** A Payload instance (req.payload in hooks, or the lazy client elsewhere). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  /** Optional PayloadRequest so the write joins an in-flight transaction. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req?: any;
  orderId: string | number;
  entry: StatusHistoryEntry;
}

/**
 * Reads the order's current history, appends `entry`, and persists it.
 * Uses `context.skipOrderHooks` so the resulting update does not re-enter the
 * Orders afterChange hook. Throws on failure — callers decide whether to catch.
 */
export async function appendStatusHistory({
  payload,
  req,
  orderId,
  entry,
}: AppendArgs): Promise<void> {
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    req,
    overrideAccess: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any[] = Array.isArray(order?.statusHistory)
    ? order.statusHistory
    : [];
  const normalized = existing.map((e) => ({
    id: e.id,
    status: e.status,
    changedAt: e.changedAt ?? null,
    changedBy: e.changedBy ?? "system",
    note: e.note ?? null,
  }));

  await payload.update({
    collection: "orders",
    id: orderId,
    req,
    overrideAccess: true,
    context: { skipOrderHooks: true },
    data: {
      statusHistory: [
        ...normalized,
        {
          status: entry.status,
          changedAt: entry.changedAt ?? new Date().toISOString(),
          changedBy: entry.changedBy,
          note: entry.note ?? null,
        },
      ],
    },
  });
}
