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

The runner requires Bun. It executes the prior-schema preservation assertion
first (expected psql exit 3), applies the unchanged migration, then executes all
66 integration assertions, including the original role fences. SQL runs from the
owned temporary directory: the role test's historical relative task-5 output
path is sandboxed there and its receipt is collected as `roles.json`. No
historical task-5 receipt is overwritten.

Next, `spatial-sql-echo-red.sh` deterministically reproduces the rejected old
schedule on actual browser-role connections. The holder reserves an ID, the
contender emits the old `CREATE_STARTED` echo, and a FIFO gates psql before its
already queued duplicate-create statement can reach PostgreSQL. A live snapshot
records the open holder and idle, unblocked contender. Only after the holder's
COMMIT acknowledgement does the coordinator open the gate. The same queued
statement returns PT409, proving that the original outcome could pass without
overlap. The test intentionally exits 1 with `SPATIAL_ECHO_WITHOUT_OVERLAP`;
the runner requires both that exit and sentinel, not an incidental failure.

Finally, `bun scripts/qa/spatial-sql-races.mts` must exit 0 with five real overlaps:

1. The local cluster enables `log_lock_waits`, a 50ms `deadlock_timeout`, and a
   PID-bearing log prefix in the C locale. This threshold triggers PostgreSQL's
   actual lock-wait event; elapsed time is never the success assertion.
2. Before submitting each contender statement, the driver opens an append-only
   log cursor at EOF and subscribes with `fs.watch`. Historical events, other
   backend PIDs, SQL text, and lock-acquired messages cannot satisfy the barrier.
3. After the specific contender's wait event, a third, local-admin connection
   takes one live catalog snapshot. The SQL assertion requires the holder to be
   idle in an open transaction, the contender active in a Lock wait, the holder
   in `pg_blocking_pids`, and matching granted ExclusiveLock/ungranted ShareLock
   entries for the exact transaction ID named by the server event. Both racing
   connections remain `authenticator` -> `anon`; observation does not grant them
   administrative capabilities.
4. Only that proof allows holder COMMIT. The same blocked statement resumes;
   it is never cancelled and retried as a fresh query. Every original rejection
   and preservation assertion remains in place, including the NOWAIT probe.

`races.json` records both backend IDs, the raw wait event, lock identity/modes,
blocker relationship, holder transaction, blocked SQL/query start, and ordered
subscription/event/verification/COMMIT/completion events per scenario. Client
COMMIT acknowledgement and contender completion may arrive in either order;
both necessarily follow COMMIT submission after the live proof. A contender
completing early fails closed. Event and process waits have bounded failure
timeouts, not sleeps or polling. PostgreSQL NOTIFY is not used: delivery on
commit cannot establish this precommit barrier.

Each invocation prints its unique evidence directory under
`output/evidence/tile-to-world/task-30/run.*`. It contains `schema-red.log`,
`red.log`, `green.log`, `roles.json`, `races.json`, the actual `postgres.log`, and
`cleanup.md`. Independent runs cannot overwrite one another. The runner always
stops only its owned cluster and removes its private directory, including on
failure; no protected-project DELETE bypass is introduced. Evidence is not
committed. Run the focused log-subscription tests with:

```sh
bun test scripts/qa/spatial-sql-lock-wait.test.mts
```

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
