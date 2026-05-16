-- =============================================================================
-- ElektrK — Verificación de schema
-- Ejecutar después de TODAS las migraciones (Auth.js + Payload).
--
-- Uso:
--   psql "$DATABASE_URL_UNPOOLED" -f scripts/db/verify-schema.sql
--
-- Resultado esperado: todas las tablas muestran "OK". Si alguna aparece como
-- "MISSING", la migración correspondiente no se ejecutó correctamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Inventario completo: todas las tablas en el schema public
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [1] Todas las tablas en schema public ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- 2. Tablas de Auth.js — muestra OK o MISSING para cada una esperada
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [2] Tablas Auth.js (esperado: 4 filas en OK) ==='
SELECT
  expected.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN 'OK' ELSE '*** MISSING ***' END AS status
FROM (VALUES
  ('users'),
  ('accounts'),
  ('sessions'),
  ('verification_token')
) AS expected(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_name = expected.table_name
  AND t.table_schema = 'public'
ORDER BY expected.table_name;

-- -----------------------------------------------------------------------------
-- 3. Alerta: verification_tokens (plural) NO debe existir
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [3] Alerta: verification_tokens (plural) NO debe existir ==='
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'verification_tokens'
    )
    THEN 'ERROR — existe "verification_tokens" (plural). Eliminar y usar "verification_token" (singular).'
    ELSE 'OK — "verification_tokens" (plural) no existe.'
  END AS check_result;

-- -----------------------------------------------------------------------------
-- 4. Tablas de Payload — muestra OK o MISSING para cada una esperada
--    Payload convierte slugs con guiones a guiones_bajos:
--      colección "order-items" → tabla "order_items"
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [4] Tablas Payload (esperado: todas en OK) ==='
SELECT
  expected.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN 'OK' ELSE '*** MISSING ***' END AS status
FROM (VALUES
  ('admins'),
  ('media'),
  ('products'),
  ('variants'),
  ('orders'),
  ('order_items'),
  ('tickets'),
  ('settings'),
  ('payload_migrations'),
  ('payload_locked_documents'),
  ('payload_preferences')
) AS expected(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_name = expected.table_name
  AND t.table_schema = 'public'
ORDER BY expected.table_name;

-- -----------------------------------------------------------------------------
-- 5. Verificar que Payload NO creó su propia tabla "users"
--    La tabla users debe pertenecer a Auth.js y tener columna "emailVerified".
--    Si Payload hubiera creado users, tendría columnas distintas.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [5] Columnas de la tabla "users" (debe ser de Auth.js) ==='
\echo '    Columnas esperadas: id, name, email, emailVerified, image, created_at, updated_at'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- Señal de que es Auth.js: la columna "emailVerified" existe en camelCase con comillas
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'emailVerified'
    )
    THEN 'OK — "users" pertenece a Auth.js (tiene columna emailVerified).'
    ELSE 'ADVERTENCIA — "users" no tiene columna emailVerified. Verificar origen.'
  END AS ownership_check;

-- Verificar columna password_hash (requerida por Credentials provider)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'users'
        AND column_name  = 'password_hash'
    )
    THEN 'OK — columna "users.password_hash" existe (Credentials provider listo).'
    ELSE '*** MISSING *** — falta "users.password_hash". Ejecutar: bun run db:auth:migrate'
  END AS password_hash_check;

-- Verificar que NO existe colisión: Payload no debe crear "users"
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admins'
    )
    THEN 'OK — tabla "admins" existe (Payload usa admins, no users).'
    ELSE 'MISSING — tabla "admins" no existe. Ejecutar migraciones de Payload.'
  END AS payload_admins_check;

-- -----------------------------------------------------------------------------
-- 6. Historial de migraciones de Payload
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [6] Migraciones de Payload ejecutadas ==='
SELECT name, batch, created_at
FROM payload_migrations
ORDER BY batch, name;

-- -----------------------------------------------------------------------------
-- 7. Extensiones activas
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [7] Extensiones activas ==='
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_trgm', 'uuid-ossp')
ORDER BY extname;

-- Verificar que pg_trgm esté activa (requerida por auth-migration.sql)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm')
    THEN 'OK — pg_trgm activa.'
    ELSE '*** MISSING *** — pg_trgm no está activa. Ejecutar: bun run db:extensions'
  END AS pg_trgm_check;

-- -----------------------------------------------------------------------------
-- 8. Conteo de filas (sanity check post-seed)
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== [8] Conteo de filas por tabla ==='
SELECT
  relname AS table_name,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
