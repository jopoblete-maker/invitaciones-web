-- Phase 3D transactional versioning RPCs.
-- Deep event validation and payload limits remain application responsibilities.
-- Large legacy snapshots may add roughly 5.72 MB per new version.

CREATE FUNCTION public.create_event_version(
    p_event_id text,
    p_content jsonb,
    p_expected_working_version_id uuid,
    p_source_version_id uuid DEFAULT NULL,
    p_initial_workflow text DEFAULT 'draft'
)
RETURNS TABLE(version_id uuid, version_number bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event public.eventos%ROWTYPE;
    v_source public.event_versions%ROWTYPE;
    v_next_number bigint;
    v_new_id uuid;
BEGIN
    SELECT e.* INTO v_event
    FROM public.eventos e
    WHERE e.id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_NOT_FOUND';
    END IF;
    IF v_event.event_status <> 'active' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_ARCHIVED';
    END IF;
    IF v_event.current_working_version_id
       IS DISTINCT FROM p_expected_working_version_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_CONFLICT';
    END IF;
    IF p_content IS NULL OR jsonb_typeof(p_content) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_EVENT';
    END IF;
    IF p_initial_workflow NOT IN (
        'draft', 'ready_for_preview', 'in_review',
        'changes_requested', 'approved'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_WORKFLOW';
    END IF;

    IF p_source_version_id IS NOT NULL THEN
        SELECT v.* INTO v_source
        FROM public.event_versions v
        WHERE v.id = p_source_version_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_NOT_FOUND';
        END IF;
        IF v_source.event_id <> p_event_id THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_EVENT_MISMATCH';
        END IF;
    END IF;

    -- Safe because every writer locks the same parent event row first.
    SELECT COALESCE(max(v.version_number), 0) + 1 INTO v_next_number
    FROM public.event_versions v
    WHERE v.event_id = p_event_id;

    INSERT INTO public.event_versions (
        event_id, version_number, content, schema_version,
        workflow_status, source_version_id
    )
    VALUES (
        p_event_id,
        v_next_number,
        p_content,
        CASE
            WHEN (p_content->>'schema_version') ~ '^[1-9][0-9]*$'
            THEN CASE
                WHEN (p_content->>'schema_version')::numeric <= 32767
                THEN (p_content->>'schema_version')::smallint
                ELSE NULL
            END
            ELSE NULL
        END,
        p_initial_workflow,
        p_source_version_id
    )
    RETURNING id INTO v_new_id;

    UPDATE public.eventos
    SET current_working_version_id = v_new_id
    WHERE id = p_event_id;

    RETURN QUERY SELECT v_new_id, v_next_number;
END
$function$;

CREATE FUNCTION public.publish_event_version(
    p_event_id text,
    p_version_id uuid
)
RETURNS TABLE(event_id text, published_version_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event public.eventos%ROWTYPE;
    v_version public.event_versions%ROWTYPE;
BEGIN
    SELECT e.* INTO v_event
    FROM public.eventos e
    WHERE e.id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_NOT_FOUND';
    END IF;
    IF v_event.event_status <> 'active' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_ARCHIVED';
    END IF;

    SELECT v.* INTO v_version
    FROM public.event_versions v
    WHERE v.id = p_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_NOT_FOUND';
    END IF;
    IF v_version.event_id <> p_event_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_EVENT_MISMATCH';
    END IF;
    IF v_version.workflow_status <> 'approved' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_WORKFLOW';
    END IF;
    IF v_event.current_working_version_id IS DISTINCT FROM p_version_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_CONFLICT';
    END IF;

    UPDATE public.event_versions
    SET published_at = COALESCE(published_at, transaction_timestamp())
    WHERE id = p_version_id;

    UPDATE public.eventos
    SET published_version_id = p_version_id,
        current_working_version_id = NULL
    WHERE id = p_event_id;

    RETURN QUERY SELECT p_event_id, p_version_id;
END
$function$;

CREATE FUNCTION public.rollback_event_version(
    p_event_id text,
    p_version_id uuid
)
RETURNS TABLE(event_id text, published_version_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event public.eventos%ROWTYPE;
    v_version public.event_versions%ROWTYPE;
BEGIN
    SELECT e.* INTO v_event
    FROM public.eventos e
    WHERE e.id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_NOT_FOUND';
    END IF;
    IF v_event.event_status <> 'active' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_ARCHIVED';
    END IF;

    SELECT v.* INTO v_version
    FROM public.event_versions v
    WHERE v.id = p_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_NOT_FOUND';
    END IF;
    IF v_version.event_id <> p_event_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_EVENT_MISMATCH';
    END IF;
    IF v_version.published_at IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_WORKFLOW';
    END IF;

    -- Preserve any existing working draft while changing only public history.
    UPDATE public.eventos
    SET published_version_id = p_version_id
    WHERE id = p_event_id;

    RETURN QUERY SELECT p_event_id, p_version_id;
END
$function$;

CREATE FUNCTION public.archive_event(p_event_id text)
RETURNS TABLE(event_id text, event_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event public.eventos%ROWTYPE;
BEGIN
    SELECT e.* INTO v_event
    FROM public.eventos e
    WHERE e.id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_NOT_FOUND';
    END IF;

    IF v_event.event_status <> 'archived' THEN
        UPDATE public.eventos
        SET event_status = 'archived'
        WHERE id = p_event_id;
    END IF;

    RETURN QUERY SELECT p_event_id, 'archived'::text;
END
$function$;

-- SECURITY DEFINER functions must not inherit PostgreSQL's default PUBLIC EXECUTE.
-- The future backend-role grants are intentionally isolated in 06-security-future.sql.
REVOKE ALL ON FUNCTION public.create_event_version(text, jsonb, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_event_version(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_event_version(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_event(text) FROM PUBLIC;
