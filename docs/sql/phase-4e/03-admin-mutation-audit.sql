-- Phase 4E-B3-A5-RPC-AUDIT: transactional administrative mutation wrappers.
-- The existing business RPC signatures remain unchanged. These wrappers are
-- the only administrative path that couples each mutation to its audit row.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_event_version_audited(
    p_event_id text,
    p_content jsonb,
    p_expected_working_version_id uuid,
    p_source_version_id uuid,
    p_initial_workflow text,
    p_admin_identity text,
    p_ip inet,
    p_origin text,
    p_action text
)
RETURNS TABLE(version_id uuid, version_number bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_version_id uuid;
    v_version_number bigint;
BEGIN
    IF p_admin_identity IS DISTINCT FROM 'shared-admin-credential'
       OR p_action IS DISTINCT FROM 'CREATE_VERSION' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_AUDIT_PARAMETERS';
    END IF;

    SELECT r.version_id, r.version_number
    INTO v_version_id, v_version_number
    FROM public.create_event_version(
        p_event_id,
        p_content,
        p_expected_working_version_id,
        p_source_version_id,
        p_initial_workflow
    ) AS r;

    PERFORM public.append_admin_audit(
        p_event_id,
        v_version_id,
        p_action,
        'success',
        NULL,
        p_admin_identity,
        p_ip,
        p_origin
    );

    RETURN QUERY SELECT v_version_id, v_version_number;
END
$function$;

CREATE OR REPLACE FUNCTION public.transition_event_version_workflow_audited(
    p_event_id text,
    p_version_id uuid,
    p_expected_status text,
    p_target_status text,
    p_admin_identity text,
    p_ip inet,
    p_origin text,
    p_action text
)
RETURNS TABLE(event_id text, version_id uuid, workflow_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event_id text;
    v_version_id uuid;
    v_workflow_status text;
    v_expected_action text;
BEGIN
    v_expected_action := CASE
        WHEN p_target_status = 'approved' THEN 'APPROVE_VERSION'
        ELSE 'CHANGE_WORKFLOW'
    END;

    IF p_admin_identity IS DISTINCT FROM 'shared-admin-credential'
       OR p_action IS DISTINCT FROM v_expected_action
       OR (p_target_status = 'approved' AND p_expected_status IS DISTINCT FROM 'in_review') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_AUDIT_PARAMETERS';
    END IF;

    SELECT r.event_id, r.version_id, r.workflow_status
    INTO v_event_id, v_version_id, v_workflow_status
    FROM public.transition_event_version_workflow(
        p_event_id,
        p_version_id,
        p_expected_status,
        p_target_status
    ) AS r;

    PERFORM public.append_admin_audit(
        v_event_id,
        v_version_id,
        v_expected_action,
        'success',
        NULL,
        p_admin_identity,
        p_ip,
        p_origin
    );

    RETURN QUERY SELECT v_event_id, v_version_id, v_workflow_status;
END
$function$;

CREATE OR REPLACE FUNCTION public.publish_event_version_audited(
    p_event_id text,
    p_version_id uuid,
    p_admin_identity text,
    p_ip inet,
    p_origin text,
    p_action text
)
RETURNS TABLE(event_id text, published_version_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_event_id text;
    v_published_version_id uuid;
BEGIN
    IF p_admin_identity IS DISTINCT FROM 'shared-admin-credential'
       OR p_action IS DISTINCT FROM 'PUBLISH_VERSION' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_AUDIT_PARAMETERS';
    END IF;

    SELECT r.event_id, r.published_version_id
    INTO v_event_id, v_published_version_id
    FROM public.publish_event_version(p_event_id, p_version_id) AS r;

    PERFORM public.append_admin_audit(
        v_event_id,
        v_published_version_id,
        p_action,
        'success',
        NULL,
        p_admin_identity,
        p_ip,
        p_origin
    );

    RETURN QUERY SELECT v_event_id, v_published_version_id;
END
$function$;

REVOKE ALL ON FUNCTION public.create_event_version_audited(text, jsonb, uuid, uuid, text, text, inet, text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_event_version_workflow_audited(text, uuid, text, text, text, inet, text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_event_version_audited(text, uuid, text, inet, text, text)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_event_version_audited(text, jsonb, uuid, uuid, text, text, inet, text, text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_event_version_workflow_audited(text, uuid, text, text, text, inet, text, text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_event_version_audited(text, uuid, text, inet, text, text)
    TO service_role;

COMMIT;
