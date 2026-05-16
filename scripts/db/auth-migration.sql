-- =============================================================================
-- ElektrK — Migración de tablas Auth.js (next-auth v5 / @auth/neon-adapter)
--
-- IMPORTANTE: ejecutar ANTES de las migraciones de Payload y DESPUÉS de
-- haber habilitado extensiones (scripts/db/enable-extensions.sql).
-- Estas tablas son propiedad exclusiva de Auth.js y NUNCA las toca Payload.
--
-- Payload usa la colección "admins" (tabla: admins) para el panel /admin.
-- Auth.js usa la tabla "users" para los clientes del storefront.
-- No hay colisión porque Payload NO crea tabla "users".
--
-- Uso:
--   psql "$DATABASE_URL_UNPOOLED" -f scripts/db/auth-migration.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users — clientes del storefront (≠ admins de Payload)
--
-- password_hash: almacena el hash scrypt generado por src/lib/auth/password.ts
--   formato: "<16-byte-salt-hex>:<64-byte-derived-key-hex>"
--   se llena solo cuando el cliente usa Credentials (email+password).
--   usuarios OAuth (Google, Facebook) quedan con password_hash NULL.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              TEXT         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            VARCHAR(255),
  email           VARCHAR(255) UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image           TEXT,
  password_hash   TEXT,                              -- Credentials provider
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Idempotencia: si la tabla ya existía sin la columna, agregarla sin error.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- -----------------------------------------------------------------------------
-- accounts — cuentas OAuth vinculadas a un usuario (Google, Facebook, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id                   TEXT         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"             TEXT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                 VARCHAR(255) NOT NULL,
  provider             VARCHAR(255) NOT NULL,
  "providerAccountId"  VARCHAR(255) NOT NULL,
  refresh_token        TEXT,
  access_token         TEXT,
  expires_at           BIGINT,
  id_token             TEXT,
  scope                TEXT,
  session_state        TEXT,
  token_type           TEXT,
  UNIQUE(provider, "providerAccountId")
);

-- -----------------------------------------------------------------------------
-- sessions — sesiones activas de clientes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"       TEXT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ  NOT NULL,
  "sessionToken" VARCHAR(255) NOT NULL UNIQUE
);

-- -----------------------------------------------------------------------------
-- verification_token — tokens de magic link / verificación de email
-- CRÍTICO: nombre en SINGULAR, tal como espera @auth/neon-adapter.
--          La tabla "verification_tokens" (plural) causaría un error silencioso.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_token (
  identifier  TEXT        NOT NULL,
  expires     TIMESTAMPTZ NOT NULL,
  token       TEXT        NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- -----------------------------------------------------------------------------
-- Índices de performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id       ON accounts("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions("sessionToken");

-- Índice trigram en users.name para búsqueda fuzzy (requiere pg_trgm)
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (name gin_trgm_ops);

-- =============================================================================
-- Verificación inmediata
-- =============================================================================
DO $$
DECLARE
  missing TEXT := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name   = 'users')              THEN missing := missing || ' users';              END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name   = 'accounts')           THEN missing := missing || ' accounts';           END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name   = 'sessions')           THEN missing := missing || ' sessions';           END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_schema = 'public' AND table_name   = 'verification_token') THEN missing := missing || ' verification_token'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name   = 'users' AND column_name = 'password_hash') THEN missing := missing || ' users.password_hash'; END IF;

  IF missing = '' THEN
    RAISE NOTICE 'OK — Auth.js tables (including users.password_hash) created successfully.';
  ELSE
    RAISE EXCEPTION 'MISSING:%', missing;
  END IF;
END $$;
