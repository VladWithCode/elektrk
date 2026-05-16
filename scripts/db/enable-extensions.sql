-- =============================================================================
-- ElektrK — Extensiones PostgreSQL
-- Ejecutar ANTES de cualquier migración.
-- Requiere conexión directa (DATABASE_URL_UNPOOLED).
--
-- Uso:
--   psql "$DATABASE_URL_UNPOOLED" -f scripts/db/enable-extensions.sql
--   -- o pegar directamente en: Neon Dashboard → SQL Editor
-- =============================================================================

-- pg_trgm: búsqueda por similitud y LIKE indexado para el catálogo.
-- REQUERIDO: auth-migration.sql crea un índice gin_trgm_ops sobre users.name.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- uuid-ossp: OPCIONAL en PostgreSQL 13+.
-- gen_random_uuid() está disponible de forma nativa en PostgreSQL 13+ sin esta
-- extensión, y Neon usa PostgreSQL 16. Solo instalarla si alguna herramienta
-- externa necesita explícitamente uuid_generate_v4().
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Confirmar extensiones activas
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_trgm', 'uuid-ossp')
ORDER BY extname;
