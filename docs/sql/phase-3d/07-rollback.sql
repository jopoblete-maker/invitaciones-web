-- Phase 3D rollback for stages A and B only.
--
-- A: structure exists without backfill. This removes the new empty objects.
-- B: backfill exists while the app still reads eventos.datos. This removes the
--    shadow copy and restores the legacy shape; eventos.datos stays untouched.
-- C: if versioning has accepted V2+, DO NOT run this destructive rollback.
--    Redeploy legacy reads first and preserve event_versions for recovery.

BEGIN;

DO $rollback_guard$
BEGIN
    IF to_regclass('public.event_versions') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM public.event_versions WHERE version_number > 1
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'ROLLBACK_BLOCKED_VERSION_HISTORY_EXISTS';
    END IF;
END
$rollback_guard$;

DROP FUNCTION IF EXISTS public.create_event_version(text, jsonb, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.publish_event_version(text, uuid);
DROP FUNCTION IF EXISTS public.rollback_event_version(text, uuid);
DROP FUNCTION IF EXISTS public.archive_event(text);

DROP TRIGGER IF EXISTS eventos_touch_updated_at ON public.eventos;
DROP FUNCTION IF EXISTS public.touch_event_updated_at();

ALTER TABLE public.eventos
    DROP CONSTRAINT IF EXISTS eventos_published_version_same_event_fk,
    DROP CONSTRAINT IF EXISTS eventos_working_version_same_event_fk;

DROP TRIGGER IF EXISTS event_versions_protect_snapshot ON public.event_versions;
DROP FUNCTION IF EXISTS public.protect_event_version_snapshot();

DROP TABLE IF EXISTS public.event_versions;

ALTER TABLE public.eventos
    DROP CONSTRAINT IF EXISTS eventos_event_status_ck,
    DROP COLUMN IF EXISTS published_version_id,
    DROP COLUMN IF EXISTS current_working_version_id,
    DROP COLUMN IF EXISTS event_status,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS updated_at;

COMMIT;

-- Stage C recovery is intentionally not automated here. Once any V2/V3 exists:
-- 1. Keep public.event_versions and every pointer/history column.
-- 2. Restore server reads from public.eventos.datos before changing DB objects.
-- 3. Design a forward recovery that preserves version-only edits.
