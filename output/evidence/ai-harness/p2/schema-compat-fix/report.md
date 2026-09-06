# P2 acceptance schema compatibility fix

## Delivery and scope

- Task: `st_01a078e8`; parent/root `01a07564-2645-75ee-8627-2f0990a25d52`.
- Sole writable worktree: `/home/main/z-project/rpg-zzu-ai-harness-p2-outcome-20260906`.
- Branch: `agent/ai-harness-p2-schema-compat-20260906`.
- Prepared base: `dfa8bdd15e4e39904ae910101d5e90579b5d8a67`, tree `d891bbd81abe1eaf9b1573ecf28b63251ea05cc7`.
- Verified source/test commit: `68ab835fc098b7486417d0eaed8b83f88d68d777`, tree `1dd36238133657e76992cd4baf7393f72d0d1355`.
- This report and raw artifacts ship in the following evidence-only commit; its identity is supplied in the handoff rather than embedded circularly in itself.
- Product changes: only `src/ai/assistantAcceptanceTools.ts`.
- Test changes: only `test/toolSchemaProviderCompat.test.ts`.
- Exact patches: `source.diff`, `test.diff`. No session, parser, evaluator, ledger, runtime, configuration, dependency, or other test edits.

The shared declaration now exposes a typed object with a `kind` enum and the union of actual criterion keys, plus an explicit target object with `mapId` and `newMapName`. The provider schema has no exposed unions. `toolVerdict.args` is a genuine dynamic JSON argument map (`type: "object", additionalProperties: true`), not an empty fixed object, string, wrapper, or evidence container.

## Contract traced before implementation

Read AGENTS, quickstart, wiki entry/routing/provider guidance, and the lead's `phase-p2.md`; read both matched residual raw JSON reports and logs before editing.

The two levels above the shared declaration are the public `WORK_PLAN_TOOLS` / `ACCEPTANCE_TOOLS` exposure and the actual plan/repair dispatch:

- `set_work_plan.acceptance` and `.requirements` both reference `ACCEPTANCE_SCHEMA`.
- `repair_acceptance.criteria` references the same `ACCEPTANCE_CRITERIA_SCHEMA`.
- `workPlanFromSetToolArgs` and the orchestrator parser call `parseAcceptance`.
- `AssistantAcceptanceLedger.repair` calls `parseAcceptanceCriteria` and cannot replace a valid promise.
- `parseAcceptanceCriteria` enforces every kind's required/allowed fields; a malformed sibling invalidates the entire array. Targets must contain exactly one nonempty ID/name. Verification tools must be registered and args must be an object.
- `ToolVerificationEvidence.passedScope` keys full exact args, preserves JSON value types, and requires fresh explicit evidence. The canonical ledger remains the sole satisfaction authority.

Only provider-level conditional requiredness is expressed through the flattened shape and its field instructions. Actual runtime requiredness and exclusive-target validation are unchanged. Common `kind`, point/region required fields, all previous numeric minima and nonempty arrays, closed structural objects, promise required-default semantics, target bindings, baselines, and model/host authority boundaries remain intact.

## Observed RED

Original matched lead artifacts are copied byte-for-byte as `observed-p2-residual-{base,current}{.json,.log,-vitest.json}`; their original paths and exact commands remain inside those files.

- Healthy-TMPDIR base (`58105616bb4b970f8012e43fc20498bbe9c9d11a`): two schema assertions failed, each reporting six exposed union violations. No missing-object-properties failure.
- Healthy-TMPDIR prepared P2 head: three schema assertions failed, reporting twelve union violations and two opaque args objects.
- Those broader observed runs also contain unrelated session-intent, protocol, and Continue-control failures. They are not claimed fixed or rerun by this lane.

Local execution before *any source or test edit*: `red-existing`, direct exit **1**, six schema tests, three failed / three passed; exactly twelve union violations and two opaque args objects. HEAD/tree and source/test hashes are unchanged before/after.

After adding regression tests but before the product edit: `red-regression`, direct exit **1**, 249 cases, 29 failed / 220 passed. Only schema tests failed. Adding `ACCEPTANCE_TOOLS` to the audited surfaces strengthens the existing checker: it exposes the previously unaudited repair path, giving eighteen union violations and three opaque args objects. No checker rule or original assertion was relaxed.

`red-regression-test.snapshot.txt` preserves the exact historical test bytes, checked against the SHA256 recorded in `red-regression.json`. It is evidence, not runnable/shipped test code. The later bounded lead correction replaces test casts/non-null assertions with typed bindings/guards and removes only the implementation-detail assertion that `args.properties` must be absent. Representability and runtime-rejection cases are retained, with identical test identities and counts.

## Verification

Every test, compiler check, public probe, and build was prefixed with:

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564
```

The lead-owned exec-capable temp root was never removed. Tests used one worker and `--no-cache` to avoid writing shared Vitest caches. No sleeps, polling, timeout changes, assertion suppression, skipped tests, or weakened schema checker rules were introduced.

All commands run from the assigned worktree through `capture.mjs`. It uses `spawnSync` and saves the direct child exit/signal, exact command/args/environment, timestamps, before/after HEAD/tree and file hashes, and raw stdout followed by raw stderr (not a claimed chronological interleave). Every invocation has `<name>.json` and `<name>.log`; Vitest runs additionally have `<name>-vitest.json`. No pipeline exit is used as test/build evidence.

| Invocation | Direct exit | Result |
| --- | ---: | --- |
| `red-existing` | 1 | Faithful untouched-source/untouched-test RED: 3/6 failed |
| `red-regression` | 1 | Pre-product regression RED: 29/249 failed, all in schema file |
| `green-regression` | 0 | Initial source fix: 249/249 passed |
| `green-final` | 0 | Final lead-corrected tests: 249/249 passed, including 69 schema tests |
| `public-roundtrip` | 0 | Initial public exported-schema/real-tool probe |
| `diagnostics-final` | 1 | Source/test clean; two `unknown` access errors in separate evidence probe, retained and fixed |
| `diagnostics-green` | 0 | Final targeted compiler diagnostics: source, test, and probe all zero |
| `public-roundtrip-final` | 0 | Final guarded public probe; exact args and real canonical evidence verified |
| `build` | 0 | Full `npm run build`: app typecheck, editor, export player/SDK, standalone bundle |

Final related test command (the RED regression command uses the same test selection):

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564 node output/evidence/ai-harness/p2/schema-compat-fix/capture.mjs green-final npm test -- \
  test/toolSchemaProviderCompat.test.ts \
  test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts \
  test/assistantAcceptanceRequestBaseline.test.ts test/assistantAcceptancePromiseBaseline.test.ts \
  test/assistantAcceptanceCost.test.ts test/aiRequiredOutcomes.test.ts \
  test/workPlan.test.ts test/agentVerification.test.ts \
  --maxWorkers 1 --minWorkers 1 --no-cache --reporter default --reporter json \
  --outputFile output/evidence/ai-harness/p2/schema-compat-fix/green-final-vitest.json
```

Coverage: every criterion kind; both target forms; mixed existing/new target lists; optional regions present/absent; empty and arbitrarily nested dynamic args (including null, booleans, numbers, numeric strings, arrays, and runtime keys); shared public plan/repair schemas; exact JSON roundtrips; missing required keys; unknown/mixed-kind/evidence fields; ambiguous/malformed targets; non-object args; unregistered verification tools; required defaults and malformed requiredness. Arbitrary nested args in the schema fixture establish representation, not successful execution of that hypothetical walkthrough.

The unchanged canonical suites additionally prove required/optional skips, replan preservation, real host source/withdrawal, original request baselines, repair immutability, image review delivery/currentness, exact scoped real-tool authority, advisory/foreign/fabricated/stale evidence rejection, and unapplied-draft handling.

Public entry-point exercise:

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564 node output/evidence/ai-harness/p2/schema-compat-fix/capture.mjs public-roundtrip-final \
  node_modules/.bin/vite-node --config vitest.config.ts output/evidence/ai-harness/p2/schema-compat-fix/public-roundtrip.mts
```

This imports actual exported plan/repair schemas and parser, roundtrips a full nested `check_reachability` requirement, invokes the real registered tool on a blank project, and passes its real result into the canonical evidence/ledger. No evidence means incomplete; exact fresh real evidence verifies; changed args and post-write stale evidence do not. There is no LLM/tool mock or remote write in this probe.

Diagnostics preceded build. LSP initially reported no source/test diagnostics; later fresh LSP requests timed out. The evidence probe initially used aliases outside its tsconfig scope; these were replaced with relative imports. Targeted TypeScript compiler diagnostics using the repository tsconfig are the final recorded validator, not an assertion that the timed-out LSP succeeded. The exact compiler API command and its unsuppressed diagnostic output are in `diagnostics-{final,green}.{json,log}`.

```sh
TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564 \
VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-ai-harness-p2-outcome-20260906/.vite-cache/schema-compat-fix \
node output/evidence/ai-harness/p2/schema-compat-fix/capture.mjs build npm run build
```

Build warnings remain visible in `build.log`: missing optional provider proxy credentials, existing-code circular/dynamic-static chunk concerns, chunk-size warnings, and an unresolved generated battle-reference image. They are outside the changed schema/test files; this lane did not run a baseline build to quantify warning deltas or change their configuration. The build nevertheless directly exited zero. SDK output recorded artifact `42689001932e0649`, source `452f9adb3b290fb8`, schema v4; selected built-output SHA256 values are retained in `build-artifacts.json`.

## Source binding and regression comparison

`commit-binding.json` asserts the committed files equal the final test/build hashes and that the entire base-to-source-commit diff contains exactly the two authorized source/test files. Runtime/parser/ledger/evidence hashes are recorded unchanged in each run. All captured runs have identical before/after source identity.

- Source SHA256: `313b97a1ade2896883e6e4e7a9deec733c43f9353ce73faac7b8caa78179bb10`.
- Final test SHA256: `916e1e36ea67bf2196c7326326a4365102c29566c4e117afa1ccf0ae603680dc`.
- Final probe SHA256: `194f55e92cfc3edd29f3c458c098181c0395611bb7e6f80d3191c963f702ef4e`.

`comparison.json` matches all 249 test identities across regression RED and final GREEN: **29 fixed, zero newly failing cases, zero remaining failures in the selected scope**. This is not a full-repository zero-regression claim. Full gates, live provider submissions, browser QA, push, merge, PR, dependency work, and remote content work were intentionally not performed.

## Cleanup and assumptions

`cleanup.json` confirms this task's 247 MB `dist` output was removed after hashing selected artifacts, the worktree-specific Vite cache is absent, and the lead-owned TMPDIR remains. No browser/server was started, no remote fixtures were authored, and no shared worktree files were edited. Evidence remains in this directory. The source/test commit left tracked status clean before adding this evidence-only increment.

Assumption: compatibility means the existing repository strict-provider schema contract, not a newly negotiated provider dialect or a claim of live model success. Flattening conditional provider fields is appropriate only because the already-existing fail-closed parser remains the runtime authority; that parser was not changed. No larger product boundary was necessary.
