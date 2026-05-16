-- =============================================================================
-- Auth.js (NextAuth v5) — Migración de tablas para clientes del storefront
-- Ejecutar MANUALMENTE en Neon Dashboard o via psql ANTES de arrancar el proyecto
-- Estas tablas son propiedad exclusiva de Auth.js y no las toca PayloadCMS
-- =============================================================================

-- Tabla de clientes (storefront users)
-- NOTA: Esta tabla es "users", distinta de "admins" que maneja Payload
CREATE TABLE IF NOT EXISTS users (
  id               TEXT         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             VARCHAR(255),
  email            VARCHAR(255) UNIQUE,
  "emailVerified"  TIMESTAMPTZ,
  image            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tabla de cuentas OAuth vinculadas (para Google, GitHub, etc. en fases futuras)
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

-- Tabla de sesiones activas de clientes
CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"       TEXT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ  NOT NULL,
  "sessionToken" VARCHAR(255) NOT NULL UNIQUE
);

-- Tabla de tokens de verificación (magic link / email verification)
-- IMPORTANTE: nombre en singular "verification_token" tal como espera @auth/neon-adapter
CREATE TABLE IF NOT EXISTS verification_token (
  identifier  TEXT         NOT NULL,
  expires     TIMESTAMPTZ  NOT NULL,
  token       TEXT         NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Índices para performance en consultas de sesión
CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON sessions("userId");
CREATE INDEX IF NOT EXISTS idx_accounts_user_id        ON accounts("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_session_token  ON sessions("sessionToken");
CREATE INDEX IF NOT EXISTS idx_users_email             ON users(email);

-- =============================================================================
-- VERIFICACIÓN: después de ejecutar, confirmar con:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
--
-- Deberías ver: accounts, sessions, users, verification_token
-- NO deberías ver conflicto con tablas de Payload (admins, media, payload_migrations)
-- =============================================================================
