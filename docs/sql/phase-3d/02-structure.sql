-- Phase 3D structural migration. Run only after 01-preflight.sql passes.
BEGIN;

ALTER TABLE public.eventos
    ADD COLUMN published_version_id uuid NULL,
    ADD COLUMN current_working_version_id uuid NULL,
    ADD COLUMN event_status text NOT NULL DEFAULT 'active',
    ADD COLUMN created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    ADD CONSTRAINT eventos_event_status_ck
        CHECK (event_status IN ('active', 'archived'));

CREATE TABLE public.event_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL,
    version_number bigint NOT NULL,
    content jsonb NOT NULL,
    schema_version smallint NULL,
    workflow_status text NOT NULL DEFAULT 'draft',
    source_version_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    published_at timestamptz NULL,

    CONSTRAINT event_versions_event_number_uq
        UNIQUE (event_id, version_number),
    CONSTRAINT event_versions_event_id_id_uq
        UNIQUE (event_id, id),
    CONSTRAINT event_versions_number_ck
        CHECK (version_number > 0),
    CONSTRAINT event_versions_content_object_ck
        CHECK (jsonb_typeof(content) = 'object'),
    CONSTRAINT event_versions_schema_version_ck
        CHECK (schema_version IS NULL OR schema_version > 0),
    CONSTRAINT event_versions_workflow_ck
        CHECK (workflow_status IN (
            'draft', 'ready_for_preview', 'in_review',
            'changes_requested', 'approved', 'archived'
        )),
    CONSTRAINT event_versions_event_fk
        FOREIGN KEY (event_id)
        REFERENCES public.eventos(id)
        ON DELETE RESTRICT,
    CONSTRAINT event_versions_source_same_event_fk
        FOREIGN KEY (event_id, source_version_id)
        REFERENCES public.event_versions(event_id, id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY IMMEDIATE
);

-- The UNIQUE(event_id, version_number) index also serves ordered history reads.
-- No created_at index is justified by the current access patterns.

CREATE FUNCTION public.touch_event_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
    IF ROW(
        NEW.published_version_id,
        NEW.current_working_version_id,
        NEW.event_status
    ) IS DISTINCT FROM ROW(
        OLD.published_version_id,
        OLD.current_working_version_id,
        OLD.event_status
    ) THEN
        NEW.updated_at := transaction_timestamp();
    ELSE
        NEW.updated_at := OLD.updated_at;
    END IF;
    RETURN NEW;
END
$function$;

CREATE TRIGGER eventos_touch_updated_at
BEFORE UPDATE ON public.eventos
FOR EACH ROW
EXECUTE FUNCTION public.touch_event_updated_at();

CREATE FUNCTION public.protect_event_version_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
       OR NEW.source_version_id IS DISTINCT FROM OLD.source_version_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'IMMUTABLE_VERSION_FIELD';
    END IF;
    RETURN NEW;
END
$function$;

CREATE TRIGGER event_versions_protect_snapshot
BEFORE UPDATE ON public.event_versions
FOR EACH ROW
EXECUTE FUNCTION public.protect_event_version_snapshot();

COMMIT;
