# Task37: append-only audit requests

`insertRows` serves only `project_commits` and `project_changes`. Its request must
use `Prefer: return=minimal`, not the shared upsert preference. PostgREST turns
`resolution=merge-duplicates` into `ON CONFLICT DO UPDATE`, which requires UPDATE
even when inserting a fresh primary key. Migration
`20260829000001_anon_privilege_tighten.sql` intentionally denies anon UPDATE and
DELETE on both audit tables. Do not repair this client bug with broader grants.
Ordinary project/child upserts retain their existing merge preference.

## Disposable reproduction

The task37 harness reuses task20's real PostgREST recorder and SQL session helper,
without modifying the original task20 driver, docs, receipt or evidence. It
creates a private socket-only PostgreSQL 16 cluster, applies the same applicable
product migrations unchanged, and runs actual JWT anon requests through an
`authenticator` session. No production configuration is needed or consumed.
Bun runs with `--no-env-file`; application and libpq connection variables are
cleared before startup. The loopback recorder strips `/rest/v1`, preserves real
HTTP request/response bodies and headers, and redacts only the ephemeral JWT.

Use the parent's asynchronous monitor and shared validation lock:

```sh
flock -w 60 /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  timeout 180 env SPATIAL_TEST_POSTGREST_BIN=/absolute/verified/path/postgrest \
  bash scripts/qa/spatial-audit-local.sh
```

The reusable prerequisite receipt is
`/home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/postgrest-ready.json`.
The parent owns removal of that shared executable after Q7-Q9. No binary or
package dependency is shipped. Official PostgREST 13.0.7 Linux x86-64 checksums:

- Archive: `4153f81ccc40e7b735edc89cd84b49da25ba27eb37d57c7f6a82c9005a0b762b`
- Executable: `036738687f9814a9db5f3d78afa6e614bcf20c66add04455e34ea494784db7b3`

## Proof contract

- The same `recordProjectCommit` application entry point fails with real
  401/42501 before the fix. The rejected receipt retains a null commit tip.
- After the fix both POSTs return 201; the awaited application receipt is
  persisted, a second receipt advances the tip, and its stored parent references
  the first commit. Actual GETs check linked change rows and the serialized hash.
- ACLs still grant SELECT/INSERT and deny UPDATE/DELETE. Raw PATCH and DELETE
  return 401/42501 for both tables. Reintroducing only the merge preference fails
  with 401/42501 for both fresh and duplicate keys.
- Plain duplicate primary keys return 409/23505, not silent success or overwrite.
  The original rows remain structurally identical after all attempts.
  This is append-only semantics, **not** request idempotency: project_changes has
  a generated key, so an unkeyed repeat can append a distinct change row.
- A missing project returns 409/23503 through the real writer without advancing
  its tip. An ordinary project upsert still updates its existing row.

The focused request test is `test/supabaseAuditAppend.test.ts`; its five cases
cover each audit table's preference, rejection at either write, and an ordinary
conversation upsert control. The HTTP driver provides real adapter/application
coverage rather than using that unit recorder as fake permission evidence.

Evidence lives in `output/evidence/tile-to-world/task-37/`: monitor transcripts,
raw `http.json`, accepted/rejected receipts, ACL/identity receipts, source hashes,
focused Bun bundle logs, process termination and cluster cleanup. Lossless
`http.json.gz` and `build.log.gz` copies are committed instead of the large raw
JSON and verbatim bundle logs; both forms are indexed. After checkout, use
`gzip -dk run.*/http.json.gz run.*/build.log.gz` inside the evidence directory
before `sha256sum -c artifact-sha256.txt`. Source and artifact indexes are
referenced by `spatial-task37-receipt.json`.

The two audit inserts remain separate requests; atomic pairing and retry dedup
are not introduced by this fix. This proof covers local PostgREST/JWT/ACLs and
the headless application audit entry point. It does not prove deployed Supabase
credentials, gateway policy, migration rollout, browser UI, or Q7-Q9 races.
