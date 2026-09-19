-- Phase 3F-C1: controlled workflow transitions for event versions.
-- REVIEW ARTIFACT ONLY: do not execute without production approval.
--
-- Publication remains exclusively controlled by eventos.published_version_id.
-- This function changes only event_versions.workflow_status.
-- On first creation, the role executing this migration will own the function;
-- later CREATE OR REPLACE executions preserve that owner. Confirm it is the
-- trusted migration/owner role before production execution.

CREATE OR REPLACE FUNCTION public.transition_event_version_workflow(
    p_event_id text,
    p_version_id uuid,
    p_expected_status text,
    p_target_status text
)
RETURNS TABLE(event_id text, version_id uuid, workflow_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event public.eventos%ROWTYPE;
    v_version public.event_versions%ROWTYPE;
BEGIN
    -- Lock the stable identity first, matching the order used by the other
    -- versioning RPCs and serializing transitions for the same event.
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
    WHERE v.id = p_version_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_NOT_FOUND';
    END IF;
    IF v_version.event_id <> p_event_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_EVENT_MISMATCH';
    END IF;
    IF v_event.current_working_version_id IS DISTINCT FROM p_version_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VERSION_CONFLICT';
    END IF;
    IF v_version.workflow_status IS DISTINCT FROM p_expected_status THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_WORKFLOW';
    END IF;

    IF p_expected_status IS NULL
       OR p_target_status IS NULL
       OR NOT (
           (p_expected_status = 'draft' AND p_target_status = 'in_review')
           OR (p_expected_status = 'in_review' AND p_target_status = 'approved')
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_WORKFLOW';
    END IF;

    UPDATE public.event_versions v
    SET workflow_status = p_target_status
    WHERE v.id = p_version_id;

    RETURN QUERY
    SELECT p_event_id, p_version_id, p_target_status;
END
$function$;

-- SECURITY DEFINER functions must not inherit PostgreSQL's default PUBLIC EXECUTE.
REVOKE ALL ON FUNCTION public.transition_event_version_workflow(text, uuid, text, text)
    FROM PUBLIC;

-- Execute permissions are intentionally separated from function creation.
-- Review and apply 00-preflight-security.sql before the least-privilege grants
-- in 02-backend-rpc-grants.sql. Neither script grants direct table writes.
