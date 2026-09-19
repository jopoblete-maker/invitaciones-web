-- Phase 3F-C2: least-privilege EXECUTE grants for backend versioning RPCs.
-- REVIEW ARTIFACT ONLY: run manually after 00-preflight-security.sql confirms
-- the five exact function signatures and the built-in service_role role.
-- No table, sequence, schema, anon, authenticated, or PUBLIC grant is added.

BEGIN;

-- Remove inherited/default exposure and any explicit browser-role access.
REVOKE ALL ON FUNCTION public.create_event_version(text, jsonb, uuid, uuid, text)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_event_version(text, jsonb, uuid, uuid, text)
    FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.publish_event_version(text, uuid)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_event_version(text, uuid)
    FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.rollback_event_version(text, uuid)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_event_version(text, uuid)
    FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.archive_event(text)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_event(text)
    FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.transition_event_version_workflow(text, uuid, text, text)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_event_version_workflow(text, uuid, text, text)
    FROM anon, authenticated;

-- The Supabase Data API maps a Secret API Key (sb_secret_...) to service_role.
GRANT EXECUTE ON FUNCTION public.create_event_version(text, jsonb, uuid, uuid, text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_event_version(text, uuid)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_event_version(text, uuid)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_event(text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_event_version_workflow(text, uuid, text, text)
    TO service_role;

COMMIT;
