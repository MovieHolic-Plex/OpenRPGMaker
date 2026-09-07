# Supervisor verification and GROK resumption

The controlled fixture is independently verified. This is backend fixture
readiness, not Task8 UI completion or approval.

## Current evidence

Supervisor monitor `mon_F7XB4CJDXA0TQG87` / `bash_73` exited 0.

- Node fixture and existing HTTP tests: 18 passed, 0 failed.
- Unchanged Task7 process regressions: all 6 passed, including tests that
  deliberately require nonzero wrapper exit on cleanup failure.
- Explicit existing-zod-alias app typecheck: exit 0.
- Changed JavaScript diagnostics: no errors.
- Real execution/report/Apply/publication failure/save-only retry/readback:
  `succeeded / ready / applied / saved`.
- Exactly one job, one provider operation, one controlled provider call.
- Six expected negative violations: five legacy HTTP denials and one
  foreign-project denial. No unexpected errors or external browser origins.

Current run: `a0db790e-fe82-49ea-be19-31598058beba`.
Job: `7f395e55-71f8-43b8-97c3-e46b9892d90c`.
The current `qa-wire-real-http-proof.json` belongs to this supervisor run.
Pair it with `supervisor-qa-wire-cleanup.json`, not the older
`qa-wire-release-cleanup.json`. The older release logs/receipts remain historical.

The current UUID-bound receipt proves command/server exit 0, graceful closure,
no cleanup errors/escalations/remaining PIDs, free port, removed temporary
storage, zero browsers, zero held operations and zero waiters.
The parent compared the proof and receipt identities and checked these fields.

## GROK execution after integration

Run from the integrated main worktree root, not the historical tmpfs path in
Astra's handoff. Read `QA-WIRE-HANDOFF.md` for exact controls and plan contracts.
Use a unique label per run:

```bash
TASK8_QA=1 TASK8_ZOD_ENTRY=/home/main/node_modules/zod/index.js \
TASK7_COMMAND_TIMEOUT=3600 TASK7_SHUTDOWN_TIMEOUT=45 \
python3 .omo/evidence/ai-job-queue/task-7/run-owned.py grok-families-r1 \
  node node_modules/@playwright/test/cli.js test \
  --config .omo/evidence/ai-job-queue/task-8/grok-family.config.mjs
```

First adapt the family spec to run-bound controls, pinned disposable project
initialization, exact provider plans and actual result assertions. The existing
POST-only spec is not ready to run. Put transient Playwright output in owned
tmpfs storage and retain the required bounded screenshots/action evidence.

Never use normal Vite or browser-only mocking for this family proof. Neither
the controlled fixture nor this verification makes a zero-billing assertion
about earlier runs. All remaining original GROK R1 findings and U1-U8 behavior
remain required, including native review, guarded Apply and normal save/reload.
