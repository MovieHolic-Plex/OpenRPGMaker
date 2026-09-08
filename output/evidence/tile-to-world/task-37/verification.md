# Task37 verification

Base: cbd880f2f3900ab1a85cd88f4cc9772e71c43f1b on fix/spatial-audit-append.
Product change: one replacement line in src/project/supabaseProjectSync.ts insertRows.
No SQL, privileges, auth, shared headers, or ordinary upsert code changed.

## RED / GREEN

- RED monitor mon_0KSWTMHCHTKSVPG2: focused Vitest 2 failed / 3 passed;
  expected return=minimal, received resolution=merge-duplicates,return=minimal.
  Unit exit 1. Real HTTP run.kKcP3b exit 1 at the actual project_commits POST:
  HTTP 401, SQLSTATE 42501, permission denied for table project_commits.
  The rejected application receipt retained tip=null. Monitor exit 0 means the
  wrapper confirmed BOTH expected red exits; it does not call the red tests green.
- GREEN monitor mon_EHXJ28RJV64K4K7Y: focused Vitest 5 passed / 0 failed in one run;
  no-excuse checker found no violations in the two new TS/MTS files;
  real HTTP run.D8dnKS exit 0. No retries, polling, sleeps, disabled assertions,
  or increased deadlines. Both monitors used flock -w 60 and timeout 180.
- Focused build: Bun bundled 306 modules / 2.0 MB / exit 0 in each private cluster.
  Source entry ran against actual PostgreSQL 16 + PostgREST 13.0.7.
- LSP diagnostics: no diagnostics on src/project/supabaseProjectSync.ts,
  test/supabaseAuditAppend.test.ts and scripts/qa/spatial-audit-append.mts.
  bash -n scripts/qa/spatial-audit-local.sh and source git diff --check passed.
  Staging raw Bun build.log files exposed their trailing blank line as a diff
  whitespace error. Lossless build.log.gz copies preserve the original bytes
  without rewriting the logs; raw files remain local and indexed.
- No broad old suites/builds or Q7-Q9 reruns. Existing projectCommitLogging and
  commitEditActivityAttachment tests use vi.waitFor polling; they were inspected,
  not modified or represented as this task's deterministic verification.

## Runtime observations

RED contains 7 HTTP exchanges; GREEN contains 33. GREEN includes four successful
201 audit POSTs (two linked commit/change pairs), persisted application receipts,
a tip advancing to the second ID and its parent referencing the first ID.

Both tables independently reject raw PATCH and DELETE with 401/42501. Both
reject a plain duplicate primary key with 409/23505. Reintroducing only the merge
preference rejects both fresh-key and duplicate-key POSTs on each table with
401/42501. GET comparisons preserve the original complete audit rows.
The missing-project append rejects with 409/23503 without tip advancement.
Ordinary root upserts still update the existing project, and the unit control
preserves conversation upsert preferences.

Identity/ACL receipts show real JWT anon / session authenticator / no writer
membership; SELECT and INSERT allowed, UPDATE and DELETE denied. Product
migrations are unchanged. Raw PostgREST status/header/body data are retained in
http.json and lossless committed http.json.gz; cmp against decompression passed.
The local JWT/key header values alone are redacted. No deployed credentials,
endpoint, migration rollout, browser, or atomic multi-request audit claim.

## Architectural review

1. Responsibility: product edit owns audit append request semantics; unit file
   owns audit request contracts; MTS driver owns live audit proof; shell owns the
   disposable database lifecycle. No unrelated refactor.
2. Boundary purity: driver parses received JSON through existing rawObject;
   SQL/HTTP assertions remain at test boundaries, not production defensive layers.
3. Variants: no tagged-domain variant dispatch was introduced.
4. Escape hatches: no new any, casts, non-null assertions or suppressed diagnostics.
5. Defensive layers: no new production guards or catch blocks.
6. Helpers: rows() has multiple test callers; production reuses its header builder.
7. Tests: exact header regressions were RED before the replacement and GREEN after;
   live audit receipt path has real SQL/HTTP proof plus rejection cases.
8. Parameters: touched insertRows has three; new helpers have at most one.
9. Redundant verification: no new production operation/query pairs; test readbacks
   assert requested persisted-row immutability and content, not transport success.
10. Naming: no new negative-form names.
11. Logging: production logging and error handling are unchanged.

Pure LOC: source 1390 (inherited, unchanged count; explicit one-line fix scope
precludes unrelated extraction), focused test 44, live driver 122, shell 69.
New files remain below 200; the inherited module is not presented as size-clean.
