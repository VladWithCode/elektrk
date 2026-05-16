# ElektrK — Guía de conexión a Neon (PostgreSQL)

Esta guía cubre todo lo necesario para pasar de `DATA_SOURCE=mock` a una base de datos
real en Neon. Seguir los pasos en orden exacto para evitar errores.

> **DATA_SOURCE** permanece en `"mock"` durante toda la preparación.
> Solo se cambia a `"payload"` en el **último paso**, una vez que la base de datos
> está lista y verificada.

---

## Prerrequisitos

- Node.js 20+ / Bun instalado
- `psql` instalado localmente:
  - **macOS**: `brew install postgresql`
  - **Windows**: instalar [PostgreSQL](https://www.postgresql.org/download/windows/) o usar **Neon SQL Editor** directamente
  - **WSL/Ubuntu**: `sudo apt install postgresql-client`
- Acceso a [console.neon.tech](https://console.neon.tech)

---

## Compatibilidad de scripts `db:*` por plataforma

Los scripts `db:extensions`, `db:auth:migrate` y `db:verify` usan la sintaxis
`$DATABASE_URL_UNPOOLED` (variable de entorno POSIX). Esto funciona en:

| Entorno | Funciona |
|---|---|
| macOS terminal | ✅ |
| Linux terminal | ✅ |
| Git Bash (Windows) | ✅ |
| WSL (Windows) | ✅ |
| Windows PowerShell | ❌ — usar equivalente manual |
| Windows CMD | ❌ — usar equivalente manual |

**Si usas PowerShell en Windows**, ejecuta los scripts directamente con psql:

```powershell
# PowerShell — reemplaza <TU_URL_DIRECTA> con DATABASE_URL_UNPOOLED de tu .env.local
psql "<TU_URL_DIRECTA>" -f scripts/db/enable-extensions.sql
psql "<TU_URL_DIRECTA>" -f scripts/db/auth-migration.sql
psql "<TU_URL_DIRECTA>" -f scripts/db/verify-schema.sql
```

Alternativa para todos los pasos SQL: usar el **Neon SQL Editor** en el dashboard web.
Copiar y pegar el contenido de cada archivo `.sql` directamente.

---

## Orden de setup — pasos exactos

### Paso 1 — Crear el proyecto en Neon

1. Ir a [console.neon.tech](https://console.neon.tech) → **New Project**
2. Nombre sugerido: `elektrk-prod` (o `elektrk-dev`)
3. Region: la más cercana a tu proveedor de deploy (ej. `us-east-1` para Vercel)
4. PostgreSQL version: **16** (recomendado)
5. Click **Create Project**

---

### Paso 2 — Copiar las connection strings en `.env.local`

En el panel de tu proyecto → **Connection Details**:

| Variable en `.env.local` | Qué connection string usar |
|---|---|
| `DATABASE_URL` | **Pooled connection** (dropdown → "Pooled") |
| `DATABASE_URL_UNPOOLED` | **Direct connection** (dropdown → "Direct") |

> **Por qué dos URLs:**
> `DATABASE_URL` (pooled vía PgBouncer) → Auth.js en runtime.
> `DATABASE_URL_UNPOOLED` (directa) → scripts psql y migraciones de Payload.
> PgBouncer en modo transaction no soporta `PREPARE` ni DDL multi-statement.

```bash
cp .env.example .env.local
# Editar .env.local: pegar DATABASE_URL y DATABASE_URL_UNPOOLED
# Dejar DATA_SOURCE="mock" por ahora
```

---

### Paso 3 — Habilitar extensiones PostgreSQL

```bash
# macOS / Linux / Git Bash / WSL
bun run db:extensions

# Windows PowerShell
psql "<DATABASE_URL_UNPOOLED>" -f scripts/db/enable-extensions.sql
```

Esto instala `pg_trgm` (requerida para el índice fuzzy de `users.name`).

`uuid-ossp` es opcional — no se instala por defecto porque `gen_random_uuid()`
está disponible de forma nativa en PostgreSQL 13+ sin extensión adicional.

---

### Paso 4 — Crear tablas de Auth.js

```bash
# macOS / Linux / Git Bash / WSL
bun run db:auth:migrate

# Windows PowerShell
psql "<DATABASE_URL_UNPOOLED>" -f scripts/db/auth-migration.sql
```

Crea exactamente estas 4 tablas (más la columna de credenciales):
- `users` — clientes del storefront (≠ tabla `admins` de Payload), incluye columna `password_hash` para el Credentials provider
- `accounts` — cuentas OAuth vinculadas (Google, Facebook)
- `sessions` — sesiones activas
- `verification_token` — tokens magic link (**singular**, no `verification_tokens`)

El script es **completamente idempotente**:
- Usa `CREATE TABLE IF NOT EXISTS` en todas las tablas
- Usa `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT` para que si la tabla ya existía sin esa columna, se agrega sin error
- **No se requiere ningún paso manual de `ALTER` adicional**

> **CRÍTICO:** El nombre es `verification_token` en singular.
> `@auth/neon-adapter` busca exactamente ese nombre.

El script es **idempotente**: usa `CREATE TABLE IF NOT EXISTS` y
`CREATE INDEX IF NOT EXISTS`. Ejecutarlo dos veces es seguro.

---

### Paso 5 — Crear la migración inicial de Payload

```bash
bun run payload:migrate:create --name init
```

Genera el archivo de migración en `migrations/` basado en las collections
definidas en `payload.config.ts`. Requiere `DATABASE_URL_UNPOOLED` en `.env.local`.

---

### Paso 6 — Ejecutar las migraciones de Payload

```bash
bun run payload:migrate
```

Crea las tablas de Payload en Neon:

| Colección | Tabla generada |
|---|---|
| `admins` | `admins` |
| `media` | `media` |
| `products` | `products` |
| `variants` | `variants` |
| `orders` | `orders` |
| `order-items` | `order_items` (guiones → guiones bajos) |
| `tickets` | `tickets` |
| Global `settings` | `settings` |
| Interno | `payload_migrations` |
| Interno | `payload_locked_documents` |
| Interno | `payload_preferences` |

> Usa `DATABASE_URL_UNPOOLED` internamente. No usar DATABASE_URL (pooled) para esto.

---

### Paso 7 — Regenerar el import map de Payload

```bash
bun run payload:importmap
```

Regenera `src/app/(payload)/importMap.js`. Ejecutar cada vez que se añadan
o eliminen collections de Payload.

---

### Paso 8 — Verificar el schema

```bash
# macOS / Linux / Git Bash / WSL
bun run db:verify

# Windows PowerShell
psql "<DATABASE_URL_UNPOOLED>" -f scripts/db/verify-schema.sql
```

El script muestra 8 secciones numeradas. Resultado esperado:

| Sección | Qué verificar |
|---|---|
| [1] Tablas en public | Debe incluir todas las tablas de Auth.js + Payload |
| [2] Tablas Auth.js | Las 4 tablas en estado `OK`, ninguna en `MISSING` |
| [3] Alerta plural | `OK — "verification_tokens" (plural) no existe.` |
| [4] Tablas Payload | Las 11 tablas en estado `OK`, ninguna en `MISSING` |
| [5] Columnas de users | Confirma `emailVerified` (Auth.js, no Payload) |
| [6] Migraciones Payload | Al menos 1 fila (la migración `init`) |
| [7] Extensiones | `pg_trgm` en estado `OK` |
| [8] Conteo de filas | Todas las tablas con 0 o más filas |

---

### Paso 9 — Levantar el proyecto

```bash
bun run dev
```

La app se inicia con `DATA_SOURCE=mock` (los mocks siguen funcionando).

---

### Paso 10 — Crear el primer admin en Payload

1. Ir a `http://localhost:3000/admin`
2. Payload muestra el formulario de creación del primer usuario administrador
3. Completar nombre, email y contraseña
4. El admin queda en la tabla `admins` (no en `users`)

> `admins` y `users` son tablas completamente independientes.
> Un admin de Payload no puede iniciar sesión como cliente del storefront.

---

### Paso 11 — Seed de productos demo (opcional)

```bash
bun run seed:products
```

Inserta los 8 productos de `MOCK_PRODUCTS` en Payload con sus variantes.
Es idempotente: detecta existencia por `slug` y omite los que ya existen.

**Limitación:** si un producto fue creado parcialmente (el producto se creó
pero alguna variante falló), el segundo run omite el producto completo.
En ese caso, eliminar el producto desde `/admin` antes de re-seedear.

---

### Paso 12 — Subir imágenes y fichas técnicas (opcional)

En `/admin` → **Media**:
- Subir imágenes de producto (JPG, PNG, WebP, SVG)
- Subir fichas técnicas en PDF
- Seleccionar `documentType`: "Imagen de producto" o "Ficha técnica / Datasheet"
- Vincular desde `/admin` → **Productos** → campos "Imágenes" y "Ficha técnica"

---

### Paso 13 — Activar DATA_SOURCE=payload

Solo después de verificar que `/admin` funciona y los datos están en Neon:

En `.env.local`, cambiar:

```env
DATA_SOURCE="payload"
```

Reiniciar el servidor:

```bash
bun run dev
```

El storefront ahora lee desde Payload en lugar de MOCK_PRODUCTS.

---

## Rollback a mocks

En cualquier momento:

```env
DATA_SOURCE="mock"
```

La app vuelve a MOCK_PRODUCTS inmediatamente. La base de datos no se toca.

---

## Variables de entorno completas para producción

```env
DATA_SOURCE="payload"
DATABASE_URL="postgresql://..."           # pooled
DATABASE_URL_UNPOOLED="postgresql://..."   # direct
PAYLOAD_SECRET="..."                      # openssl rand -base64 32
AUTH_SECRET="..."                         # openssl rand -base64 32
AUTH_URL="https://tu-dominio.com"
NEXT_PUBLIC_SERVER_URL="https://tu-dominio.com"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
FACEBOOK_CLIENT_ID="..."
FACEBOOK_CLIENT_SECRET="..."
STRIPE_SECRET_KEY="..."                   # Fase 5
STRIPE_WEBHOOK_SECRET="..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="..."
```

---

## Resumen de comandos en orden

```
# Terminal Unix (macOS / Linux / Git Bash / WSL):

1.  [Neon dashboard] Crear proyecto
2.  cp .env.example .env.local  →  pegar DATABASE_URL y DATABASE_URL_UNPOOLED
3.  # DATA_SOURCE="mock"  ← dejar así por ahora
4.  bun run db:extensions
5.  bun run db:auth:migrate
6.  bun run payload:migrate:create --name init
7.  bun run payload:migrate
8.  bun run payload:importmap
9.  bun run db:verify
10. bun run dev
11. [/admin]  Crear primer admin
12. bun run seed:products   (opcional)
13. [.env.local]  DATA_SOURCE="payload"  →  bun run dev
```
