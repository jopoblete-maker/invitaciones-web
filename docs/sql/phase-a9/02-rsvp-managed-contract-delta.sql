-- A9.13-C: incremental RSVP Managed contract delta approved in A9.13-B.
-- Apply only after 01-rsvp-managed.sql, under its owning database role.
-- Review artifact: not executed by the application or by its creation.
-- Explicit execution authorization and isolated regression tests are required.
-- This transaction changes only the RSVP audit check and six backend RPCs,
-- and adds one private helper. Existing calendar, storage and read paths remain.
-- Managed calendar derivation and ambiguous/nonexistent input rejection belong
-- to the trusted backend; the approved civil-day purge calculation is unchanged.

BEGIN;

-- 1. Fail before DDL unless the owning role and A9 foundations match.
DO $preconditions$
DECLARE
    v_item record;
    v_relation oid;
    v_function oid;
    v_definition text;
    v_action text;
BEGIN
    IF pg_catalog.current_setting('server_version_num')::integer < 170000 THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_POSTGRESQL_VERSION_UNSUPPORTED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace AS n
        WHERE n.nspname = 'rsvp_private'
          AND pg_catalog.pg_get_userbyid(n.nspowner) = CURRENT_USER
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_OWNER_OR_SCHEMA_MISMATCH';
    END IF;

    FOREACH v_action IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles AS r WHERE r.rolname = v_action) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_REQUIRED_ROLE_MISSING';
        END IF;
        IF pg_catalog.has_schema_privilege(v_action, 'rsvp_private', 'USAGE') THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_PRIVATE_SCHEMA_ACL_MISMATCH';
        END IF;
    END LOOP;

    FOR v_item IN
        SELECT x.name FROM (VALUES
            ('event_settings'), ('invitations'), ('responses'),
            ('creation_requests'), ('anonymous_aggregates'), ('admin_audit')
        ) AS x(name)
    LOOP
        v_relation := pg_catalog.to_regclass('rsvp_private.' || v_item.name);
        IF v_relation IS NULL OR NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class AS c
            WHERE c.oid = v_relation AND c.relkind = 'r' AND c.relrowsecurity
              AND pg_catalog.pg_get_userbyid(c.relowner) = CURRENT_USER
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_REQUIRED_TABLE_MISMATCH';
        END IF;
        FOREACH v_action IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF pg_catalog.has_table_privilege(
                v_action, v_relation, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
            ) THEN
                RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_PRIVATE_TABLE_ACL_MISMATCH';
            END IF;
        END LOOP;
    END LOOP;

    FOR v_item IN
        SELECT x.* FROM (VALUES
            ('public.eventos', 'id', 'text'),
            ('public.eventos', 'event_status', 'text'),
            ('rsvp_private.event_settings', 'event_id', 'text'),
            ('rsvp_private.event_settings', 'timezone', 'text'),
            ('rsvp_private.event_settings', 'event_at', 'timestamptz'),
            ('rsvp_private.event_settings', 'deadline_at', 'timestamptz'),
            ('rsvp_private.event_settings', 'purge_due_at', 'timestamptz'),
            ('rsvp_private.event_settings', 'revision', 'bigint'),
            ('rsvp_private.event_settings', 'purged_at', 'timestamptz'),
            ('rsvp_private.invitations', 'id', 'uuid'),
            ('rsvp_private.invitations', 'event_id', 'text'),
            ('rsvp_private.invitations', 'display_name', 'text'),
            ('rsvp_private.invitations', 'revision', 'bigint'),
            ('rsvp_private.invitations', 'updated_at', 'timestamptz'),
            ('rsvp_private.admin_audit', 'action', 'text')
        ) AS x(relation_name, column_name, type_name)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_attribute AS a
            WHERE a.attrelid = pg_catalog.to_regclass(v_item.relation_name)
              AND a.attname = v_item.column_name AND a.attnum > 0 AND NOT a.attisdropped
              AND a.atttypid = pg_catalog.to_regtype(v_item.type_name)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_REQUIRED_COLUMN_MISMATCH';
        END IF;
    END LOOP;

    FOR v_item IN
        SELECT x.* FROM (VALUES
            ('rsvp_private.fail(text)', 'void', false, false),
            ('rsvp_private.calculate_purge_due_at(timestamptz,text)', 'timestamptz', false, false),
            ('rsvp_private.prepare_event_settings()', 'trigger', false, false),
            ('rsvp_private.reject_audit_mutation()', 'trigger', false, false),
            ('rsvp_private.audit(text,text,text)', 'void', false, false),
            ('rsvp_private.lock_event(text)', 'rsvp_private.event_settings', false, false),
            ('rsvp_private.lock_admin_invitation(text,uuid,bigint)', 'rsvp_private.invitations', false, false),
            ('rsvp_private.lock_public_invitation(text,bytea)', 'rsvp_private.invitations', false, false),
            ('rsvp_private.validate_response(text,integer,integer)', 'void', false, false),
            ('rsvp_private.write_response(text,uuid,integer,text,integer)', 'void', false, false),
            ('public.rsvp_configure(text,text,timestamptz,timestamptz,bigint)', 'bigint', true, false),
            ('public.rsvp_create_invitation(text,uuid,text,text,integer,bytea)', 'jsonb', true, false),
            ('public.rsvp_public_read(text,bytea)', 'jsonb', true, false),
            ('public.rsvp_public_respond(text,bytea,bigint,text,integer)', 'jsonb', true, false),
            ('public.rsvp_admin_mutate(text,uuid,bigint,text,text,integer,bytea)', 'jsonb', true, false),
            ('public.rsvp_admin_correct_capacity(text,uuid,bigint,text,integer)', 'jsonb', true, false),
            ('public.rsvp_admin_list(text,uuid,integer)', 'record', true, true),
            ('public.rsvp_purge_due(integer)', 'integer', true, false),
            ('public.rsvp_admin_aggregate(text)', 'record', true, true),
            ('public.rsvp_admin_audit_list(text,integer)', 'record', true, true)
        ) AS x(signature, return_type, is_definer, returns_set)
    LOOP
        v_function := pg_catalog.to_regprocedure(v_item.signature);
        IF v_function IS NULL OR NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc AS p
            WHERE p.oid = v_function
              AND pg_catalog.pg_get_userbyid(p.proowner) = CURRENT_USER
              AND p.prorettype = pg_catalog.to_regtype(v_item.return_type)
              AND p.prosecdef = v_item.is_definer AND p.proretset = v_item.returns_set
              AND p.proconfig @> ARRAY['search_path=""']::text[]
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_REQUIRED_FUNCTION_MISMATCH';
        END IF;
    END LOOP;

    IF (SELECT count(*) FROM pg_catalog.pg_proc AS p
        JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname LIKE 'rsvp_%') <> 10
       OR EXISTS (
           SELECT 1 FROM pg_catalog.pg_proc AS p
           JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
           WHERE (n.nspname = 'rsvp_private' AND p.proname = 'assert_active_event')
              OR (n.nspname = 'public' AND p.proname IN (
                  'rsvp_admin_correct_name', 'rsvp_admin_read_configuration'
              ))
       ) THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_DELTA_ALREADY_PRESENT_OR_RPC_MISMATCH';
    END IF;

    SELECT pg_catalog.pg_get_constraintdef(c.oid) INTO v_definition
    FROM pg_catalog.pg_constraint AS c
    JOIN pg_catalog.pg_attribute AS a
      ON a.attrelid = c.conrelid AND a.attname = 'action'
    WHERE c.conrelid = pg_catalog.to_regclass('rsvp_private.admin_audit')
      AND c.conname = 'admin_audit_action_check'
      AND c.contype = 'c' AND c.convalidated
      AND c.conkey = ARRAY[a.attnum]::smallint[];
    IF NOT FOUND OR v_definition LIKE '%CORRECT_NAME%' THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_AUDIT_ACTION_CHECK_MISMATCH';
    END IF;
    FOREACH v_action IN ARRAY ARRAY[
        'CONFIGURE', 'CREATE', 'CORRECT', 'CORRECT_CAPACITY',
        'ROTATE', 'REVOKE', 'DELETE', 'PURGE'
    ] LOOP
        IF pg_catalog.strpos(v_definition, pg_catalog.quote_literal(v_action)) = 0 THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_AUDIT_ACTION_CHECK_MISMATCH';
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger AS t
        WHERE t.tgrelid = pg_catalog.to_regclass('rsvp_private.admin_audit')
          AND t.tgname = 'admin_audit_append_only' AND NOT t.tgisinternal
          AND t.tgenabled IN ('O', 'A')
          AND t.tgfoid = pg_catalog.to_regprocedure('rsvp_private.reject_audit_mutation()')
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A9_AUDIT_GUARD_MISMATCH';
    END IF;
END
$preconditions$;

-- 2. Preserve all existing actions and append the name-correction action.
ALTER TABLE rsvp_private.admin_audit
    DROP CONSTRAINT admin_audit_action_check,
    ADD CONSTRAINT admin_audit_action_check CHECK (
        action IN (
            'CONFIGURE', 'CREATE', 'CORRECT', 'CORRECT_CAPACITY',
            'ROTATE', 'REVOKE', 'DELETE', 'PURGE', 'CORRECT_NAME'
        )
    );

-- 3. Private activity assertion. Callers already retain the parent row lock
-- before locking settings/invitations. Reusing FOR SHARE does not upgrade it.
CREATE FUNCTION rsvp_private.assert_active_event(
    p_event_id text,
    p_public boolean
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
    v_status text;
BEGIN
    SELECT e.event_status INTO v_status
    FROM public.eventos AS e
    WHERE e.id = p_event_id
    FOR SHARE;

    IF NOT FOUND OR v_status IS DISTINCT FROM 'active' THEN
        IF p_public IS TRUE THEN
            PERFORM rsvp_private.fail('RSVP_EVENT_ARCHIVED');
        ELSE
            PERFORM rsvp_private.fail('ADMIN_EVENT_NOT_ACTIVE');
        END IF;
    END IF;
END
$fn$;

-- 4. Existing RPCs: unchanged signatures and minimal activity guards.
CREATE OR REPLACE FUNCTION public.rsvp_configure(
    p_event_id text,
    p_timezone text,
    p_event_at timestamptz,
    p_deadline_at timestamptz,
    p_expected_revision bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_event rsvp_private.event_settings%ROWTYPE;
    v_revision bigint;
    v_new_purge_due_at timestamptz;
BEGIN
    IF p_event_id IS NULL
       OR p_timezone IS NULL
       OR p_event_at IS NULL
       OR NOT isfinite(p_event_at)
       OR p_deadline_at IS NULL
       OR NOT isfinite(p_deadline_at)
       OR p_expected_revision IS NULL
       OR p_expected_revision < 0
    THEN
        PERFORM rsvp_private.fail('INVALID_MANAGED_CONFIGURATION');
    END IF;

    v_new_purge_due_at := rsvp_private.calculate_purge_due_at(
        p_event_at, p_timezone
    );

    -- Serialize initial configuration without writing the parent event.
    PERFORM 1
    FROM public.eventos AS e
    WHERE e.id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM rsvp_private.fail('ADMIN_EVENT_NOT_FOUND');
    END IF;

    PERFORM rsvp_private.assert_active_event(p_event_id, false);

    SELECT s.* INTO v_event
    FROM rsvp_private.event_settings AS s
    WHERE s.event_id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        IF p_expected_revision <> 0 THEN
            PERFORM rsvp_private.fail('REVISION_CONFLICT');
        END IF;

        IF clock_timestamp() >= v_new_purge_due_at THEN
            PERFORM rsvp_private.fail('PII_RETENTION_EXPIRED');
        END IF;

        INSERT INTO rsvp_private.event_settings (
            event_id, timezone, event_at, deadline_at
        )
        VALUES (p_event_id, p_timezone, p_event_at, p_deadline_at)
        RETURNING revision INTO v_revision;
    ELSE
        -- An expired configuration cannot be revived by changing its schedule.
        IF v_event.purged_at IS NOT NULL
           OR clock_timestamp() >= v_event.purge_due_at
        THEN
            PERFORM rsvp_private.fail('PII_RETENTION_EXPIRED');
        END IF;

        IF p_expected_revision <> v_event.revision THEN
            PERFORM rsvp_private.fail('REVISION_CONFLICT');
        END IF;

        IF clock_timestamp() >= v_new_purge_due_at THEN
            PERFORM rsvp_private.fail('PII_RETENTION_EXPIRED');
        END IF;

        UPDATE rsvp_private.event_settings
        SET timezone = p_timezone,
            event_at = p_event_at,
            deadline_at = p_deadline_at,
            revision = revision + 1,
            updated_at = clock_timestamp()
        WHERE event_id = p_event_id
        RETURNING revision INTO v_revision;
    END IF;

    PERFORM rsvp_private.audit(
        p_event_id, 'CONFIGURE', 'authenticated_admin'
    );
    RETURN v_revision;
END
$fn$;

CREATE OR REPLACE FUNCTION public.rsvp_create_invitation(
    p_event_id text,
    p_request_id uuid,
    p_display_name text,
    p_invitation_type text,
    p_max_attendees integer,
    p_token_hash bytea
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_request rsvp_private.creation_requests%ROWTYPE;
    v_invitation rsvp_private.invitations%ROWTYPE;
BEGIN
    PERFORM rsvp_private.lock_event(p_event_id);
    PERFORM rsvp_private.assert_active_event(p_event_id, false);

    IF p_request_id IS NULL THEN
        PERFORM rsvp_private.fail('INVALID_REQUEST_ID');
    END IF;

    SELECT q.* INTO v_request
    FROM rsvp_private.creation_requests AS q
    WHERE q.event_id = p_event_id AND q.request_id = p_request_id;

    IF FOUND THEN
        IF v_request.invitation_id IS NULL THEN
            PERFORM rsvp_private.fail('IDEMPOTENCY_KEY_CONSUMED');
        END IF;

        SELECT i.* INTO STRICT v_invitation
        FROM rsvp_private.invitations AS i
        WHERE i.event_id = p_event_id AND i.id = v_request.invitation_id;

        -- First committed operation wins; retries never replace its payload.
        RETURN jsonb_build_object(
            'invitationId', v_invitation.id,
            'revision', v_invitation.revision,
            'created', false
        );
    END IF;

    IF p_display_name IS NULL
       OR p_display_name <> btrim(p_display_name)
       OR length(p_display_name) NOT BETWEEN 1 AND 120
       OR p_invitation_type IS NULL
       OR p_invitation_type NOT IN ('individual', 'group')
       OR p_max_attendees IS NULL
       OR p_max_attendees NOT BETWEEN 1 AND 20
       OR (p_invitation_type = 'individual' AND p_max_attendees <> 1)
       OR p_token_hash IS NULL
       OR octet_length(p_token_hash) <> 32
    THEN
        PERFORM rsvp_private.fail('INVALID_INVITATION_PAYLOAD');
    END IF;

    BEGIN
        INSERT INTO rsvp_private.invitations (
            event_id, display_name, invitation_type,
            max_attendees, token_hash
        )
        VALUES (
            p_event_id, p_display_name, p_invitation_type,
            p_max_attendees, p_token_hash
        )
        RETURNING * INTO v_invitation;
    EXCEPTION
        WHEN unique_violation THEN
            PERFORM rsvp_private.fail('INVITATION_UNIQUENESS_CONFLICT');
    END;

    INSERT INTO rsvp_private.creation_requests (
        event_id, request_id, invitation_id
    )
    VALUES (p_event_id, p_request_id, v_invitation.id);

    PERFORM rsvp_private.audit(p_event_id, 'CREATE', 'authenticated_admin');

    RETURN jsonb_build_object(
        'invitationId', v_invitation.id,
        'revision', v_invitation.revision,
        'created', true
    );
END
$fn$;

CREATE OR REPLACE FUNCTION public.rsvp_public_respond(
    p_event_id text,
    p_token_hash bytea,
    p_expected_revision bigint,
    p_status text,
    p_attendee_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_invitation rsvp_private.invitations%ROWTYPE;
    v_deadline timestamptz;
    v_revision bigint;
BEGIN
    -- Validate token/event membership before functional RSVP errors.
    v_invitation := rsvp_private.lock_public_invitation(
        p_event_id, p_token_hash
    );
    PERFORM rsvp_private.assert_active_event(p_event_id, true);

    SELECT s.deadline_at INTO v_deadline
    FROM rsvp_private.event_settings AS s
    WHERE s.event_id = p_event_id;

    IF clock_timestamp() >= v_deadline THEN
        PERFORM rsvp_private.fail('RSVP_DEADLINE_CLOSED');
    END IF;

    PERFORM rsvp_private.validate_response(
        p_status, p_attendee_count, v_invitation.max_attendees
    );

    IF p_expected_revision IS NULL
       OR p_expected_revision <> v_invitation.revision
    THEN
        PERFORM rsvp_private.fail('REVISION_CONFLICT');
    END IF;

    PERFORM rsvp_private.write_response(
        p_event_id, v_invitation.id, v_invitation.max_attendees,
        p_status, p_attendee_count
    );

    UPDATE rsvp_private.invitations
    SET revision = revision + 1, updated_at = clock_timestamp()
    WHERE event_id = p_event_id AND id = v_invitation.id
    RETURNING revision INTO v_revision;

    RETURN jsonb_build_object(
        'revision', v_revision,
        'status', p_status,
        'attendeeCount', p_attendee_count
    );
END
$fn$;

CREATE OR REPLACE FUNCTION public.rsvp_admin_mutate(
    p_event_id text,
    p_invitation_id uuid,
    p_expected_revision bigint,
    p_action text,
    p_status text,
    p_attendee_count integer,
    p_new_token_hash bytea
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_invitation rsvp_private.invitations%ROWTYPE;
    v_revision bigint;
BEGIN
    IF p_action IS NULL
       OR p_action NOT IN ('CORRECT', 'ROTATE', 'REVOKE', 'DELETE')
    THEN
        PERFORM rsvp_private.fail('INVALID_ADMIN_ACTION');
    END IF;

    v_invitation := rsvp_private.lock_admin_invitation(
        p_event_id, p_invitation_id, p_expected_revision
    );

    IF p_action <> 'DELETE' THEN
        PERFORM rsvp_private.assert_active_event(p_event_id, false);
    END IF;

    IF p_action = 'CORRECT' THEN
        IF p_new_token_hash IS NOT NULL THEN
            PERFORM rsvp_private.fail('INVALID_ADMIN_ACTION_PAYLOAD');
        END IF;

        -- Administrative correction may pass the public deadline, not retention.
        PERFORM rsvp_private.validate_response(
            p_status, p_attendee_count, v_invitation.max_attendees
        );
        PERFORM rsvp_private.write_response(
            p_event_id, p_invitation_id, v_invitation.max_attendees,
            p_status, p_attendee_count
        );
    ELSIF p_action = 'ROTATE' THEN
        IF p_status IS NOT NULL
           OR p_attendee_count IS NOT NULL
           OR p_new_token_hash IS NULL
           OR octet_length(p_new_token_hash) <> 32
           OR p_new_token_hash = v_invitation.token_hash
        THEN
            PERFORM rsvp_private.fail('INVALID_TOKEN_ROTATION');
        END IF;

        BEGIN
            UPDATE rsvp_private.invitations
            SET token_hash = p_new_token_hash
            WHERE event_id = p_event_id AND id = p_invitation_id;
        EXCEPTION
            WHEN unique_violation THEN
                PERFORM rsvp_private.fail('TOKEN_UNIQUENESS_CONFLICT');
        END;
        -- Rotation deliberately preserves revoked_at.
    ELSE
        IF p_status IS NOT NULL
           OR p_attendee_count IS NOT NULL
           OR p_new_token_hash IS NOT NULL
        THEN
            PERFORM rsvp_private.fail('INVALID_ADMIN_ACTION_PAYLOAD');
        END IF;

        IF p_action = 'REVOKE' THEN
            IF v_invitation.revoked_at IS NOT NULL THEN
                RETURN jsonb_build_object(
                    'revision', v_invitation.revision,
                    'revoked', true,
                    'changed', false
                );
            END IF;

            UPDATE rsvp_private.invitations
            SET revoked_at = clock_timestamp()
            WHERE event_id = p_event_id AND id = p_invitation_id;
        ELSE
            DELETE FROM rsvp_private.invitations
            WHERE event_id = p_event_id AND id = p_invitation_id;

            -- Response is deleted; the random creation key loses its link.
            PERFORM rsvp_private.audit(
                p_event_id, 'DELETE', 'authenticated_admin'
            );
            RETURN jsonb_build_object('deleted', true);
        END IF;
    END IF;

    UPDATE rsvp_private.invitations
    SET revision = revision + 1, updated_at = clock_timestamp()
    WHERE event_id = p_event_id AND id = p_invitation_id
    RETURNING revision INTO v_revision;

    PERFORM rsvp_private.audit(p_event_id, p_action, 'authenticated_admin');
    RETURN jsonb_build_object('revision', v_revision, 'changed', true);
END
$fn$;

-- 5. Small administrative RPCs, with no direct client table access.
CREATE FUNCTION public.rsvp_admin_correct_name(
    p_event_id text,
    p_invitation_id uuid,
    p_expected_revision bigint,
    p_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_invitation rsvp_private.invitations%ROWTYPE;
    v_name text;
    v_revision bigint;
BEGIN
    v_invitation := rsvp_private.lock_admin_invitation(
        p_event_id, p_invitation_id, p_expected_revision
    );
    PERFORM rsvp_private.assert_active_event(p_event_id, false);

    v_name := pg_catalog.btrim(p_display_name);
    IF v_name IS NULL OR pg_catalog.length(v_name) NOT BETWEEN 1 AND 120 THEN
        PERFORM rsvp_private.fail('INVALID_DISPLAY_NAME');
    END IF;

    IF v_name = v_invitation.display_name THEN
        RETURN pg_catalog.jsonb_build_object(
            'invitationId', v_invitation.id,
            'revision', v_invitation.revision,
            'changed', false
        );
    END IF;

    UPDATE rsvp_private.invitations
    SET display_name = v_name,
        revision = revision + 1,
        updated_at = pg_catalog.clock_timestamp()
    WHERE event_id = p_event_id AND id = p_invitation_id
    RETURNING revision INTO v_revision;

    PERFORM rsvp_private.audit(p_event_id, 'CORRECT_NAME', 'authenticated_admin');
    RETURN pg_catalog.jsonb_build_object(
        'invitationId', p_invitation_id,
        'revision', v_revision,
        'changed', true
    );
END
$fn$;

CREATE FUNCTION public.rsvp_admin_read_configuration(
    p_event_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_status text;
    v_settings rsvp_private.event_settings%ROWTYPE;
BEGIN
    -- Same parent-first order as writers, including initial configuration.
    SELECT e.event_status INTO v_status
    FROM public.eventos AS e
    WHERE e.id = p_event_id
    FOR SHARE;
    IF NOT FOUND THEN
        PERFORM rsvp_private.fail('ADMIN_EVENT_NOT_FOUND');
    END IF;

    SELECT s.* INTO v_settings
    FROM rsvp_private.event_settings AS s
    WHERE s.event_id = p_event_id
    FOR SHARE;
    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object(
            'eventId', p_event_id,
            'eventStatus', v_status,
            'configured', false,
            'revision', 0,
            'timezone', NULL,
            'eventAt', NULL,
            'deadlineAt', NULL,
            'purgeDueAt', NULL,
            'purged', false
        );
    END IF;

    -- Calendar metadata remains readable after retention; no invitation data.
    RETURN pg_catalog.jsonb_build_object(
        'eventId', p_event_id,
        'eventStatus', v_status,
        'configured', true,
        'revision', v_settings.revision,
        'timezone', v_settings.timezone,
        'eventAt', v_settings.event_at,
        'deadlineAt', v_settings.deadline_at,
        'purgeDueAt', v_settings.purge_due_at,
        'purged', v_settings.purged_at IS NOT NULL
    );
END
$fn$;

-- 6. Explicit execution-only backend privileges; private storage stays private.
REVOKE ALL ON FUNCTION rsvp_private.assert_active_event(text, boolean)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rsvp_configure(text, text, timestamptz, timestamptz, bigint)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_configure(text, text, timestamptz, timestamptz, bigint)
    TO service_role;

REVOKE ALL ON FUNCTION public.rsvp_create_invitation(text, uuid, text, text, integer, bytea)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_create_invitation(text, uuid, text, text, integer, bytea)
    TO service_role;

REVOKE ALL ON FUNCTION public.rsvp_public_respond(text, bytea, bigint, text, integer)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_public_respond(text, bytea, bigint, text, integer)
    TO service_role;

REVOKE ALL ON FUNCTION public.rsvp_admin_mutate(text, uuid, bigint, text, text, integer, bytea)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_admin_mutate(text, uuid, bigint, text, text, integer, bytea)
    TO service_role;

REVOKE ALL ON FUNCTION public.rsvp_admin_correct_name(text, uuid, bigint, text)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_admin_correct_name(text, uuid, bigint, text)
    TO service_role;

REVOKE ALL ON FUNCTION public.rsvp_admin_read_configuration(text)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_admin_read_configuration(text)
    TO service_role;

COMMIT;
