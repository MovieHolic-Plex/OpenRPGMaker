# Durable AI job repository - supervisor evidence

Date: 2026-09-06. Scope is plan task 1, not the completed end-user queue feature.

## Failing-first evidence

Read `red.log`: `node --test test/aiJobsRepository.test.mjs` failed the admission test with
`AssertionError [ERR_ASSERTION]: Missing expected rejection`, expected `PERSISTENCE_FAILED`.
The declared non-durable seam acknowledged an injected metadata write failure. This was
a behavioral assertion, not a missing import or syntax error.

## Independent verification

- Supervisor invoked `node --test test/aiJobsRepository.test.mjs && npm run typecheck:app`
  through monitor `mon_H7V2EG65KEX27Z6Z`; combined command completed exit 0.
- Node tests reported 24 passed, 0 failed, including actual SIGKILL recovery and competing
  restarters, malformed storage, metadata write/sync/rename failure, and idempotent outcomes.
- LSP: no diagnostics in contracts.ts, repository.mjs, storage.mjs, validation.mjs,
  repository.d.mts or aiJobsRepository.test.mjs.
- `git diff --check`: exit 0.

## Public API surface exercise

The supervisor imported `openAiJobsRepository` from the actual repository module in eval,
created an isolated temporary repository, persisted a JSON snapshot, admitted an assistant
job, recorded cancellation, closed/reopened the repository, and repeated its idempotency key.

Observed:

```json
{
  "sameId": true,
  "createdAgain": false,
  "jobs": 1,
  "state": "cancelled",
  "inbox": 1,
  "input": "qa-project"
}
```

Cleanup: repository closed and the supervisor's temporary directory removed. No server,
provider dispatch, browser session or remote project write was used by this exercise.

## Review scope

The supervisor read contracts, storage, repository, validation, declarations, regression
tests and the focused architecture documentation diff. No job HTTP/scheduler/executor/UI
completion is claimed by this increment.
