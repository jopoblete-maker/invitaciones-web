-- Phase 3F-F2: atomically create a stable event identity and its V1 draft.
-- REVIEW ARTIFACT ONLY: do not execute without production approval.
-- eventos.datos remains NOT NULL, so it receives the initial snapshot solely
-- for transitional schema compatibility. Public reads must treat an event with
-- no published pointer and a working pointer as unpublished.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_versioned_event(
    p_event_id text,
    p_content jsonb
)
RETURNS TABLE(
    event_id text,
    version_id uuid,
    version_number bigint,
    workflow_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_version_id uuid;
    v_inserted_count bigint;
    v_schema_version smallint;
BEGIN
    IF p_event_id IS NULL
       OR p_event_id = ''
       OR p_event_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_EVENT_ID';
    END IF;

    IF p_content IS NULL OR pg_catalog.jsonb_typeof(p_content) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_EVENT';
    END IF;
    IF p_content ? 'id'
       AND (p_content->>'id') IS DISTINCT FROM p_event_id
    THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_EVENT';
    END IF;
    IF p_content ? 'schema_version'
       AND COALESCE(p_content->>'schema_version', '') NOT IN ('1', '2')
    THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_EVENT';
    END IF;

    v_schema_version := CASE
        WHEN p_content ? 'schema_version'
        THEN (p_content->>'schema_version')::smallint
        ELSE NULL
    END;

    INSERT INTO public.eventos (
        id,
        datos,
        published_version_id,
        current_working_version_id,
        event_status
    )
    VALUES (p_event_id, p_content, NULL, NULL, 'active')
    ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    IF v_inserted_count <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_ALREADY_EXISTS';
    END IF;

    INSERT INTO public.event_versions (
        event_id,
        version_number,
        content,
        schema_version,
        workflow_status,
        source_version_id,
        published_at
    )
    VALUES (
        p_event_id,
        1,
        p_content,
        v_schema_version,
        'draft',
        NULL,
        NULL
    )
    RETURNING id INTO v_version_id;

    UPDATE public.eventos
    SET current_working_version_id = v_version_id
    WHERE id = p_event_id;

    RETURN QUERY
    SELECT p_event_id, v_version_id, 1::bigint, 'draft'::text;
END
$function$;

REVOKE ALL ON FUNCTION public.create_versioned_event(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_versioned_event(text, jsonb)
    FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_versioned_event(text, jsonb)
    TO service_role;

COMMIT;
