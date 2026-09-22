-- Phase 4E-B3-A4: append-only administrative audit storage.
-- Additive only. Business RPCs are intentionally not changed in this phase.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp timestamptz NOT NULL DEFAULT transaction_timestamp(),
    event_id text NULL,
    version_id uuid NULL,
    action text NOT NULL,
    result text NOT NULL,
    error_code text NULL,
    admin_identity text NOT NULL,
    ip inet NULL,
    origin text NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_log_timestamp_idx
    ON public.admin_audit_log (timestamp);
CREATE INDEX IF NOT EXISTS admin_audit_log_event_timestamp_idx
    ON public.admin_audit_log (event_id, timestamp);
CREATE INDEX IF NOT EXISTS admin_audit_log_version_timestamp_idx
    ON public.admin_audit_log (version_id, timestamp);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_timestamp_idx
    ON public.admin_audit_log (action, timestamp);

CREATE OR REPLACE FUNCTION public.guard_admin_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('app.admin_audit_retention_cleanup', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ADMIN_AUDIT_LOG_APPEND_ONLY';
END
$function$;

DROP TRIGGER IF EXISTS admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.append_admin_audit(
    p_event_id text,
    p_version_id uuid,
    p_action text,
    p_result text,
    p_error_code text,
    p_admin_identity text,
    p_ip inet,
    p_origin text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_id uuid;
BEGIN
    IF p_admin_identity IS DISTINCT FROM 'shared-admin-credential'
       OR p_action IS NULL OR length(p_action) = 0 OR length(p_action) > 100
       OR p_result IS NULL OR length(p_result) = 0 OR length(p_result) > 50
       THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_AUDIT_PARAMETERS';
    END IF;

    INSERT INTO public.admin_audit_log (
        event_id, version_id, action, result, error_code,
        admin_identity, ip, origin
    ) VALUES (
        p_event_id, p_version_id, p_action, p_result, p_error_code,
        p_admin_identity, p_ip, p_origin
    ) RETURNING id INTO v_id;

    RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.purge_admin_audit_before(p_before timestamptz)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_deleted bigint;
BEGIN
    IF p_before IS NULL OR p_before > (clock_timestamp() - interval '12 months') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_AUDIT_RETENTION_BOUNDARY';
    END IF;

    PERFORM set_config('app.admin_audit_retention_cleanup', 'on', true);
    DELETE FROM public.admin_audit_log WHERE timestamp < p_before;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END
$function$;

REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.append_admin_audit(text, uuid, text, text, text, text, inet, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_admin_audit_before(timestamptz)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_admin_audit(text, uuid, text, text, text, text, inet, text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_admin_audit_before(timestamptz)
    TO service_role;

COMMIT;
