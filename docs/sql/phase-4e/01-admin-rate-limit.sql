-- Phase 4E-B3-A4: shared administrative rate-limit storage.
-- Additive only. Do not run automatically from the application.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_rate_limit_windows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    window_key text NOT NULL,
    window_started_at timestamptz NOT NULL,
    request_count integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT admin_rate_limit_windows_count_ck CHECK (request_count > 0),
    CONSTRAINT admin_rate_limit_windows_key_window_uq UNIQUE (window_key, window_started_at)
);

CREATE INDEX IF NOT EXISTS admin_rate_limit_windows_lookup_idx
    ON public.admin_rate_limit_windows (window_key, window_started_at);

CREATE OR REPLACE FUNCTION public.consume_admin_rate_limit(
    p_window_key text,
    p_window_seconds integer,
    p_max_requests integer
)
RETURNS TABLE(allowed boolean, retry_after_seconds integer, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_now timestamptz := clock_timestamp();
    v_started timestamptz;
    v_count integer;
    v_retry integer;
BEGIN
    IF p_window_key IS NULL OR length(p_window_key) = 0 OR length(p_window_key) > 512
       OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400
       OR p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 100000 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_RATE_LIMIT_PARAMETERS';
    END IF;

    v_started := to_timestamp(
        floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
    );

    -- Serialize requests for the same logical key across all application instances.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_window_key, 0));

    DELETE FROM public.admin_rate_limit_windows
    WHERE window_key = p_window_key
      AND window_started_at < v_started;

    INSERT INTO public.admin_rate_limit_windows (
        window_key, window_started_at, request_count
    ) VALUES (
        p_window_key, v_started, 1
    )
    ON CONFLICT (window_key, window_started_at)
    DO UPDATE SET
        request_count = public.admin_rate_limit_windows.request_count + 1,
        updated_at = transaction_timestamp()
    RETURNING request_count INTO v_count;

    v_retry := GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (v_started + (p_window_seconds * interval '1 second') - v_now)))::integer
    );

    RETURN QUERY SELECT v_count <= p_max_requests, v_retry, v_count;
END
$function$;

REVOKE ALL ON TABLE public.admin_rate_limit_windows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_admin_rate_limit(text, integer, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_admin_rate_limit(text, integer, integer)
    TO service_role;

COMMIT;
