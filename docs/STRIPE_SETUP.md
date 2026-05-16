# Stripe Setup — ElektrK

> **Estado actual (Fase 7A):** La arquitectura Stripe está completamente preparada.
> El checkout funciona en **modo simulado** — no se procesan pagos reales.
> Sigue esta guía cuando Neon esté listo para activar pagos reales (Fase 7B).

---

## Variables de entorno necesarias

Agrégalas a `.env.local` (desarrollo) y al dashboard de Vercel (producción).

```env
# Clave secreta del servidor — NUNCA exponerla al cliente
STRIPE_SECRET_KEY="sk_test_..."

# Clave publicable — segura para el navegador
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Secreto del webhook — obtenido al registrar el endpoint en Stripe
STRIPE_WEBHOOK_SECRET="whsec_..."
```

> ⚠️ Las claves que comienzan con `sk_test_` / `pk_test_` son de prueba (modo test).
> Para producción usa `sk_live_` / `pk_live_`. **Nunca mezcles claves test y live.**

---

## Cómo obtener las claves

### STRIPE_SECRET_KEY y NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

1. Ve a [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys).
2. En el menú superior, asegúrate de tener seleccionado **"Test mode"** (toggle).
3. Copia:
   - **Secret key** → `STRIPE_SECRET_KEY`
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### STRIPE_WEBHOOK_SECRET

El secreto del webhook se obtiene al registrar el endpoint de ElektrK en Stripe.
Tienes dos opciones: **Stripe CLI** (desarrollo local) o **Dashboard** (staging/producción).

---

## Configurar el webhook

### Opción A — Stripe CLI (desarrollo local)

```bash
# Instalar Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Reenviar eventos al servidor local
stripe listen \
  --forward-to http://localhost:3000/api/stripe/webhook \
  --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed

# El CLI imprime el webhook secret — cópialo como STRIPE_WEBHOOK_SECRET
# > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Deja el CLI corriendo mientras pruebas. Cada vez que inicies una nueva sesión
> el secret puede cambiar — actualiza `.env.local` si cambia.

### Opción B — Dashboard de Stripe (staging / producción)

1. Ve a [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks).
2. Haz clic en **"Add endpoint"**.
3. URL del endpoint:
   - Staging: `https://tu-preview.vercel.app/api/stripe/webhook`
   - Producción: `https://elektrk.mx/api/stripe/webhook`
4. Selecciona los eventos (ver sección siguiente).
5. Crea el endpoint → copia el **"Signing secret"** → `STRIPE_WEBHOOK_SECRET`.

---

## Eventos de webhook requeridos

Registra exactamente estos tres eventos en Stripe:

| Evento | Cuándo ocurre | Acción en ElektrK |
|--------|---------------|-------------------|
| `checkout.session.completed` | Cliente completa el pago en Stripe | Marcar Order como "paid", descontar stock |
| `checkout.session.expired` | El cliente abandona o la sesión vence | Marcar Order como "expired", restaurar stock reservado |
| `payment_intent.payment_failed` | El pago fue rechazado | Marcar Order como "failed", notificar al cliente |

---

## Probar con Stripe CLI

Con el CLI corriendo (`stripe listen`), puedes disparar eventos de prueba:

```bash
# Simular checkout completado
stripe trigger checkout.session.completed

# Simular checkout expirado
stripe trigger checkout.session.expired

# Simular pago fallido
stripe trigger payment_intent.payment_failed
```

También puedes completar un checkout real con la tarjeta de prueba de Stripe:

```
Número: 4242 4242 4242 4242
Fecha:  cualquier fecha futura
CVC:    cualquier 3 dígitos
ZIP:    cualquier código postal
```

Para simular un pago rechazado: `4000 0000 0000 0002`

---

## Checklist de activación (Fase 7B)

Antes de activar pagos reales, completa todos estos pasos:

### Prerrequisitos

- [ ] Neon configurado y `DATABASE_URL` / `DATABASE_URL_UNPOOLED` en `.env.local`
- [ ] Migraciones de Payload ejecutadas (`bun run payload:migrate`)
- [ ] Auth.js con DB (`bun run db:auth:migrate`)
- [ ] `stripe` package instalado (`bun add stripe`)
- [ ] `STRIPE_SECRET_KEY` en `.env.local` (clave **test**)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en `.env.local`
- [ ] `STRIPE_WEBHOOK_SECRET` en `.env.local` (del CLI o Dashboard)

### Activar checkout desde UI

1. Abrir `src/app/(store)/checkout/page.tsx`.
2. En `handleSubmit`, **eliminar el bloque "MODO SIMULADO"**.
3. **Descomentar el bloque "Stripe block"** (ya está escrito, solo descomentarlo).
4. Verificar que `customerAuthId` se pase correctamente desde `useSession()`.

### Activar creación de Order antes del checkout

En `src/app/api/checkout/session/route.ts`:

1. Descomentar la sección "Phase 7B" (busca los TODOs).
2. Crear Order (status: `"pending"`) + OrderItems en Payload antes de crear la sesión Stripe.
3. Pasar `order.id` como `orderDraftId` al input de `createCheckoutSession`.

### Activar post-payment logic en webhook

En `src/app/api/stripe/webhook/route.ts`:

1. En `handleCheckoutSessionCompleted`:
   - Obtener Order por `orderDraftId` de los metadatos.
   - Actualizar `Order.status` → `"paid"`.
   - Guardar `stripeCheckoutSessionId` y `stripePaymentIntentId`.
   - Descontar stock en cada variante de producto.

2. En `handleCheckoutSessionExpired`:
   - Actualizar `Order.status` → `"expired"`.

3. En `handlePaymentIntentFailed`:
   - Actualizar `Order.status` → `"failed"`.

### Activar Order en Payload

Las colecciones `Orders` y `OrderItems` ya existen en:
- `src/collections/Orders.ts`
- `src/collections/OrderItems.ts`

Agrega estos campos a `Orders` para Stripe:

```ts
{ name: "stripeCheckoutSessionId", type: "text", admin: { readOnly: true } },
{ name: "stripePaymentIntentId",   type: "text", admin: { readOnly: true } },
```

### Pasar a producción

1. Cambiar `STRIPE_SECRET_KEY` → clave `sk_live_...`
2. Cambiar `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → clave `pk_live_...`
3. Registrar el webhook de producción en el Dashboard.
4. Actualizar `STRIPE_WEBHOOK_SECRET` con el secreto del endpoint de producción.
5. Verificar que `DATA_SOURCE="payload"` esté configurado en Vercel.

---

## Arquitectura de archivos (Fase 7A)

```
src/
  lib/
    stripe/
      client.ts      — Lazy loader de Stripe SDK; isStripeConfigured()
      types.ts       — CheckoutLineItem, CheckoutSessionInput, StripeOrderMetadata, etc.
      checkout.ts    — createCheckoutSession(), buildCheckoutInput(), toCentavos()
  app/
    api/
      checkout/
        session/
          route.ts   — POST /api/checkout/session (preparado, no llamado desde UI)
      stripe/
        webhook/
          route.ts   — POST /api/stripe/webhook (preparado, TODOs para Fase 7B)
    (store)/
      checkout/
        page.tsx     — UI en modo simulado; bloque Stripe listo para descomentar
        success/
          page.tsx   — Página de confirmación
        cancel/
          page.tsx   — Página de cancelación
```

---

## Notas de seguridad

- **Nunca** confíes en el cuerpo de un webhook sin verificar la firma (`stripe-signature`).
- **Nunca** expongas `STRIPE_SECRET_KEY` al cliente — solo `NEXT_PUBLIC_*`.
- **Siempre** re-valida el stock contra la base de datos antes de crear la sesión (no uses el snapshot de CartItem).
- En producción, considera re-fetchear la sesión de Stripe en el webhook en lugar de confiar sólo en `event.data.object` (defensa en profundidad).
- Registra todos los errores de webhook para auditoría. Stripe muestra intentos fallidos en el Dashboard.
