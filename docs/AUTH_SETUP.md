# ElektrK — Guía de Auth.js

Referencia completa para activar autenticación real de clientes (storefront).

> **Nota:** Esta guía cubre autenticación del storefront (clientes → tabla `users`).
> El acceso al panel Payload (`/admin`) usa una tabla `admins` independiente y
> **no** usa Auth.js. Ambos sistemas son completamente separados.

---

## Estado actual — Phase 6B activa ✅

| Funcionalidad | Estado |
|---|---|
| Configuración Auth.js | ✅ Completa |
| JWT fallback (sin DB) | ✅ Activo cuando no hay DATABASE_URL |
| Credentials provider | ✅ **Activo** — consulta `users` en Neon, verifica scrypt hash |
| Google OAuth | ✅ Configurado — activo solo si env vars presentes |
| Facebook OAuth | ✅ Configurado — activo solo si env vars presentes |
| Login UI conectado | ✅ Formulario con Server Action |
| Register UI conectado | ✅ Formulario con Server Action |
| Navbar auth-aware | ✅ useSession() para mostrar estado |
| Account protection | ✅ Middleware (proxy.ts) + getSessionSafe() |
| Password hashing | ✅ Node crypto.scrypt (`hashPassword` / `verifyPassword`) |
| Creación de usuario en DB | ✅ **Phase 6B completa** — inserta en `users` + auto-login |
| Credentials verify vs DB | ✅ **Phase 6B completa** — verifica `password_hash` en Neon |

---

## Variables de entorno requeridas

```env
# Mínimo para JWT sessions (auth funciona sin DB)
AUTH_SECRET="..."                   # openssl rand -base64 32

# Para sesiones en base de datos + Credentials provider real
DATABASE_URL="postgresql://..."     # Neon pooled connection
AUTH_URL="https://tu-dominio.com"   # En producción, tu dominio exacto

# Google OAuth (opcional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Facebook OAuth (opcional)
FACEBOOK_CLIENT_ID="..."
FACEBOOK_CLIENT_SECRET="..."
```

### Generar AUTH_SECRET

```bash
# Unix / macOS / Git Bash
openssl rand -base64 32

# PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# O simplemente:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Probar /api/auth/session

Con el servidor corriendo (`bun run dev`):

```bash
curl http://localhost:3000/api/auth/session
# → {} si no hay sesión
# → { "user": { "id": "...", "name": "...", "email": "..." }, "expires": "..." } si hay sesión
```

Sin `AUTH_SECRET` en `.env.local`, en development Auth.js auto-genera uno
(no persistente entre reinicios). En producción `AUTH_SECRET` es obligatorio.

---

## Cómo registrar un usuario (Phase 6B — ya activa)

1. Abre `http://localhost:3000/register`
2. Completa: nombre, apellido, correo, contraseña (mín. 8 caracteres), confirmación
3. Al enviar:
   - Se validan los campos
   - Se normaliza el email a minúsculas
   - Se verifica que el email no exista en la tabla `users`
   - Se hashea la contraseña con scrypt (Node.js crypto)
   - Se inserta en `users` (id, name, email, emailVerified=null, password_hash)
   - Se inicia sesión automáticamente vía Credentials
   - Se redirige a `/account`

## Cómo iniciar sesión

1. Abre `http://localhost:3000/login`
2. Introduce email y contraseña
3. Al enviar:
   - Se busca el usuario en `users` por email (normalizado a minúsculas)
   - Se verifica la contraseña contra `password_hash` con scrypt timing-safe compare
   - En caso de éxito: JWT cookie, redirect a `/account`
   - En caso de fallo: mensaje amigable "Credenciales incorrectas…"

## Cómo funcionó la activación (referencia)

```bash
# 1. Asegurar que las tablas existan
bun run db:auth:migrate
# → CREATE TABLE IF NOT EXISTS users (id, name, email, emailVerified, image, password_hash, ...)
# → CREATE TABLE IF NOT EXISTS accounts, sessions, verification_token
# → Idempotente: no borra datos si ya existen

# 2. Los cambios de código ya están aplicados en:
#    - auth.ts         → Credentials.authorize() consulta Neon y verifica hash
#    - register/actions.ts → inserta en users, auto-login, redirect /account
```

---

## Cómo activar Google OAuth

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Crea un OAuth 2.0 Client ID
3. URIs de redirección autorizados:
   ```
   http://localhost:3000/api/auth/callback/google        (desarrollo)
   https://tu-dominio.com/api/auth/callback/google       (producción)
   ```
4. Copia las credenciales en `.env.local`:
   ```env
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```
5. El proveedor se activa automáticamente — no se requiere ningún cambio de código

---

## Cómo activar Facebook OAuth

1. Ve a [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App
2. Añade el producto "Facebook Login"
3. URIs de redirección:
   ```
   http://localhost:3000/api/auth/callback/facebook
   https://tu-dominio.com/api/auth/callback/facebook
   ```
4. Copia las credenciales en `.env.local`:
   ```env
   FACEBOOK_CLIENT_ID="..."
   FACEBOOK_CLIENT_SECRET="..."
   ```
5. El proveedor se activa automáticamente

---

## Tablas que requiere Auth.js

Creadas por `scripts/db/auth-migration.sql`:

| Tabla | Descripción |
|---|---|
| `users` | Clientes del storefront (email, name, image) |
| `accounts` | Cuentas OAuth vinculadas a un usuario |
| `sessions` | Sesiones activas (strategy: "database") |
| `verification_token` | Tokens para magic link / email verification |

> ⚠️ El nombre es `verification_token` en **singular**.
> `@auth/neon-adapter` busca exactamente ese nombre.

La columna `password_hash` **no está en la migración base** — se añade
manualmente cuando se activa Credentials (ver sección anterior).

---

## Cómo funciona con Neon cuando esté listo

```
Cliente → POST /api/auth/callback/credentials
         → Auth.js llama Credentials.authorize(email, password)
         → authorize() hace SELECT en tabla `users` via DATABASE_URL
         → verifica password_hash con verifyPassword() (Node crypto.scrypt)
         → retorna { id, name, email }
         → Auth.js crea sesión en tabla `sessions`
         → devuelve cookie de sesión al cliente

Cliente → GET /api/auth/session
         → Auth.js lee la sesión desde la tabla `sessions`
         → retorna { user: { id, name, email }, expires }
```

Con OAuth (Google/Facebook):
```
Cliente → GET /api/auth/signin/google
         → redirect a Google
         → Google → POST /api/auth/callback/google
         → Auth.js crea/actualiza registro en `users` y `accounts`
         → crea sesión en `sessions`
```

---

## Estrategia de sesión

| Condición | Estrategia | Almacenamiento |
|---|---|---|
| `DATABASE_URL` presente | `database` | Tabla `sessions` en Neon |
| `DATABASE_URL` ausente | `jwt` | Cookie firmada (stateless) |

En modo `jwt` (sin DB), las sesiones funcionan pero **no persisten** entre
reinicios del servidor (la firma cambia si AUTH_SECRET cambia).

---

## Pendientes para fases futuras

1. **Google OAuth** — Añadir `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` en `.env.local` y quitar el botón `disabled` en `LoginForm.tsx`
2. **Facebook OAuth** — Ídem con `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
3. **AUTH_URL** — Configurar con el dominio exacto en producción
4. **Email verification** — Activar verificación de correo antes de permitir login
5. **Forgot password** — Implementar flujo de recuperación de contraseña

---

## Separación Payload admin vs Auth.js storefront

```
/admin  → Payload CMS → tabla `admins` → isAdmin() en payload-access.ts
                         sin relación con Auth.js

/login  → Auth.js     → tabla `users`  → Credentials / Google / Facebook
/account             → SessionProvider → useSession() → getSessionSafe()
```

Un administrador de Payload **no puede** iniciar sesión como cliente del
storefront con las mismas credenciales, y viceversa.
