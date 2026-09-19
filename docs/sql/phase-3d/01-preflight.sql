-- Phase 3D preflight. READ-ONLY: this script changes no persistent object or data.
-- Run with application writes paused. Any exception requires a fresh review.

DO $preflight$
DECLARE
    v_count bigint;
BEGIN
    IF to_regclass('public.eventos') IS NULL THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_EVENTOS_NOT_FOUND';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'eventos'
          AND column_name = 'id' AND data_type = 'text' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_EVENTOS_ID_CONTRACT_CHANGED';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'eventos'
          AND c.contype = 'p'
          AND pg_get_constraintdef(c.oid, true) = 'PRIMARY KEY (id)'
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_EVENTOS_ID_PK_CHANGED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'eventos'
          AND column_name = 'datos' AND data_type = 'jsonb' AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_EVENTOS_DATOS_CONTRACT_CHANGED';
    END IF;

    IF to_regclass('public.event_versions') IS NOT NULL THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_EVENT_VERSIONS_ALREADY_EXISTS';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'eventos'
          AND column_name IN (
              'published_version_id', 'current_working_version_id',
              'event_status', 'created_at', 'updated_at'
          )
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_VERSIONING_COLUMNS_ALREADY_EXIST';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'create_event_version', 'publish_event_version',
              'rollback_event_version', 'archive_event',
              'touch_event_updated_at', 'protect_event_version_snapshot'
          )
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_VERSIONING_FUNCTION_ALREADY_EXISTS';
    END IF;

    IF to_regprocedure('gen_random_uuid()') IS NULL THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_GEN_RANDOM_UUID_UNAVAILABLE';
    END IF;

    SELECT count(*) INTO v_count FROM public.eventos;
    IF v_count <> 3 THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_EVENT_COUNT_CHANGED',
            DETAIL = format('Expected 3 rows from 3D-B, found %s.', v_count);
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.eventos
        WHERE datos IS NULL OR jsonb_typeof(datos) <> 'object'
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_INVALID_DATOS';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.eventos
        WHERE id !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          AND id !~ '^[a-z0-9]+(-[a-z0-9]+)*-$'
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_INCOMPATIBLE_EVENT_ID';
    END IF;

    IF (SELECT count(*) FROM public.eventos WHERE datos->>'schema_version' = '1') <> 1
       OR (SELECT count(*) FROM public.eventos WHERE datos->>'schema_version' = '2') <> 0
       OR (SELECT count(*) FROM public.eventos WHERE datos->>'schema_version' IS NULL) <> 2
    THEN
        RAISE EXCEPTION USING MESSAGE = 'PREFLIGHT_SCHEMA_DISTRIBUTION_CHANGED';
    END IF;
END
$preflight$;

SELECT
    count(*) AS event_count,
    count(*) FILTER (WHERE id ~ '^[a-z0-9]+(-[a-z0-9]+)*$') AS strict_ids,
    count(*) FILTER (WHERE id ~ '^[a-z0-9]+(-[a-z0-9]+)*-$') AS trailing_hyphen_ids,
    count(*) FILTER (WHERE datos->>'schema_version' IS NULL) AS legacy_or_null,
    count(*) FILTER (WHERE datos->>'schema_version' = '1') AS schema_v1,
    count(*) FILTER (WHERE datos->>'schema_version' = '2') AS schema_v2,
    min(pg_column_size(datos)) AS min_datos_bytes,
    round(avg(pg_column_size(datos))) AS avg_datos_bytes,
    max(pg_column_size(datos)) AS max_datos_bytes
FROM public.eventos;
