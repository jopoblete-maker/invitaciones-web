# Phase 3 versioning closeout

Phase 3 established and validated the persistent event-versioning lifecycle in
production. This document records the resulting architecture, the real canary
exercise, compatibility constraints, and known follow-up work.

## Final architecture

`eventos` owns the stable public identity. Its `published_version_id` selects
the snapshot served publicly and `current_working_version_id` identifies the
single editable version, when one exists. The legacy `datos` column remains as
a temporary compatibility source.

`event_versions` stores immutable content snapshots. Versions are ordered by
`version_number`, move through `workflow_status`, record publication history in
`published_at`, and may identify their origin through `source_version_id`.

The validated editorial flow is:

```text
draft -> private preview -> in_review -> approved -> publish
```

A published V1 can remain public while V2 is the working version. Publishing V2
moves the public pointer to V2. Rolling back moves that pointer from V2 to V1
without deleting or rewriting V2.

## Production canary

The real canary used event `ycor-versioning-demo`:

- V1: `695067cb-0dfc-4a25-a14a-ee3a7ada07ce`
- V2: `544189e5-7747-43e6-ac2d-53a47ade1a31`

V1 was approved and published. V2 was then created from V1, previewed privately,
and approved without changing the public V1. V2 was subsequently published, and
the rollback returned the public pointer to V1. Both versions remain preserved
in history; the final working pointer is null.

The corresponding fictitious local snapshots are retained as operational
fixtures:

- `.dev/drafts/ycor-versioning-demo.event.json` represents V1.
- `.dev/drafts/ycor-versioning-demo-v2.event.json` represents V2.

Both snapshots keep the stable content ID `ycor-versioning-demo`. Their visible
title difference makes the publication and rollback result easy to verify.

## Compatibility status

- Kaly & Joha remains protected, and migrated legacy events remain operational.
- `eventos.datos` remains a transitional compatibility field.
- The public reader retains its current isolated legacy fallback rules.
- RLS remains disabled according to the latest verified production state; this
  closeout does not claim otherwise.
- `docs/sql/phase-3d/06-security-future.sql` has not been executed.
- `docs/sql/phase-3d/07-rollback.sql` has not been executed.

## Known technical debt

`rollback_event_version` does not implement optimistic concurrency for
`published_version_id` and does not accept an `expectedPublishedVersionId`.
Although it locks the event row, a concurrent publication completed before that
lock is acquired could be replaced by a later rollback. Add this hardening
before exposing rollback broadly in the UI.

The transitional `eventos.datos NOT NULL` requirement and the legacy public-read
fallback also remain. Their removal requires a separately reviewed migration
after compatibility is no longer needed.
