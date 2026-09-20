-- Phase 3F-F3: production preflight for create_versioned_event.
-- READ-ONLY: run manually in Supabase SQL Editor and review every result.
-- This script does not install functions, call RPCs, or modify rows.

-- 1. Required public.eventos columns and types.
WITH expected(column_name, data_type, udt_name, is_nullable) AS (
    VALUES
        ('id', 'text', 'text', 'NO'),
        ('datos', 'jsonb', 'jsonb', 'NO'),
        ('published_version_id', 'uuid', 'uuid', 'YES'),
        ('current_working_version_id', 'uuid', 'uuid', 'YES'),
        ('event_status', 'text', 'text', 'NO'),
        ('created_at', 'timestamp with time zone', 'timestamptz', 'NO'),
        ('updated_at', 'timestamp with time zone', 'timestamptz', 'NO')
)
SELECT
    e.column_name,
    c.column_name IS NOT NULL AS column_exists,
    c.data_type AS actual_data_type,
    c.udt_name AS actual_udt_name,
    c.is_nullable AS actual_is_nullable,
    c.data_type = e.data_type
        AND c.udt_name = e.udt_name
        AND c.is_nullable = e.is_nullable AS matches_expected
FROM expected e
LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = 'eventos'
   AND c.column_name = e.column_name
ORDER BY e.column_name;

-- eventos must exist, be owned explicitly, and have id as its primary key.
WITH relation AS (
    SELECT pg_catalog.to_regclass('public.eventos') AS oid
)
SELECT
    r.oid IS NOT NULL AS eventos_exists,
    pg_catalog.pg_get_userbyid(c.relowner) AS table_owner,
    con.conname AS primary_key_name,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS primary_key_definition,
    pg_catalog.pg_get_constraintdef(con.oid, true) = 'PRIMARY KEY (id)'
        AS id_is_primary_key
FROM relation r
LEFT JOIN pg_catalog.pg_class c ON c.oid = r.oid
LEFT JOIN pg_catalog.pg_constraint con
    ON con.conrelid = c.oid
   AND con.contype = 'p';

-- 2. Required public.event_versions columns and types.
WITH expected(column_name, data_type, udt_name, is_nullable) AS (
    VALUES
        ('id', 'uuid', 'uuid', 'NO'),
        ('event_id', 'text', 'text', 'NO'),
        ('version_number', 'bigint', 'int8', 'NO'),
        ('content', 'jsonb', 'jsonb', 'NO'),
        ('schema_version', 'smallint', 'int2', 'YES'),
        ('workflow_status', 'text', 'text', 'NO'),
        ('published_at', 'timestamp with time zone', 'timestamptz', 'YES'),
        ('source_version_id', 'uuid', 'uuid', 'YES')
)
SELECT
    e.column_name,
    c.column_name IS NOT NULL AS column_exists,
    c.data_type AS actual_data_type,
    c.udt_name AS actual_udt_name,
    c.is_nullable AS actual_is_nullable,
    c.data_type = e.data_type
        AND c.udt_name = e.udt_name
        AND c.is_nullable = e.is_nullable AS matches_expected
FROM expected e
LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = 'event_versions'
   AND c.column_name = e.column_name
ORDER BY e.column_name;

-- Ownership, primary key, unique(event_id, version_number), and all FKs.
WITH relation AS (
    SELECT pg_catalog.to_regclass('public.event_versions') AS oid
)
SELECT
    r.oid IS NOT NULL
        AS event_versions_exists,
    pg_catalog.pg_get_userbyid(c.relowner) AS table_owner,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM relation r
LEFT JOIN pg_catalog.pg_class c ON c.oid = r.oid
LEFT JOIN pg_catalog.pg_constraint con
    ON con.conrelid = c.oid
   AND con.contype IN ('p', 'u', 'f')
ORDER BY con.contype, con.conname;

-- Parent pointers must reference versions belonging to the same event.
SELECT
    con.conname AS constraint_name,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM pg_catalog.pg_constraint con
WHERE con.conrelid = pg_catalog.to_regclass('public.eventos')
  AND con.contype = 'f'
ORDER BY con.conname;

-- 3. Current production metadata counts. No JSON content is selected.
SELECT
    (SELECT pg_catalog.count(*) FROM public.eventos) AS event_count,
    (SELECT pg_catalog.count(*) FROM public.event_versions) AS version_count,
    (SELECT pg_catalog.count(*) FROM public.eventos
        WHERE published_version_id IS NOT NULL) AS with_published_pointer,
    (SELECT pg_catalog.count(*) FROM public.eventos
        WHERE current_working_version_id IS NOT NULL) AS with_working_pointer,
    (SELECT pg_catalog.count(*) FROM public.eventos
        WHERE published_version_id IS NULL
          AND current_working_version_id IS NOT NULL) AS unpublished_with_working,
    (SELECT pg_catalog.count(*) FROM public.eventos
        WHERE published_version_id IS NULL
          AND current_working_version_id IS NULL) AS both_pointers_null,
    (SELECT pg_catalog.count(*) FROM public.eventos
        WHERE event_status = 'archived') AS archived_count;

-- 4. Existing canaries: metadata only, never eventos.datos or version content.
SELECT
    e.id,
    e.event_status,
    e.published_version_id IS NOT NULL AS has_published_pointer,
    e.current_working_version_id IS NOT NULL AS has_working_pointer,
    pg_catalog.count(v.id) AS version_count,
    pv.version_number AS published_version_number,
    pv.workflow_status AS published_workflow_status
FROM public.eventos e
LEFT JOIN public.event_versions v ON v.event_id = e.id
LEFT JOIN public.event_versions pv
    ON pv.event_id = e.id
   AND pv.id = e.published_version_id
WHERE e.id IN ('kaly-joha', 'luis-li-', 'prima-ver-')
GROUP BY
    e.id,
    e.event_status,
    e.published_version_id,
    e.current_working_version_id,
    pv.version_number,
    pv.workflow_status
ORDER BY e.id;

-- 5. Exact signatures and effective EXECUTE privileges for current RPCs.
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
            'transition_event_version_workflow',
            'text, uuid, text, text',
            pg_catalog.to_regprocedure(
                'public.transition_event_version_workflow(text,uuid,text,text)'
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
    LEFT JOIN pg_catalog.pg_proc p ON p.oid = e.function_oid
),
roles AS (
    SELECT
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
            AS service_role_oid,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon') AS anon_oid,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
            AS authenticated_oid
)
SELECT
    f.function_name,
    f.identity_arguments,
    f.function_oid IS NOT NULL AS function_exists,
    pg_catalog.pg_get_userbyid(f.proowner) AS owner,
    f.prosecdef AS security_definer,
    f.proconfig AS function_settings,
    CASE WHEN f.function_oid IS NULL THEN NULL ELSE EXISTS (
        SELECT 1
        FROM pg_catalog.aclexplode(
            COALESCE(f.proacl, pg_catalog.acldefault('f', f.proowner))
        ) acl
        WHERE acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
    ) END AS public_can_execute,
    CASE WHEN f.function_oid IS NULL OR r.anon_oid IS NULL THEN NULL
        ELSE pg_catalog.has_function_privilege(r.anon_oid, f.function_oid, 'EXECUTE')
    END AS anon_can_execute,
    CASE WHEN f.function_oid IS NULL OR r.authenticated_oid IS NULL THEN NULL
        ELSE pg_catalog.has_function_privilege(
            r.authenticated_oid,
            f.function_oid,
            'EXECUTE'
        )
    END AS authenticated_can_execute,
    CASE WHEN f.function_oid IS NULL OR r.service_role_oid IS NULL THEN NULL
        ELSE pg_catalog.has_function_privilege(
            r.service_role_oid,
            f.function_oid,
            'EXECUTE'
        )
    END AS service_role_can_execute
FROM functions f
CROSS JOIN roles r
ORDER BY f.function_name;

-- 6. Expected before installation: function_exists must be false.
SELECT
    pg_catalog.to_regprocedure('public.create_versioned_event(text,jsonb)')
        IS NOT NULL AS function_exists,
    'expected false before installation'::text AS expected_result;
