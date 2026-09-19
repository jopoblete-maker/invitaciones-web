-- Phase 3F-C2: read-only security preflight for administrative RPCs.
-- Run manually and review every result before applying grants.
-- This script does not call any RPC and does not modify database state.

-- The expected backend role must exist. A Supabase Secret API Key uses this
-- built-in Postgres role when it accesses the Data API.
SELECT
    r.rolname,
    r.rolcanlogin,
    r.rolbypassrls
FROM pg_catalog.pg_roles r
WHERE r.rolname IN ('service_role', 'anon', 'authenticated')
ORDER BY r.rolname;

-- Verify exact signatures, ownership, SECURITY DEFINER, configured search_path,
-- and effective EXECUTE privileges. NULL privileges mean the referenced role
-- does not exist; false is the required result for PUBLIC/anon/authenticated.
WITH expected(function_name, identity_arguments, function_oid) AS (
    VALUES
        (
            'create_event_version',
            'text, jsonb, uuid, uuid, text',
            pg_catalog.to_regprocedure(
                'public.create_event_version(text,jsonb,uuid,uuid,text)'
            )
        ),
        (
            'publish_event_version',
            'text, uuid',
            pg_catalog.to_regprocedure('public.publish_event_version(text,uuid)')
        ),
        (
            'rollback_event_version',
            'text, uuid',
            pg_catalog.to_regprocedure('public.rollback_event_version(text,uuid)')
        ),
        (
            'archive_event',
            'text',
            pg_catalog.to_regprocedure('public.archive_event(text)')
        ),
        (
            'transition_event_version_workflow',
            'text, uuid, text, text',
            pg_catalog.to_regprocedure(
                'public.transition_event_version_workflow(text,uuid,text,text)'
            )
        )
),
functions AS (
    SELECT
        e.function_name,
        e.identity_arguments,
        p.oid AS function_oid,
        p.proowner,
        p.prosecdef,
        p.proconfig,
        p.proacl
    FROM expected e
    LEFT JOIN pg_catalog.pg_proc p
        ON p.oid = e.function_oid
),
roles AS (
    SELECT
        (
            SELECT r.oid FROM pg_catalog.pg_roles r
            WHERE r.rolname = 'service_role'
        ) AS service_role_oid,
        (
            SELECT r.oid FROM pg_catalog.pg_roles r
            WHERE r.rolname = 'anon'
        ) AS anon_oid,
        (
            SELECT r.oid FROM pg_catalog.pg_roles r
            WHERE r.rolname = 'authenticated'
        ) AS authenticated_oid
)
SELECT
    f.function_name,
    f.identity_arguments,
    f.function_oid IS NOT NULL AS function_exists,
    pg_catalog.pg_get_userbyid(f.proowner) AS owner,
    f.prosecdef AS security_definer,
    f.proconfig AS function_settings,
    CASE
        WHEN f.function_oid IS NULL THEN NULL
        ELSE EXISTS (
            SELECT 1
            FROM pg_catalog.aclexplode(
                COALESCE(
                    f.proacl,
                    pg_catalog.acldefault('f', f.proowner)
                )
            ) acl
            WHERE acl.grantee = 0
              AND acl.privilege_type = 'EXECUTE'
        )
    END AS public_can_execute,
    CASE
        WHEN f.function_oid IS NULL OR r.anon_oid IS NULL THEN NULL
        ELSE pg_catalog.has_function_privilege(r.anon_oid, f.function_oid, 'EXECUTE')
    END AS anon_can_execute,
    CASE
        WHEN f.function_oid IS NULL OR r.authenticated_oid IS NULL THEN NULL
        ELSE pg_catalog.has_function_privilege(
            r.authenticated_oid,
            f.function_oid,
            'EXECUTE'
        )
    END AS authenticated_can_execute,
    CASE
        WHEN f.function_oid IS NULL OR r.service_role_oid IS NULL THEN NULL
        ELSE pg_catalog.has_function_privilege(
            r.service_role_oid,
            f.function_oid,
            'EXECUTE'
        )
    END AS service_role_can_execute
FROM functions f
CROSS JOIN roles r
ORDER BY f.function_name;
