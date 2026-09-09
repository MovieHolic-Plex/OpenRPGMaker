# Task20: real HTTP persistence boundaries

The task20 lane adds PostgREST to the existing run-owned PostgreSQL harness. It
never connects to a deployed Supabase instance or reads application credentials.
The old `--local-only` loopback fixture remains transport-only coverage.

## Invocation

Provide an explicitly installed Linux x86-64 PostgREST 13.0.7 executable; the
harness does not download or install software. The validation in this lane used
the official release asset `postgrest-v13.0.7-linux-static-x86-64.tar.xz`:

- archive SHA-256: `4153f81ccc40e7b735edc89cd84b49da25ba27eb37d57c7f6a82c9005a0b762b`
- executable SHA-256: `036738687f9814a9db5f3d78afa6e614bcf20c66add04455e34ea494784db7b3`

Run through the parent's monitor with its validation lock:

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  env SPATIAL_TEST_POSTGREST_BIN=/absolute/run-owned/path/postgrest \
  bash scripts/qa/spatial-sql-local.sh task20
```

Append `Q7`, `Q8`, or `Q9` after `task20` to run one boundary in its own
cluster. The final validation used these separate scopes, a 60-second lock
acquisition bound and a 180-second per-scope command bound. Keep the monitor alive
until its exit receipt; a queued monitor is not a completed test.

The harness invokes the approved Q7/Q8/Q9 script/argument surfaces with Bun
instead of the plan's `npx tsx`. Bun is required for explicit resource management
and the isolated missing-RPC guard bundle; no tsx package is installed here.
`QA_PROJECT=task20` is the reserved fixture namespace, isolated by cluster per run:

```sh
bun scripts/qa/spatial-persistence.mts --project task20 --scenario stale-writers --evidence "$E/Q7"
bun scripts/qa/spatial-persistence.mts --project task20 --scenario mirror-failure --evidence "$E/Q8"
bun scripts/qa/spatial-migration.mts --scenario legacy-matrix --evidence "$E/Q9"
```

These commands must inherit `SPATIAL_TEST_DATABASE_URL` from the harness. The
strict socket parser rejects missing, foreign, network and appended connection
strings. Application Supabase/proxy variables and libpq defaults are unset before
startup. The product migrations run unchanged. A test-only invoker identity RPC
records the actual JWT-selected `anon`, session `authenticator`, backend PID, and
absence of writer-role membership. The role is not emulated by the recorder.

## Assertions and evidence

- Q7 uses the actual store load/flush pipeline. A browser-role psql holder accepts
  A in an open transaction. B's one HTTP flush waits, resumes, receives 409, keeps
  its distinct dirty local value, and issues no retry or fallback.
- A client loaded before real activation cannot reuse its legacy upsert. Direct
  marker removal and mirror overwrite fail. A distinct legacy project still
  inserts and updates through the same table API.
- Duplicate create overlaps an uncommitted create and resumes as 409, preserving
  the accepted row. Missing RPC is a real temporary database function rename;
  the adapter rejects it as migration-required without fallback.
- Q8 injects a NOT VALID CHECK constraint on the run's map projection. The root
  commits, the real mirror transaction rolls back on INSERT, the store retains
  its accepted receipt and separate warning, and canonical reload/picker preview
  materials ignore the retained stale child rows. `preview.json` is a headless
  data receipt, **not** browser pixels.
- Q9 activates custom/missing/empty/collision library cases from raw HTTP capture.
  Exact raw fields and shop commands survive activation; archive bytes survive
  actual canonical save, package export/import and reload. Conversion remains
  idempotent. Both legacy-root-first and legacy-map-first HTTP activation races
  conflict. Activation-first rejects the blocked legacy HTTP map writer.

Every overlap subscribes to the exact Postgres PID's new `log_lock_waits` event
before the HTTP action. A separate observer requires an active Lock wait,
`pg_blocking_pids`, the exact transaction ID, the holder's open transaction and
matching ShareLock/ExclusiveLock entries. Only then does the holder COMMIT. No
sleep, echo, cancellation/retry, or elapsed-duration assertion proves overlap.

`http.json` stores raw request bodies and original response status/message,
header pairs and response bodies from PostgREST. Only the ephemeral JWT/key
request header values are redacted. The recorder strips the Supabase `/rest/v1`
path prefix but does not fabricate SQL results, authorization, or statuses.
PostgREST maps SQLSTATE 42501 to **401 for its anon role**, including a JWT whose
role is anon; the older transport fixture's 403 is not the real anon wire code.

## Guard sensitivity

`mutation-red.log` and `green.log` capture unchanged rejection checks against:
loaded SHA, spatial version, direct marker removal, protected mirror writes,
insert-only creation, pre-existing upsert, effective raw baseline, and the client
HTTP-error rejection boundary. SQL RED requires a 2xx unsafe acceptance, not a
syntax error or a different rejection. Original `pg_get_functiondef` definitions
are captured and restored exactly before GREEN. Root/mirror mutations bypass the
respective trigger branch; create mutation substitutes existing-row update for
insert-only routing; raw-baseline mutation trusts the supplied baseline instead
of the lock-protected recomputation.

Missing-RPC sensitivity bundles an isolated copy of `persistenceHttp.ts`, removes
only `if (!response.ok)`, and runs the same probe against the genuinely absent
RPC. RED must exit 3 with `SPATIAL_HTTP_GUARD_ACCEPTED_ERROR`; an original-source
bundle must exit 0. Product source is never modified. Both bundles are removed.

The harness records source tree/blob hashes, focused Bun build output, real
Postgres logs, role receipts, process exit receipts, and cluster cleanup. Local
roles disappear with the owned cluster; no protected-row DELETE bypass is used.
Task20 closes inherited validation-lock descriptors before starting detached
Postgres; `lock-inheritance.log` also asserts the postmaster did not inherit that
lock. This fixes the observed interrupted-launcher lock retention without
releasing the lock held by the supervising `flock` process.
The unchanged task5/30 66 SQL assertions/five psql races are parent evidence, not
recounted as new task20 coverage.

## Observed out-of-scope defect

The actual anon store audit POST sends `resolution=merge-duplicates` to
`project_commits`. Migration `20260829000001_anon_privilege_tighten.sql` revoked
anon UPDATE on that append-only table, so PostgREST's generated `ON CONFLICT DO
UPDATE` returns 401/42501. The store logs the failure after its root save. The
new driver waits for that exact `project_commits` response rather than waiting
for a `project_changes` request which never occurs. Raw failure receipts and
stderr are retained; audit persistence is **not** counted as passing. Fix the
append-only writer's request preference, not the privilege fence, in a separately
authorized production change. Headless edit-activity disk mirroring also logs
its unsupported relative dev-server URL; no dev server or browser is claimed.

Local PostgREST/JWT/ACL evidence does not prove deployed Supabase keys, gateway,
RLS policies, migration deployment, or browser presentation. Q7-pre's deployed
pre-migration vulnerability capture remains a separate task23 obligation.
