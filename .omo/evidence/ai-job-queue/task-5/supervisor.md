# Supervisor verification - delayed application

The supervisor independently ran the tests and actual Chromium entry point after
the worker handed off. No paid provider or user remote-project writes were used.

## Regression evidence

- Unchanged assistant result, before the correction:
  `npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobApplication.test.ts -t 'unchanged read-only result'`
  exited 1. The store subscription observed 1 mutation, expected 0.
  Monitor `mon_8M9SWD1KRHEDH0ET` / `bash_46`.
- After the correction, the full 11-file application/event/identity/tileset suite
  passed 92 tests, and `node --test test/aiJobsHttp.test.mjs` passed 10 tests.
  `node test/aiJobApplication.browser.mjs`, `npm run typecheck:app`, and
  `npm run build:app` then passed in the same sequential command, exit 0.
  Monitor `mon_32X69P8P4RBBHCXN` / `bash_47`; build completed in 41.53 seconds.
- Actual Chromium evidence: histories `[1, 0]` for the competing application;
  unchanged assistant result reports `application: applied`, `save: unsaved`,
  `reason: no-changes`, 0 store mutations and 0 history entries. All three durable
  application records retain recovery snapshots and receipt IDs. Browser proof
  validates receipt-bound artifact hashes and command-dialog confirmation/undo.
- Commit review found that pending cache writes recomputed their destination
  after acquiring a lock. The two discriminating cases, persistence and migration,
  both failed before the fix by overwriting the new slot's `localProjectId`.
  `npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobIdentity.test.ts -t 'queued cache'`
  exited 1 with 2 failures / 4 excluded cases.
  Monitor `mon_8JKGV67J3ZHR7EFE` / `bash_48`.
- Cache writes now use the slot captured before lock acquisition. Final post-fix
  `npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobIdentity.test.ts test/aiJobApplication.test.ts`
  passed 31 tests. The same sequential invocation then passed the actual browser
  proof, `npm run typecheck:app` and `npm run build:app`, exit 0; build 43.64 seconds.
  Monitor `mon_1K314TXQJ7PWFMF6` / `bash_49`.
- After adjusting test deferred constructors for the repository's TypeScript lib,
  the exact queued-cache regression was run again: 2 passed / 4 excluded by the
  explicit filter, exit 0. Monitor `mon_CK43HX3CWT4PRK1X` / `bash_50`.
  Fresh test diagnostics were clean. Final browser history counts were `[0, 1]`
  (the winning tab may differ); unchanged-result mutations remained 0 and both
  paidCalls and remoteProjectWrites were 0. Final port 19841 listener check was empty.

## Boundaries and remaining project work

`browser-evidence.json`, `browser-reviewed-command.png` and `browser-trace.zip`
are produced by the checked-in real-browser proof script. The script closes its
contexts, service, server and temporary storage in `finally`. An independent
`ss -ltnp` check after the first final run found no listener on port 19841.
The pre-existing server on port 9841 was not touched.

LSP checks on the application coordinator, application records, project store,
identity, cache persistence and touched tests were clean. The test target uses an
older TypeScript library, so new test deferreds use ordinary Promise constructors,
not Promise.withResolvers.

The worker's `HANDOFF.md` records six identical pre-existing store-suite failures
against the base-source overlay and current source. They were not suppressed.
Full supervisor gates and final editor inbox/report/submission QA remain later
plan tasks. This evidence proves delayed application, not those unfinished UI
surfaces or a real user's Supabase save.
