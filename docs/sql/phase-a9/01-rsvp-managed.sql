-- A9.5: RSVP Managed review artifact, incorporating approved A9.4.
-- Do not execute automatically. Execution and isolated SQL tests require
-- separate authorization. This artifact has not been executed.
--
-- Prerequisites for future execution:
-- PostgreSQL 17-compatible syntax; public.eventos(id text, event_status text);
-- anon, authenticated and service_role roles; a trusted deployment owner for
-- all new objects; no existing rsvp_private schema or conflicting RPC names.
-- No existing table, historical function or editorial object is altered.
--
-- Backend responsibilities: authenticate administrative operations and their
-- event scope; verify the current managed mode; validate schedule.timezone
-- against IANA; derive absolute event/deadline instants from that schedule;
-- generate cryptographically random 256-bit tokens and hash their original
-- 32 bytes with SHA-256; sanitize HTTP errors and sensitive telemetry.
-- Only hashes reach these RPCs. Public token failures map to HTTP 404 with
-- RSVP_NOT_AVAILABLE, without exposing PostgreSQL details.
--
-- Retention is 90 civil days in the event timezone, using PostgreSQL's
-- documented resolution of nonexistent/repeated destination local times.
-- The daily retention worker repeats bounded batches and retries on a later
-- scheduled execution after failure. Operational access stops at purge_due_at
-- even when physical cleanup is pending. Audit and final aggregates survive.

BEGIN;

-- 1. Private operational storage.

CREATE SCHEMA rsvp_private;

REVOKE ALL ON SCHEMA rsvp_private
    FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE rsvp_private.event_settings (
    event_id text PRIMARY KEY
        REFERENCES public.eventos(id) ON DELETE RESTRICT,
    timezone text NOT NULL,
    event_at timestamptz NOT NULL,
    deadline_at timestamptz NOT NULL,
    purge_due_at timestamptz NOT NULL,
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    purged_at timestamptz NULL,
    CHECK (length(timezone) BETWEEN 1 AND 100),
    CHECK (isfinite(event_at)),
    CHECK (isfinite(deadline_at)),
    CHECK (isfinite(purge_due_at)),
    CHECK (purge_due_at > event_at)
);

CREATE TABLE rsvp_private.invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL
        REFERENCES rsvp_private.event_settings(event_id)
        ON DELETE RESTRICT,
    display_name text NOT NULL CHECK (
        display_name = btrim(display_name)
        AND length(display_name) BETWEEN 1 AND 120
    ),
    invitation_type text NOT NULL
        CHECK (invitation_type IN ('individual', 'group')),
    max_attendees integer NOT NULL
        CHECK (max_attendees BETWEEN 1 AND 20),
    token_hash bytea NOT NULL
        CHECK (octet_length(token_hash) = 32),
    revoked_at timestamptz NULL,
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (invitation_type <> 'individual' OR max_attendees = 1),
    CONSTRAINT invitations_token_hash_uq UNIQUE (token_hash),
    CONSTRAINT invitations_event_id_id_uq UNIQUE (event_id, id),
    CONSTRAINT invitations_event_id_id_capacity_uq
        UNIQUE (event_id, id, max_attendees)
);

CREATE TABLE rsvp_private.responses (
    invitation_id uuid PRIMARY KEY,
    event_id text NOT NULL,
    max_attendees integer NOT NULL,
    response_status text NOT NULL
        CHECK (response_status IN ('attending', 'not_attending')),
    attendee_count integer NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        max_attendees BETWEEN 1 AND 20
        AND attendee_count BETWEEN 0 AND max_attendees
    ),
    CHECK (
        (response_status = 'attending' AND attendee_count >= 1)
        OR
        (response_status = 'not_attending' AND attendee_count = 0)
    ),
    CONSTRAINT responses_same_event_capacity_fk
        FOREIGN KEY (event_id, invitation_id, max_attendees)
        REFERENCES rsvp_private.invitations(event_id, id, max_attendees)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE rsvp_private.creation_requests (
    event_id text NOT NULL
        REFERENCES rsvp_private.event_settings(event_id)
        ON DELETE RESTRICT,
    request_id uuid NOT NULL,
    invitation_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (event_id, request_id),
    UNIQUE (invitation_id),
    CONSTRAINT creation_requests_same_event_fk
        FOREIGN KEY (event_id, invitation_id)
        REFERENCES rsvp_private.invitations(event_id, id)
        ON DELETE SET NULL (invitation_id)
);

CREATE TABLE rsvp_private.anonymous_aggregates (
    event_id text PRIMARY KEY,
    invitation_count bigint NOT NULL,
    attending_count bigint NOT NULL,
    not_attending_count bigint NOT NULL,
    unanswered_count bigint NOT NULL,
    attendee_count bigint NOT NULL,
    materialized_at timestamptz NOT NULL,
    CHECK (
        invitation_count >= 0
        AND attending_count >= 0
        AND not_attending_count >= 0
        AND unanswered_count >= 0
        AND attendee_count >= 0
    ),
    CHECK (
        invitation_count =
        attending_count + not_attending_count + unanswered_count
    ),
    CHECK (
        attendee_count >= attending_count
        AND attendee_count <= attending_count * 20
    )
);

CREATE TABLE rsvp_private.admin_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    action text NOT NULL CHECK (
        action IN (
            'CONFIGURE', 'CREATE', 'CORRECT', 'CORRECT_CAPACITY',
            'ROTATE', 'REVOKE', 'DELETE', 'PURGE'
        )
    ),
    actor_class text NOT NULL CHECK (
        actor_class IN ('authenticated_admin', 'retention_worker')
    )
);

-- PK/UNIQUE indexes cover token lookup, invitation pagination and idempotency.

CREATE INDEX event_settings_pending_purge_idx
    ON rsvp_private.event_settings(purge_due_at, event_id)
    WHERE purged_at IS NULL;

CREATE INDEX responses_event_idx
    ON rsvp_private.responses(event_id, invitation_id);

CREATE INDEX admin_audit_event_time_idx
    ON rsvp_private.admin_audit(event_id, occurred_at, id);

-- 2. Private helpers and calendar/audit triggers.

CREATE FUNCTION rsvp_private.fail(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = p_code;
END
$fn$;

CREATE FUNCTION rsvp_private.calculate_purge_due_at(
    p_event_at timestamptz,
    p_timezone text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
    IF p_event_at IS NULL OR NOT isfinite(p_event_at) THEN
        PERFORM rsvp_private.fail('INVALID_MANAGED_CONFIGURATION');
    END IF;

    IF p_timezone IS NULL
       OR length(p_timezone) NOT BETWEEN 1 AND 100
       OR p_timezone LIKE 'posix/%'
       OR p_timezone LIKE 'right/%'
       OR NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_timezone_names AS z
           WHERE z.name = p_timezone
       )
    THEN
        PERFORM rsvp_private.fail('INVALID_IANA_TIMEZONE');
    END IF;

    RETURN (
        (p_event_at AT TIME ZONE p_timezone) + interval '90 days'
    ) AT TIME ZONE p_timezone;
END
$fn$;

CREATE FUNCTION rsvp_private.prepare_event_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
    NEW.purge_due_at := rsvp_private.calculate_purge_due_at(
        NEW.event_at, NEW.timezone
    );
    RETURN NEW;
END
$fn$;

CREATE TRIGGER event_settings_calendar_guard
    BEFORE INSERT OR UPDATE OF timezone, event_at, purge_due_at
    ON rsvp_private.event_settings
    FOR EACH ROW
    EXECUTE FUNCTION rsvp_private.prepare_event_settings();

CREATE FUNCTION rsvp_private.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
    PERFORM rsvp_private.fail('RSVP_AUDIT_APPEND_ONLY');
    RETURN NULL;
END
$fn$;

CREATE TRIGGER admin_audit_append_only
    BEFORE UPDATE OR DELETE ON rsvp_private.admin_audit
    FOR EACH ROW
    EXECUTE FUNCTION rsvp_private.reject_audit_mutation();

CREATE FUNCTION rsvp_private.audit(
    p_event_id text,
    p_action text,
    p_actor_class text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $fn$
    INSERT INTO rsvp_private.admin_audit(event_id, action, actor_class)
    VALUES (p_event_id, p_action, p_actor_class);
$fn$;

-- Lock order: event parent, operational settings, invitation, response.
-- The purge worker only locks settings and their dependent operational rows.

CREATE FUNCTION rsvp_private.lock_event(p_event_id text)
RETURNS rsvp_private.event_settings
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
    v_event rsvp_private.event_settings%ROWTYPE;
BEGIN
    PERFORM 1
    FROM public.eventos AS e
    WHERE e.id = p_event_id
    FOR SHARE;

    SELECT s.* INTO v_event
    FROM rsvp_private.event_settings AS s
    WHERE s.event_id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM rsvp_private.fail('MANAGED_CONFIG_NOT_FOUND');
    END IF;

    IF v_event.purged_at IS NOT NULL
       OR clock_timestamp() >= v_event.purge_due_at
    THEN
        PERFORM rsvp_private.fail('PII_RETENTION_EXPIRED');
    END IF;

    RETURN v_event;
END
$fn$;

CREATE FUNCTION rsvp_private.lock_admin_invitation(
    p_event_id text,
    p_invitation_id uuid,
    p_expected_revision bigint
)
RETURNS rsvp_private.invitations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
    v_invitation rsvp_private.invitations%ROWTYPE;
BEGIN
    PERFORM rsvp_private.lock_event(p_event_id);

    SELECT i.* INTO v_invitation
    FROM rsvp_private.invitations AS i
    WHERE i.event_id = p_event_id AND i.id = p_invitation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM rsvp_private.fail('ADMIN_INVITATION_NOT_FOUND');
    END IF;

    IF p_expected_revision IS NULL
       OR p_expected_revision <> v_invitation.revision
    THEN
        PERFORM rsvp_private.fail('REVISION_CONFLICT');
    END IF;

    RETURN v_invitation;
END
$fn$;

CREATE FUNCTION rsvp_private.lock_public_invitation(
    p_event_id text,
    p_token_hash bytea
)
RETURNS rsvp_private.invitations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
    v_event rsvp_private.event_settings%ROWTYPE;
    v_invitation rsvp_private.invitations%ROWTYPE;
BEGIN
    PERFORM 1
    FROM public.eventos AS e
    WHERE e.id = p_event_id
    FOR SHARE;

    SELECT s.* INTO v_event
    FROM rsvp_private.event_settings AS s
    WHERE s.event_id = p_event_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_event.purged_at IS NOT NULL
       OR clock_timestamp() >= v_event.purge_due_at
    THEN
        PERFORM rsvp_private.fail('RSVP_NOT_AVAILABLE');
    END IF;

    IF p_token_hash IS NULL OR octet_length(p_token_hash) <> 32 THEN
        PERFORM rsvp_private.fail('RSVP_NOT_AVAILABLE');
    END IF;

    SELECT i.* INTO v_invitation
    FROM rsvp_private.invitations AS i
    WHERE i.event_id = p_event_id
      AND i.token_hash = p_token_hash
      AND i.revoked_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM rsvp_private.fail('RSVP_NOT_AVAILABLE');
    END IF;

    RETURN v_invitation;
END
$fn$;

CREATE FUNCTION rsvp_private.validate_response(
    p_status text,
    p_attendee_count integer,
    p_max_attendees integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
    IF p_status IS NULL
       OR p_status NOT IN ('attending', 'not_attending')
       OR p_attendee_count IS NULL
       OR p_attendee_count < 0
       OR (p_status = 'attending' AND p_attendee_count < 1)
       OR (p_status = 'not_attending' AND p_attendee_count <> 0)
    THEN
        PERFORM rsvp_private.fail('RSVP_INVALID_PAYLOAD');
    END IF;

    IF p_attendee_count > p_max_attendees THEN
        PERFORM rsvp_private.fail('RSVP_ATTENDEE_LIMIT');
    END IF;
END
$fn$;

CREATE FUNCTION rsvp_private.write_response(
    p_event_id text,
    p_invitation_id uuid,
    p_max_attendees integer,
    p_status text,
    p_attendee_count integer
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $fn$
    INSERT INTO rsvp_private.responses (
        event_id, invitation_id, max_attendees,
        response_status, attendee_count
    )
    VALUES (
        p_event_id, p_invitation_id, p_max_attendees,
        p_status, p_attendee_count
    )
    ON CONFLICT (invitation_id)
    DO UPDATE SET
        response_status = EXCLUDED.response_status,
        attendee_count = EXCLUDED.attendee_count,
        updated_at = clock_timestamp();
$fn$;

-- 3. Backend-only operational RPCs.

CREATE FUNCTION public.rsvp_configure(
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

CREATE FUNCTION public.rsvp_create_invitation(
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

CREATE FUNCTION public.rsvp_public_read(
    p_event_id text,
    p_token_hash bytea
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_invitation rsvp_private.invitations%ROWTYPE;
    v_event rsvp_private.event_settings%ROWTYPE;
    v_response rsvp_private.responses%ROWTYPE;
BEGIN
    v_invitation := rsvp_private.lock_public_invitation(
        p_event_id, p_token_hash
    );

    SELECT s.* INTO STRICT v_event
    FROM rsvp_private.event_settings AS s
    WHERE s.event_id = p_event_id;

    SELECT r.* INTO v_response
    FROM rsvp_private.responses AS r
    WHERE r.event_id = p_event_id AND r.invitation_id = v_invitation.id;

    RETURN jsonb_build_object(
        'displayName', v_invitation.display_name,
        'type', v_invitation.invitation_type,
        'maxAttendees', v_invitation.max_attendees,
        'revision', v_invitation.revision,
        'timezone', v_event.timezone,
        'deadlineAt', v_event.deadline_at,
        'closed', clock_timestamp() >= v_event.deadline_at,
        'response', CASE
            WHEN v_response.invitation_id IS NULL THEN NULL
            ELSE jsonb_build_object(
                'status', v_response.response_status,
                'attendeeCount', v_response.attendee_count
            )
        END
    );
END
$fn$;

CREATE FUNCTION public.rsvp_public_respond(
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

CREATE FUNCTION public.rsvp_admin_mutate(
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

CREATE FUNCTION public.rsvp_admin_correct_capacity(
    p_event_id text,
    p_invitation_id uuid,
    p_expected_revision bigint,
    p_invitation_type text,
    p_max_attendees integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_invitation rsvp_private.invitations%ROWTYPE;
    v_attendee_count integer;
    v_revision bigint;
BEGIN
    v_invitation := rsvp_private.lock_admin_invitation(
        p_event_id, p_invitation_id, p_expected_revision
    );

    -- The parent FOR SHARE lock stabilizes activity until transaction end.
    IF NOT EXISTS (
        SELECT 1 FROM public.eventos AS e
        WHERE e.id = p_event_id AND e.event_status = 'active'
    ) THEN
        PERFORM rsvp_private.fail('ADMIN_EVENT_NOT_ACTIVE');
    END IF;

    IF p_invitation_type IS NULL
       OR p_invitation_type NOT IN ('individual', 'group')
       OR p_max_attendees IS NULL
       OR p_max_attendees NOT BETWEEN 1 AND 20
       OR (p_invitation_type = 'individual' AND p_max_attendees <> 1)
    THEN
        PERFORM rsvp_private.fail('INVALID_INVITATION_CAPACITY');
    END IF;

    SELECT r.attendee_count INTO v_attendee_count
    FROM rsvp_private.responses AS r
    WHERE r.event_id = p_event_id AND r.invitation_id = p_invitation_id
    FOR UPDATE;

    IF FOUND AND p_max_attendees < v_attendee_count THEN
        PERFORM rsvp_private.fail('CAPACITY_BELOW_CURRENT_ATTENDANCE');
    END IF;

    IF p_invitation_type = v_invitation.invitation_type
       AND p_max_attendees = v_invitation.max_attendees
    THEN
        RETURN jsonb_build_object(
            'revision', v_invitation.revision, 'changed', false
        );
    END IF;

    UPDATE rsvp_private.invitations
    SET invitation_type = p_invitation_type,
        max_attendees = p_max_attendees,
        revision = revision + 1,
        updated_at = clock_timestamp()
    WHERE event_id = p_event_id AND id = p_invitation_id
    RETURNING revision INTO v_revision;

    -- The FK propagates capacity atomically without changing response/count.
    -- responses.updated_at continues to denote the last response write.
    PERFORM rsvp_private.audit(
        p_event_id, 'CORRECT_CAPACITY', 'authenticated_admin'
    );
    RETURN jsonb_build_object(
        'revision', v_revision,
        'type', p_invitation_type,
        'maxAttendees', p_max_attendees,
        'changed', true
    );
END
$fn$;

CREATE FUNCTION public.rsvp_admin_list(
    p_event_id text,
    p_after_id uuid,
    p_limit integer
)
RETURNS TABLE (
    invitation_id uuid,
    display_name text,
    invitation_type text,
    max_attendees integer,
    revoked boolean,
    revision bigint,
    response_status text,
    attendee_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
        PERFORM rsvp_private.fail('INVALID_PAGE_SIZE');
    END IF;
    PERFORM rsvp_private.lock_event(p_event_id);

    RETURN QUERY
    SELECT i.id, i.display_name, i.invitation_type, i.max_attendees,
           i.revoked_at IS NOT NULL, i.revision,
           r.response_status, r.attendee_count
    FROM rsvp_private.invitations AS i
    LEFT JOIN rsvp_private.responses AS r
      ON r.event_id = i.event_id AND r.invitation_id = i.id
    WHERE i.event_id = p_event_id
      AND (p_after_id IS NULL OR i.id > p_after_id)
    ORDER BY i.id
    LIMIT p_limit;
END
$fn$;

-- 4. Retention worker and non-PII administrative reads.

CREATE FUNCTION public.rsvp_purge_due(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_event record;
    v_processed integer := 0;
    v_cutoff timestamptz;
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
        PERFORM rsvp_private.fail('INVALID_PURGE_BATCH_SIZE');
    END IF;
    v_cutoff := clock_timestamp();

    FOR v_event IN
        SELECT s.event_id
        FROM rsvp_private.event_settings AS s
        WHERE s.purged_at IS NULL AND s.purge_due_at <= v_cutoff
        ORDER BY s.purge_due_at, s.event_id
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Includes remaining revoked invitations; excludes earlier deletions.
        INSERT INTO rsvp_private.anonymous_aggregates (
            event_id, invitation_count, attending_count,
            not_attending_count, unanswered_count,
            attendee_count, materialized_at
        )
        SELECT v_event.event_id,
               count(i.id),
               count(i.id) FILTER (WHERE r.response_status = 'attending'),
               count(i.id) FILTER (WHERE r.response_status = 'not_attending'),
               count(i.id) FILTER (WHERE r.invitation_id IS NULL),
               coalesce(sum(r.attendee_count), 0),
               clock_timestamp()
        FROM rsvp_private.invitations AS i
        LEFT JOIN rsvp_private.responses AS r
          ON r.event_id = i.event_id AND r.invitation_id = i.id
        WHERE i.event_id = v_event.event_id;

        DELETE FROM rsvp_private.invitations
        WHERE event_id = v_event.event_id;

        DELETE FROM rsvp_private.creation_requests
        WHERE event_id = v_event.event_id;

        UPDATE rsvp_private.event_settings
        SET purged_at = clock_timestamp(),
            revision = revision + 1,
            updated_at = clock_timestamp()
        WHERE event_id = v_event.event_id;

        PERFORM rsvp_private.audit(
            v_event.event_id, 'PURGE', 'retention_worker'
        );
        v_processed := v_processed + 1;
    END LOOP;

    RETURN v_processed;
END
$fn$;

CREATE FUNCTION public.rsvp_admin_aggregate(p_event_id text)
RETURNS TABLE (
    event_id text,
    invitation_count bigint,
    attending_count bigint,
    not_attending_count bigint,
    unanswered_count bigint,
    attendee_count bigint,
    materialized_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $fn$
    SELECT a.event_id, a.invitation_count, a.attending_count,
           a.not_attending_count, a.unanswered_count,
           a.attendee_count, a.materialized_at
    FROM rsvp_private.anonymous_aggregates AS a
    WHERE a.event_id = p_event_id;
$fn$;

CREATE FUNCTION public.rsvp_admin_audit_list(
    p_event_id text,
    p_limit integer
)
RETURNS TABLE (
    audit_id uuid,
    occurred_at timestamptz,
    action text,
    actor_class text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
        PERFORM rsvp_private.fail('INVALID_PAGE_SIZE');
    END IF;

    RETURN QUERY
    SELECT a.id, a.occurred_at, a.action, a.actor_class
    FROM rsvp_private.admin_audit AS a
    WHERE a.event_id = p_event_id
    ORDER BY a.occurred_at DESC, a.id DESC
    LIMIT p_limit;
END
$fn$;

-- 5. RLS and explicit backend-only privileges.
-- No browser policies. Trusted definer owners operate on their own tables.
-- service_role receives no direct schema/table/helper privileges here.

ALTER TABLE rsvp_private.event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_private.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_private.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_private.creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_private.anonymous_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_private.admin_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA rsvp_private
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rsvp_private
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rsvp_private
    FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
    public.rsvp_configure(text, text, timestamptz, timestamptz, bigint)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.rsvp_create_invitation(text, uuid, text, text, integer, bytea)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rsvp_public_read(text, bytea)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.rsvp_public_respond(text, bytea, bigint, text, integer)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.rsvp_admin_mutate(text, uuid, bigint, text, text, integer, bytea)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.rsvp_admin_correct_capacity(text, uuid, bigint, text, integer)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rsvp_admin_list(text, uuid, integer)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rsvp_purge_due(integer)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rsvp_admin_aggregate(text)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rsvp_admin_audit_list(text, integer)
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
    public.rsvp_configure(text, text, timestamptz, timestamptz, bigint)
    TO service_role;
GRANT EXECUTE ON FUNCTION
    public.rsvp_create_invitation(text, uuid, text, text, integer, bytea)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_public_read(text, bytea)
    TO service_role;
GRANT EXECUTE ON FUNCTION
    public.rsvp_public_respond(text, bytea, bigint, text, integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION
    public.rsvp_admin_mutate(text, uuid, bigint, text, text, integer, bytea)
    TO service_role;
GRANT EXECUTE ON FUNCTION
    public.rsvp_admin_correct_capacity(text, uuid, bigint, text, integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_admin_list(text, uuid, integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_purge_due(integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_admin_aggregate(text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_admin_audit_list(text, integer)
    TO service_role;

COMMIT;
