# WhatsApp Order Flow — Phase 2 Implementation Spec

Status: **Draft** · Owner: engineering · Target: ElektrK storefront + Payload admin
Supersedes nothing; extends the Phase 1 WhatsApp order flow that replaced Stripe.

---

## 0. Context & Current State

Sales run entirely through WhatsApp + manual admin confirmation. There is **no
online payment**.

Phase 1 (shipped) delivered:

- Order lifecycle statuses: `pending → payment_pending → paid → fulfilled → cancelled`.
- Human-friendly `orderNumber` (`ORD-000042`), unique + indexed, searchable in admin.
- Structured `shipping` group, `customerName`, buyer `notes` on orders.
- Checkout creates a `pending` order, then the success page shows a
  "Enviar pedido por WhatsApp" button (`wa.me/<store number>` with a pre-filled
  Spanish summary).
- Admin confirms payment by moving status to `paid`; an Orders `afterChange`
  hook decrements variant stock on the forward transition into `paid`.
- Payment proofs: `Orders.paymentProofs` array (`file` upload → media,
  `uploadedBy`, `uploadedAt`). Customers upload from the order detail page;
  admins upload from the Payload admin. Files are public `utfs.io` URLs.

### Key code touchpoints

| Concern | Path |
| --- | --- |
| Orders collection + hooks | `src/collections/Orders.ts` |
| Order items | `src/collections/OrderItems.ts` |
| Media (uploadthing) | `src/collections/Media.ts` |
| Store settings (global) | `src/globals/Settings.ts` |
| Settings repo + `StorefrontSettings` | `src/lib/repositories/settings.ts`, `src/data/mock-settings.ts` |
| Orders repo | `src/lib/repositories/orders.ts` |
| Order mapper | `src/lib/mappers/order.mapper.ts` |
| Order domain types | `src/types/order.ts` |
| WhatsApp message lib | `src/lib/whatsapp/order-message.ts` |
| Checkout success page | `src/app/(store)/checkout/success/page.tsx` |
| Account order detail | `src/app/(store)/account/orders/[id]/page.tsx` |
| Proof upload action + UI | `src/app/(store)/account/orders/[id]/actions.ts`, `_components/OrderProofUpload.tsx` |
| Migrations | `src/migrations/*.ts` + `src/migrations/index.ts` |
| Email adapter | `payload.config.ts` (`resendAdapter`, `RESEND_API_KEY`) |
| Cache tags | `src/lib/cache-tags.ts` |

### Environment / platform constraints (must respect)

- **DATA_SOURCE=payload**, Neon Postgres, `push: false` — every schema change
  needs a migration.
- **Migrations are hand-written.** `payload migrate:create` currently prompts
  interactively about pre-existing `media.is_deleted` snapshot drift and cannot
  run non-interactively. Author migrations by hand following the conventions in
  `src/migrations/20260630_182000_payment_proofs.ts` (array table) and
  `20260630_whatsapp_orders.ts` (columns + enum). Register each in
  `src/migrations/index.ts`.
- **Collection files load under the Payload CLI (plain Node ESM)** — no `@/`
  path alias inside anything imported by a collection. Keep such chains relative
  (see `src/lib/whatsapp/order-message.ts`).
- Order ids are **sequential `serial` integers** — do not expose them as secrets.
- Payment media is **public-read** on `utfs.io` (unguessable URL only).
- Applying migrations + backfills is **operator-gated** (run manually).

---

## 1. Goals

Make the buy/sell flow simple and trustworthy for both sides:

1. Close the PII/security gaps opened by the manual flow.
2. Keep inventory correct across the manual confirmation lag.
3. Notify both parties automatically at each meaningful step.
4. Let the customer self-serve payment (know where + how to pay, re-open the
   WhatsApp handoff, track status, cancel).
5. Give the admin a guided, auditable workflow.

Non-goals (this phase): online card payments, private/gated media storage
(tracked as a follow-up), full stock **reservation** (we bound the risk with
auto-expiry instead).

---

## 2. Status & Data Model Changes (foundation)

### 2.1 Per-proof review state (fixes muddy status semantics)

**Problem:** a customer upload auto-advances `pending → payment_pending`
(labeled "Pago solicitado" = *admin requested payment*), conflating two
different events.

**Solution:** stop overloading order status. Add a review state **per proof**
and keep order status admin-meaningful.

- `Orders.paymentProofs[].reviewStatus`: select `pending | accepted | rejected`,
  default `pending`.
- `Orders.paymentProofs[].reviewNote`: text (admin reason, e.g. "monto no
  coincide"). Shown to the customer.
- Keep the auto-advance `pending → payment_pending` on the **first customer
  upload**, but re-read its meaning as "awaiting admin review". Update the
  Spanish label of `payment_pending` to "Pago en revisión" (see 2.2).

**Migration:** add columns to `orders_payment_proofs`:
`review_status "enum_orders_payment_proofs_review_status" DEFAULT 'pending'`,
`review_note varchar`. Create the enum.

### 2.2 Status labels revision

Update `src/types/order.ts` (`ORDER_STATUS_LABELS`, options) and the Orders
collection select `options`:

| value | new label |
| --- | --- |
| `pending` | Recibida |
| `payment_pending` | Pago en revisión |
| `paid` | Pago confirmado |
| `fulfilled` | Entregada |
| `cancelled` | Cancelada |

No enum migration (labels are UI-only; enum values unchanged).

### 2.3 Status history (audit trail)

**Problem:** no record of who changed status when.

**Solution:** `Orders.statusHistory` array field (append-only, admin readOnly in
UI): `{ status (select, same options), changedAt (date), changedBy (text:
"customer" | "admin" | "system"), note (text) }`.

Populate from the Orders `afterChange` hook whenever `doc.status !==
previousDoc.status` (append an entry). The proof-upload path and cron also write
entries via the same helper.

**Migration:** array table `orders_status_history` following the
`orders_payment_proofs` pattern (id varchar PK, `_order`, `_parent_id` FK
cascade, `status` enum reuse — actually a new enum
`enum_orders_status_history_status` mirroring order statuses, `changed_at`
timestamptz, `changed_by varchar`, `note varchar`, indexes).

> Chosen over Payload `versions: true` to avoid the large `_orders_v` version
> tables and keep the migration small + purpose-built.

### 2.4 Checkout idempotency (prevents duplicate orders)

**Problem:** double-submit / retry creates multiple `pending` orders for one cart.

**Solution (two layers):**

1. Client: disable submit after first click (already partly done) + guard
   against re-entry in `CheckoutClient`.
2. Server: `submitCheckout` accepts a client-generated `idempotencyKey` (UUID,
   created once per checkout mount). Store it on the order
   (`Orders.idempotencyKey`, unique, indexed). Before creating, look up an order
   with the same key for the same `customerAuthId`; if found, return it instead
   of creating a duplicate.

**Migration:** `orders.idempotency_key varchar` + unique index
`orders_idempotency_key_idx`.

**Acceptance:** submitting the same checkout twice yields one order.

---

## 3. Security Fixes

### 3.1 Success page ownership gate (HIGH — do first)

**Problem:** `checkout/success/page.tsx` calls `getOrderById` with no ownership
check; ids are enumerable serial integers. Anyone can read another order's PII
and rebuild its WhatsApp message.

**Solution:**

- Require a session; fetch the order; if `order.customerAuthId !==
  session.user.id`, do **not** render order details or the pre-filled message.
- Preferred redirect target after checkout: pass the order id, but render the
  WhatsApp CTA only for the owner. For a non-owner / logged-out visitor, show a
  generic "revisa tus órdenes" state with a login link (no PII).

**Files:** `src/app/(store)/checkout/success/page.tsx` (add
`getSessionSafe` + ownership branch).

**Acceptance:** visiting `/checkout/success?orderId=<not mine>` reveals no
customer data and no wa.me message.

### 3.2 Payment-proof access (MEDIUM — follow-up, scoped here)

**Problem:** receipts (bank data) on permanent public URLs.

**Phase-2 minimum:** document the risk in-product (admin note) and ensure proof
URLs are never rendered to non-owners (they already only render on the
ownership-gated account detail page and Payload admin).

**Later (separate task):** switch payment-proof media to a **private** bucket
(uploadthing private ACL or a dedicated `payment-proofs` collection) served
through a proxy route that checks order ownership / admin. This is a larger
change (storage config + signed URLs) and is intentionally deferred; capture as
a backlog item.

---

## 4. Inventory Integrity

### 4.1 Restore stock on cancel/refund (HIGH — small)

**Problem:** stock decrements on `→paid` but never restores when a `paid` order
is later `cancelled`.

**Solution:** extend the Orders `afterChange` hook:

- Track whether stock was decremented for an order. Add
  `Orders.stockDecremented` (checkbox, default false, admin readOnly). Set it
  `true` inside the decrement branch.
- On transition into `cancelled` **while `stockDecremented === true`**, run an
  `incrementOrderStock(req, orderId)` (mirror of the existing decrement helper,
  adds quantity back), then set `stockDecremented = false`.
- Guard against double-apply using the flag (idempotent).

**Migration:** `orders.stock_decremented boolean DEFAULT false`.

**Files:** `src/collections/Orders.ts` (hook + inline increment helper,
same-transaction `req`).

**Acceptance:** `pending→paid` decrements once; `paid→cancelled` restores;
`cancelled→paid` decrements again; no double counting.

### 4.2 Auto-expire stale pending orders (MEDIUM)

**Problem:** abandoned `pending` orders accumulate forever and, combined with no
reservation, are the main oversell vector.

**Solution:** scheduled job that cancels `pending` (and optionally
`payment_pending` with no accepted proof) orders older than **N days**
(configurable, default 7). Cancelling never touches stock (not yet decremented),
appends a `statusHistory` entry with `changedBy: "system"`.

**Implementation:** Vercel Cron → `src/app/api/cron/expire-orders/route.ts`
guarded by a `CRON_SECRET` header check. Uses the orders repo to find + cancel.
Add the cron entry to `vercel.ts` (project config).

**Env:** `CRON_SECRET`. **Setting:** `pending_order_ttl_days` (see §6, optional).

**Acceptance:** a `pending` order older than the TTL is auto-cancelled on the
next cron run and recorded in history.

> Full stock **reservation** (decrement-on-create + release-on-cancel) is a
> heavier alternative; deferred. Auto-expiry bounds the risk for now.

---

## 5. Notifications (highest satisfaction lever)

Resend is already configured (`resendAdapter` in `payload.config.ts`). Use
`payload.sendEmail(...)`. All copy in Spanish.

### 5.1 Email infrastructure

- New `src/lib/email/` module: `sendOrderEmail(...)` wrapper + small HTML
  templates (plain, inline-styled). Never throws into the request path (wrap in
  try/catch, log on failure).
- Templates: order received (customer), payment confirmed, shipped/fulfilled,
  cancelled, proof rejected (with `reviewNote`).
- From address: replace the placeholder `onboarding@resend.dev` with a verified
  sender once the domain is set up (env `EMAIL_FROM`).

### 5.2 Customer lifecycle emails

Trigger from the Orders `afterChange` hook on status transitions (and on
create):

| Event | Email |
| --- | --- |
| order created | "Recibimos tu orden ORD-… — envíala por WhatsApp para coordinar el pago" (include wa.me link + payment instructions, §6) |
| `→ paid` | "Pago confirmado — preparamos tu pedido" |
| `→ fulfilled` | "Tu pedido va en camino / está listo" |
| `→ cancelled` | "Tu orden fue cancelada" |
| proof `rejected` | "Necesitamos otro comprobante" + reason |

### 5.3 Admin new-order notification

On order create, email the admin (`settings.supportEmail`) with the order
number, customer, total, and a deep link to the admin order page. Optional
second channel later (WhatsApp Business API / push) — out of scope now.

**Files:** `src/lib/email/*`, `src/collections/Orders.ts` (hook calls),
`src/lib/repositories/orders.ts` (create path can trigger the admin email, or
do it in the hook on `operation === "create"`).

**Acceptance:** each transition sends exactly one email to the right party;
failures are logged, never block the status change.

---

## 6. Payment Instructions (removes the main manual friction)

**Problem:** the customer never learns *where/how to pay* except via a manual
WhatsApp reply from the admin.

**Solution:** store payment details once, surface them everywhere.

### 6.1 Settings

Add a `payment` group to `src/globals/Settings.ts`:

- `bankName` (text)
- `accountHolder` (text)
- `clabe` (text)
- `accountNumber` (text, optional)
- `paymentInstructions` (textarea — free-form, e.g. "Envía tu comprobante por
  WhatsApp o desde tu orden")
- `pendingOrderTtlDays` (number, optional — powers §4.2)

Extend `StorefrontSettings` (`src/data/mock-settings.ts`), the settings mapper
(`src/lib/repositories/settings.ts`), and `MOCK_SETTINGS`. Bump/keep the
`SETTINGS_CACHE_TAG` revalidation (already tag-based).

**Migration:** `settings` global table columns `payment_bank_name`,
`payment_account_holder`, `payment_clabe`, `payment_account_number`,
`payment_payment_instructions`, `payment_pending_order_ttl_days`.

### 6.2 Surface points

- **Order detail page** (`account/orders/[id]`): a "Cómo pagar" panel with the
  bank details + instructions, shown while `pending`/`payment_pending`.
- **WhatsApp message** (`src/lib/whatsapp/order-message.ts`): append a
  "Datos de pago" block when present.
- **Order-received email** (§5.2): include the same block.

**Acceptance:** with payment settings filled, the customer sees bank details on
the order page, in the WhatsApp text, and in the email — without any admin
action.

---

## 7. Customer UX

### 7.1 Re-open WhatsApp from the order detail page

Add a "Enviar / reenviar por WhatsApp" button on `account/orders/[id]` (owner
only), while `pending`/`payment_pending`. Rebuild the link server-side (reuse
`buildWhatsAppUrl` + `buildOrderWhatsAppMessage`, already done on the success
page). Optionally record `Orders.whatsappSentAt` on click via a tiny action so
the admin can see whether the customer initiated contact.

### 7.2 Cancel my order

Customer server action to cancel own order while `pending`/`payment_pending`.
Sets `cancelled`, appends history (`changedBy: "customer"`), triggers the cancel
email. No stock impact (not decremented yet).

### 7.3 Manage own proofs

- Remove/replace a proof the customer uploaded **while it is still
  `reviewStatus: pending`** (not after admin accepted/rejected). Server action +
  ownership + state checks; delete the media doc (respect `guardMediaDelete`).
- Show each proof's `reviewStatus` badge + `reviewNote` in `OrderProofUpload`.

### 7.4 Status timeline

Render `statusHistory` as a vertical timeline on the order detail page
(customer-friendly labels, dates). Read-only.

**Files:** `account/orders/[id]/page.tsx`, `_components/OrderProofUpload.tsx`,
new `_components/OrderTimeline.tsx`, `account/orders/[id]/actions.ts`.

---

## 8. Admin UX

### 8.1 Guided actions

The raw status `select` works but is unguided. Add admin-only affordances
(Payload custom UI field or documented SOP): "Solicitar pago", "Confirmar pago",
"Rechazar comprobante" (sets proof `reviewStatus: rejected` + `reviewNote`),
"Marcar entregada". Minimum viable: keep the select, but add field
descriptions + ensure the proof array shows `reviewStatus`/`reviewNote` inline.

### 8.2 Proof review

Admin sets `reviewStatus` on each proof; `rejected` triggers the customer email
(§5.2). Accepting a proof does **not** auto-set `paid` (admin still confirms
explicitly) — but surface a hint.

### 8.3 Settings for messaging

- Configurable WhatsApp message template (optional; default to current builder).
- Validate the WhatsApp number format on save (digits + country code) with a
  Payload field `validate`.

### 8.4 Admin-uploaded proof timestamp

Set `uploadedAt` for admin-added proofs (currently blank because the field is
readOnly). Default it in a `beforeChange`/array hook to `now` when missing.

---

## 9. Operational cleanup

- Backfill `order_number` for existing null rows (orders #4/#5):
  `UPDATE orders SET order_number = 'ORD-' || lpad(id::text,6,'0') WHERE order_number IS NULL;`
- Verify the `orders_payment_proofs` migration applied
  (`bun run payload:migrate`, then `\d orders_payment_proofs`).
- Decide on `docs/STRIPE_SETUP.md` (already removed) — no action.

---

## 10. Phasing & Sequencing

Ordered by value / dependency. Each phase is independently shippable.

| Phase | Scope | Depends on |
| --- | --- | --- |
| **2.0 Security** | §3.1 success-page ownership; §9 backfill | — |
| **2.1 Integrity** | §4.1 stock restore on cancel; §2.3 status history; §2.2 labels | 2.0 |
| **2.2 Notifications** | §5 email infra + customer + admin emails | 2.1 (history helper) |
| **2.3 Payment self-serve** | §6 settings + surface points | 2.2 (email block) |
| **2.4 Customer UX** | §7 resend WhatsApp, cancel, proof mgmt, timeline; §2.1 proof review state | 2.1, 2.3 |
| **2.5 Admin UX** | §8 guided actions, proof review, template, validation, uploadedAt | 2.4 |
| **2.6 Hygiene** | §2.4 idempotency; §4.2 auto-expire cron | 2.1 |
| **Backlog** | §3.2 private proof storage; full stock reservation; WhatsApp Business API notifications | — |

---

## 11. Cross-cutting Acceptance Criteria

- `bun run typecheck` and `bun run lint` clean for all new/changed files
  (pre-existing lint debt in `payload.config.ts` / guards excluded).
- Every schema change has a hand-written migration registered in
  `src/migrations/index.ts`, with a working `down()`.
- No `@/` alias inside anything imported by a collection.
- Hooks never throw into the request path; email/stock side-effects are
  best-effort and logged.
- No order PII is reachable without session + ownership (or admin).
- Each order status transition is recorded in `statusHistory` and, where
  applicable, emits exactly one email.

---

## 12. New/changed schema summary (migrations to author)

1. `orders.stock_decremented boolean DEFAULT false` (§4.1)
2. `orders.idempotency_key varchar` + unique index (§2.4)
3. Payment settings columns on `settings` global (§6.1)
4. `orders_payment_proofs`: `review_status` enum + `review_note varchar` (§2.1)
5. `orders_status_history` array table + status enum (§2.3)
6. `orders.whatsapp_sent_at timestamptz` (optional, §7.1)

Author each following existing migration conventions; do not rely on
`migrate:create` (interactive drift).

---

## 13. New environment variables

| Var | Purpose |
| --- | --- |
| `EMAIL_FROM` | Verified Resend sender address |
| `CRON_SECRET` | Guards the expire-orders cron route |

(`RESEND_API_KEY` already exists.)
