# Phase 3D SQL

These scripts prepare the additive `eventos` + `event_versions` model. They are
review artifacts only in Phase 3D-C; none has been executed against Supabase.

## Confirmed production baseline

PostgreSQL 17.6 has three `public.eventos` rows with `id text` as primary key and
`datos jsonb NOT NULL`. Two IDs retain a compatible trailing hyphen. Payloads
range from 3,312 to 5,722,194 bytes, so every immutable version can materially
increase storage. There are no versioning objects or historical timestamps.

Kaly & Joha (`kaly-joha`) remains protected: its `datos` value is copied exactly
to V1 and continues powering the public invitation until a later application
phase changes reads.

## Future execution order

1. Create and verify a Supabase backup.
2. Pause application writes.
3. Run `01-preflight.sql`.
4. Run `02-structure.sql`.
5. Run `03-backfill.sql`.
6. Run `04-verify.sql` and review every result.
7. Run `05-rpc.sql`.
8. Run `04-verify.sql` again.
9. Resume writes only after approval.

Do not execute `06-security-future.sql` until the role represented by
`SUPABASE_KEY` is confirmed. It intentionally contains commented proposal SQL
and does not alter the currently unsecured legacy `eventos` surface.

`07-rollback.sql` supports stages A/B while `datos` remains authoritative. Its
guard aborts destructive rollback if any V2+ exists. After real version history
exists, preserve it and use a separately reviewed forward-recovery plan.

No script drops, rewrites, normalizes, or updates `eventos.datos`. No script in
this directory changes the public URL, renderer, publisher, or application code.
