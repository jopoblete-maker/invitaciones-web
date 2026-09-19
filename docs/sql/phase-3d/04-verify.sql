-- Phase 3D verification. READ-ONLY: every anomaly query should return zero.

-- Counts should agree dynamically; no production count is hardcoded here.
SELECT
    (SELECT count(*) FROM public.eventos) AS event_count,
    (SELECT count(*) FROM public.event_versions) AS version_count,
    (SELECT count(*) FROM public.event_versions WHERE version_number = 1) AS v1_count,
    (SELECT count(*) FROM public.eventos)
      = (SELECT count(*) FROM public.event_versions WHERE version_number = 1)
      AS event_v1_counts_match;

-- Events without a published pointer.
SELECT e.id
FROM public.eventos e
WHERE e.published_version_id IS NULL;

-- Published pointers that do not resolve to a version owned by the event.
SELECT e.id, e.published_version_id
FROM public.eventos e
LEFT JOIN public.event_versions v
  ON v.event_id = e.id AND v.id = e.published_version_id
WHERE e.published_version_id IS NOT NULL AND v.id IS NULL;

-- Working pointers that do not resolve to a version owned by the event.
SELECT e.id, e.current_working_version_id
FROM public.eventos e
LEFT JOIN public.event_versions v
  ON v.event_id = e.id AND v.id = e.current_working_version_id
WHERE e.current_working_version_id IS NOT NULL AND v.id IS NULL;

-- Versions without a parent event.
SELECT v.id, v.event_id
FROM public.event_versions v
LEFT JOIN public.eventos e ON e.id = v.event_id
WHERE e.id IS NULL;

-- Duplicate logical version numbers.
SELECT event_id, version_number, count(*) AS duplicate_count
FROM public.event_versions
GROUP BY event_id, version_number
HAVING count(*) > 1;

-- Migrated snapshots that differ from the untouched legacy source.
SELECT e.id
FROM public.eventos e
JOIN public.event_versions v
  ON v.event_id = e.id AND v.version_number = 1
WHERE e.datos IS DISTINCT FROM v.content;

-- Invalid V1 migration metadata.
SELECT v.id, v.event_id, v.workflow_status, v.published_at
FROM public.event_versions v
WHERE v.version_number = 1
  AND (v.workflow_status <> 'approved' OR v.published_at IS NULL);

-- Initial migration must leave no pending working version.
SELECT id, current_working_version_id
FROM public.eventos
WHERE current_working_version_id IS NOT NULL;

-- Schema distribution.
SELECT COALESCE(schema_version::text, 'legacy/null') AS schema_group,
       count(*) AS version_count
FROM public.event_versions
GROUP BY schema_version
ORDER BY schema_version NULLS FIRST;

-- Storage diagnostic. JSONB equality above is the authoritative check.
SELECT e.id,
       pg_column_size(e.datos) AS datos_bytes,
       pg_column_size(v.content) AS content_bytes,
       e.datos IS NOT DISTINCT FROM v.content AS snapshot_equal
FROM public.eventos e
JOIN public.event_versions v
  ON v.event_id = e.id AND v.version_number = 1
ORDER BY e.id;

-- Safe Kaly & Joha canary: no JSON content is returned.
SELECT e.id AS event_id,
       v.version_number,
       v.schema_version,
       v.workflow_status,
       e.published_version_id = v.id AS published_pointer_matches,
       e.datos IS NOT DISTINCT FROM v.content AS snapshot_equal,
       pg_column_size(e.datos) AS datos_bytes,
       pg_column_size(v.content) AS content_bytes
FROM public.eventos e
JOIN public.event_versions v
  ON v.event_id = e.id AND v.version_number = 1
WHERE e.id = 'kaly-joha';

-- Aggregate legacy canary: IDs and JSON content are not exposed.
SELECT count(*) AS legacy_event_count,
       count(*) FILTER (WHERE v.version_number = 1) AS legacy_v1_count,
       count(*) FILTER (WHERE v.schema_version IS NULL) AS null_schema_count,
       bool_and(e.datos IS NOT DISTINCT FROM v.content) AS all_snapshots_equal
FROM public.eventos e
JOIN public.event_versions v
  ON v.event_id = e.id AND v.version_number = 1
WHERE e.datos->>'schema_version' IS NULL;
