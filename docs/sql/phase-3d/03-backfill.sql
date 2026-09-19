-- Phase 3D V1 backfill. Pause application writes before running.
-- transaction_timestamp() is the single logical migration timestamp. It does
-- not represent the historical creation or publication time of any event.
BEGIN;

LOCK TABLE public.eventos IN SHARE ROW EXCLUSIVE MODE;

DO $guard$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.eventos
        WHERE datos IS NULL OR jsonb_typeof(datos) <> 'object'
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'BACKFILL_INVALID_DATOS';
    END IF;

    IF EXISTS (SELECT 1 FROM public.event_versions) THEN
        RAISE EXCEPTION USING MESSAGE = 'BACKFILL_VERSIONS_ALREADY_EXIST';
    END IF;
END
$guard$;

INSERT INTO public.event_versions (
    event_id,
    version_number,
    content,
    schema_version,
    workflow_status,
    source_version_id,
    created_at,
    published_at
)
SELECT
    e.id,
    1,
    e.datos,
    CASE
        WHEN (e.datos->>'schema_version') ~ '^[1-9][0-9]*$'
        THEN CASE
            WHEN (e.datos->>'schema_version')::numeric <= 32767
            THEN (e.datos->>'schema_version')::smallint
            ELSE NULL
        END
        ELSE NULL
    END,
    'approved',
    NULL,
    transaction_timestamp(),
    transaction_timestamp()
FROM public.eventos e;

DO $equality$
BEGIN
    IF (SELECT count(*) FROM public.event_versions WHERE version_number = 1)
       <> (SELECT count(*) FROM public.eventos)
    THEN
        RAISE EXCEPTION USING MESSAGE = 'BACKFILL_COUNT_MISMATCH';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.eventos e
        LEFT JOIN public.event_versions v
          ON v.event_id = e.id AND v.version_number = 1
        WHERE v.id IS NULL OR e.datos IS DISTINCT FROM v.content
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'BACKFILL_SNAPSHOT_MISMATCH';
    END IF;
END
$equality$;

UPDATE public.eventos e
SET published_version_id = v.id,
    current_working_version_id = NULL,
    created_at = transaction_timestamp(),
    updated_at = transaction_timestamp()
FROM public.event_versions v
WHERE v.event_id = e.id AND v.version_number = 1;

ALTER TABLE public.eventos
    ADD CONSTRAINT eventos_published_version_same_event_fk
        FOREIGN KEY (id, published_version_id)
        REFERENCES public.event_versions(event_id, id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY IMMEDIATE,
    ADD CONSTRAINT eventos_working_version_same_event_fk
        FOREIGN KEY (id, current_working_version_id)
        REFERENCES public.event_versions(event_id, id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY IMMEDIATE;

DO $final_check$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.eventos e
        LEFT JOIN public.event_versions v
          ON v.event_id = e.id AND v.id = e.published_version_id
        WHERE e.published_version_id IS NULL
           OR v.id IS NULL
           OR e.datos IS DISTINCT FROM v.content
           OR e.current_working_version_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION USING MESSAGE = 'BACKFILL_FINAL_VERIFICATION_FAILED';
    END IF;
END
$final_check$;

COMMIT;
