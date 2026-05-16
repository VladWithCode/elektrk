# Guía de Deploy — ElektrK

> **Estado actual:** El proyecto funciona en modo mock (DATA_SOURCE=mock) sin base de datos.  
> Este documento describe todos los pasos necesarios para pasar a producción completa con Neon, Vercel, Auth y Stripe.

---

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Variables de entorno en producción](#2-variables-de-entorno-en-producción)
3. [Configurar Neon](#3-configurar-neon)
4. [Configurar Vercel](#4-configurar-vercel)
5. [Correr migraciones](#5-correr-migraciones)
6. [Crear primer admin de Payload](#6-crear-primer-admin-de-payload)
7. [Seed de productos (opcional)](#7-seed-de-productos-opcional)
8. [Cambiar DATA_SOURCE de mock a payload](#8-cambiar-data_source-de-mock-a-payload)
9. [Configurar Stripe webhook en producción](#9-configurar-stripe-webhook-en-producción)
10. [Rutas a validar tras el deploy](#10-rutas-a-validar-tras-el-deploy)
11. [Checklist antes de producción](#11-checklist-antes-de-producción)

---

## 1. Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Bun | ≥ 1.1.0 | Runtime y package manager |
| Node.js | ≥ 20.x | Requerido por Next.js 16 |
| Neon PostgreSQL | Cualquier plan | Serverless Postgres; requiere pooled + unpooled connections |
| Stripe | Cuenta activa | Para pagos; en modo test no hay cobros reales |
| Auth.js (next-auth v5) | ya incluido | OAuth + Credentials provider |
| Payload CMS | v3.x (ya incluido) | Admin y colecciones |

---

## 2. Variables de entorno en producción

Todas las variables deben configurarse en Vercel → Settings → Environment Variables.  
**Nunca commitees valores reales al repositorio.**

### Base de datos (Neon)

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ Siempre (cuando DATA_SOURCE=payload) | Connection string pooled (pgbouncer). Ejemplo: `postgres://user:pass@ep-xxx.neon.tech/elektrk?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | ✅ Para migraciones | Connection string directo (sin pooler). Necesario para `psql` y `payload migrate` |

### Payload CMS

| Variable | Requerida | Descripción |
|---|---|---|
| `PAYLOAD_SECRET` | ✅ | Clave secreta de Payload. Genera con: `openssl rand -hex 32` |

### Auth.js

| Variable | Requerida | Descripción |
|---|---|---|
| `AUTH_SECRET` | ✅ En producción | Secret para JWT/sesiones. Genera con: `openssl rand -hex 32` |
| `AUTH_URL` | ✅ En producción | URL base de la app. Ejemplo: `https://elektrk.vercel.app` |

### Servidor

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SERVER_URL` | ✅ | URL pública del sitio. Usada para metadataBase, sitemap y OG URLs. Ejemplo: `https://elektrk.vercel.app` |
| `DATA_SOURCE` | ✅ | `mock` (default) o `payload`. Cambiar a `payload` solo después de correr migraciones |

### OAuth (opcionales — activar solo si se configuran en el proveedor)

| Variable | Requerida | Descripción |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Opcional | ID de cliente OAuth de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Opcional | Secret OAuth de Google Cloud Console |
| `FACEBOOK_CLIENT_ID` | Opcional | App ID de Facebook Developer |
| `FACEBOOK_CLIENT_SECRET` | Opcional | App Secret de Facebook Developer |

> Auth.js solo registra los proveedores OAuth cuando **ambas** variables del par están presentes. Si faltan, el botón de login social simplemente no aparece.

### Stripe

| Variable | Requerida | Descripción |
|---|---|---|
| `STRIPE_SECRET_KEY` | Para pagos reales | Secret key de Stripe. Empieza con `sk_live_` (producción) o `sk_test_` (test) |
| `STRIPE_WEBHOOK_SECRET` | Para webhooks | Secret de endpoint webhook. Empieza con `whsec_` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Para frontend | Publishable key. Empieza con `pk_live_` o `pk_test_` |

---

## 3. Configurar Neon

1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear un proyecto → elegir región más cercana (ej. `us-east-1` o `eu-west-1`)
3. Crear una base de datos: `elektrk`
4. En el panel de Neon → **Connection Details**:
   - Copiar la URL **pooled** (con `?pgbouncer=true&sslmode=require`) → `DATABASE_URL`
   - Copiar la URL **unpooled** (directa) → `DATABASE_URL_UNPOOLED`
5. Verificar conexión:

```bash
psql "$DATABASE_URL_UNPOOLED" -c "SELECT 1;"
```

6. Habilitar extensiones necesarias:

```bash
bun run db:extensions
```

> Script: `scripts/db/enable-extensions.sql`

---

## 4. Configurar Vercel

1. Conectar el repositorio en [vercel.com/new](https://vercel.com/new)
2. Framework: **Next.js** (detectado automáticamente)
3. Build Command: `bun run build` (o dejar el default de Vercel)
4. Install Command: `bun install`
5. Agregar todas las variables de entorno del paso 2
6. **No activar** `DATA_SOURCE=payload` hasta haber corrido las migraciones

### Variables mínimas para primer deploy (modo mock)

```
NEXT_PUBLIC_SERVER_URL=https://tu-proyecto.vercel.app
AUTH_SECRET=<genera con openssl rand -hex 32>
AUTH_URL=https://tu-proyecto.vercel.app
DATA_SOURCE=mock
```

El build en modo mock no requiere `DATABASE_URL`, `PAYLOAD_SECRET` ni Stripe.

---

## 5. Correr migraciones

> **Prerequisito:** `DATABASE_URL_UNPOOLED` configurado en entorno local o CI.

### Paso 1 — Migración de Auth (tablas de sesiones/usuarios)

```bash
bun run db:auth:migrate
```

Script: `scripts/db/auth-migration.sql`  
Crea: `users`, `sessions`, `accounts`, `verification_tokens`

### Paso 2 — Verificar esquema de Auth

```bash
bun run db:verify
```

Script: `scripts/db/verify-schema.sql`

### Paso 3 — Migración de Payload

```bash
bun run payload:migrate
```

> Payload detecta el schema de las colecciones y aplica las migraciones pendientes.

### Paso 4 — Regenerar importmap de Payload (si hay cambios de colecciones)

```bash
bun run payload:importmap
```

### Crear una migración nueva (cuando se modifiquen colecciones)

```bash
bun run payload:migrate:create
```

---

## 6. Crear primer admin de Payload

1. Con `DATA_SOURCE=payload` y `DATABASE_URL` configurados
2. Visitar `https://tu-dominio.com/admin`
3. En el primer acceso, Payload muestra el formulario de creación de admin
4. Crear usuario administrador con email y contraseña seguros
5. **Guardar las credenciales en un gestor de contraseñas**

---

## 7. Seed de productos (opcional)

Pobla la base de datos con los productos de `src/data/mock-products.ts`:

```bash
bun run seed:products
```

> Script: `scripts/seed/seed-products.ts`  
> Solo ejecutar **después** de que las migraciones de Payload estén completas y `DATA_SOURCE=payload`.

---

## 8. Cambiar DATA_SOURCE de mock a payload

**No cambiar hasta que:**
- [ ] Neon está conectado y funcional
- [ ] `bun run db:auth:migrate` ejecutado
- [ ] `bun run payload:migrate` ejecutado
- [ ] Admin de Payload creado
- [ ] Al menos 1 producto visible en `/admin/collections/products`

**Para activar:**

En Vercel → Environment Variables:
```
DATA_SOURCE=payload
```

Redesplegar el proyecto. Verificar que `/products` muestra datos reales.

---

## 9. Configurar Stripe webhook en producción

Ver `docs/STRIPE_SETUP.md` para el flujo completo.

**Resumen:**

1. En [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) → Crear endpoint
2. URL del endpoint: `https://tu-dominio.com/api/stripe/webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
4. Copiar el **Webhook signing secret** (`whsec_...`) → Variable `STRIPE_WEBHOOK_SECRET`
5. Agregar también `STRIPE_SECRET_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
6. En `src/app/(store)/checkout/page.tsx` → descomentar el bloque de Stripe (marcado con `TODO Phase 7B`)

---

## 10. Rutas a validar tras el deploy

| Ruta | Tipo | Qué verificar |
|---|---|---|
| `/` | SSG | Carga, productos featured, hero |
| `/products` | SSG | Catálogo, filtros, búsqueda |
| `/products/[slug]` | SSG | Detalle, variantes, añadir al carrito |
| `/cart` | SSG | Items, totales, checkout CTA |
| `/checkout` | SSG | Formulario, envío simulado |
| `/checkout/success` | SSG | Página de confirmación |
| `/checkout/cancel` | SSG | Página de cancelación |
| `/login` | SSG | Formulario, error sin DB |
| `/register` | SSG | Formulario, error sin DB |
| `/account` | Dynamic | Requiere sesión activa |
| `/account/orders` | Dynamic | Lista de órdenes |
| `/account/orders/[id]` | Dynamic | Detalle de orden, 404 si no existe |
| `/support` | SSG | Info de contacto |
| `/support/tickets` | SSG | Formulario de ticket |
| `/admin` | Dynamic | Login de Payload (requiere DATA_SOURCE=payload) |
| `/sitemap.xml` | SSG | Listado de URLs públicas |
| `/robots.txt` | SSG | Allow/Disallow correcto |
| `/404` (cualquier ruta inválida) | SSG | Página not-found personalizada |
| `/api/checkout/session` | Dynamic | 503 si Stripe no configurado |
| `/api/stripe/webhook` | Dynamic | 503 si webhook secret no configurado |

---

## 11. Checklist antes de producción

### Infraestructura

- [ ] Neon project creado y región elegida
- [ ] `DATABASE_URL` (pooled) copiado a Vercel
- [ ] `DATABASE_URL_UNPOOLED` (directo) copiado a Vercel
- [ ] Extensions habilitadas (`bun run db:extensions`)

### Auth

- [ ] `AUTH_SECRET` generado y configurado
- [ ] `AUTH_URL` apunta al dominio de producción
- [ ] Migración de Auth ejecutada (`bun run db:auth:migrate`)
- [ ] Esquema verificado (`bun run db:verify`)
- [ ] (Opcional) Google OAuth — Client ID y Secret configurados en Google Cloud Console y en Vercel
- [ ] (Opcional) Facebook OAuth — App ID y Secret configurados en Facebook Developer y en Vercel

### Payload

- [ ] `PAYLOAD_SECRET` generado y configurado
- [ ] Migración de Payload ejecutada (`bun run payload:migrate`)
- [ ] Admin de Payload creado en `/admin`
- [ ] Al menos 1 producto publicado en Payload

### DATA_SOURCE

- [ ] Cambiado a `payload` en Vercel
- [ ] Redeploy ejecutado
- [ ] `/products` muestra productos reales

### Stripe (cuando se active)

- [ ] `STRIPE_SECRET_KEY` configurado (clave de producción `sk_live_`)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` configurado
- [ ] Webhook endpoint creado en Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` configurado
- [ ] Bloque de Stripe en `checkout/page.tsx` descomentado (Phase 7B)
- [ ] Test de pago con tarjeta de prueba `4242 4242 4242 4242`

### SEO y servidor

- [ ] `NEXT_PUBLIC_SERVER_URL` apunta al dominio correcto
- [ ] `sitemap.xml` accesible y con las URLs correctas
- [ ] `robots.txt` accesible
- [ ] OG image configurada (`public/og-default.png` 1200×630)

### Build y tests

- [ ] `bun run lint` → 0 errores
- [ ] `bun run typecheck` → 0 errores
- [ ] `bun run build` → sin errores
- [ ] Variables de entorno no expuestas en logs ni respuestas de API
