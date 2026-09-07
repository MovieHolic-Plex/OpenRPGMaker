# Spatial SQL publication contract

Run from the SQL worktree:

```sh
bash scripts/qa/spatial-sql-local.sh
```

The harness uses PostgreSQL 16 at `/usr/lib/postgresql/16/bin`. It creates a
unique private cluster under `/tmp/spatial-sql-st_01a07acd.*`, accepts only a
private Unix socket, and registers teardown before startup. It never reads a
production/admin URL or the application's credentials. Supabase roles are
created locally, then the applicable checked-in `rpg_zzu` migrations run
unchanged. The unrelated public benchmark and DRAFT auth migrations do not run.

The runner executes the prior-schema preservation assertion first (expected
psql exit 3), applies the migration, then executes:

```sh
psql "$SPATIAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -f test/integration/spatial-publication.sql
npx tsx scripts/qa/spatial-sql-races.mts
```

Both GREEN commands must exit 0. The runner always stops its own cluster and
removes its private directory; it does not introduce a protected-project DELETE
bypass. Evidence is under `output/evidence/tile-to-world/task-5/` and is not
committed. The race driver uses two actual psql connections, subscribed protocol
barriers, open transactions, and a NOWAIT parent-lock proof. No sleeps or polling
are involved. A concurrent loser can either encounter the held lock or reach it
after release; both schedules must preserve the same accepted data.

## RPC wire shape

`rpg_zzu.publish_spatial_project(project_id, expected_sha256, project,
operation, legacy_baseline DEFAULT NULL)` returns one JSON object:

```json
{"project_id":"id","revision":1,"sha256":"server-generated-token","project":{}}
```

- `create`: null expected SHA, no baseline, insert-only; duplicate IDs are PT409.
- `update`: the SHA originally loaded by this client, no baseline; requires the
  sticky fence and project-v4/spatial-v1 envelope. Stale clients get PT409.
- `activate`: the existing raw root SHA plus a separate raw baseline. Construct
  the baseline as the untouched `current_json`, replacing `maps` with the union
  of root maps and raw `maps.map_json` keyed by `map_id` (overlay rows win).
  Pass that effective raw project JSON directly, not a wrapper or normalized
  editor project. The submitted project must equal the baseline after removing
  its newly added `spatialAuthoring` field. Existing raw fields, events, empty
  arrays, and retired tileset data cannot be rewritten during activation.

The SQL boundary validates the versioned spatial envelope, collection types and
receipt digest shapes. Complete design/occurrence graph validation belongs to
the typed project validator, not a second SQL implementation of that domain.
Raw archive bytes remain opaque to SQL. Clients must retain them unchanged.

`rpg_zzu.sync_spatial_mirrors(project_id, expected_sha256)` is a separate call
and transaction. It accepts no map/tileset bodies, locks the accepted root,
checks its SHA and fence, and projects maps, tilesets and retired terrain rows
from that root. Success returns `project_id`, `sha256`, and `status: "synced"`.
A projection error is a mirror warning at the client boundary; do not roll back,
retry, or replace the already successful root publication. Canonical readers
must not overlay mirrors.

## Deployment assumptions and errors

- SQLSTATE PT409 is PostgREST HTTP 409. 42501 denies access/direct protected
  writes; 22023 rejects invalid operation/envelope/raw-preservation inputs.
- Use READ COMMITTED (PostgREST's normal isolation). 25001 rejects stronger
  transaction snapshots, which could otherwise hide a committed map-only edit
  even after acquiring the parent lock.
- Existing project access is the currently deployed table ACL policy. The RPC
  checks the actual access-controlled SET ROLE identity, falling back to
  session_user for direct sessions. It fails closed if project RLS is enabled;
  a future RLS cutover requires its own policy-aware adapter.
- The dedicated writer has no login, role-management powers or memberships.
  Browser roles cannot assume it. Guards run as invoker; a definer trigger's
  current_user would incorrectly turn every caller into the privileged writer.
- The migration expects Supabase's pgcrypto extension in `extensions`. Task 23
  must inspect that prerequisite and deploy through the private administrative
  connection. This harness is not deployment verification.
- Activation never upgrades an older raw project version or repairs raw data.
  A conversion that needs such rewrites requires an explicit contract decision,
  not silent normalization in this RPC.
