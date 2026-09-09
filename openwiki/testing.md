## P5 delivery gates and the P4 regressions they caught (2026-09-09)

### Open: checkpoint writes still slow the authoring loop

`--scenario late-cancel` still fails on this branch, and the reason is measured, not guessed.
Same-load A/B (pre-merge main `9689f74e` vs this branch, alternating runs):

| | pre-merge | this branch |
|---|---|---|
| whole scenario | 76.7s | 117.0s (was 144.6s before the fixes below) |
| median gap between model rounds | 926ms | ~2.5s |
| A's apply entered at | 23.3s | ~50s |

The harness arms a 60s signal window when it installs the proposal observer, so a run this much
slower trips it before the late apply is released. The window is a real budget: do not widen it.

Root cause: every checkpoint write deep-clones the whole row, and the row embeds full project
copies (`runtime.requestBaseline`, each acceptance promise baseline, and — until now — the draft
project). Landed mitigations: capture only on `tool_call` rather than every session event, drop
the per-round wait, cache content identity and the acceptance recovery copy, and keep draft bytes
only in the apply-stage row. Together they removed ~28s.

The remaining gap needs the structural fix: write the immutable per-request baselines **once per
run** into a companion record and reference them from each checkpoint row, so a row write stops
copying whole projects. That is a schema change (another additive IndexedDB version plus restore
wiring) and is deliberately not attempted as a late patch.


`node scripts/qa/ai-harness-all.mjs --scenario all --report <path>` runs every deterministic
editor scenario, one owned process each (own Vite port, Firefox, isolated remote project,
cleanup receipt), and stops at the first failure so a later pass cannot mask an earlier one.
Membership: proof-failure, required-skip, outcome-matrix, retained-draft-ask, wiki-delivery,
new-goal-draft, late-cancel, human-edit-race, checkpoint-upgrade (its own script) and
crash-after-apply (the `recovery` scenario). Real remote save proof stays separate:
`node scripts/qa/ai-harness-remote-proof.mjs --create-isolated-project --scenario all --report <path>`.

That gate found four P4 regressions that unit tests and the recovery scenario had all missed;
pre-merge main passed the same scenarios, which is how each was attributed:

1. A rejected checkpoint row aborted `proveAppliedRevision` before `store.flush()`, so the
   save and its proof disappeared entirely. Checkpoint writes are recovery convenience; the save
   is the user's canonical work. Failures are now audit warnings (`agent_run:checkpoint-write-failed`)
   and save/proof/turn progress continue. Only `prepareCheckpointApply` still demands durability.
2. The same rejection killed the retry turn through `turn-boundary-error`.
3. Content identity was recomputed twice per round at ~160ms each on the default project.
4. `AssistantAcceptanceLedger.exportRecovery()` deep-cloned every promise baseline on every
   capture, and the row was cloned again on top of that: 92 captures burned 13.3s, which pushed
   the harness past its 60s settle budget and left the editor's send button disabled forever.

Measure before optimizing here: the numbers above came from timing the real browser run
(`report.checkpointCost`), not from reading the code. After the fixes required-skip is back to
the pre-merge shape — 58 rounds, 112 contract checks, zero violations.

## P4 checkpoint storage and boot admission (2026-09-09)

`test/aiRunCheckpointStore.test.ts` covers additive v1/v2 to v3 IndexedDB
migration, conversation/index/tombstone preservation, atomic checkpoint writes,
transaction abort, stale writes, unsupported identity/version data, terminal-only
cleanup and nondurable memory fallback. `test/aiRunRecovery.test.ts` initially
covers transcript-only boot admission: loading interrupted history must not call
`AssistantSession.sendUserMessage` automatically.

`node scripts/qa/ai-harness-checkpoint-upgrade.mjs` uses real isolated Firefox
IndexedDB contexts and actual Vite-served storage modules. It verifies v1/v2
upgrade, durable checkpoint equality after page reload, unsupported rows and
owned cleanup. `EXPECTED_HEAD` optionally pins the source; `EVIDENCE_DIR` selects
a new output directory. Exclusive output files retain earlier failures.
This local storage API check does not require or access a Supabase project and
is not proof of crash-after-apply execution recovery.

`aiRunRecoveryLedgers.test.ts` and `aiRunReconciliation.test.ts` cover original
contracts/baselines, stale historical verification, latest-epoch selection and
revalidation after baseline mutation. `aiRunRecoveryRuntime.test.ts` forks actual
durable IDB bytes after a native event apply, recreates the session/panel and
clicks Continue: create/apply counts must not increase. Its other controls keep
remaining WorkPlan/requirements and reviewer budgets, and run actual ending
quality assessment without reauthoring. `aiRunRecoveryAdmission.test.ts` checks
ten nonresumable classes through the real panel admission boundary.

The runtime fixture keeps the actual start map and its referenced tileset rather
than twelve unused bundled tilesets. Image delivery for the authored marker is
still required; a transparent event is a visual map change. Do not replace
review approval, fake checkpoint durability, extend deadlines or rely on a
sleep to reach the commit boundary. Independent real page-reload QA is a
separate final gate; unit IDB recreation alone is not browser reload evidence.

`xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario recovery` is that
final gate. Only model HTTP is scripted: the checkpoint bytes are the ones the
runtime wrote. It saves and reads a fresh owned remote project, refuses an
`upsert_event` without `show_map_region` through the real independent review,
then authors the marker with real map render acknowledgment. A QA-only Vite
observer awaits `__qaRecoveryCommit` after the actual remote commit returns and
before the final conversation save, so `page.reload()` lands exactly on the
crash-after-apply image. After reload it asserts the same IDB rows and event
count, an available Continue, and after clicking Continue zero new model calls,
creates, applies or undo entries, the retained original request/applied history,
a new run id with a greater epoch, exactly one final save and an unchanged
retired row. Click-time project-description drift must report
`needs-reconciliation` and a faulted `schemaVersion` must report
`unsupported`, both with zero writes; each injected fault is reverted through
the actual store or `mutateAiRecord`, never by seeding a success row.
`EXPECTED_HEAD` pins the source, and the run rehashes an explicit 29-file
recovery/harness scope before and after execution. Large per-step state lives in
`<EVIDENCE_DIR>/<label>.json` with its PNG; `actions.json` keeps paths and
byte counts, because re-embedding those snapshots overflowed `JSON.stringify`
after a passing run. Cleanup deletes the owned project and verifies absence.

## P3 request-bound fixture alignment (2026-09-08)

`test/assistantAcceptanceProject.test.ts` exercises exact title/item values,
finite preservation allowances, applied/draft state and sourced wiki declarations
through real tool and wiki paths. Retain `context.project` after a writing tool:
the runner replaces that object. Wiki fixture IDs must be canonical `w_` IDs.

`test/aiHarnessResponderProtocol.node.test.mjs` keeps intent and
`REQUEST_COVERAGE_AUDIT` dispatch separate without consuming tool rounds or
releasing a held response. Native P2 requests now state their actual obligations,
and matching planner requirements use the mandatory host coverage IDs. Assert
their original source, required flag and real evidence, not just list length.
Newly audited authoring is assessed; genuine legacy scheduler-only cases retain
the legacy outcome distinction.

Native commit-A requests recording a sourced preference, not implementing combat.
Its title/wiki effects, B's item value and completion before late A, and every
original fault/ownership assertion remain required. Preserve historical opaque
requests and failed runs as history, not fresh passing evidence. Run
`scripts/qa/ai-harness-contracts.mjs --scenario <name>` for `late-cancel`,
`human-edit-race`, `proof-failure`, `required-skip` and `outcome-matrix` against the
final combined source with isolated remote fixtures and complete cleanup.
Reuse unchanged scoped evidence; do not rerun broad suites for documentation or
fixture-only corrections. These commands are requirements, not a pass claim.

## Issue 693 verification contracts (2026-09-08)

The commit probe's fake DOM implements number-input `valueAsNumber` and numeric
constraint validation, including required, range and step rejection. Keep native
production numeric APIs intact; do not add optional validation fallbacks for test
doubles. `fakeDomNumericInput.test.ts` and `eventSpawnNumericProbe.test.ts` cover
invalid/no-commit and valid/commit behavior, including the existing faction
consumer. The gate-repair evidence also compares these semantics to native Chromium.

Spawn and life-skill recovery fields have explicit form, interaction and commit
fixtures with raised floors. Update only their entries, not unrelated snapshot
drift. All no-commit and crash gates remain active. Local diagnostic entry works
with an empty conversation and opens a registered consent layer; it does not emit
the historical `conversation-export` event or export a transcript. The modal gate's
narrow exemption covers only the persistent indicator/download anchor; actual
Escape routing is exercised through the visible assistant menu.

Focused contracts: `npm test -- test/fakeDomNumericInput.test.ts
 test/eventSpawnNumericProbe.test.ts test/aiEmptyExportFeedback.test.ts
 test/aiUiEventContract.test.ts test/playBootRecovery.test.ts
 test/selectedEventTestModal.test.ts test/databaseSystemView.test.ts --maxWorkers=1`.
Full gates and production build remain lead-owned; the exhaustive main/candidate
failure disposition is in `.omo/evidence/issue-693/gate-repairs/`.

## Request-coverage gate follow-up (2026-09-08)

The complete immutable control at `e05a99b91` accounted for 1,826 files / 18,328
cases (18,089 passed, 216 failed, 23 skipped). The repaired `0798a67b` run accounted
for 1,829 files / 18,363 cases (18,128 passed, 212 failed, 23 skipped). Both are
**red** results. A 1,200-second observer deadline did not establish a hung runner:
the four-thread instrumented runs took 2,511 and 4,250 seconds. Keep collection,
case, module-end, child-exit and unhandled-error evidence separate.

Adding a shared fake-DOM capability can activate more production code. In this
case `insertBefore` enabled custom selects, exposing missing options/index/value
semantics, overbroad `HTMLSelectElement` identity and duplicate node ownership.
Preserve the enhancement and model its real contracts instead of removing the
capability. Seed actual selectable records in fixtures (`roll`, `event-a/b`);
native selects cannot select nonexistent IDs. Checklist tests must respect
working-before-pending priority while still proving keyed nodes actually reorder
when their statuses change.

AI transport fixtures must distinguish intent, independent request coverage,
author execution and independent review. Author execution may be non-streaming.
Observe request/response and terminal events before Send; retain real forwarding
callbacks, full-map image receipts, approval before apply, actual ghost bounds,
one apply and cleanup. Never raise a deadline to hide a fixture-rejected request.

The final full-run diagnostic stream lost one optional `collected` record for
`undoHistory.test.ts`; its intact appended `start` record was recoverable. The
original trace hash was unchanged, all 1,829 independently reported/queued/ended
file identities and the terminal inventory matched, and that module's 15 cases
passed in the untouched JSON report. Recovery retained the damaged bytes and
did not invent a test outcome or missing diagnostic. A separate derived
summarizer records that limitation; never silently skip malformed evidence.

Bind every result to its executed source. The later selector-fixture repair and
main integration were validated with focused tests, build and shipping-player
checks; they are not relabeled as another full run of `0798a67b`. Preserve raw
failure values, multiplicity, source skips, timing-sensitive cases and the red
surface gate. Some normally included legacy tests attempt remote authoring or
filesystem writes: keep the scoped sandbox restrictions explicit rather than
running them against a user's configured project to make a gate green.

The compact result/disposition index is
[`output/evidence/acceptance-gate-followup/README.md`](../output/evidence/acceptance-gate-followup/README.md).

## Native event battle reliability QA (2026-09-08)

Focused regressions are `eventBattleAdmission.test.ts` (actual command modal and
aggregate draft validation), `eventBattleFailure.test.ts` (real foreground,
autorun readiness, parallel, random/field admission and stale-owner handling),
and `battleInitializationAdmission.test.ts` (real constructor/audio, transition
failure, empty monster party and corrected starter retry). Domain runtime and
interpreter behavior stay real; only Phaser I/O, result presentation or a specific
transition fault are adapted. New async tests subscribe before triggering and
await completion/lease release with bounded deadlines, never fixed sleeps.

Reproducible exported-player matrix (no DB writes, scratch/evidence in worktree):

```bash
mkdir -p .scratch/battle-reliability
TMPDIR=$PWD/.scratch/battle-reliability QA_BROWSER=firefox \
  node scripts/qa/runtime/event-battle-reliability.probe.mjs
```

The probe owns an ephemeral `startPlayerQaServer` unless `QA_BASE_URL` is supplied.
`QA_OUT_DIR` selects evidence output; `QA_CASES` selects comma-separated case IDs.
It uses diagnostic copies of the historical battle fixture through `player.html`
and the export-store shim, not editor Play mode. It covers invalid-variable and
valid action/auto/parallel starts, empty troops/monster parties, hidden enemies,
legacy enemyIds, numeric 0, and a real correction event followed by retry.
Observers subscribe before input and watch DOM/state changes; no polling/sleeps.
Valid starts must expose the actor command menu after transition removal. Error
cases must retain a nonzero, nontransparent notice entirely inside the viewport;
DOM presence alone previously passed while every error sat below the canvas.
Read `SUMMARY.md`, `results.json`, and the named screenshots. Page errors fail;
console errors are retained because reported admission faults intentionally log.
Chromium on the shared host can fail with `ERR_NETWORK_CHANGED`; the browser
selector permits Firefox without weakening the scenario's assertions. This is
behavioral evidence, not independent visual approval. The lead still owns the
real editor picker/Confirm/reopen checks, full gates/build and final browser QA.

## Real large-world player QA (2026-09-07)

`npm run qa:runtime -- --scenario live-world-start --project <saved-project.json>`
checks the real 128x128 QA world's shipped-player boot and authored harbor start.
It does not teleport. This is only boot proof, not proof of eight-landmark reachability.
The live-world evidence also records event-driven directional input, every actual
tile arrival, and rendered-player agreement for the complete landmark walk.
Read the generated `SUMMARY.md` before its relevant screenshots.

## CSS budget: file count is informational

`scripts/check-css-budget.mjs` reports stylesheet count and paths but does not
treat adding or removing files as a regression or quality improvement. Keep
styles split by ownership; do not concatenate unrelated styles to meet a count.
The existing baseline remains valid without regeneration. Increases in hardcoded
hex colors, `!important`, undefined custom properties and global `:root` files
still fail. Import-graph and live-class checks remain separate active gates.

Run `node --test test/cssBudget.test.mjs` for isolated CLI regression coverage,
then `npm run gates:css` and `npm run gates -- --only css` on the real repository.

## Selection and composer surface contracts (2026-09-06)

`aiSelectionChipScope.test.ts` mounts the real panel/composer in happy-dom and
processes the ordered assistant stylesheet imports with Vite, including tokens
and the late editor UI-mode constraints. Do not test fabricated chips against
one historical CSS fragment or load the deleted repair stylesheet.

Idle current-map pins remain visible. Selection prioritizes the scope pin and
hides only its nonselection siblings; clearing restores the map pin and removes
the AI scope without clearing the editor selection. Keyboard help is the
textarea title, not a separate action-row hint. Focus and blur retain the
shipped row layout and controls.

Routing tests subscribe to the panel's running-to-terminal class transition
before clicking Send, including old attribute values for transitions batched
into one observer delivery. The bounded timer only rejects a missing transition;
the observer and timer are always disposed. CSS/DOM mutation probes confirm
that the visibility and row-layout assertions reject actual regressions.

## P3/current-main composition fixtures (2026-09-08)

Composition tests must supply both captured proposal base and authored baseline.
The epoch fixture scripts independent review as a separate revision-bound request,
returning findings for the actual required problems rather than granting approval
unconditionally. Main's real reviewer parser, acceptance checks and apply gates
remain connected. An advisory cancellation that preserves a previous milestone
must first produce a real reviewed application: advisory checks now precede approval
of the next batch. Host Continue retains that applied ledger without replay.

Native HTTP adapters distinguish tool-free independent review from normal writer
messages and report the actual `finish_reason` (`stop` or `tool_calls`). Multimodal
writer viewport text is not JSON review input. Stale-race rejection counters expose
both actual apply-rejection calls and typed independent-review rejection events;
neither is a successful application receipt. Keep all original value, undo, remote
readback, owner and terminal assertions. Clear all six unit history fields:
`VITE_SUPABASE_USE_PROXY=0`, `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`,
`VITE_SUPABASE_PROJECT_ID=`, `SUPABASE_ANON_KEY=`, `SUPABASE_UPSTREAM_URL=`.
Native authored fixtures instead use fresh isolated remote IDs and absence-proven cleanup.

Legacy QA `modify` declarations without request-coverage responses fail closed on
current main. Never substitute empty requirements, unconditional approval or a
non-authoring classification to obtain an epoch PASS. The current coverage schema
has no exact title-screen or item-price evaluator; `functionalUnresolved` cannot
be approved away. Such a native fixture incompatibility is an explicit producer
blocker, not independent approval or permission to change acceptance policy.

### Cooperative Node scheduling in long session fixtures (2026-09-08)

Long scripted turns can pass their test deadline while starving Vitest's separate
60-second `onTaskUpdate` ACK deadline. A traced budget case left a promptly posted
ACK unread across subsequent cases even though all 54 file assertions passed.
Use `test/cooperativeNodeYield.ts` through the existing `AssistantSession`
`yieldToUi` option in the implicated fixtures: its native `setImmediate` permits
RPC/IPC progress during tool work, including when UI/autosave timers are fake.
This is a scheduling boundary, not a sleep or a replacement for a subscribed
completion signal. Keep controlled/deferred yield callbacks, response scripts,
assertions, budgets and all deadlines unchanged. Shared fixture adoption is
explicit and opt-in; do not globally change the runner or suppress RPC errors.
Verify ACK consumption during the original workload with a captured original
monotonic clock, then require clean direct exits with effective four workers and
the six-field isolation above. JSON success or an afterEach-only yield is not proof.

## AI turn observation contracts (2026-09-06)

`aiChatObservability.test.ts` and `aiChatPanelTransportError.test.ts` exercise the
real panel/session/parser/tool pipeline. HTTP fixtures distinguish the
non-streaming `response_format: { type: "json_object" }` intent request from chat
responses. A single-step `needsPlan: false` intent is required when the test is
about one chat loop: `agentMode: "chat"` alone does not disable the balanced
autonomy planner. Do not restore obsolete API-key configuration to avoid this
contract; the editor uses OAuth.

Subscribe to terminal `recordAiActivity` publication before clicking Send. For P3
detached late-apply races, also observe the actual proposal-host promise as described
below; terminal publication alone can precede its completion.
`whenAiChatPanelSettled()` covers boot and persistence, not an active chat turn.
Do not replace the terminal signal with microtask counts, sleep loops or guessed
retry durations. Reasoning coverage uses two distinct successful query tools;
ghost coverage subscribes during the write and also verifies its final apply and
cleanup; transport coverage verifies that settings recovery actually opens.
Mutation evidence breaks those production connections independently and restores
them before the final passing run.

### P2 R1 retained-draft Ask (2026-09-07)

`test/aiAskRetainedDraft.test.ts` exercises the real session, runner, registered
write tool, apply adapter and undo. Cancellation fires on the subscribed successful
tool result, not a delay. It asserts zero real apply invocations during explicit
Ask and inferred questions under Do or Plan, then one on authorized Do/resume,
no replay on repeat resume, and exact undo restoration. Other cases cover Ask at
the acceptance-milestone boundary, early preparation failure, executor-supplied
calls and applied/pending coexistence. Run the focused regression with
`npm test -- test/aiAskRetainedDraft.test.ts --maxWorkers=1`.

The native editor command used for R1 was:

```sh
export TMPDIR=/dev/shm/rpg-zzu-ai-harness-p2-01a07564
QA_PORT=37047 QA_CACHE_ROOT="$TMPDIR/r1-ask-native-cache" \
  EVIDENCE_DIR=output/evidence/ai-harness/p2/review-r1-ask/native \
  xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario retained-draft-ask
```

Choose a free owned port and fresh evidence directory for another run.
`QA_CACHE_ROOT` is optional and defaults to `.vite-cache` under the worktree;
relative overrides resolve there too. The harness creates and removes a unique
Vite cache child beneath that root. Native QA requires Firefox/Xvfb and Supabase
access for fresh owned projects, with remote save/readback and owned cleanup.

Only LLM HTTP responses are scripted. The adapter waits for the next model request
after a successful title write, clicks Abort, then exercises explicit Ask and an
inferred question under Do. Typed Continue in Ask stays unauthorized; selecting
Do and typing Continue applies once, repeat Continue doesn't replay, and the real
undo control restores the original bytes with independent remote readback. This
scenario doesn't click `ai-continue-run`; inferred Plan is covered by the unit test.
Native `recordAppliedProject` observations count successful apply receipts:
**0 after cancellation, 0 after Ask, 0 after typed Continue in Ask, 1 after authorized
resume, 1 after repeated resume**. They don't count failed apply attempts; exact
invocation counts come from the real-adapter unit spy above. This scenario doesn't
verify wiki delivery or establish integrated P2 approval.

### P2 R3 wiki delivery (2026-09-07)

Run `npm test -- test/projectWikiDelivery.test.ts --maxWorkers=1` for coordinator,
session and real store/apply coverage: changed versus empty extraction, backfill,
checkpoint failure, cancellation at apply, accepted save followed by edit/cancel,
proof retry/currentness, stale/foreign/missing receipts, unrelated human revisions,
late old-run callbacks and post-tool progress writes. Wiki-only runs keep tool-call
arrays empty even when delivery is `applied` or `persisted`.

The final producer native command was:

```sh
QA_PORT=36901 \
  EVIDENCE_DIR=output/evidence/ai-harness/p2/review-r3-wiki/native-final \
  xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario wiki-delivery
```

Use a free owned port and fresh evidence directory, with the same Firefox/Xvfb and
owned Supabase setup as R1. The scenario scripts wiki extraction and a labelled
HTTP 503 on the wiki project-save request, not a real remote outage or synthetic
owner outcome. Actual composer submission and the default coordinator leave the
new guideline dirty locally while independent remote readback matches the accepted
pre-wiki baseline. Result, recap, getter, harness, bridge harness, local activity,
terminal event and visible DOM agree on `failed / unassessed / applied`, with zero
authoring tool calls. Owned remote deletion and browser/server/cache cleanup are
checked. Native coverage is the failed checkpoint path, not successful wiki save,
post-tool progress or edit/cancel races; those are unit contracts above. It doesn't
establish pixel review, external MCP HTTP, remote telemetry or integrated P2 approval.

## P3 ownership and stale-base verification (2026-09-07)

Read the [P3 evidence index](../output/evidence/ai-harness/p3/README.md) for exact
commands, source bindings and failure history. Repaired source
`34d5b672ad30c2dec5a3d58fa761f83781a6ee35` passed the integrated 53-file / 883-test
selection, 12 Node checks (11 lifetime cases plus the original completion wrapper),
app typecheck/build and all eight native scenarios, each direct exit 0. The
[repair report](../output/evidence/ai-harness/p3/repairs/integration/report.md) binds
those results to committed bytes. These aren't independent re-verification,
whole-goal approval or a substitute for the lead's full-gate comparison.

The earlier `9b2782f18` integration's 52 files / 872 tests and eight native passes
remain historical. Independent review of `450a1bbfb` returned needs-fix despite
872 focused passes: the real mutation subscriber exposed R1, and human-race R2
collected only 15 positive checks while 24 stale checks never ran. Neither that
incomplete packet nor its zero failed-check count is a 39-check pass.

Required real-seam regressions include `aiRunEpoch`, `aiRunEpochProof`,
`aiRunEpochPanel`, `aiRunReentry`, `aiRunnerSlotCleanup`, `aiStaleProposal` and
`aiMutationApplyAccounting` under `test/`. The accounting test retains the original
real-store subscriber that retires A and starts B after A's actual title mutation.
A must retain applied delivery, with no pending copy, replay or B application/proof.
Keep malformed-current-argument, generation-bypass, pre-mutation cancellation,
activity-observer, nested notification and throwing-outcome controls. Both replacement
paths must finish notifications and autosave scheduling while preserving the thrown
error. Keep the actual next runner send after B settles, not just no stale apply.
Run the house/shared-adapter, cluster-modal, P1 receipt/current-proof and P2
requirements/outcome/Ask/new-goal/Continue/wiki controls alongside them. Tests must
subscribe to exact signals before actions, use bounded rejecting deadlines and
release/drain owned deferred work. Don't add sleeps, polling, wider test deadlines,
skips or tests that pin prose.

Native entry: `xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario NAME`,
with `TMPDIR=/dev/shm/rpg-zzu-ai-harness-p3-01a07564`, a free strict `QA_PORT`, private
`QA_CACHE_ROOT` and fresh `EVIDENCE_DIR`. Exact recorded commands and ports are in
the evidence index. Both scenarios use actual editor controls and fresh owned remote
projects with real save/read and deletion/absence checks, not ambient user content.

- `late-cancel`: hold A's real post-apply commit transport, click Abort and New
  Conversation, let B apply/save/prove while A remains held, then release A. Await
  A's original proposal-host promise and terminal activity before assertions. The
  QA-only Vite observer preserves promise/value/error/receiver/arguments and doesn't
  change product authority. The terminal-only apparent GREEN is an unaccepted
  verification gap. The corrected P2 calibration retains the original eight
  violations; integration preserves those assertions and passes all 19 checks,
  with no late A effects.
- `human-edit-race`: after the actual detached proposal is built, use real tile,
  Database System width and existing Items price controls, then save/read all three
  before releasing the model response. P2 overwrote 7/336/137 with 240/320/50;
  integrated source retains 7/336/137, rejects the stale draft, and preserves current
  apply/undo. Zero apply receipts and two rejection notifications aren't invocation
  counts. All 39 collected checks pass with no page/route errors.

Human-race transport waiters and retries now share the finite human edit/save/read
owner. Only successful completion releases them. Failure, cancellation or cleanup
rejects the hold, never returns a successful final response. Completion observers
subscribe before Send but start this race's unchanged 60,000 ms completion timers
immediately before release. Human actions/evaluations retain 60,000 ms bounds,
mutation/render 10,000 ms, REST 30,000 ms, and cleanup evaluation is bounded too.
The product request bound isn't widened; an independently terminal A fails the
pre-release assertions. This is bounded ordering, not unlimited latency tolerance.
`test/aiHarnessHumanLifetime.node.test.mjs` uses fake-clock advancement and exact
events/deferred signals to cover retries, failure, cancellation, evaluation bounds
and observer disposal beyond the old competing hold deadline.

All repair validators hold the parent-owned
`$TMPDIR/p3-independent-repair-01a07564.lock` with bounded `flock` acquisition.
Run native scenarios serially, without competing test/build/browser jobs. This
avoids contention but isn't the R2 fix: the original independent human race failed
in isolation too. The first integration deadline failure and later identical-source
isolated success both remain historical, alongside that needs-fix packet. The
corrected QA's current/P2 calibration retains all 39 checks and the original 18 P2
violations. No sleep, deadline increase or lucky retry establishes the correction.
Screenshots exist, but pixel approval wasn't established by these producers.

### Autosave status fixture ownership (2026-09-08)

`test/autosaveStatus.test.ts` holds the exact projects POST, not the first global
fetch (the 1500 ms edit-activity mirror arrives first). Subscribe to saved/error
and request arrival before triggering work; start the original 1000 ms completion
bound at response release. Preserve pending at 3999 ms, saving at 4000 ms, the
exact state sequence, retry/backoff assertions and native save/receipt hashing.
Join the actual in-flight save and call-through manual-history writer promises,
flush telemetry, then detach listeners/editor/DOM before restoring globals/modules.
The map-focused statusbar fixture isolates the unused database-modal entry point,
not the real editor/dock/store subscriptions. Its original assertions and test/hook
deadlines remain active. These fixture checks do not establish historical timeout
attribution, native N1/N2/product coverage, or final P3 readiness.

### Project history transport isolation

Disabling `ProjectStore` remote persistence does **not** disable `recordProjectCommit`.
It uses independent Supabase history transport. Pure-unit and supplementary probes
must explicitly isolate/clear its URL/key/proxy settings before execution too;
P1 transport fixtures supply their own isolated configuration. Native persistence
checks instead use fresh owned remote projects for both project and history writes.

The epoch preservation probe exposed six exact persisted commit/change pairs in an
ambient project. Only those recorded IDs were deleted, then both tables were read
back as empty, including independent confirmation. `project_commits` uses
`commit_id`; `project_changes` is scoped by `commit_id` and has no `project_id`
column. Don't generalize that cleanup to other rows or claim earlier unrecorded
history writes were absent. No before/after remote project-row snapshot exists for
that probe, so project-row impact wasn't measured. The
[preservation report](../output/evidence/ai-harness/p3/epochs/reentry/preservation/report.md)
retains the original HTTP 400 from the incorrect filter and the exact cleanup scope.

Private Vitest results caching requires an explicit top-level `cacheDir` in a config
that preserves repository test settings. `VITE_CACHE_DIR` alone doesn't configure
this repository's Vitest cache, even though Vite native/build commands consume it.
The integrated focused run used an explicit private override and four workers.
Earlier QA supplementary unit runs and standard full gates aren't claimed privately
cached. Never delete the shared dependency cache as owned cleanup.

The frozen P2 full gate is still red: exit 1, 198 failed and 23 pending Vitest tests,
one suite-only failure, and seven surface failures. Compare exact case/reason
multiplicity and suite failures, not passing totals or old checked-in baseline labels.
The initial watcher expiry has no command outcome and remains incomplete. The lead
owns final gates, independent verification and protected delivery. No durable
checkpoints, remote schema, distributed/two-tab writer guarantee or P4/P5 is verified.

## Canonical project storage versus AI history (2026-09-06)

`test/noLocalProjectDb.test.ts` guards project/editor source against a local
canonical-project database. A direct `typeof indexedDB` capability check does not
read or write project data and is allowed. Every actual IndexedDB reference,
including an alias, guarded open, window property or computed property access,
remains rejected by the TypeScript AST check. SQLite and removed JSON fallback
restrictions remain unchanged.

Do not remove the guard to accommodate AI history: its IndexedDB implementation
belongs to `src/ai/aiRecordDb.ts`. The editor may report whether that history is
durable. Negative guard fixtures and a temporary actual project-source mutation
prove that allowing capability detection does not allow a local project store.

## Action RPG authoring and runtime proof (2026-09-07)

`test/actionRpgAuthoringAcceptance.test.ts` exercises the actual AssistantSession:
wait-only scene success and failed mandatory verification followed by skipped
work cannot publish verified acceptance. Goal-scoped action targets and required
verification survive replanning; only an explicit context reset clears them.
Ordinary one-page guides are not subject to a stateful-NPC quota.

`run_action_combat_test({mapId})` is an asynchronous session dispatch; the normal
synchronous tool registry deliberately fails closed. The session validates its
arguments, invokes the copied exported player, captures the exact owned receipt
before serialization, and publishes verification blockers with the same ledger
used by the checklist. It never interprets model-provided receipt JSON as proof.

Run `node scripts/qa/runtime/action-rpg.scenario.mjs` for the existing action
demo through the actual compiled `/export-player/` deployment. Read
`verify-shots/runtime-qa/action-rpg/SUMMARY.md` first. The script is not a generic
`qa:runtime --scenario` beat file. For a newly authored game, the lead must also
use the actual browser AI, save/reload the remote project, and exercise the
resulting player with keyboard inputs. Unit receipts do not replace that run.

## Database CSS ownership contracts (2026-09-06)

The required surface gate includes `databaseAllTabsRenderWalk`, using the actual
registry and destination-specific sentinels. The original 32 destinations are
retained; upstream Opening and Game Over expand the current set to 34. Per-file Vitest JSON
must contain successful, nonempty, unskipped required assertions; aggregate exit
zero or file existence alone is not proof. `databaseRequiredSurfaceAxis` and
`databaseCssOwnerProof` exercise missing-execution and missing-designated-owner
failures, including unrelated descendant declarations left in place.

The dedicated `playwright.db-css.config.ts` uses an explicitly started, cwd-verified
worktree server and zero retries. Supply its `DEV_SERVER_PORT`; do not reuse the
copied 9841 value or another checkout's server. Freeze/restart owned transforms
after source changes and record source/harness fingerprints with browser-scoped
PNG/JSON evidence. The primary matrix derives its complete destination set from
the live registry (currently 34) at 1440x900 and 1024x900; separate contracts cover native controls, true wheel/keyboard access,
fonts, focus, virtualized reveal, domain variants and deliberate CSS regressions.
Editor boot must complete before opening Database; wait for the published boot
metric rather than the first toolbar node. Existing whole-suite failures and
timeouts remain explicit, with assertion/diagnostic comparison against a frozen base.

## Audio description verification

These are reproducible verification requirements, not a claim that every gate has passed.
Record commands, exit codes and evidence under `output/evidence/audio-descriptions/`;
keep baseline failures and unverified visual review separate from feature results.
No live project backfill, SQL migration, asset conversion or catalog regeneration is needed.

Focused model, persistence, tool, UI, prompt and export gates:

```sh
npm test -- test/audioDescriptions.test.ts test/audioDescriptionPersistence.test.ts test/audioDescriptionConcurrentPersistence.test.ts test/audioResourceCatalog.test.ts
npm test -- test/audioDescriptionTools.test.ts test/audioDescriptionDiff.test.ts test/audioDescriptionToolStore.test.ts test/audioDescriptionToolExposure.test.ts test/audioResourceToolPagination.test.ts
npm test -- test/audioDescriptionEditor.test.ts test/audioDescriptionLifecycle.test.ts test/audioDescriptionPickerSurfaces.test.ts test/audioDescriptionCommandSurfaces.test.ts test/audioDescriptionResourceLifecycle.test.ts test/audioResourceSearchContract.test.ts
npm test -- test/audioDescriptionPrompt.test.ts test/audioDescriptionPromptTransport.test.ts test/audioDescriptionSessionPrompt.test.ts
npm test -- test/audioDescriptionExport.test.ts test/projectPackage.test.ts test/webExportUsagePruning.test.ts test/cc0AudioPlayback.test.ts test/playerRuntimeAudioIds.test.ts test/runtimeQaAudioContract.test.ts
npm run build
```

Assert machine-consumed fields, raw IDs, source values, truncation, input sentinels and
state changes, not exact explanatory prose. Persistence coverage must include deferred
save responses, repeated map saves, same/different-key conflicts, clear/reset, and edits
made after submission. Mock only transport when asserting real serialization/load/merge
behavior; label that evidence as mocked transport rather than live Supabase persistence.

### Real editor surfaces

```sh
npx playwright test --config playwright.audio.config.ts
```

`playwright.audio.config.ts` scopes Firefox, zero retries and an isolated Vite cache to
`test/e2e/audio-descriptions.spec.ts` and `test/e2e/audio-description-search.spec.ts`.
It defaults to port 19847 and `.omo/audio-e2e-vite-cache`; `DEV_SERVER_PORT` and
`VITE_CACHE_DIR` can override those values. A reused server must use the same isolated
cache/setup. This local Firefox choice addresses Chromium module requests failing with
host `ERR_NETWORK_CHANGED`; it doesn't change global browser policy.

`test/e2e/audioDescriptionHarness.ts` waits for DOMContentLoaded, the real toolbar and
the loaded store, rejects remote persistence, then installs a normal blank project through
the real store. Readiness comes from actual state, not page-load timing or fixed sleeps.
Subscribe before triggering asynchronous edits/imports/playback, then await their exact
signal with a bounded timeout.

At 1024x768 and 1440x900, verify save/reopen/search, clear/reset, modal undo/redo, dirty
cancellation, real WAV import/edit/delete and project-import isolation. Also exercise live
picker refresh, removed-ID confirmation blocking, listener cleanup, project-switch close,
audio test, normal/M2 event forms and actual registered AI tool parity.
Capture screenshots/traces with selected IDs and worktree/port information. Capturing an
image isn't visual-review approval; keyboard/focus and layout inspection remain separate.
Don't claim Lighthouse approval from this scoped suite.

### Exported-player playback and dependency evidence

`scripts/qa/prepare-audio-descriptions.mts` uses
`test/fixtures/audioDescriptions.ts` and the real `prepareWebExport()` boundary.
It checks source immutability and removed metadata, then writes a new fixture path with
exclusive-create semantics. Use a fresh evidence directory for each run:

```sh
EVIDENCE=output/evidence/audio-descriptions/08-export
mkdir -p "$EVIDENCE"
RUN="$(mktemp -d "$EVIDENCE/run-XXXXXX")"
CACHE="$(mktemp -d /tmp/oprn-audio-qa-cache-XXXXXX)"
trap 'rm -rf -- "$CACHE"' EXIT
bun scripts/qa/prepare-audio-descriptions.mts "$RUN/project.json"
VITE_CACHE_DIR="$CACHE" npm run qa:runtime -- --scenario audio-descriptions --browser firefox --project "$RUN/project.json" --out "$RUN/runtime"
AUDIO_QA_BROWSER=firefox AUDIO_QA_PROJECT="$PWD/$RUN/project.json" AUDIO_QA_FAILURE_OUT="$PWD/$RUN/runtime-failure" VITE_CACHE_DIR="$CACHE" node --test test/runtimeQaAudioFailure.test.mjs
node scripts/qa/check-player-audio-dependencies.mjs "$RUN/player-dependencies.json"
```

The fixture preparer and dependency checker refuse to overwrite their output files.
`scripts/runtime-qa.mjs` runs the dedicated `player.html` surface, not editor play mode.
`scripts/qa/runtime/audio-descriptions.scenario.mjs` starts starter BGM
`cc0-bgm-rtp-fld-003` through title input, then triggers local SE `cc0-sound-ui-confirm`
through an interaction. The commands above select Firefox for this host; the runtime CLI
defaults to Chromium. Its optional `--browser firefox` and the failure test's
`AUDIO_QA_BROWSER=firefox` are separate from the editor Playwright configuration.

`scripts/lib/runtimeQaAudio.mjs` installs native `playing`/`error` listeners before the
action. Evidence requires a trusted event from the matching engine-owned, same-origin audio
element, valid ready/paused/ended state, expected loop/mute state, the engine-requested ID
and an engine snapshot. It doesn't replace `Audio`, `play()` or engine methods. A requested-ID
log alone isn't playback evidence. `test/runtimeQaAudioFailure.test.mjs` aborts the real SE
request and requires failed playback evidence while BGM succeeds.

This proves native playback start, not human listening, full-track playback or label accuracy.
Inspect the runtime `SUMMARY.md` and machine-readable audio evidence, including failures.
`test/runtimeQaAudioContract.test.ts` covers the report contract.

`scripts/qa/check-player-audio-dependencies.mjs` performs a production player build with
`write: false` and records modules with positive rendered length. It rejects
`src/assets/audioResourceCatalog.ts`, `bgmCatalog.ts` and `seCatalog.ts`, while requiring
`src/assets/bgmCatalogRuntime.ts` and `seCatalogRuntime.ts`. This is rendered-bundle evidence,
not a source-grep claim. Keep prompt descriptions in `src/ai/eventAudioPrompt.ts`, separate
from shared event eligibility and player dependencies.

Close owned browsers/servers and remove only owned temporary caches after verification.
After applying documentation, the integrating lead runs `npm run openwiki:index`, then
`npm run openwiki:index -- --check` and `npm run openwiki:verify`. Don't hand-edit INDEX.md.

## Mac onboarding Phase 1 contracts (2026-09-06)

`node --test test/macLauncher.test.mjs test/setupLocal.test.mjs` (also
`npm run test:mac-onboarding`) is the focused Node 24 gate. Tests use empty temporary folders,
synthetic anon credentials and local HTTP servers, never the provisioned private `.env.local`.
They cover Vite env precedence/round-trip (including conflicting base `.env` values with byte,
inode, permission and modification-time preservation), exclusive 0600 creation, preservation and races,
masked input/cancellation, unsafe origins/admin keys/redirects, read-only `rpg_zzu.projects`
probes, npm install failure, quoted Finder paths, listen-before-open, startup signals, and a
real Vite strict-port collision. The collision test remaps only the occupied port so it cannot
interfere with a user's port 9999. Subscribe to requests/listen/close before triggering actions;
no sleeps, polling, prose-lock tests or retries as a passing strategy.

Affected existing checks: `npm run typecheck:app` and
`npm test -- test/supabaseProjectConfig.test.ts test/supabaseProxyPath.test.ts test/vitePreviewProxy.test.ts`.
The supervisor owns the full build/gates and same-base failure comparison.
For real surface QA, invoke the actual launcher with `--no-open`, await its owned-listen log,
then GET `/` and `/auth/providers` and load the configured existing project in a real browser
through `/supabase`. Do not create content or allow remote mutation. If 9999 is occupied, record
the collision; never kill/reuse that server or change the product's fixed port to get green.
Evidence belongs under `output/evidence/mac-onboarding`; do not capture private config/headers.
A legacy remote-HTTP test backend requires a temporary local read-only bridge, not weakened
URL validation or edits to the existing env file; identify that limitation in the evidence.

The narrow macOS workflow uses Node 24 and no live DB secrets. Actions are disabled and the
producer host is Linux: neither the workflow file nor Linux Bash tests prove macOS/Finder QA.
Actual Mac execution or explicit reviewer acceptance of that gap remains a merge prerequisite.

## Task10 field-input verification and limits (2026-09-06)

Recorded verification, not a new execution by this documentation update: `.omo/evidence/life-full-20260906/10/VERIFY.md` and `.omo/evidence/life-full-20260906/phase3-verification/final/VERIFY.md` confirm task10 and integrated tasks6..10 at producer `bbaf9464cad3768da057ef9909338b5cfb25aa8c`. This documentation checkout integrates that source at `d107ac24ed72902fb35980034d08aed3ab3e0553`.

- All **45 cases** in `test/lifeFieldInteraction.test.ts` passed: front/feet priority, consumed refusal without attack/fallback, conservation, authored tools, bounds/capacity/disabled/missing-definition failures, renderer warnings and runner alignment. Exact-date controls cover future/expired forage, adjacent/duplicate/backward cursors, three-day cadence and 28/99-day year boundaries, including year `9007199254740991`.
- The independent first-and-only focused run passed **233 tests in 10 files, exit 0**, with the command below. Diagnostics covered all 25 Phase3 source/test paths with zero TypeScript diagnostics; app typecheck and full build exited 0. These retained receipts aren't whole-project gates.
- Independent `priority.mjs` executes real `handleAction` through both five-step priority chains with actual chest DOM, front farming before an underfoot event, and six normal/extreme-date controls. Event execution records dispatch only. Runner chest logs alone don't prove storage transfer.
- Native Firefox uses `player.html` and the shipping export store shim: three scenarios, five real Z inputs, no initial reward items/generated forage. Real catch spends energy 3 -> 0; authored underfoot sleep reaches day2 before pickup grants berry 0 -> 1. Energy/tool refusals preserve the readable QA snapshot except its action receipt, with zero swing cooldown, unchanged stamina and no attack audio request. Complete hidden-owner/RNG preservation comes from transaction tests, not the limited QA mirror.
- `performObservedAction` arms `oprn:action` before input. Sleep completion uses a prearmed DOM mutation signal for day2, an authored post-sleep switch and `running=false`. No fixed sleeps, polling or injected successful outcomes. Native images differ by exactly **3408 RGBA pixels**, confined to x128..191/y188..259 at the forage marker. This proves localized refresh, not aesthetic approval. Missing-definition fallback/warning survival use real renderer/event refresh with recording endpoints, not a native edited-content journey.

```sh
npm test -- test/lifeSkillDisabledHarvest.test.ts test/cropRegrowthContract.test.ts test/toolActionAuthoringParity.test.ts test/makerClockIntegration.test.ts test/lifeFieldInteraction.test.ts test/databaseLifeCraftingView.test.ts test/playSceneFarmFeedback.test.ts test/playScenePlaceableOverlay.test.ts test/npcActionFacing.test.ts test/seasonalForage.test.ts
```

The broader 17-file selection remains **283 passed, 2 failed, exit 1**. Inherited `actionDebounceFootprint.test.ts` cases `3x3 + passRows1 body/pass rectangle case` and `absent footprint identity case` throw `TypeError: Cannot read properties of undefined (reading 'registry')` in `syncCutsceneHudVisibility`. Earlier whole-suite/gate attempts timed out twice at 1200s (exit 124); current whole-suite regression status is unknown and six matched pre-existing surface failures remain. Build warnings are retained. Native image viewing was unavailable, so numerical pixels and DOM evidence aren't image-level approval. No complete 51-feature journey, remote persistence, whole-project green verdict or task33 final approval is claimed. Existing task6..9 evidence below keeps its original scope.

## Life QA observation and action receipts (2026-09-06)

- `npm test -- test/lifeQaObservability.test.ts` characterizes real till/rejection behavior and tests detached life snapshots, optional absence, per-scene receipts and instrumentation-off behavior. Observation is not save reconciliation or gameplay mutation.
- For a synchronous field action, use `performObservedAction(page, () => page.keyboard.press("z"))` from `scripts/lib/runtimeQaRun.mjs`. It arms the exact scene-host `oprn:action` listener **before** input and returns `{receipt, state, mirror}` after the action's mirror sync, even when the game state did not change. The bounded timeout/cancel path removes the listener and disposes its JS handle. No extra browser global is installed. State and receipt reads are detached copies.
- Existing runtime scenarios may opt into the same contract with `{kind:"action", observe:true}` instead of an action followed by a settling sleep. The manifest includes existing life owners and the receipt when present. Hook readiness uses the boot/mirror DOM mutation signal, not a polling interval. Other scenario waits are unchanged; no pre-existing life scenario was rewritten or credited with a journey it did not run.
- Receipts describe synchronous input dispatch and actual farm attempt results. Event/chest dispatch must still await that surface's own DOM completion; `handled:true` is not an asynchronous completion receipt. Future fishing, linked housing, regrowth and ledger integrations are not claimed by this foundation.
- Task5 reproducible public-module and shipped-player proof scripts are under `.omo/evidence/life-full-20260906/5/`; `public-probe.mjs` generates the minimal local contract fixture, `browser-proof.mjs` drives actual keyboard input with QA off/on, and `harness-proof.mjs` exercises the dedicated runtime runner's observed action op. No editor play, remote authored content or injected successful outcomes are used. Full 51-feature coverage remains not-run until the later journeys.

### Task5 validation correction (2026-09-06)

Run heavyweight suites, builds and browser proofs serially. The original title-readiness failures did not retain enough diagnostics to establish a cause; a later passing replay is not a root-cause diagnosis. `5/correction/browser-proof.mjs` under the task5 evidence directory retains per-context startup milestones, page/console/HTTP/request failures and pending requests/DOM on failure. It keeps the same 120-second DOM deadlines, arms canvas-plus-loading-overlay-removal before Enter, and uses a real visible menu to prove normal omitted-flag player readiness without QA hooks. No network bypass, polling or settling sleep is added.

`test/debugSession.test.ts` uses static imports for collection and synchronous operation tests. The former first-test `load()` charged every import (including unused-in-that-test scene hooks) to its 15-second operation deadline. Measured hooks loading dominated the actual fixture/operations; the new `runtimeDom` dependency also expanded the hooks' local static graph from 81 to 276 modules through the editor store. This correction separates setup from operations; it does **not** claim to reduce that graph or make imports faster. Timing evidence retains collection/import costs and all four tests/17 assertions. Do not raise timeouts, prewarm caches, or hide the two unrelated actionDebounce registry-fixture failures.

Generate `openwiki/INDEX.md` **after staging the final evidence-inclusive file set**: its basename checks consume `git ls-files`, so a pre-staging check can pass while the committed index is stale. Check it again against the final committed tracked set.

### Task5 Q1 audio boundary correction (2026-09-06)

`test/audioQaInstrumentation.test.ts` constructs the real AudioEngine with omitted/false/true capabilities, exercises queue unlock and real media-element control/stop paths (only browser play/pause are stubbed in happy-dom), and checks publication, detached state, resource recording and ownership-safe revocation. `test/playerAudioQaLifecycle.test.ts` keeps the real shell/audio singleton and exported store shim to cover enabled-to-omitted/false replacement and teardown. Existing playback assertions remain; the QA-specific control test and editor audio-dialog browser probe explicitly opt in.

`.omo/evidence/life-full-20260906/5/q1/browser-proof.mjs` extends the prior real keyboard proof to omitted/false/true boots. Its known-owner enumeration adds both audio QA globals, plus actor/media hooks, without removing any prior name; it also records **all** own `__oprn*` properties to expose unknown owners without misclassifying legitimate boot/juice diagnostics. Native media `playing`/`error` listeners are armed before player construction, DOM readiness before Enter/Escape, and scene receipt listeners before each actual z. The proof retains the prior acceptance/rejection, mirror and detached-read assertions, compares QA audio state to the public API, verifies requested start BGM, and revokes globals via real shell teardown. Native `playing`, unpaused state and readyState establish browser playback/decode evidence, not a claim about audible speaker output. No result injection, fixed sleeps, polling, timing retries, cache warmups or increased deadlines.

Use `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock` for serial heavyweight validation under this execution. Q1 receipts preserve the original failures and supervisor/VERIFY files; the two unrelated registry-fixture errors still run and remain failures, not a changed baseline. Re-generate INDEX only after final evidence-inclusive staging and check the committed tree.

## 기존 실패 비교는 진단 내용까지 확인한다 (2026-09-05)

같은 main의 실패 파일·테스트 이름·중복 횟수가 같아도 회귀가 없다는 충분한 증거는 아니다.
JRPG 재검증에서 `roleNameComparisonGate`는 양쪽 모두 실패 1개였지만, 진단은 기존 2곳에서
새 물 타일 역할 비교를 포함한 4곳으로 늘었다. 이름 비교 뒤 실패 메시지·수신값의 차이도 검토한다.
워크트리 경로·스택 줄 번호 차이를 제외한 새 위반을 수정하고, 실패 메시지가 불완전한 기준선은
해당 테스트만 다시 실행한다. 전체 게이트의 직접 종료 코드와 기존 실패는 보고서에 그대로 남긴다.

전체 실행이 시간 제한에 걸리면 테스트 범위를 줄이는 대신 native Vitest `run --shard=i/N`으로
나눌 수 있다. 먼저 같은 설정의 `list --filesOnly --json`으로 전체 파일 집합을 보존하고,
각 shard의 실제 종료 코드와 JSON을 모아 합집합 일치·누락 0·중복 0을 검증한다.
Vitest 3.2.4의 `list --shard`는 실제 실행 분할을 반영하지 않았으므로 분할 증거로 쓰지 않는다.
완전한 수집과 테스트 통과는 별개다. JSON에 없는 unhandled error도 있으므로 종료 코드 1을
카운터만 보고 성공으로 바꾸지 않는다. `ENOSPC`가 섞인 결과는 보존하고 해당 분할만 별도
임시 공간에서 다시 실행한다. 기존 실패 파일 안의 새 assertion도 원본 기준선과 대조한다.
PR678의 고정 리비전별 원본·영수증·검사기는 `output/evidence/monster-catalog/full-suite/`에 있다.

## Esc 메뉴 동작·시각 검증 (2026-09-05)

- `npm run qa:runtime -- --scenario esc-menu`: 미리보기, 회복량 예고, 대상 유지·연속 사용,
  장비 비교, 파티·시스템 화면, 필드 복귀. 결과는 `verify-shots/runtime-qa/esc-menu/SUMMARY.md`.
- `test/runtime/esc-menu.spec.ts`: 같은 출하 플레이어 하네스로 실제 DOM/스크롤 유지, 좌우 영역
  복귀, 640×480·1024×768·1280×960 배치, 닫힘 마지막 프레임과 빠른 재열기, 모션 감소를 검사한다.
- `test/playerMenuItemPreview.test.ts`: 회복 예고와 실제 적용 일치, 무변이·난수 보존,
  타입 전환과 사용 장소, 만피 상태 치료, 전투불능 대상 제한.
- `test/playerStatusMenuMotion.test.ts`: 종료 완료 전에 DOM을 삭제하지 않고 오래된 종료 콜백이
  새 메뉴를 삭제하지 않는지 확인한다.
- `scripts/qa/runtime/esc-menu-fixture.mjs`는 기존 테스트 프로젝트를 복사해 약품 종류를 명시한다.
  저작 콘텐츠의 정본을 수정하는 작업이 아니다. 원래 fixture의 normalGoods 약품으로 실행하면
  필드 사용이 거절되는 것이 현재 아이템 종류 계약에 맞다.

# Testing

## Completed-house Phase 2 verification (2026-09-06)

Primary command:

```sh
npm test -- test/houseProtectionFill.test.ts test/houseProtectionForest.test.ts \
  test/houseProtectionLifecycle.test.ts test/villageHouseProtection.test.ts --maxWorkers=2
```

Lifecycle tests wrap real stages, inject damage after their real work, and assert
atomic rejection before restoration. Direct-stage tests observe array writes,
not only final equality. Cover bbox gaps/ridge/deck ladder, all six kits, linked
doors and passable fronts, snow at 50x50/100x100, real serialize/deserialize,
preexisting houses/human stamps, exact counts/roads, and discarded pipeline
attempts. The runnable integration exercise is
`.omo/evidence/house-protection/p2/exercise.mts` (run with `vite-node --config
vitest.config.ts`). No authored/shared DB content is generated by this code QA.

Related house/village/road/session and producer suites must retain their existing
assertions. Compare failures **and assertion values** with immutable Phase 1
`e238eb1908b0f6fcdc32011d6e2419797f442704`; do not call a red command green.
Detailed RED/GREEN, baseline comparisons, tool-surface output, static checks and
build evidence belong in `.omo/evidence/house-protection/p2/README.md`.

For the supervisor's baseline and candidate full gates, use the same supported
Vitest pool environment on both:
`VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 npm run gates`.
Only concurrency changes: test deadlines, coverage, runner configuration and
tracked gate baselines stay unchanged. Full gates and browser/review approval
remain supervisor-owned, separate from the focused integration evidence.

## P2 낚시·채집·도감·박물관 focused gate (2026-08-25)

- `npx vitest run test/p2ProjectSchema.test.ts test/p2LifeRuntime.test.ts test/p2DayTransition.test.ts test/p2SessionPersistence.test.ts test/p2ReferenceLifecycle.test.ts test/p2EditorAuthoring.test.ts test/p2LifeLedgerUi.test.ts --configLoader runner`를 실행하고, matching P0/P1 persistence/transition/editor/life-ledger regressions와 `npm run typecheck:app`를 뒤따르게 한다.
- hostile cases는 failed-catch RNG rollback, no energy, unavailable season/time/weather, deterministic daily forage placement/cleanup, placeable/inventory overflow, duplicate day advance, collection counter overflow, duplicate donation/reward, aggregate reward overflow, malformed/stale save row, legacy omitted field, exact map/item deletion impact, structured editor roundtrip, long name, empty tab, pointer/keyboard tab semantics를 포함한다. Merged-root browser evidence에서는 root-owned `foraging-card.png`가 실제로 해석되는지도 확인한다.

Use the lightest command that proves the change.

## Map-owned overlays: actual AI-turn browser regression (2026-09-05)

- Run `xvfb-run -a node scripts/qa/map-owned-ai-turns.mjs` from the checkout root. It owns a verified-free `127.0.0.1:19846` Vite listener (`DEV_SERVER_NO_TLS=1 E2E_FREEZE_DEV_SERVER=1`, strict port), headed Firefox, and separate disposable browser profiles for completion and abort. It refuses a reused listener. Set `QA_PORT` to a different free port when another worktree is using the default; the probe, server, and browser all use that port. `EVIDENCE_DIR` selects the output directory; the default is `output/evidence/map-owned-overlays/phase2/green`.
- This is the real composer -> session -> tool loop -> proposal/store apply path, unlike the phase-1 overlay-setter probe. Only local `/v1/chat/completions` responses are scripted, routed by `body.tools`; all other non-read requests are blocked. `blankProject=1`, disabled remote persistence, and imported-store identity are asserted. No live model credentials or remote saves are needed.
- Promise-held responses bracket actual `set_build_spec` and two `clear_region` calls. Subscribe before clicking/sending/releasing: session tool events, ghost/store subscriptions, map selection, Phaser `postrender`, and the send button's `disabled` attribute (the exact `turnBusy` projection). Do not wait on a checklist for lookup completion: question turns may have none. No sleeps or polling.
- Checks include A -> B -> A with a real draft, another A-targeted tool delivered while viewing B, B's renderer layers/chip and map bytes, successful apply retirement with one intentionally unbuilt entry, same-session lookup non-revival, and abort reverting speculative `done/building` entries to `planned` with zero applied changes. Every rendered B frame and every store change is also observed.
- Existing `focusAcceptedAgentChanges` moves the view to A at successful apply. The regression records that behavior and explicitly reopens B to check the final state; it does **not** claim completion preserves B selection. Autonomous milestone apply is not covered (`agentMode: "chat"` is explicit).
- Mutation proof and exact GREEN/RED commands: `output/evidence/map-owned-overlays/phase2/BROWSER.md`. Screenshots are captured evidence; DOM/Phaser assertions are not a claim of subjective visual review.

## Editor e2e boot-overlay determinism (2026-08-31)

- When a spec needs deterministic access to editor chrome, follow `test/e2e/tileset-ai-native-review.spec.ts`: after navigation wait for `edit-canvas`, click `login-guest` if visible and assert `login-modal` is gone, click `standard-welcome-start` if visible and assert `standard-welcome-card` is gone, then click `coach-mark-skip` if visible and assert no `[data-testid^="coach-mark-"]` remains.
- Do not assume browser storage from a prior run, and do not use fixed sleeps or polling for these overlays. Await each exact dismissal state before opening a menu or modal.

## 영역 다듬기 focused gate (2026-08-31)

- 가벼운 순서: `npx vitest run test/regionSurroundings.test.ts test/regionBlend.test.ts test/regionPolish.test.ts test/regionTaskPolishModal.test.ts` 로 새 계약을 먼저 본다. 클립·실행 경로를 건드렸으면 `test/regionTaskClip.test.ts test/regionTaskRun.test.ts` 를, 칩·지시문을 건드렸으면 `test/selectionActionChips.test.ts test/suggestedCommands.test.ts` 를 더한다(8파일 97케이스).
- **경고를 blockers 로 만들면 테스트가 잡는다.** `test/regionTaskRun.test.ts` 의 `mode: polish` 절은 어울림 issue 가 전부 `warning` 인지, `severity:"error"` 목록이 비어 있는지, 이음새 때문에 `region-scope-violation` 이 뜨지 않는지를 본다 — 이 경로에는 차단 개념이 없다(`PendingRegionApply` 에 `blockers` 없음). 어울림을 게이트로 만드는 변경은 여기서 실패해야 한다.
- 함정: 이음새 검사에 `scopeRegion` 을 안 넘기면 다듬기가 **항상** 스코프 위반 error 로 막힌다. 그 케이스가 `test/regionTaskRun.test.ts` 에 회귀로 박혀 있다.
- 보고서 캡처는 게이트가 아니라 증거 재생성이다: `E2E_INCLUDE_DIAGNOSTICS=1 npx playwright test test/e2e/_region-polish-report-shots.spec.ts` → `vite-node scripts/_polish-brief-sample.mts` → `node scripts/_build-polish-report.mjs`. 수치는 캡처가 DOM 에서 읽어 `reports/region-polish/facts.json` 에 적고, 보고서는 그 값만 읽는다.

## AI 이벤트 배치 통행성 focused gate (2026-08-30)

- 가벼운 순서: `node scripts/run-vitest.mjs run test/aiEventPlacementPassability.test.ts test/aiEventPlacementSurfaceGate.test.ts --configLoader bundle` 로 계약 + 구조 게이트를 먼저 본다. 배치 툴을 건드렸으면 해당 툴의 spec(`test/aiPlacement*.test.ts`)을, 컨텍스트를 건드렸으면 `test/aiMapContextPassability*.test.ts` 를 더한다.
- **새 배치 툴을 추가하면 게이트가 먼저 실패한다.** `test/aiEventPlacementSurfaceGate.test.ts` 는 `src/editor/tools/**`·`src/project/quest/**` 를 AST 로 훑어 `map.events` 직접 쓰기를 찾고, 같은 함수(또는 그 함수가 부르는 같은 파일 헬퍼)에 `resolveEventPlacement`/`passableLanding`/`nearestPassableCell` 이 없으면 file:line 을 지목한다(bare `isPassable` 은 계약 호출로 세지 않는다 — 무관한 좌표로 한 번 부르는 미끼만으로 함수가 «보호됨» 이 됐다). 통과 방법은 두 가지뿐이다: 계약을 지나게 고치거나, `file#function` 키와 한국어 이유를 허용목록에 적는다. 쓰이지 않는 허용목록 항목은 stale 로 실패하므로 리팩터 후 정리가 강제된다.
- 함정: 계약 이름을 주석이나 문자열에 적어두면 통과할 것 같지만 안 된다(AST 호출식만 센다). 그 위장 케이스도 게이트 자신의 테스트에 들어 있다.
- 함정: `formatViewportContextBlock(viewport, name, project?)` 의 `project` 는 optional 이라 호출부가 안 넘기면 통행 그리드가 조용히 사라진다. 단위 테스트는 인자를 직접 넘기므로 그 누락을 **못 본다** — 실측으로 그렇게 죽어 있었다. 출하 경로(`buildSystemPrompt`, `AssistantSession` 턴 블록)를 고정하는 `test/aiMapContextPassabilityWiring.test.ts` 가 그 계약이다.
- 배치 자체의 판정 규칙(캐릭터형·밟기형 vs action 트리거, 단일 대상 자동 착지 vs 영역 건너뛰기)은 `openwiki/editor-ai-tools.md` 의 2026-08-30 항목이 정본이다.

## 체공(점프·낙하) focused gate (2026-08-29)

- `test/characterHop.test.ts`: 순수 곡선·클램프 계약. 아크 대칭성과 양끝 0, 낙하의 감가속 비대칭, `hopOriginY` 가 `height × scaleY` 로 나누는지(`hopOriginY(16,32,2) === 1.25`), 착지 충격 계획이 `MIN_IMPACT_LIFT_PX` 미만이면 `null` 인지, `prefers-reduced-motion` 에서 흔들림·먼지가 빠지고 SE 만 남는지.
- `test/runtimeCharacterHop.test.ts`: NPC 체공. 리프트가 최고점까지 오르는 동안 `sprite.y` 와 `sprite.depth` 가 **불변**인지(깊이 y-소트·카메라·조명이 이 값을 읽는다), 점프가 이동 속도가 아니라 자기 `durationMs` 를 쓰는지, `dropIn` 이 타일을 바꾸지 않는지.
- `test/runtimePlayerHop.test.ts`: 주인공 체공. 목적지 커밋(`tileX`/`session.x`), 맵 밖 점프는 건너뛰고 다음 명령을 소비, 낙하가 끝날 때까지 다음 걸음을 시작하지 않음. 이 파일의 `playerMock.setFrame` 은 Phaser 처럼 원점을 `[0.5, 1]` 로 되돌린다 — **리프트는 프레임 갱신 뒤에 적용해야 한다**는 호출 순서 계약을 테스트가 직접 지킨다.
- `test/hopPersistence.test.ts`: 저작한 `heightPx`/`durationMs`/`dx`/`dy` 의 저장 왕복(두 저작면 모두). 문자열 높이는 `deserialize` 가 던져야 한다.
- `test/moveRouteCatalogPersistence.test.ts`: 팔레트 44 버튼이 만드는 커맨드 전부를 하나씩·통째로 왕복시킨다(범인 버튼의 `testId` 를 실어 실패). 그리고 「효과음 재생」 기본값이 `collectResourceIds` 안에 있는지 잠근다 — 이 한 줄이 "없는 리소스 기본값이 이벤트 저장을 통째로 막는" 결함의 회귀 게이트다.
- 회귀는 `test/runtimeNpcRoute*.test.ts`, `test/runtimeMoveRoute*.test.ts`, `test/e2e/oprn-move-route-focused.spec.ts`(카탈로그 버튼/행 수) 까지. 그 스펙의 스윕 시험은 **스위치·효과음 칸을 채우지 않는다** — 없는 id 를 넣으면 「적용」이 이벤트를 저장하지 않아 내보내기가 빈 채로 나온다(예전 `sw_route_seen`/`se_route_chime` 이 그래서 0 개를 뱉었다).

### 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`

jsdom 이 못 하는 것만 본다. 리프트는 Phaser 의 `displayOrigin` 에 실리고 `setFrame` 이 그것을
되돌리므로, **원점 계약의 최종 판정은 실제 Phaser 뿐이다.**

- 새 op: `playerRoute`(이동 경로를 주인공에게 직접 물린다), `waitForLift`(리프트 창을 조건으로
  대기), `waitForGrounded`(체공 상태기 소멸을 대기), `captureShadowSample`(픽셀 대조용 표본 프레임).
- 새 expect: `playerLiftPx(AtLeast)`, `playerSpriteY`(접지선), `playerAirborne`,
  `playerShadowVisible`(깊이 띠 0~100k + alpha>0 동시 확인), `playerShadowGroundY`(타원 아래 끝),
  `playerShadowInkAtLeast`(렌더된 픽셀 농도).
- **착지 판정은 `liftPx` 로 하지 마라.** 훅이 정수로 반올림하므로 착지 직전 프레임도 0 으로
  보인다 — `playerAirborne` / `waitForGrounded` 가 유일한 진실이다.

#### 오브젝트 축 검사는 "한 픽셀도 안 그려진 상태" 를 통과시킨다 (2026-08-29 실측)

그림자가 `visible=true`, alpha>0, 깊이 띠 안, 카메라 안인데도 화면에 전혀 없었다(원인은
`textures.createCanvas` + 나중에 그리기, `openwiki/runtime-battle.md` 참고). 그래서
`playerShadowInkAtLeast` 는 **렌더된 픽셀**을 잰다. 여기까지 오는 데 실패한 설계 두 개를 기록한다.

1. 같은 프레임에서 상자를 **위로** 옮겨 잡은 대조군 → 캐릭터의 발이 늘 거기 있어 측정이
   뒤집혔다(-0.036).
2. 같은 프레임에서 상자를 **아래로** 옮겨 잡은 대조군 → 지형 자체가 5% 어두워서 **완전 투명한
   그림자도 통과**했다(0.050 > 0.03).

지금 쓰는 방식은 같은 **월드 사각형**을 두 프레임에서 비교한다: 그림자가 떠 있던 프레임 대
캐릭터가 그 자리를 걸어서 떠난 뒤의 프레임. 지형이 동일하므로 차이는 그림자뿐이다.
눈금(실측): 정상 0.10~0.15 / 완전 투명 0.026~0.030(두 프레임의 카메라 스크롤 차이에서 오는
서브픽셀 잡음 바닥) → 하한 0.06. 측정은 고고도에서만 유효하다 — 낮은 고도에서는 캐릭터의 발이
상자를 덮는다.

### 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)

`.herdr` 워크트리는 `node_modules` 를 공유하지 않고 `.vite` 캐시만 갖는 경우가 있어 `npm test`/`npm run typecheck` 가 바로 죽는다. 본 레포의 도구를 워크트리에 겨누면 된다.

```bash
cd /home/main/z-project/rpg-zzu
node node_modules/vitest/vitest.mjs run --configLoader bundle \
  --root /home/main/.herdr/worktrees/rpg-zzu/<name> test/characterHop.test.ts
```

**단, `cwd` 를 보는 테스트는 이 우회로 조용히 남의 코드를 잰다** (2026-08-30 실측).
`--root` 는 vitest 의 탐색 루트만 옮기고 `process.cwd()` 는 그대로 본 레포다. `test/playerRuntimeCss.test.ts` 는
`build({ configFile: resolve("vite.player.config.ts") })` 로 **cwd 기준** 설정을 읽어 익스포트 플레이어를
빌드하므로, 이 우회로 돌리면 워크트리 CSS 가 아니라 **main 의 CSS** 를 검사한다. 증상이 고약하다 —
공통 선택자(`.dialogue-overlay`)는 통과하고 이번 브랜치가 새로 넣은 이름만 "누락"으로 뜬다.
빌드·플러그인·설정 파일을 cwd 로 찾는 테스트는 워크트리 안에서 직접 돌린다(위 심볼릭 링크가 있으면 된다).

```bash
cd /home/main/.herdr/worktrees/rpg-zzu/<name>
node node_modules/vitest/vitest.mjs run test/playerRuntimeCss.test.ts
```

타입체크는 워크트리 tsconfig 를 상속한 임시 설정에 `node_modules` 경로를 얹는다. `"*": ["*", ".../node_modules/*"]` 매핑을 빼면 `phaser` 가 TS2307 로 터지면서 수백 개 가짜 에러가 번진다.

```json
{ "extends": "/home/main/.herdr/worktrees/rpg-zzu/<name>/tsconfig.json",
  "compilerOptions": { "paths": {
    "@/*": ["src/*"],
    "*": ["*", "/home/main/z-project/rpg-zzu/node_modules/*"] } } }
```

**e2e 는 위 우회가 안 통한다** (2026-08-30 실측). Playwright 의 `webServer` 는 설정 파일이 있는 디렉터리에서
`npm run dev` 를 돌리므로 워크트리에 vite 가 실재해야 한다. 본 레포 패키지를 **개별 심볼릭 링크**로 걸면
`.vite` 캐시가 워크트리에 남아 공유 `node_modules` 를 오염시키지 않는다. 디렉터리를 통째로 링크하면
vite 가 공유 캐시에 쓰기 시작해 다른 세션과 충돌한다.

```bash
SRC=/home/main/z-project/rpg-zzu/node_modules
DST=/home/main/.herdr/worktrees/rpg-zzu/<name>/node_modules
for e in "$SRC"/* "$SRC"/.bin; do b=$(basename "$e"); [ -e "$DST/$b" ] || ln -s "$e" "$DST/$b"; done
```

**이 개별 링크 형태가 `server.fs.allow` 를 뚫는다** (2026-08-30 실측). `node_modules` **디렉터리
자체는 실물**이므로 `realpathSync("./node_modules")` 는 자기 자신으로 풀려 아무것도 넓히지 못하고,
`/@fs/…/node_modules/phaser/dist/phaser.min.js` 가 403 으로 죽는다. 증상이 엉뚱한 데서 나온다 —
게임이 통째로 안 뜨므로 `qa:runtime` 이 "런타임 훅 없음" 으로 모든 비트를 실패시킨다(포트·타임아웃
문제로 오진하기 쉽다). `vite.player-qa.config.ts` 의 `fsAllowRoots()` 는 이제 `node_modules` 안
**링크들의 대상 쪽**(스코프 패키지는 한 단계 더)을 넓힌다. 판별: 서버 로그의
`outside of Vite serving allow list` 와 함께 찍히는 allow 목록에 본 레포 경로가 있는지 본다.

그다음 **포트를 반드시 고정해서** 돌린다. `playwright.config.ts` 는 `reuseExistingServer: true` 라서
기본 포트 9173 에 다른 워크트리의 서버가 이미 떠 있으면 **남의 코드를 조용히 테스트한다.**
출력에 `[WebServer]` 줄이 보이면 이 실행이 직접 띄운 것이다.

```bash
DEV_SERVER_PORT=9351 E2E_BOOT_TIMEOUT_MS=90000 npx playwright test test/e2e/<spec>.spec.ts
```

`E2E_BOOT_TIMEOUT_MS` 는 `seedProjectFromSupabaseCanonical` 내부의 `edit-canvas` 대기(기본 15초)를 늘린다 —
콜드 부팅이 그보다 느려 스펙이 통째로 빨개지는 일이 흔하다. 다만 `startNewGameFromTitle` 에
`waitForRuntimeState: false` 를 주는 방식으로 부팅을 건너뛰지는 말 것. 자동시작 분기가 스테이지만 보고
곧장 반환해서 **게임이 시작되기 전에** 다음 단계로 넘어간다.

## Roguelike run Phase 0–3 coverage (2026-08-24)

- `test/roguelikeRun.test.ts`: real interpreter lifecycle plus save-snapshot roundtrip.
- `test/roguelikeRunEditor.test.ts`: native condition/command forms and staged edit preservation.
- `test/commandContracts/runControl.contract.test.ts`: all action variants, inactive no-op behavior, non-blocking completion, and project serialization.
- `test/roguelikeRooms.test.ts`: exact deterministic slot selection, generation invalidation after floor/reset changes and same-seed restart, real `run_scene_test` enemy and one-shot loot reset behavior, live event-surface rebuild, save/load generation stability, event-reset opt-out, real-time enemy HP/projectile cleanup, active-run kill persistence isolation, AI tool authoring, import validation, and project roundtrip.
- Registry/shape coverage includes `runControl` and `run`; native manifest counts are 78 commands and 17 conditions at this phase.
- **Condition coverage (2026-08-29).** `test/conditionEvaluatorParity.test.ts` is the parity spine: it feeds identical `(condition, state)` pairs for all 17 kinds, in both a satisfying and a non-satisfying state, to all three evaluators (`pageResolution.evalPageCondition`, `session.evalCondition`, the battle runtime's `evaluateCondition`) and asserts identical verdicts. It also asserts `Object.keys(CASES)` equals `CONDITION_KINDS` in order, so a new union member fails the test until it is classified. `ALLOWLISTED_DIVERGENCES` is currently empty — record evidence before adding to it.
  `test/commandContracts/fork.contract.test.ts` covers all 17 kinds through the real interpreter drain; it previously covered only 10, with `timePhase`/`season`/`npcActivity`/`friendshipAtLeast`/`battleResult`/`run` proven at the `evalCondition` unit level but never through branch selection. It also pins that an empty friendship `npcKey` resolves via the host event's `characterId`.
  `test/pageConditionAuthoringIntegrity.test.ts` pins that a page condition survives an emptied reference (inline error, not deletion) and that touching a disabled row activates it visibly. `test/conditionEvalPreview.test.ts` pins the three-state 판정 불가 verdict. `test/conditionCopyTokens.test.ts` is the internal-token gate for condition copy.

### 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)

`.omo/gates-baseline.json` 은 `baselineTrustworthy: false` 이고 이유가 적혀 있다 — 동일 코드로
연속 실행해도 실패 수가 170/187/195/203 으로 흔들리고 `failedFiles` 는 **합집합**이다.
실측: playwright 시간 QA 가 dev 서버를 돎리는 동시에 `npm run gates` 를 돌렸다가 24개 파일이
「새로 실패」로 찍혔고, 그 중에는 바로 전에 개별 실행으로 두 번 초록을 본 파일도 섞여 있었다.
따라서 게이트 회귀 파정은 **조용한 상태에서 해당 파일을 개별 재실행**해서 마무리해야 한다.
`typecheck:app` 은 기준선이 0 오류 + `baselineTrustworthy: true` 이므로 그곳의 오류는 바로 회귀다.

## 데이터베이스 UI/UX 계측 하네스 (2026-08-30)

`scripts/qa/db-ux-probe.mjs` — 데이터베이스 모달 **30탭 + 서브내비 49곳**을 순회하며 눈이 아니라
브라우저에게 직접 묻는다. computed style / `getBoundingClientRect` / `appearance` / `naturalWidth` 를
읽으므로 결과가 부하에 흔들리지 않는다.

```bash
PROBE_BASE=http://127.0.0.1:9873/ PROBE_OUT=/tmp/probe PROBE_SUBNAV=1 node scripts/qa/db-ux-probe.mjs
```

| env | 뜻 |
|---|---|
| `PROBE_BASE` | dev 서버 주소 (워크트리마다 다른 포트를 쓴다) |
| `PROBE_OUT` | `probe.json` + 스크린샷 출력 디렉터리 |
| `PROBE_ONLY` | 탭 슬러그 하나만 (반복 수정 중에 쓴다) |
| `PROBE_SUBNAV=1` | 서브내비 49곳까지 들어가서 잰다 |
| `PROBE_SHOTS=0` | 스크린샷 생략 (측정만 할 때 훨씬 빠르다) |
| `PROBE_W` / `PROBE_H` | 뷰포트. 기본 1680x1050 |

세는 것: `selectUnskinned`(computed `appearance` 가 `none` 이 아닌 select), `numberUnskinned`,
`rangeUnskinned`, `detailsMarker`, `imgBroken`/`imgZero`/`bgZero`/`badUrls`, `selfClipped`(자기
`overflow` 로 글자가 깎인 요소), `tinyFont`, `tinyPseudo`, `lowLineHeight`, 탭별 헤더 비용과
작업영역 높이, 그리고 **탭별 모달 창 rect**.

### 가상 요소 텍스트를 안 재면 `tinyFont 0` 은 "안 봤다" 는 뜻이다 (실측)

초기 하네스는 자식 텍스트 노드(`nodeType === 3`)가 있는 요소만 재서, `::before`/`::after` 의
`content` 는 **구조상 단 한 건도 재지 않았다.** 그러는 동안 `tinyFont 0` 은 "작은 글자가 없다" 로
읽혔지만 실제로는 "가상 요소를 안 봤다" 였다. `tinyPseudo` 를 붙이자 모달 전역에서 유일하게 11px
미만으로 렌더링되는 텍스트가 드러났다 — `sidebar.css` 의 `.db-tab-group::after` 셰브론(`▾`)
10px, 30탭 × 6개 = **180건**. 근거 파일은
`verify-shots/db-ux/pseudo-baseline/probe.json`(셰브론만 10px 로 되돌린 30탭 순회,
`totals.tinyPseudo` 180). `before/probe.json` 에는 이 키가 없으니 그쪽을 근거로 들지 마라.

교훈: **계수기가 0 이라고 보고하면 그 표면이 범위에 들어오는지 먼저 증명하라.** 일부러 깨뜨린
표본을 만들어 계수기가 실제로 오르는지 보는 것이 가장 짧다(`db-placeholder-proof.mjs` 가 이미
이미지 쪽에서 같은 짓을 한다).

그리고 `TINY_FLOOR` 는 11 이며 이건 재단이 아니라 **기준선과 같은 자**다. 진단 문서와
`before/probe.json` 이 모두 "11px 미만" 을 셌다. 문턱을 11.5 로 올리면 726건이 새로 걸리는데
전부 정확히 11px 이다 — before/after 가 다른 자를 쓰면 비교가 무의미하니 가볍게 바꾸지 말 것.

곁딸린 하네스: `scripts/qa/db-placeholder-proof.mjs`(살아 있는 썸네일을 실제로 깨뜨려 자리표시자가
보이는지 증명), `scripts/shoot-db-tabs.mjs`(탭 스크린샷 30장).

### 0px 이미지는 "깨진 것" 과 "접힌 것" 을 갈라야 한다 (실측)

처음 만든 판정은 크기 0 인 이미지를 전부 결함으로 셌는데, 접힌 `<details>` 안이나
`display:none` 조상 밑에 있는 이미지도 0px 이다. 하네스는 조상 사슬을 걸어 올라가 숨은 것을
`imgHidden`/`bgHidden` 으로 따로 센다. 이 구분이 없으면 고칠 것이 없는데도 숫자가 안 떨어진다.

### 타이밍에 취약한 e2e 가 빨간불이면 그 스펙이 단정하는 속성을 직접 재라 (실측 2026-08-30)

`test/e2e/database-modal-size-invariant.spec.ts` 는 탭을 눌러도 모달 창 rect 가 1px도 안 움직이는지
본다. 이 박스에서 다른 세션들이 vitest·chromium 프로세스를 **98개** 돌리는 동안(loadavg 86) 3뷰포트
× 재시도까지 **6회 전부** 실패했는데, 사인은 전부
`locator.click: Test timeout of 240000ms exceeded` 였고 **기하 드리프트 단정 출력은 0건** — 비교문에
도달조차 못 했다. 지속시간으로는 구분되지 않는다: 30탭 순회 자체가 4분쯤 걸리므로 진짜 드리프트
실패도 4분이 걸린다. **판정은 오류 메시지로 한다** — drift 목록이 있으면 회귀, 시간 초과 문구면 경합.

초록불을 만들려고 `test.setTimeout` 을 늘리는 것은 게이트를 무력화하는 것이다. 대신 스펙이 단정하는
속성을 부하와 무관하게 직접 쟀다: 프로브가 탭마다 창 rect 를 기록하므로 **탭 간 창 상자가 몇
종류인지** 보면 된다. 1종이면 델타 0 이다.

```
1024x768  -> 30탭 전부 1000x744@12    상자 1종
1280x800  -> 30탭 전부 1256x776@12    상자 1종
1680x1050 -> 30탭 전부 1628x900@26    상자 1종
1920x1200 -> 30탭 전부 1628x900@146   상자 1종
```

같은 30탭을 같은 브라우저로 순회하는 프로브가 `tabsErrored 0` 으로 완주한다는 사실이, 240초 클릭
타임아웃이 CSS 탓이 아니라는 것까지 같이 증명한다.

### 소스를 grep 하는 테스트는 이름만 봐서는 회귀를 못 가른다 (실측)

`test/databaseKoreanRtpDefaults.test.ts` 는 소스에서 한글 라벨 21종을 찾고 **첫 미스에서 끊는다**.
그래서 "실패한 테스트 이름" 만 비교하면 새로 지운 라벨이 안 보인다. 라벨을 건드렸으면 21종 각각의
등장 횟수를 base 와 대조하라. 또한 이런 테스트의 단정문은 `expected 'import type ...' to contain
'...'` 모양이라 **다른 파일 블록으로 새기 쉽다** — `awk '/FAIL/,0'` 는 EOF 까지 긁으므로 원인을
오배정한다. FAIL 라인 사이로 구간을 끊어서 읽어라.

## Agent validation rule

- Tool-rule parity: `test/toolActionAuthoringParity.test.ts` plus database-life, farming, tool-capability, serialization, regrowth and disabled-XP regressions. Task8 evidence at `.omo/evidence/life-full-20260906/8/` records RED, 269 tests/15 files, changed-file diagnostics, app typecheck, full build, the public authority probe, and native Firefox editor keyboard/undo controls at 1440x900 and 1024x768. The editor boot subscription uses `perf-metrics-json.initialEditRenderMs`, not the early toolbar mount, which can be replaced during boot. Native player gameplay is not claimed. Chromium transport failures, probe setup failures and offline fixture warnings remain in the evidence. Screenshots were captured, but this child had no image-decoding-capable model; DOM observations are verified, visual image review remains with the parent.

**Authored game content** (demo maps, events, sample adventure data meant for the product): incomplete until **Supabase save + load-back** succeeds. Repo fixtures alone do not count. See root `AGENTS.md`.

Pick validation based on the touched boundary:

- Type-only or low-risk helper changes: run `npm run typecheck` plus a focused unit test if one exists.
- Project schema, migration, persistence, defaults, or references: run focused Vitest coverage for the changed path and include save/load or migration evidence.
- Default item/equipment catalog changes run `test/defaultItemCatalogQuality.test.ts` for Korean copy and shape coherence plus `test/itemRuntimeUsability.test.ts` for real field-menu/battle effect and consumption behavior. Keep the icon-coverage and default-database suites in the same focused gate.
- Terms/runtime label changes should cover `resolveTerms` defaults and overrides, old JSON with missing `meta.terms`, unknown term roundtrips, and focused DOM/model checks for battle command labels, shop text, inn text, and status/common labels when touched.
- Cluster-rule changes should include a focused validator test plus a commit-gate proof: a hard rule must still produce a `projectLint` error, `commitChangeset` must return `ok:true` for cluster-rule-only hard violations, and the fixed map should return `ok:true` without cluster-rule issues.
- Editor UI/workflow changes: run focused tests and drive the browser/editor surface with Playwright or an equivalent browser check.
- 데이터베이스 모달 UI 변경: `scripts/qa/db-ux-probe.mjs` 로 30탭을 재고 `verify-shots/db-ux/before` 와
  대조한다. 컨트롤 껍데기(`selectUnskinned`/`numberUnskinned`/`rangeUnskinned`/`detailsMarker`),
  이미지 실패, `selfClipped`, 헤더 비용이 판정 지표다. 스크린샷만으로는 통과로 치지 않는다.
- Desktop UI integration: use the Beginner/Standard/Expert shell matrix at `1024×768`, `1280×800`, and `1440×900`; separately exercise the event editor at `1586×992`, `1280×900`, `1024×768`, and `960×900`. Capture fresh three-mode shells, menu focus, shared modal, AI restore, event-editor, and title/load state; record viewport and localStorage setup next to the screenshots.
- The focused desktop regression batch includes the applicable UI unit files (modal stack, AI panel chrome, coachmarks, play input blocker, and title screen) plus `test/e2e/responsive-shell.spec.ts`, `test/e2e/desktop-editor-interactions.spec.ts`, `test/e2e/title-play-controls.spec.ts`, and the event-editor desktop flow. Use an isolated server port with `--workers=1`; fail on every browser error except the documented optional developer bridge refusal.
- `npm run build` is required before integrated UI handoff. The root supervisor, not a task worker, owns `npm run gates`; compare any gate result to the repository baseline instead of treating pre-existing failures as this task's regression.
- Modern Exteriors content/release validation is blocked without repository-visible redistribution rights. Do not run or claim its seed/reload/remote diagnostic, and do not write Supabase data as a replacement for the blocked validation.
- Canonical ice-terrain changes must run `test/iceDiagonalTerrain.test.ts`, `test/dungeonThemedLayouts.test.ts`, and `test/dungeonRoomPipeline.test.ts`. The exact Supabase crop fixture must stay unchanged; generated ridges must contain all six role tiles and return zero issues from `validateIceDiagonalTerrain`; the ceiling band must contain none of them. For authored output, save only a derived map id, reload it from Supabase, compare both tile layers, and capture small real editor-canvas regions against `map_g_ice_grand`.
- 조수 패널 레이아웃 회귀는 `test/e2e/assistant-single-dock.spec.ts` 가 지킨다(2026-08-31, 구 `test/e2e/chat-dock-switch.spec.ts` 대체 — 도크 축 glass/side/float 이 삭제돼 「전환」이라는 주제 자체가 없어졌다). 이 스펙이 보는 것: 1600/1100/900 폭과 새로고침에서 입력줄 캡슐이 편집 캔버스 안에 있는지, 로그 마운트가 유리 껍데기 하나이고 상승 오버레이·휘발 존이 없는지(`.ai-chat-log` 는 정확히 1개), 온도 선택이 아이콘 우선이고 닫히는지, 접기↔복귀가 `oprn:ai-panel-collapsed` 로 왕복하는지, 그리고 `chat-side-panel`·`chat-dock-toggle`·`ai-dock-mode-btn`·`ai-chat-detach` 가 **0건**인지. 폭 헬퍼 단위 커버리지는 레이아웃/패널 테스트에 있다. 자동 펼침/접힘(맵 우선 기본 접힘, 턴에서 펼침, 자동 펼침이었으면 유휴 뒤 재접힘)은 `test/aiPanelAutoExpand.test.ts` + `test/aiPanelChrome.test.ts` 가 본다. 조수 UI 를 건드렸으면 태스크 오너가 스펙 작성만 요청한 게 아닌 한 이 묶음을 돌려라.
- The genre-neutral authoring launcher and collapsed journey chip are covered by `test/authoringTasks.test.ts` and `test/authoringJourney.test.ts`; command reuse, loaded project identity, and player-boot evidence are covered by `test/commandRegistry.test.ts`, `test/loadNewRemoteProject.test.ts`, and `test/selectedEventTestModal.test.ts`. `test/quickBattleAuthoringGate.test.ts` drives the database basic-record button and proves broken references create no Quick Battle modal, session, or runtime. A Test click or synchronous `renderPlayer` return is not completion evidence. Passing coverage must observe actual `PlayScene` readiness, bind the success event to the current project fingerprint, invalidate it after authored changes, fail closed for stale/broken-reference events, keep manual acknowledgement distinct from completion, and exercise the exact issue list/Data repair path. `test/e2e/authoring-journey.spec.ts` proves the journey stays a corner chip, the topbar launcher still reaches Data, and the open popover keeps the 1024px font/target/clipping contract.
- Runtime/player/battle changes: run focused unit tests plus the smallest e2e or browser scenario that proves the behavior in play mode.
- **Export gameplay acceptance:** start an isolated normal dev server, then run `npm run qa:export -- --editor-url http://127.0.0.1:<port> --out <evidence-dir>`. `scripts/qa-export-playability.mts` imports a test-only deterministic copy of `editor-authored-demo-v3.json` through the real file chooser and downloads ZIP/HTML through the actual project menu. The editor session must have remote persistence disabled; the harness blocks remote writes and never modifies the source fixture.
- The downloaded ZIP is served at both an origin root and `/games/demo/` with no root-resource fallback; HTML runs via `file://` with HTTP blocked. Required checks are keyboard movement, NPC quest choice, authored battle victory, decoded party images/idle strips, decoded and playing BGM, map transfer, manual save, page reload and manual slot restoration. It also rejects HTML substituted for JS and a missing required image, and opens/closes editor Test Play. Results and cleanup receipts are in `results.json` with named screenshots; neither HTTP 200 nor map-entry-only evidence passes this gate.
- Use `npm run typecheck:export-qa` for the script's Node/browser type boundary. Focused contracts include `exportAssetResolution`, `webExportBattleDependencies`, `webExportCatalogAudio`, `standaloneExport`, `standaloneCli`, `devPlayerBundles` and `playerManifestContract`; `node --test test/devPlayerDelivery.test.mjs` exercises cold normal-dev delivery on a private cache and ephemeral port.
- On hosts producing Chromium `ERR_NETWORK_CHANGED` during the large dev-module graph, `qa:export` accepts `--api-transport`. This QA-only option forwards real same-origin HTTP responses through Playwright's API transport; it does not substitute code/data or bypass menu actions. `results.json` records the transport. Exported games still use native browser networking, and editor Test Play must also move in response to a real arrow key.
- Weather rendering has one Phaser-owned runtime path (`playSceneWeather.ts`). Focused tests assert the pure Phaser render plan for rain, storm, snow, fog, and none. The retired DOM overlay/CSS path must not be restored.
- Web export/player-bundle changes should cover project serialization roundtrip, used-asset collection, `export_game` summary data, `build:player` output files/HTML structure, and practical bundle string checks for editor/AI/remote-provider leakage such as `supabase` and `llm-provider`. Manifest coverage must prove the exact transitive Vite JS/CSS/assets closure, runtime asset hashes, missing/malformed/tampered/interrupted reads, and Unicode full-casefold collisions across manifest/generated ZIP sets (at minimum sharp-s, Greek final sigma, compatibility ligatures, and NFC composition). Pin the offline Unicode 15 data version, authoritative input digests, table counts, and fail-closed stream validation; keep post-version drift canaries such as U+1C89/U+1C8A and U+10D50/U+10D70. A Unicode data regeneration must independently compare every scalar key and run every NFKC relation in the official `NormalizationTest.txt`. Fetch/parser/hash and atomic serialize/open/write/fsync/close/rename/remove adapters must turn `Error` and non-`Error` throws into stable value-free typed failures while preserving the prior manifest and cleanup behavior. Keep every product/source module below the programming LOC ceiling or document an approved exception. When the task owner forbids Playwright for export smoke, stop at static output validation and report the manual serving path instead.
- Community player pipeline changes must run `npm run test:node playerArtifactPipeline` (or `node --test test/playerArtifactPipeline.node.test.mjs test/playerArtifactPipelineRollback.node.test.mjs test/playerArtifactPipelineGuard.node.test.mjs test/playerArtifactPipelineRecovery.node.test.mjs`) in disposable roots. Cover installed tamper/missing/extra, old lock, source/runtime/deployment digest drift, redacted scan/adapter failures, copy and post-copy rehash failures, all four target/lock rename positions both before and after native rename side effects, lock serialize/open/write/fsync/close failures, guard open/write/fsync/close/remove faults, concurrent/replacement ownership, dead-PID guard recovery, interrupted backup/staging recovery, raw preflight failures, and physical Windows junction/symlink escape rejection with an unchanged outside canary. Every pre-commit failure must leave the prior target and lock byte-identical and leave no task-owned guard/staging/backup residue. Do not exercise sync against the repository's real `dist/export-player`, `community-site/public/player-static`, or lock until the final artifact-install task owns that mutation.
- Community play-route/package-contract changes must cover canonical `.oprn` export, legacy `.rpgzzu` import, real reader/writer normalization and reload identity, encoded hostile slugs, typed boot-config roundtrip, stable save namespace, localized return URL, visibility-before-shell, real editor-schema rejection of malformed objects, traversal 400, missing/invisible 404, corrupt/adapter 500, and value-free error bodies. Drive the actual exported shell plus Korean/English errors in Chromium at desktop/mobile/tablet widths; use injected adapters and fixture packages only, with no production DB writes or credentials.
- Battle flow changes should cover both `"gauge"` regression and `"strict"` round collection/resolution. For strict, assert actor command collection, enemy AI inclusion, agility ordering, actor-first/index tie breaks, round-unit state upkeep, hidden gauge UI, and `simulate_battle` round logs from a scripted replay.
- Exact Gen1 battle changes must keep the pure golden vectors (`gen1DamageGolden`, `gen1CaptureGolden`, `gen1StatusGolden`) and the live runtime wiring suite (`gen1RuntimeExactIntegration`) green. Include nominal-100% 1/256 miss, physical/special classification by element, player PP timing and legal Struggle/recoil, support-only auto fallback, non-link enemy unlimited PP, omitted-active-slot 1v1, post-hit chance byte boundaries, custom type-id semantics, major-status type immunity, wake-turn loss, residual KO, second-major-status rejection, trainer capture blocking, exact capture/shakes, captured-state filtering/HP clamp, and monster plus actor PP save roundtrips. Injected constant RNG must terminate; it may not hang rejection sampling. Pair these with RM2K3 runtime/prediction regressions before handoff.
- Active-slot/switch battle changes should cover active/reserve snapshot composition, strict switch-first resolution, forced switch after active defeat, defeated reserve exclusion, gauge immediate switch/gauge reset, participant tracking, and `simulate_battle` strict scripts with `"switch"`.
- Runtime growth changes should cover class override save/load compatibility, effective-class stats/skills/equipment/commands, promotion requirements and branch behavior, reward policies using `participatingActorIds`, and equipment effects for element resistance, state resistance, and double attack. Include a command-contract file for any new native event command kind.
- Save-slot regression tests must cross the real storage codec (`saveToSlot`/`writeAutosave` -> `readSaveSlot`/`readAutosave` -> `applySaveSnapshot`); direct `createSaveSnapshot` -> `applySaveSnapshot` tests cannot detect fields dropped by the known-field JSON parser. Active/reserve monster reward tests must assert both persisted EXP and result-screen level-up previews against `participatingActorIds`.
- Monster collection changes should cover capture formula boundaries, uncapturable troop blocking, deterministic IV generation, party-six overflow to box, save/load plus legacy-save compatibility, captured-enemy EXP exclusion, `simulate_battle` strict `"capture"` scripts, and starter-choice event walkthroughs. Evolution/type changes should additionally cover level/item/friendship requirements, item consumption, HP-ratio preservation, learned target-species skills, automatic post-victory evolution, `evolveMonster` success/failure branches, type-chart single/dual/STAB/immunity multipliers, missing-chart regression, and `simulate_battle` favorable/unfavorable damage comparisons. Care-item tests must reject missing/zero, non-finite, unsafe, and over-cap source stacks and assert exact session non-mutation, including friendship and EXP. Include a command-contract file for any new native event command kind and run `node scripts/generateToolCatalog.mjs` when `define_monster_species`, `set_type_chart`, or `give_starter_monsters` schemas change.
- Hunting-runtime changes should cover weighted encounter distribution with fixed seeds, switch/variable/level/region filtering, field-spawn maxAlive/respawn/passable-cell selection, save/load policy that excludes spawn runtime state, `run_scene_test` field-spawn contact battle/respawn assertions, and a headless hunting-growth path that reaches promotion requirements.
- Farming-runtime changes should cover till/plant/water/harvest state transitions, unwatered-day growth stop, season-change death, regrow harvest cycles, save/load preservation, farmableArea bounds, crop DB/tool schemas, `advanceCropGrowth`, and a `run_scene_test` path that plants, waters through `advanceDays`, asserts `cropStageAt`, harvests, and asserts `inventoryCount`.
- P0 life-runtime changes use `test/p0RuntimeIntegration.test.ts`, `test/p0DayTransitionSceneFailure.test.ts`, `test/p0TransitionControlFlow.test.ts`, `test/p0LifeLedgerUi.test.ts`, and `test/p0SessionPersistence.test.ts`. Required hostile cases are exact and zero-minute day boundaries, `restorePerDay: 0`, repeated/source-stale transition keys, malformed/current/non-adjacent saved cursors, non-safe and absolute-minute-overflow saved clocks, already-settled and invalid shipping, season day 28 plus custom season boundaries, stale maker state, maker-disabled overflow bypass plus maker-enabled overflow fail-closed, insufficient-energy all-or-nothing area actions, success-only crop/rock/tree XP, manual/autosave/checkpoint cursor roundtrip, legacy menu absence, generated-art wiring, four tab roles/action indices, long labels, empty states, and pure API-backed UI actions. Preflight failures must show `day-transition-error` without running hooks/fades/success refreshes. Post-fade hook failures must roll the session back, fade in, refresh/sync the restored surfaces, and remain visibly failed. Blocking interpreter sleeps must not resume later commands after `false`; ordinary fire-and-forget sleep/advance paths must observe false/rejected promises. Parallel sleep/advance cases must stay pending without resuming, resume only after success, and retain a stopped process/error surface without executing later commands after false or rejection. `test/makerClockIntegration.test.ts` exercises actual `updateGameTime`, command/set-time, sleep and the Storage codec. It covers minute 29/30, multi-day residual deadlines, menu-open elapsed frames, zero-owner-identity preservation, backward-ready state, frozen promises, original-clock recovery, invalid dates, later-stage rollback and collection overflow/duplication. The task9 public ledger/clock probe uses Happy DOM plus real modules with camera/render endpoints, not native player gameplay or the complete 51-feature journey.
- P1 weather/animal foundation changes use `test/p1FoundationSchema.test.ts`. Keep authored normalize/shape/serialize/deserialize/start-session coverage together with manual save, autosave, and checkpoint round trips. Hostile coverage must include unknown weather enums, duplicate ids, over-limit arrays, non-finite or unsafe numeric fields, writer/parser/direct-apply sanitization, one-day-only weather persistence (no forecast snapshot), and schema-v3 saves that omit both optional runtime fields.
- P1 daily-weather runtime changes use `test/p1WeatherCalendar.test.ts` and `test/p1WeatherDayTransition.test.ts`. Keep fixed-seed/day determinism, season/year forecast boundaries, authored `forecastDays`, all-zero/malformed table fallback, disabled-package clearing, and exact `session.rng` non-mutation under repeated/out-of-order forecast queries. The farming handoff must reject stale/non-rain/zero-intensity weather, be idempotent, skip dead/untilled plots, and prove rain/storm watering happens before `syncFarmPlotsToDate`. Actual `dayTransition.ts` wiring is an integration-owner test and must preserve atomic transition rollback.
- P1 farm-animal runtime changes use `test/p1FarmAnimals.test.ts` and `test/p1SessionPersistence.test.ts` together with the foundation suite. Cover compatible assignment/move and capacity, missing species/building/item refs, duplicate or malformed live instances, empty arrays, atomic feed debit and same-day receipt, late/future care rejection, friendship cap, both-care production eligibility, per-species cadence, exact-once/future advance cursors, whole-herd product overflow rollback, atomic ready-product collection, valid moved-home save roundtrip, stale-home fallback, and deterministic unassignment of saved capacity overflow. `test/p1DayTransitionIntegration.test.ts` additionally proves source-day care produces after the other stages and animal overflow rolls back weather, calendar, shipping, farming, energy, and makers with the live session unchanged. `test/p1HostileAudit.test.ts` independently guards live-calendar care, future production, capacity repair, disabled screen-weather clearing, and stale saved-weather replacement. `test/p1RuntimeUi.test.ts` proves an animal-only package exposes the life ledger, generated animal artwork is wired, and feed/pet/collect buttons mutate only through the animal authorities.
- P1 browser gates are `test/e2e/stardew-p1-editor.spec.ts` and `test/e2e/stardew-p1-runtime.spec.ts` against Supabase project `rpg-zzu-stardew-demo`. They verify the four authored season tables, both species, the placed home and two event-bound animals, HUD date/current weather/forecast/birthday, visible animal event sprites, generated animal art, real feed/pet actions, containment, and horizontal overflow at 1024×768 and 1440×900. Screenshots are tracked under `.superpowers/sdd/qa-shots/stardew-p1/`. `net::ERR_ABORTED` is accepted only as navigation/teardown cancellation and the absent optional local browser bridge is the only allowed connection refusal; other request failures, page exceptions, and console errors fail the specs.
- Stardew life-content validation additionally runs `test/stardewDemo.test.ts`, `test/databaseCropView.test.ts`, `test/databaseCharacterView.test.ts`, and `test/databaseMonsterSpeciesView.test.ts`; live persistence uses `RPG_ZZU_LIVE_SUPABASE_ROUNDTRIP=1 npx vitest run test/stardewSupabaseRoundtrip.live.test.ts --configLoader runner`. Browser evidence comes from `test/e2e/stardew-life-content.spec.ts` (remote project, 1024/1440 DB layouts and card navigation), `test/e2e/stardew-resident-runtime.spec.ts` (loved gift response +80), and the explicit diagnostic specs `_farm-loop-probe`, `_farm-visual-inspect`, `_mine-loop-probe`. Use a unique `DEV_SERVER_PORT`; evidence is written under `output/evidence/stardew/` and must be visually inspected, not accepted from exit status alone.
- Friendship/gift/seasonal-shop changes should cover friendship clamp/save-load, deterministic gift preference deltas, daily gift limits and next-day reset, `friendshipAtLeast`, `getFriendship` variable bridging, `giftSystem` off regression, legacy shop-without-stock regression, seasonal stock filtering/prices, `set_shop_stock`/`make_villager` tool contracts, and a `run_scene_test` path that gives a loved gift, asserts `friendshipAtLeast`, branches dialogue, advances days into another season, and asserts `shopStock`. Gift-consumption tests must reject missing/zero, non-finite, unsafe, and over-cap source stacks and assert exact session non-mutation, including birthday friendship and `dailyGifts` receipt state.
- Troop battle-event changes should cover page conditions for `onRound`/`everyRound`, `enemyHpBelow`, and switch state; `runOnce`; supported message/choices/common-event/vital commands; unsupported-command logs/lint; and event logs returned through runtime snapshots or `simulate_battle`.
- Play status menu keyboard regressions are covered by `test/e2e/oprn-menu-keyboard-tour.spec.ts`; it is intentionally long (`test.setTimeout(120_000)`) and tours item use, skills, equipment, save/load, row, formation, quests, wait, and title return using keyboard navigation.
- Wiki-only changes: run `npm run openwiki:verify`.

- `npm test` runs the Vitest unit suite.
- `npm run test:node` runs the `node:test` suite. It **discovers** `test/**/*.test.mjs` through `scripts/run-node-tests.mjs` instead of listing files, and fails when discovery returns nothing. Do not replace it with a hardcoded file list: `playerArtifactPipeline*` (4 files), `playerArtifactContract`, and `playerReleasePreflight` (85 cases total) were silently unreachable for months because Vitest's `include` is `test/**/*.test.ts` and the only npm entry point named two OAuth files explicitly. It now gates CI in the `unit-tests` job of `.github/workflows/parity.yml`.
- `npm run test:ai-oauth` filters the same runner down to the OAuth files. The ported OAuth stack is pinned by `test/oauthCredentials.test.ts`(요청 자격 패커·만료 거절), `test/codexOAuthFlow.test.ts`(device 흐름, 주입 fetch/sleep), `test/antigravityOAuthFlow.test.ts`(인가 URL·프로젝트 발견·온보딩 재시도), `test/oauthLoopbackCallback.node.test.mjs`(바인드 우선·포트 점유 폴백·정리), `test/ohMyPiWorker.node.test.mjs`(인증은 Node / 완성은 Bun 워커), `test/ohMyPiLiveLogin.node.test.mjs`(**실제 제공자 엔드포인트**를 우리 코드로 친다). OAuth 스위트는 시간에 기대지 않는다: 폴링·재시도 대기는 주입된 sleep 으로 즉시 끝나고, 상한은 호출 횟수로 검증한다. 저장소 경로 env(`RPG_ZZU_OH_MY_PI_AUTH_PATH`)는 `scripts/lib/aiAuthRuntime.ts` 를 **import 하기 전에** 정해야 한다 — 저장소가 모듈 로드 시점에 만들어지므로 static import 로는 늦는다(그래서 두 node 스위트가 동적 import 를 쓴다).
- `npm run test:parity` runs the editor->player parity suite (`test/parity/`: contract matrix resolver, parity rig, battle/actor-class/round-trip/scene behavioral parity, golden-project playthrough, and the play-boot validation gate). It gates CI via `.github/workflows/parity.yml`; heavy Playwright e2e is nightly/optional and does NOT gate CI.
- Vitest uses a 15 second per-test timeout in `vitest.config.ts`; several headless walkthrough/autosave tests can exceed the default 5 seconds during full-suite parallel runs even when they pass focused.
- `npm run typecheck` verifies TypeScript only.
- `npm run build` must pass before merge-ready work.
- `playwright` / `npm run test:e2e` covers browser `test/e2e` flows.
- Database permanent QA specs (2026-08 beginner campaign): `test/e2e/qa-overview.spec.ts` (overview dashboard chips/curve/scatter/issue-jump, F1/F4/F5/F7 contracts), `qa-characters.spec.ts` (character profile CRUD + orphan-id card + '이벤트로 이동'), `qa-tilesets.spec.ts` + `qa-structure-kits.spec.ts` (tileset inspector fields + stamp empty/registered states), and `qa-db-beginner-mode.spec.ts` (beginner chrome: Tools-menu entry, common-6 nav + `db-nav-all`, plain jargon labels, dirty guard in beginner lane). All five must stay green in one run: `npx playwright test test/e2e/qa-overview.spec.ts test/e2e/qa-characters.spec.ts test/e2e/qa-tilesets.spec.ts test/e2e/qa-structure-kits.spec.ts test/e2e/qa-db-beginner-mode.spec.ts` (14 tests). Broken product contracts discovered later must move to audit specs as findings — permanent specs are green-only.
- Diagnostic audit family `test/e2e/_db-audit-*.spec.ts` (+ shared helper `test/e2e/dbAuditHelpers.ts`): adversarial probes that RECORD findings instead of failing green contracts (crud-battle, crud-collection, matrix, commands, utility-system, chrome, visual-capture). Underscore-prefixed specs are excluded from normal runs by `playwright.config.ts` `testIgnore: ["**/_*.spec.ts"]`; run them by naming the file explicitly on the CLI or with `E2E_INCLUDE_DIAGNOSTICS=1` (the config flips `testIgnore` off when either is detected). Test-level timeouts are expected probe limitations, not harness failures. Findings land as scored JSON (S×B rubric, `docs/reviews/db-beginner-heuristics-rubric.md`) in `output/evidence/db-beginner-audit/findings/` (gitignored); each spec truncates its own findings file at run start, so a completed run yields a clean file. Consolidated ledger: `docs/reviews/db-beginner-adversarial-qa-findings.md`.
- `vitest` is for focused unit tests and fast iteration.
- `run_scene_test` is the headless tick-based scene harness for authored runtime moments that need camera/spawn/picture/audio/session assertions. Use it when `play_walkthrough` is too coarse for cutscenes, timed scenes, trap retry loops, hunting spawns, farming plots, gifts, seasonal shops, or ending selection; it is a read tool and uses a session copy only. It supports `gift`, `retryCheckpoint`, and `advanceDays` steps plus `gameOver`, `playerAt`, `fieldSpawnCount`, `cropStageAt`, `inventoryCount`, `friendshipAtLeast`, `shopStock`, and `endingReached` expectations. Both `advanceDays` and natural exact clock crossings invoke `transitionToNextDay`, so headless assertions observe the same shipping settlement, energy restore, maker advancement, farm growth, and transition cursor as PlayScene.
- Calendar/time-system changes should cover minute/hour/day/season/year rollover, phase boundaries, menu/battle/cutscene pause, `forceSleep`, `onDayEnd` ordering, save/load plus legacy-save compatibility, custom `daysPerSeason` wire preservation (including day 40), and omitted-`timeSystem` regression. Include `run_scene_test` assertions for `gameTimeAt`, `timePhase`, `advanceDays`, page-condition branches, and time-gated encounter tables.
- NPC schedule changes should cover `when` matching for phase/season/dayRange/hourRange, same-map walking plus final facing, offscreen cross-map relocation, paused-time no-op behavior, dialogue/wait interruption and resumption, no-regression for unscheduled NPCs, save/load of schedule runtime fields, and `run_scene_test` assertions using `eventAt`, `eventOnMap`, and `npcActivity` page branches. Map-reference work also runs `test/npcScheduleReferenceIntegrity.test.ts`: unknown/blank/missing maps, fractional/negative/out-of-bounds coordinates, orphan hosts, exact deletion-impact row paths, target-only cascade, valid duplicate-row roundtrip, and scheduled event-ID global-key collisions are mandatory hostile cases.
- Checkpoint/trap/ending runtime changes should include focused Vitest for checkpoint save/restore, `killPlayer` game-over retry, `triggerEnding` priority choice, and ending-tool warnings, plus a `run_scene_test` fixture that walks into a trap, retries, and reaches an ending.
- Follower/chase runtime changes should include focused Vitest for A* detours, sight/give-up limits, follower trail inheritance, and save/load preservation. Include `run_scene_test` coverage for obstacle chase distance reduction, safeZone non-contact, chase touch plus checkpoint retry, and `addFollower` followed by `followerAt`.
- Lighting runtime changes should include focused Vitest for mask input calculation, ambient transition interpolation, attached-light tracking, deterministic flicker, save/load preservation, and `set_lighting_volume` map/event modes. Include `run_scene_test` coverage for `lightingAmbient`, `lightAt`, and `lightCount`, especially player-attached flashlight movement and `removeLight all`.
- Phase 6b atmosphere changes should include focused Vitest for `showAnimation` target coordinate resolution and `wait:true` blocking, deterministic storm flash timing, fog/weather save-load round trips, and `set_scene_mood` argument composition. Include `run_scene_test` coverage for `weatherKind`, `animationPlaying`, and fog combined with Phase 6a lighting.
- Investigation/puzzle authoring tools should include focused Vitest for batch hotspot skip/warning behavior, self-switch once pages, compile snapshots for all puzzle kinds, deterministic solvability rejection, and `run_scene_test` assertions for sequence success/reset, item-gate locked/unlocked, and push-switch completion.
- Horror/mystery prototype QA uses `src/testing/horrorExperienceQa.ts` as a strict, repeatable experience proxy rather than claiming simulated human taste. The project-specific plan in `src/testing/horrorMysteryQaPlan.ts` must exercise locked-gate feedback, wrong-answer recovery, the critical path, trap and chaser death with checkpoint retry, and two distinct endings through the real scene runner. Any mandatory scenario failure, lint error, silent lethal event, missing safe zone, or failed/missing browser smoke is a blocking failure; score alone cannot override it.

- **One-command horror browser-evidence contract (Slice A + indent):** `npm run qa:horror` is the single automated gate and needs **no human-maintained evidence** — it (1) runs `scripts/capture-horror-browser-evidence.mts` (`npm run capture:horror`) which **always owns a freshly verified-free port and an exact spawned process from this worktree** — spawned via `process.execPath` on the Vite JS entry with `shell:false`/`windowsHide:true` so the ChildProcess IS the server process and cleanup tears it down on Windows and Linux (no cmd-wrapper orphan; see `scripts/lib/vite-invocation.mjs` + `test/viteInvocation.test.ts`), passing `--strictPort`. **It never reuses an already-listening server** — an occupied port (this app or foreign) is an explicit failure via `planServerOwnership` (`scripts/lib/horror-capture-rules.mjs` + `test/horrorCaptureRules.test.ts`). Content binding uses a deterministic canonical digest (`scripts/lib/canonical-project-digest.mjs`) computed independently on Node (Supabase reload) and in-browser from actual project data, compared, mismatch hard-fails, and expected+observed digests are persisted; it also asserts the live session's exact expected startMapId/startPos x/y, and observes the required start-map custom BGM (cc0-bgm-dungeon → cave-theme.ogg) request+playback via a `window.__oprnAudioObserved` hook (`src/player/audio/audioEngine.ts`) — a broken required BGM fails. `browser-title.png` = title before play, `browser-play-start.png` = after play; browser-qa.json persists start-phase screenshots plus expectedStart/contentDigest/bgm fields. Launches headless Chromium against the real editor URL `/?project=rpg-zzu-horror-mystery-prototype-v1`, observes the real UI: title resource + image load, desktop touch-pad absence, the actual play-session start map id/x/y and passability (via live `__oprnDebug.readState()` + `isPassable`), and console/page/request errors — writing `output/evidence/horror-mystery-prototype/browser-qa.json` plus that title screenshot, then cleaning up its child server/browser on success and failure (bounded waits, no process-wide kill); (2) verifies source identity from `window.__oprnProjectE2E.currentProject()` digest binding and **fails** if it is not `rpg-zzu-horror-mystery-prototype-v1` or the content differs, with credentials never reaching output; (3) then reloads the project id from Supabase, combines the runs with the fresh evidence (guarded by `capturedBy` provenance + 5-minute freshness window + reject more than 30s in the future via `scripts/lib/horror-browser-evidence.mjs`), and emits JSON and Markdown reports. Documented optional-developer-bridge/telemetry request noise (`__oprn/ai-activity`, `dbserver:8100`, `127.0.0.1:17xxx` companion) is excluded from `consoleErrorCount`. Regression coverage lives in `test/horrorBrowserEvidenceFreshness.test.ts`, `test/horrorCaptureRules.test.ts`, `test/canonicalProjectDigest.test.ts`, and `test/horrorBgmAndScreenshots.test.ts`. `scripts/build-horror-mystery-prototype.mts` runs via the separate **`npm run build:horror`** script (author/build path, distinct from QA).
- Semantic scene-runner contracts (`test/horrorSemanticScenarios.test.ts`) pin the evaluator's observable evidence so a silent no-op can never score as feedback:
  - **locked-gate-feedback** requires a runner-observable message — `SceneTestResult.finalState.messages` accumulates the transcript and the runner exposes a `messageShown` expect; an interact that produces no text fails.
  - **wrong-answer-recovery** requires an explicit incorrect transition: after a wrong sequence press the progress variable (`var_<puzzle>_step`) must reset to 0 *and* a wrong-answer message must be shown. A solver that merely ignores the wrong input fails. These came from a hostile review — prior scenarios only asserted unchanged switches/inventory, so a silent no-op passed.
  - **critical-path** uses only contiguous legal `move` steps (reachability-checked) from `project.startMapId`/`startPos` through actual transfers/landings, checkpoint, corridor, and finale — no `set`/teleport navigation skips. It asserts transfer landing passability, the checkpoint snapshot captured after the actual gallery→chase transfer, and `bgmPlaying` after corridor/finale entry. The runner now applies each map's authored BGM (`resolveMapBgm` + `applyMapBgmToSession`, session-only, no engine) on initial entry and every transfer.
  - A map authored with `bgm.mode="custom"` must resolve its `resourceId`; `evaluateHorrorExperienceQa` emits `audio:unresolved-resource` and fails the build when `resolveAudioSource` returns null (a broken id would otherwise play silent).
  - Reachability and checkpoint-rollback protections are preserved — trap/chaser retry tests still assert full rollback (switch/inventory), not just position.
- Story flag / narrative-state changes should include focused Vitest for registry declare/rename/retire, auto target allocation, duplicate id/target rejection, usage-index accuracy across page conditions, conditional branches, setSwitch/setVariable, move-route setSwitch, common events, and troop battle events, plus projectLint warnings for read-without-write, write-without-read, undeclared use, retired target use, and legacy projects with no `storyFlags`. Quest graph changes should cover DAG validation/cycle rejection, dead-end write-site lint, unreachable/orphan node warnings, storyFlag condition resolution, `generate_walkthrough` JSON schema compatibility with `run_scene_test`, manualHint `set` fallback, and `verify_quest` success/failure reporting. `explain_event` coverage should evaluate all existing page-condition kinds and include an integration fixture proving concise `get_story_state`, `find_flag_usage`, and a blocked page summary such as `S3=off` for page 2.
- World graph changes should cover schema normalization, missing-node and duplicate-edge rejection, `link_maps` bidirectional idempotency, role-default map generation in `build_world`, adjacent boundary passability warnings, transfer destination/event-overlap errors, and a `run_scene_test` chain across generated maps.
- Large-project regression coverage lives in `test/fixtures/largeProject.ts` and `test/largeProjectPerf.test.ts`. The fixture should remain deterministic at 50 maps of 40x40 tiles, and the test should keep loose timing/size thresholds for deserialize normalization, serialized byte size, and a one-map 100-tick `run_scene_test` path.
- Cutscene timeline work should cover `test/cutsceneCompiler.test.ts` for beat-to-command snapshots, begin/end and validation failures, plus a `run_scene_test` integration fixture that proves camera/picture state and post-cutscene input unlock. Use `cutsceneLocked` expectations for explicit lock assertions.
- Tileset intelligence UI changes should include focused Vitest coverage for review queue ordering/state transitions, correction save metadata and undo, locked AI-write preservation, mock re-audit candidate flow, and palette preset CRUD before running the full suite.
- Tileset vocabulary cleanup must separately cover palette presets (`test/tilesetPaletteT1a.test.ts`), review/legacy metadata compatibility (`test/tilesetT1bReviewUi.test.ts`, `test/tileMetadataTools.test.ts`, `test/tilesetSectionTabs.test.ts`), and build tile-group bootstrap (`test/buildPalette.test.ts`). A rename of build-palette group symbols must leave persisted group ids and `tileset.palettePresets` unchanged.
- Tileset knowledge changes run the manual contract suite (`test/tilesetGridSelection.test.ts`, `test/tilesetKnowledgeTemplates.test.ts`, `test/tilesetDirectionalPassage.test.ts`, `test/tilesetKnowledgeContract.test.ts`, `test/repeatableBlockGrammar.test.ts`, `test/tilesetKnowledgeWorkspace.test.ts`) plus the AI workspace suite (`test/tilesetAiNativeReviewModel.test.ts`, `test/tilesetAiNativeAnalysis.test.ts`, `test/tilesetAiNativeReviewApply.test.ts`, `test/tilesetAiConversationSession.test.ts`, `test/tilesetAiWorkspaceModal.test.ts`, `test/tilesetAiCpenClient.test.ts`). The AI suite must prove that the normal manual editor remains visible, the bottom trigger is the only AI entry, whole-atlas analysis is detached, the workspace advances through its three-step wizard (`analyze → questions → summary`, with natural-step derivation and manual stepper navigation), AI questions and quick replies parse safely, answers carry into reanalysis, a per-question discard action skips the current proposal, confirmed groups remain staged until one explicit apply on the summary step, and human locks/stale fingerprints are preserved. Browser coverage is `test/e2e/tileset-ai-native-review.spec.ts` for manual surface → modal open → three-step flow (analyze status, questions with discard, summary list, apply) → export persistence, plus `test/e2e/tileset-knowledge-authoring.spec.ts` for the unchanged executable manual editor.
- AI boundary regressions must additionally cover keyless relative-proxy auth (no browser `Authorization` header), fail-closed mixed/duplicate tile-id arrays, overlapping-proposal arbitration, and executable 9×9 atlas placement (`test/clusterRulePlacement.test.ts`, focused with `-t "9x9 물 아틀라스"` while unrelated baseline failures remain in that file).
- `npm run perf:bench` runs the Node headless performance budget harness and writes JSON evidence under `evidence/perf/`.
- The perf benchmark measures data-pipeline paint latency, edit render diff planning, undo snapshot bytes, and deserialize+validate load time; it intentionally excludes Phaser render.
- Do not add the perf benchmark as a CI gate unless the budget policy changes, because local timing is machine-dependent.
- For focused selection, run a single file, pattern, or test name instead of the full suite.
- House-harness door/interior changes should cover `test/houseKit.test.ts`, `test/villageBuilder.test.ts`, interpreter command coverage, and `test/e2e/village-house-interior-transfer.spec.ts` for the play-mode action transfer round trip.
- Natural-village grammar changes must cover `test/naturalVillageReference.test.ts`, `test/houseKit.test.ts`, and `test/villageBuilder.test.ts`. The contract checks staged direct-authoring maps, shape/kit/story diversity, one intact door pair per house, no adjacent windows, four boundary road exits with no house-footprint intrusion, short fence fragments, bounded straight-road runs, interior mixed-tree density, varied props, and scheduled NPC activity/movement diversity. Authored evidence is complete only after `scripts/author-natural-village-reference.mts` and `scripts/author-natural-village-harness.mts` save and reload their project ids from Supabase. Browser evidence must use the editor's map screenshot action (not a viewport/editor screenshot); `scripts/capture-natural-village-reference.mts` captures every stage and `scripts/capture-natural-village-harness.mts` captures the final generated comparison. Capture evidence classifies the optional `127.0.0.1:17831` developer bridge separately and fails on unexpected network request failures. `scripts/generate-natural-village-report.mts` builds the linked HTML evidence report.
- Interior wall-contract changes (Option B: 주택 통타일 grammar + 다크 `366` 저장 + 렌더 전용 쿼터 소스) run as one focused batch: `npx vitest run test/interiorRoomPipeline.test.ts test/interiorAutotile.test.ts test/darkWallAutotile.test.ts test/interiorWallFrameQuarterComposition.test.ts test/legacyInteriorWallContract.test.ts test/tilesetHarness.test.ts`. Must assert: blank interior tileset seeds **no** wall-frame store group and the dark group stores `366` only; quarter composition fires only when the center is `366` and returns `null` for house ids/`430`; house grids carry cream 2-row + `457` cap with `458`/`456` joints and a `398|72|396` door over a `397` step; no `233`/`257`/`258` anywhere; user-authored autotile groups survive a harness re-seed; legacy diagnosis reports ambiguous maps without mutating them. Visual evidence is generated, never hand-drawn — `bun scripts/render-interior-wall-contract-cases.mts` rewrites `docs/interior-wall-frame-cases/*.png` from the real APIs and asserts the contract inline (105 must quarter-compose 0 cells; house grids must contain a cap and no forbidden tile).
- Terrain-template tests should not be reintroduced. When changing persistence around old project JSON, prove legacy `terrainTemplates` are dropped on load and absent after serialize.
- M2 event-command test contracts (2026-08-08 repair): a Page-3 rich-form test earns its place only by driving the form, asserting the resulting command JSON, **and** asserting the runtime effect through `executeM2RuntimeCommand`. Existence-only assertions (a testid renders, a shell mounts) certify nothing and must be rewritten to that shape or deleted — `test/page3CommandBodies.test.ts` traded nine such checks for seven full form→JSON→runtime contracts. `test/commandContracts/m2Command.contract.test.ts` covers every behavior-full command id and must keep map/common effects separate from troop parser effects: running troop-only commands through the map harness silently passes. Native aliases are converted by `newCommand` for picker authoring while persisted `m2Command` aliases stay runtime-partial and fallback-safe; assert both halves. Staged-state regressions belong in `test/eventEditorStagedState.test.ts` using its `stagedContext(initial)` harness.
- Editor command bodies must never spread the render-time `cmd` in a commit handler; that loses a prior field edit in the same form session. Patch from `context.getCurrentCommand?.()` instead, via the shared `replaceFields(context, cmd, fields, removeKeys?)` exported from `src/editor/panels/eventEditor/commandBodyM2Page3.ts` (or the local `latestShop`/`latestChoices`/`latestFork`/`updateField` equivalents). One-time seeds are the only legitimate `...cmd` spread. Any new command body needs a consecutive-two-field-edit case proving both survive.

Evidence expectations:
- Official cross-genre readiness is machine-computed by `evaluateOfficialGenrePackReadiness` from the exact five contracts in `src/project/officialGenrePackRequirements.ts` (`horror-chase`, not the old `horror` id), native command guarantees, authored command presence, real `projectLint` output, and semantic assertion receipts. Capability and authorship are separate gates: a globally supported command does not make a blank project ready. Map/common/troop command indexes include nested branches and exclude uncommitted new-event drafts. Status is only `blocked`, `incomplete`, or `ready`; there is no caller-supplied certification flag. Missing authored content is `incomplete`, while partial/missing runtime support, invalid evidence, or blocking lint is `blocked`; the known partial monster commands therefore stay blocked.
- Screenshot counts are never a genre pass condition. `verifyGenrePackAssertionReceipts` requires schema version 1, exact receipt/assertion keys, a 64-hex canonical project revision, and every declared assertion for every official pack. Direct callers must supply `validateEvidence`; omitting it fails every assertion with `evidence-validation-missing`, so a non-empty path string is never structural proof by itself. The CLI command is `npm run verify:genre-packs -- <assertion-receipts.json> <serialized-project.json>`; it canonicalizes and hashes the deserialized project, requires each evidence path to resolve to a regular JSON file beneath `evidence/`, `output/evidence/`, or `.omo/evidence/` (including realpath containment), validates `{schemaVersion,packId,assertionId,projectRevision,status}`, and sets final `ok` only when both evidence verification and the actual project readiness matrix pass. A path string, screenshot volume, or valid assertion files for a blank project cannot turn the gate green.
- `browser-verify:genre` addresses cards by stable `data-pack-id`, requires the exact official five without missing/extra/duplicate ids, and requires each click to detach the welcome DOM. Featured first-screen posters are monster-collect / story-cutscene / adventure-jrpg; horror-chase and farm-life live in the collapsed more tier, so the script expands that tier before clicking a hidden pack. `partner-raise` is only a welcome variant of `monster-collect`; it is never a sixth official pack. Diagnostic screenshot quantity is not part of the verdict.
- `play_walkthrough` publishes one provider-safe object schema with all optional variant fields and no `oneOf`/`anyOf`. `runWalkthrough` strictly validates each `do` / `expect` variant, required types, allowed fields, and mixed shapes before running step zero. A `kind`-shaped step or a choice step carrying map fields fails with a `scenario[index]` reason and `stepsRun: 0`.
- Record the exact command run.
- Capture pass/fail output or a short log excerpt.
- For UI/e2e work, include the tested route and scenario.
- If a test is skipped or flaky, say why and what remains unverified.


## Event-editor trust-loop validation (2026-07-30)
- This repository pins `vitest` exactly to `3.2.4` in both `package.json` and `package-lock.json`. In the current Windows/Node toolchain, Vitest 4.x fails before test collection with runner/config initialization errors; do not loosen or upgrade this pin without separately proving the full gate. Focused invocations use `--configLoader runner`.
- Event draft/editor changes should run `npm run typecheck:app` plus: `npx vitest run test/eventDrafts.test.ts test/eventDraftVault.test.ts test/eventDraftValidator.test.ts test/eventBeginnerTemplates.test.ts test/eventTestSandbox.test.ts test/eventEditorTrustLoop.test.ts test/selectedEventTestModal.test.ts --configLoader runner`.
- Required assertions are canonical projection while editing, crash/replace recovery, Cancel rollback, Apply/OK/Test fatal blocking, recursive nested validation and navigation, safe record-backed beginner templates, newest-first recents and roving tabs, focus/caret/details/scroll restoration, sandbox-only selected draft injection, deterministic spawn, real `initialEventTestId` player wiring, and zero `store.flush()` calls on the selected-event path. Follow with `npm run gates`, `npm run build`, and a practical browser smoke for merge-ready UI work.

## 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)

- 게이트: `npx playwright test test/e2e/event-face-command-visual.spec.ts` + `npm run gates:css`(graph 고아 0건, 예산 래칫 회귀 0건).
- 이 스펙이 잡는 것은 **얼굴이 두 장 겹쳐 보이는** 회귀다. `facesetPreview.faceImage()` 는
  얼굴 상자에 `--face-url` CSS 배경(로드 실패 폴백)을 깔고 그 안에 실제 `<img>` 를 넣는다.
  두 규칙(`<img>` 절대 배치 + 배경 끄기)을 담고 있던
  `event-editor.command-preview/07-identifiable-previews.css` 가 **어떤 배럴에도 @import 되지
  않은 고아 파일**이라 `<img>` 가 `position:static` 원본 크기(48×48)로 흘러가고 배경은 상자
  전체(96×96)에 `contain` 으로 깔렸다. 실측: 얼굴 상자 115개 중 114개가 이중 페인트.
- 계약 3줄: (1) `<img>` 가 있으면 상자의 computed `background-image` 는 `none`,
  (2) `<img>` 는 `position:absolute` 로 상자 내부를 정확히 채운다, (3) `<img>` 를 떼면
  배경 폴백이 되살아난다. 배경/`<img>` 를 **같은 크기로 맞추는 것만으로는 부족하다** —
  nearest-neighbour 래스터화 결과가 미묘하게 달라 배경이 테두리에서 1px 새어나온다.
- 대비는 computed 색이 아니라 **렌더된 픽셀**로 본다. `.ecp-message-window` 가 불투명
  `--bg-surface` 층을 어두운 유리 색 위에 깔고 있던 동안 computed 대비는 17.8:1 로
  보였지만 실제 페인트는 #FFF6E2 on #F7F8F8 = **1.0:1** 이었다.
- 배경/전경 층 순서를 만질 때는 `.ecp-message-window` 를 공유하는 문장 표시·선택지·문장
  표시 설정 미리보기도 같이 눈으로 확인한다.

## P2 spatial focused gate (2026-08-25)

- Schema/legacy/roundtrip: `test/p2SpatialSchema.test.ts`.
- Atomic economy, collision, move/upgrade/rotation/removal: `test/p2SpatialTransactions.test.ts`.
- Save writer, wire parser, direct checkpoint, explicit-empty and omitted-legacy behavior: `test/p2SpatialPersistence.test.ts`.
- Definition/placement FK, footprint collision, repair, map cascade and delete guards: `test/p2SpatialReferenceIntegrity.test.ts`.
- Database CRUD/navigation and runtime visibility: `test/p2SpatialEditorAuthoring.test.ts`, Database sidebar suites, and `test/p2SpatialRuntimeUi.test.ts`.
- Root integration performs real browser QA at 1024x768 and 1440x900 using `db-tab-farm-spatial`, `db-spatial-workspace`, `db-spatial-hero-image`, CRUD testids, and `life-ledger-tab-spaces`. This isolated implementation does not claim browser evidence.

## 대화창 연출 focused gate (2026-08-30)

연출의 실패는 **조용하다.** 예외도 콘솔 경고도 없이 "아무 일도 일어나지 않는" 정상 화면이 되므로
스크린샷으로도 구분되지 않는다. 그래서 판정 경로를 세 층으로 나눠 둔다.

- `test/dialoguePresentation.test.ts` — 순수 프로파일 표. 알 수 없는 `emotion` → `neutral` 폴백,
  감정별 성격(슬픔은 느리게, 분노·놀람은 빠르게), `reducedMotion` 이 흔들림·per-char 는 끄고
  스크림·타이핑 배율은 남기는 것, 그리고 **모든 지속시간이 `dialoguePresentationCssVars` 에 실려 나가는지**.
  마지막 항목이 `battleTransition.ts` 식 TS/CSS 값 어긋남(close 260 vs 190)의 회귀 게이트다.
- `test/dialoguePresentationCss.test.ts` — `src/styles/dialogue.css` **텍스트**를 직접 읽는다.
  ① 참조하는 모든 `animation-name` 에 실제 `@keyframes` 가 있는지(클래스만 붙고 죽은 모션 탐지),
  ② TS 가 심는 `--dialogue-*` 전부에 `:root` 폴백이 있는지(없으면 `animation-duration` 이 0s 로 떨어진다),
  ③ `dialogue-box-*` keyframes 가 `scaleX`/등방 `scale()` 을 쓰지 않는지,
  ④ reduced-motion 안전망 선택자가 `[data-dialogue-emotion]` 을 물어 감정별 규칙(특이도 0,3,0)을 이기는지.
  ①③④ 는 다른 어떤 검사로도 잡히지 않는다.
- `test/dialogueTextRenderer.test.ts` — 증분 본문 렌더러. 핵심은 **노드 동일성**이다.
  전량 재생성으로 되돌아가면 글자별 CSS 애니메이션이 매 틱 되감기는데, 그 회귀는 화면으로도
  computed style 로도 보이지 않는다("매번 처음부터"인 동안에도 계속 재생 중으로 읽힌다).
  노드가 유지되는지를 직접 재는 것만이 판정이다. `test/dialogue.test.ts` 에 **배선**까지 확인하는
  같은 단정이 하나 더 있다 — 렌더러만 멀쩡하고 `dialogue.ts` 가 옛 경로로 돌아가는 경우를 잡는다.
- `test/dialogue.test.ts` — 생명주기. `schedule` 을 주입해 fake timer 없이 결정적으로 검사한다
  (세션 첫 창만 진입 재생, `close()` 는 연출 후 비움 / `hide()` 는 즉시 컷, 연출 상태가 `resetOverlay` 의
  className 통짜 대입에 지워지지 않음). **타이핑 타이밍 기대값(24ms·159ms 단위)은 손대지 않는다** —
  진입 연출은 타이핑과 동시에 도는 순수 시각 효과라서 `startPage(0)` 시점이 바뀌지 않는다는 증거다.
- `test/e2e/dialogue-presentation-motion.spec.ts` — 실제 브라우저의 `getComputedStyle`.
  위 세 층이 다 통과해도 화면에서 죽을 수 있는 경우(특이도에 밀림, `var()` 무효, keyframe 이름 어긋남)를
  여기서만 잡는다. 두 가지 함정 대응이 스펙에 박혀 있다:
  - 진입 연출은 140~260ms 뒤 `phase="shown"` 이 되며 `animation` 선언 자체가 사라진다. 폴링으로는
    못 잡으므로 `addInitScript` 의 **MutationObserver 로 상자 삽입 순간**의 계산된 스타일을 낚아채 둔다.
  - 트리거는 `{kind:"auto"}` 이벤트를 쓴다. 실행 히트박스 클릭에 의존하지 않는다 —
    `runtimeDom.ts` 의 `upsertEventMarker` 는 **마커를 처음 만들 때만** 클릭 리스너를 붙이는데
    `playSceneAutonomous.ts:99,179` 는 `onActivate` 없이 같은 함수를 부른다. 자율이동 경로가 마커를
    먼저 그리면 그 마커는 영구히 클릭이 안 먹는다. 클릭 기반 대화 e2e 가 원래 불안정한 이유다.
- `test/playerRuntimeCss.test.ts` 의 `REQUIRED_RUNTIME_SELECTORS` 에 `dialogue-box-enter`/`-exit`/`dialogue-char-enter`
  를 넣어 둔다. 에디터 테스트플레이는 에디터 CSS 가 같이 로드돼 정상으로 보이므로, **익스포트 플레이어에
  규칙이 실렸는지는 실제 vite 빌드를 돌리는 이 검사만 판정한다.** 이 검사는 `cwd` 기준으로 설정을 읽으므로
  워크트리 안에서 직접 돌려야 한다(위 "워크트리에 `node_modules` 가 없을 때" 참고).
- 스크림은 e2e 에서 **의사요소를 직접 읽어야** 보인다. 디밍은 `::before`, 플래시는 `::after` 에 있어서
  요소 자신의 계산된 스타일에는 아무것도 안 잡힌다 — `getComputedStyle(scrim, "::before")` 를 쓴다.
  스크림 사각형이 오버레이와 같은 좌·우·아래를 갖는지도 같이 잰다(같은 `playSurface.css` 규칙이 둘의
  크롭 inset 을 맞춘다). **크롭 정합은 익스포트 플레이어(`surfaceScaleMode: "integer"`)로 실측했고
  결론은 "따라갈 크롭이 없다" 다** (2026-08-30, `npm run qa:runtime -- --scenario dialogue` 게이트 통과 +
  같은 하네스로 기하 측정): 1024×768 / 논리 320×240 에서 `--play-crop-*` 이 네 변 모두 `0px` 이고
  `.dialogue-scrim` 사각형이 `.play-stage` 와 **완전히 같다**(32,24 부터 960×720). 정수 배율은
  `Math.floor(containScale)` 이라 무대가 뷰포트를 넘을 수 없어서(`playSurfaceScale.ts:39`) 남는 여백은
  레터박스이고 `.play-stage` **밖**이다 — 스크림이 잘려 나가는 띠를 칠할 경로가 애초에 없다.
  `playSurface.css` 의 inset 목록에 든 것은 cover/crop 모드가 생길 때를 위한 대비다.
  측정 함정 하나: 디밍은 `--dialogue-scrim-ms`(140~260ms) 전이라서 창이 뜬 **직후**에 읽으면
  `::before` opacity 가 `0.26` 처럼 중간값으로 잡힌다. 정착값을 볼 거면 400ms 쯤 기다려라.
- `test/eventPreviewPaintCssom.test.ts` — 명령 미리보기 페인트. Chromium `getComputedStyle` 로 이름표 `backgroundImage`/그림자 리스트를 읽고, 글자만 `color: transparent` 로 숨긴 샷과 비교해 글리프 대 실제 배경(그라디언트 포함) 대비를 잰다. 테두리·그림자를 전역 min/max 로 통과시키지 않는다. `EVENT_PREVIEW_PAINT_FROM=HEAD` 는 수정 전 CSS 를 `git show` 로 주입한다.
- `test/dialoguePreviewPresentationCss.test.ts` — 에디터 프리뷰와 게임의 감정→keyframe 짝을
  두 CSS 파일에서 뽑아 대조한다. 프리뷰 창은 `.ecp-message-window`, 게임 창은 `.dialogue-box` 라
  규칙을 두 번 적어야 하고, 그 중복은 조용히 어긋난다 — 프리뷰만 옛 곡선으로 튀어도 예외가 없고,
  프리뷰가 존재 이유("게임에서 이렇게 보인다")를 거짓말한다. keyframes 정의는 복제하지 않고
  `dialogue.css` 것을 그대로 부르므로 그 파일이 에디터 그래프에 실려 있는지(`index.css` →
  `runtime/playerRuntime.css` → `../dialogue.css`)도 같이 본다. 사슬이 끊기면 규칙은 남고
  애니메이션만 사라진다.
- `test/dialoguePresentationAuthoring.test.ts` — 저작 UI. ① 「말투·연출」이 접힌
  `event-command-text-advanced` **밖에** 있는지(안에 있던 동안은 아무도 안 썼다. 되접히면 기능이
  다시 안 보이게 죽는다), ② 프리뷰가 **연출이 바뀐 호출에만** `data-dialogue-phase="enter"` 를
  붙이는지. ②를 놓치면 프리뷰가 본문 한 글자마다 통째로 다시 그려지므로 창이 타자마다 튀어
  **글을 쓸 수 없다** — 기능이 아니라 편집이 망가지는 회귀라서 화면 없이 여기서 잡는다.
- `test/e2e/dialogue-nameplate-clears-body.spec.ts` — **겹침은 기하라서 위의 어느 층도 못 잡는다.**
  이름표는 `position: absolute; top: -9px` 로 창 위 변에 걸친 탭이고 본문이 비켜 주는 자리는
  `.dialogue-box.has-speaker` 의 `padding-top` 뿐인데(`src/styles/TOKENS.md` 가 "본문과 겹치지 않도록
  함께 조정한다"고 적어 둔 짝), 두 값을 각각 손으로 적어 두면 서로를 모른다. 실측 2026-08-30 에
  이름표 높이 19px · top −9px 라 아래 변이 10px 지점인데 padding 은 8px 이어서 **본문 첫 줄이 2px
  덮여 있었다**(글자 윗부분이 잘려 보인다). 두 선언은 각각 유효하므로 계산된 스타일 단정은 통과하고,
  jsdom 은 레이아웃이 없어 높이가 전부 0 이라 단위 테스트도 통과한다 — 그래서 이 결함은 CSS 텍스트
  검사와 단위 테스트를 **모두 통과한 채로** 살아 있었다. 고친 방식은 상수 교체가 아니라
  `dialogueSpeakerInsetPx()` 로 이름표를 재서 여백을 정하는 것이다(바로 옆 `dialogueMaxLines` 가 줄
  수를 상수로 박지 않는 것과 같은 이유). 측정은 `offsetTop`/`offsetHeight` 로 한다 — 무대가
  `--play-scale` 로 확대되므로 `getBoundingClientRect()` 는 배율이 섞인 화면 px 를 주고, 그 값을
  padding 으로 심으면 배율만큼 부풀어 본문 칸이 사라진다.

## 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)

- `playwright.config.ts` 의 `webServer.command` 는 `npm run dev -- --port <DEV_SERVER_PORT>` 인데
  `npm run dev` 스크립트가 `--port 9999 --strictPort` 를 하드코딩한다. 메인 세션이 9999 를 점유하면
  vite 가 즉시 죽고 지정 포트에는 아무것도 LISTEN 하지 않는다 → 모든 스펙이 `edit-canvas` 를 못 찾는다.
  타임아웃을 15s→120s 로 늘려도 똑같이 실패하므로 "머신이 느려서" 로 오진하기 쉽다.
- 판별: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/` → `000` 이면 서버가 없다.
- 회피: `DEV_SERVER_NO_TLS=1 npm run dev:worktree -- --port <free>` 로 직접 띄우고
  `DEV_SERVER_PORT=<free> npx playwright test ...` 로 실행한다(`reuseExistingServer: true`).
  포트는 `ss -tlnp` 로 실측해서 고른다 — `wt create` 가 배정한 포트도 이미 점유돼 있을 수 있다.
- 브라우저 QA 중에 다른 에이전트가 `src/` 를 편집하면 HMR 리로드가 끼어들어
  `ERR_NETWORK_CHANGED` 가 쏟아지고 편집기 부팅이 깨진다. 소스가 조용할 때 브라우저 증거를 잡아라.

### `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)

Playwright 의 `locator.click()` 은 누르기 전에 `scrollIntoViewIfNeeded` 를 한다. **사람은 화면 밖이라 못 누르는 버튼도 테스트는 스크롤해서 누른다.** 그래서 "클릭 성공"은 그 버튼이 보인다는 증거가 되지 못한다. DB 구조물 탭의 `[편집]` 이 화면 밖 67px 에 있었는데 e2e 가 초록불이었던 이유가 이것이다.

- 판정은 **좌표로** 해라: `scroller.scrollTop = 0` 으로 되돌린 뒤 `getBoundingClientRect()` 를 재고,
  `document.elementFromPoint(중심)` 이 그 버튼(또는 그 자손)인지 본다. 그리고 `scrollHeight - clientHeight === 0`(스크롤 여지 없음)을 함께 확인한다. 마지막 증명은 `page.mouse.click(좌표)` — 이건 자동 스크롤을 거치지 않는다.
- `toBeVisible()` 도 부족하다. Playwright 의 "visible" 은 `display`/`visibility`/크기만 보고 **조상의 `overflow` 로 잘렸는지는 보지 않는다.**
- **접두사가 겹치는 testid 를 `^=` 로 잡지 마라.** `[data-testid^="structure-kit-edit-"]` 는 `structure-kit-editor`·`-editor-close`·`-editor-canvas` 까지 다 잡아 strict 위반이 난다. 컨테이너 클래스로 좁혀라(`.structure-kit-actions [data-testid^=...]`).
- **탭 전환은 헤딩 가시성으로 확인하면 안 된다.** DB 사이드바 탭을 누른 직후 초기화 경합에 밀려 `activeTab` 이 기본값으로 되돌아가는 것을 실측했다(구조물 → 파티). 공용 헬퍼 `switchDatabaseTab`(`test/e2e/oprn-database-helpers.ts`)을 써라 — 그룹을 순회해 찾고 **탭 버튼의 `.active`** 까지 확인한다. 그룹 슬러그를 직접 박아 넣으면(`db-tab-group-map` 같은 존재하지 않는 값) 헬퍼가 통째로 죽어도 아무도 모른다.
- **점 한 번 찍는 `count() > 0` 은 렌더 경합에 진다.** 다이얼로그가 그려지기 전에 0 을 읽고 그냥 지나쳐 버린다. `expect(async () => {...}).toPass()` 로 감싸라.
- 케이스마다 앱을 통째로 부팅하는 스펙은 `--workers=1` 로 돌려라. 병렬로 겹치면 다운로드 이벤트·다이얼로그 렌더가 밀려 간헐 실패한다(실측: 병렬 2건 실패 → 직렬 4건 전부 통과).

### 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)

`scrollHeight > clientHeight` 가 참이어도 **넘친 내용의 시작 쪽은 스크롤로 닿지 않을 수 있다.** `place-content: center` / `align-items: center` 인 스크롤 칸에서 자식이 칸보다 크면 위·왼쪽으로도 넘치는데, 스크롤 원점이 콘텐츠 박스 시작이라 그 위쪽은 영구히 가려진다. 실측: 200×100 칸에 300px 자식 → `center` 는 `scrollHeight` 200(100px 유실) + `scrollTop=0` 에서 자식 top 이 칸 top 보다 **99px 위**, `safe center` 는 `scrollHeight` 300 + top 1.

- 판정 스니펫: `const t = box.scrollTop; box.scrollTop = 0; const gap = child.getBoundingClientRect().top - box.getBoundingClientRect().top; box.scrollTop = t;` — `gap` 이 음수면 그만큼 못 닿는다.
- `scrollHeight` 를 콘텐츠 실제 크기와 대조하는 것도 같은 결함을 잡는다(40칸×16px = 640 이어야 하는데 589 가 나오면 잘렸다).
- 고침은 `safe` 키워드. 크로미움 115+ / 파이어폭스 129+ / 사파리 17.6+ 이고 이 저장소 플레이라이트 크로미움에서 `getComputedStyle(...).alignContent === "safe center"` 로 지원을 확인했다.

### 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)

`background: var(--없는토큰)` 은 대체값이 없으면 **계산값 시점에 선언 자체가 무효**가 되어 초기값(`transparent`)으로 떨어진다. 콘솔 경고도, devtools 취소선도 없다. 구조물 편집기 다이얼로그가 배경 없이 떠서 뒤의 DB 표가 뚫려 보이던 원인이 이것이고, `--oprn-*` 60개 중 23개가 이 상태였다.

- 확인은 **계산값으로** 해라: `getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)"` 이면 죽은 선언이다. 소스 CSS 를 읽어서는 알 수 없다.
- `npm run gates:css` 의 `undefinedVars` 지표가 이걸 센다. 숫자가 줄면 죽은 선언을 살린 것이다.

### `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)

- 증상: `page.goto` 는 성공했는데 화면이 **완전 백지**이고 aria 스냅샷이 비어 있다. 콘솔에 앱
  에러는 없고 `net::ERR_NETWORK_CHANGED` 만 모듈 요청 수십 개에 붙는다. `edit-canvas` 대기가
  120s 까지 늘려도 실패한다 → "머신이 느리다" / "앱이 깨졌다" 로 오진하기 쉽다.
- 원인: 크로미움은 OS 네트워크 변경 알림(리눅스 netlink)을 받으면 **진행 중인 요청을 전부 취소**한다.
  알림이 요청별이 아니라 프로세스 전역이라 `127.0.0.1` dev 서버 접속까지 함께 죽는다. 이 박스에서는
  **도커 브리지가 오르내리는 것**(`ip -br link` 에 `br-*` 가 `NO-CARRIER` 로 뜬다)이 방아쇠였다.
  다른 에이전트가 컨테이너를 띄우거나 내리는 동안 e2e 가 돌면 재현된다. HMR 과 무관하게 발생한다.
- 판별: `ip -br link | grep NO-CARRIER` 로 흔들리는 인터페이스를 확인한다. dev 서버는 정상
  (`curl` 200)인데 브라우저만 백지면 이쪽이다.
- 회피 1: `gotoWithRetry`(#154, `test/e2e/oprn-database-helpers.ts`)를 쓴다 — 전송 계층 중단을
  한 번 재시도한다. 계약은 `test/e2e/goto-retry-network-change.spec.ts` 가 고정한다.
- 회피 2: 인터페이스가 계속 흔들리는 동안에는 **파이어폭스로 돌린다.** 파이어폭스는 그 알림에
  반응하지 않는다. 스펙 파일 맨 위에 한 줄이면 된다:
  `test.use({ browserName: "firefox", viewport: { width: 1600, height: 1000 } });`
  프로젝트 이름은 그대로 `[chromium]` 으로 찍히지만 실제 엔진은 파이어폭스다 — 로그 라벨을
  근거로 "크로미움에서 통과했다" 고 보고하지 말 것. 파이어폭스 바이너리가 없으면
  `npx playwright install firefox` 로 받는다.
- 실측 사례: DB 사이드바 레일 작업(#160)에서 크로미움으로 두 번 연속 백지가 나 증거를 못 잡았고,
  파이어폭스로 바꾸자 같은 트리에서 즉시 통과했다. 그 스펙은 지금도 파이어폭스로 돈다.

## 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)

### 메뉴 적대적 플레이 회귀 (2026-09-05)

`npm run qa:runtime:gate -- test/runtime/status-menu-adversarial.spec.ts`는 출하 player 서버에서 실제 키보드로 결정/취소 유지, 아이템 소모, 상태 부여·씨앗·스위치 작동, 저장→로드→재저장, 타이틀 복귀, 오류 후 뒤로를 검사한다. 640×480·960×720·1280×800에서 불러오기 창의 stage 비율과 화면 안 배치를 잰다. fixture는 기존 테스트 프로젝트의 메모리 사본에 최소 아이템 계약만 넣으며 원격 게임을 저작하지 않는다. 결과는 `verify-shots/runtime-qa/status-menu-adversarial/SUMMARY.md`를 먼저 읽는다.

스펙은 기본 런타임 프로젝트의 브라우저를 따른다. 공유 호스트의 Chromium `ERR_NETWORK_CHANGED`로 부팅이 끊긴 이번 검증은 실행용 Playwright 설정에서 Firefox를 선택했다. 호스트 우회를 위해 스펙에 브라우저를 하드코딩하지 않는다. 실패 시 worker가 beforeAll을 다시 실행하므로 SUMMARY는 전체 실행의 유일한 성공 집계가 아니다. 실행 종료 코드와 테스트 리포트를 함께 확인한다. 비활성 대상은 button이 아닌 div로 렌더될 수 있어 `toBeEnabled()`만으로는 부족하다. 실제 BUTTON 여부와 사용 후 수량·저장 스냅숏의 효과를 함께 단정한다.

게임 화면을 브라우저로 QA 할 때 **편집기 셸을 통과하지 마라.** `npm run qa:runtime`
(반복) / `npm run qa:runtime:gate` (게이트). `player.html` 을 전용 vite 서버로 띄워
편집기 크롬 0, HMR 유지, 출하 shim 경로를 그대로 통과한다. 편집기 play 모드는 실제
`@/project/store`, 내보내기 플레이어는 `exportProjectStoreShim` 을 쓰므로 **편집기
경로로 하는 런타임 QA 는 출하물을 검증하지 않는다.**

좁은 예외는 `scripts/qa/testplay-recovery-browser-qa.mts` 하나다. 편집기 **테스트 플레이**
경로의 게이트라 편집기 셸을 통과한다. 결함이 톱바 `mode-play` 뒤의 저장·예비검사·복구 흐름에
있어 `player.html` 로는 진입할 수 없기 때문이다. 살아 있는 WebGL 캔버스를 `drawImage` /
`getImageData` 로 다시 읽으면 플레이 중에도 `distinct=1` 이므로 색 다양성은
`scripts/lib/runtimeQaRun.mjs:435` 처럼 pngjs 로 스크린샷 PNG 를 읽어 잰다.
`test/fixtures/projects/battle-v3.json` 은 거의 검으므로 렌더 여부 판정에는
`editor-authored-demo-v3.json` 을 쓴다.

- 결과는 `verify-shots/runtime-qa/<시나리오>/SUMMARY.md` 를 **먼저** 읽고 "즉시 확인" 으로
  표시된 PNG 만 열어라. `shot` 은 옵트인이고 실패 비트는 자동 캡처된다. 출력 디렉터리는
  매 실행 재생성되며 gitignore 대상이다.
- 시나리오는 `scripts/qa/runtime/<name>.scenario.mjs`. 좌표 기대치는 추측하지 말고
  `scripts/_dump-event-tiles.mjs` 로 실물에서 읽어라.
- **소리는 스크린샷에 안 잡힌다 — `expect.audioObservedIncludes`** (2026-09-04). 오디오 엔진이 재생 지시를
  받은 리소스 id 를 `window.__oprnAudioObserved`(`src/player/audio/audioEngine.ts`)에 쌓고,
  `runtimeQaRun.mjs` 가 버트번 `audioObserved` 로 읽어 온다. 관측 배열이 없으므로(훅 설치 전) 실패다.
  첫 사용자는 `chest-open` 시나리오 — 픽스처는 `scripts/qa/runtime/chest-open-fixture.mts` 가 **실물
  `place_chest` 도구로** 굽는다(`npx vite-node --script … --out /tmp/chest-open.json` 다음
  `--project /tmp/chest-open.json`). 개방 SE·아이템 징글·동전 SE 세 개가 도달하고 `gold` 0→50, 열린 상자
  프레임이 03 샷에 남아야 통과다. 대사청 스크린샷은 타자기 첫 글자에서 잡힐 수 있다 — 문장은
  유닛 테스트(`test/placeChestSavepoint.test.ts`)가 재고 하네스는 소지금·오디오·프레임을 재다.
- 체공(점프·낙하) 시나리오와 그 전용 op/expect 는 위 "체공 런타임 QA" 절에 있다. 거기서
  얻은 일반 교훈: **오브젝트가 존재한다는 검사는 그것이 그려졌다는 뜻이 아니다.**
- **`testidPresent` 만 쓴 비트는 이빨이 없다** (2026-08-30 실측). `item-care`·`item-equipment`
  가 그 상태였다 — 비트 note 는 "친밀도 70 을 확인한다 / 78 로 오른다" 라고 적어놨는데 기대치는
  노드 존재뿐이라, 돌봄이 친밀도를 커밋하지 않아도 통과했다. 숫자를 말하는 비트에는 반드시
  `expect.visibleText` 를 걸어라. 이빨은 기대값을 일부러 틀리게 넣어 확인한다(실측: `친밀도 78`
  → `친밀도 99` 로 바꾸면 종료 코드 1 + `실제 "돌봄 슬라임Lv.3 친밀도 78"`).
- `visibleText` 는 **시나리오가 이름을 적은 testid 만** 관측한다(`runtimeQaRun.mjs` 가 모든 비트의
  키를 모아 watched 목록을 만든다). DOM 문자열을 모를 때는 센티넬(`"@@PROBE@@"`)로 한 번
  실패시키면 실패 메시지가 실제 텍스트를 그대로 찍어준다. 단 **실패한 비트는 관측 시점이 밀릴 수
  있다** — 센티넬 실행에서 읽은 전투 피해값은 한 턴 뒤 값일 수 있으니, 수치는 통과하는 실행의
  스크린샷으로 확정하라.
- 전투에서 `visibleText` 축으로 쓸 수 없는 노드가 있다: `battle-enemy-list-hp-enemy-1` 은
  rm2003 스킨에서 rect 가 0×0(텍스트는 `HP 830/999` 로 들어 있는데 화면에 없다고 판정),
  `battle-damage-popup` 은 관측 순간 alpha 0 인 프레임이 있다. 믿을 축은 `battle-message-window`.
- **A/B 픽스처 비교에서 피해 숫자를 축으로 박지 마라.** 값이 픽스처마다 다르므로 한쪽이 반드시
  깨진다. 픽스처와 무관하게 성립하는 문장(`주인공의 공격!`)을 축으로 쓰고, 숫자 차이는 보고서에서
  두 실행을 비교해 읽는다. 숫자 자체는 같은 픽스처·같은 시드에서 반복 재현된다(실측: 레이피어
  3회 전부 급소 195/162, 채찍 2회 전부 34/49) — 단 지도·전투 인접 코드가 바뀌면 값이 움직인다.
- 전투 주스가 맵을 드러내는 회귀는 `test/runtime/battle-flash-map.spec.ts` 가 잠근다. 같은 QA
  서버로 `player.html` 을 띄워 `battle-v3.json` 시작 맵(0,0) 오른쪽 `battleProcessing` 이벤트로
  **실전투 DOM** 에 들어간 뒤, 한 번의 rAF 샘플 시리즈에서 세 가지를 같이 본다: 루트
  `background-color` 알파 == 1, `.battle-field::after` 오버레이 알파 > 0(플래시가 사라지지
  않았다는 증명), 루트 `transform` 의 translate 성분 == 0. 알파를 **클래스 부착 지속 시간에
  기대어 재지 마라** — 런타임은 `setTimeout` 으로 클래스를 떼므로 판정이 그 뒤로 밀리면
  오버레이가 `rgba(0,0,0,0)` 으로 읽힌다(실측으로 버진 경합). 샘플러는
  `getAnimations().playState` 가 running 인 동안만 돌고 스스로 멈춘다.
- 누출은 필드가 백드롭 이미지로 닫혀 있어서 **필드-HUD 4px 거터와 HUD 패널 사이**에서 가장
  자명하다. 새 증거를 모으려면 30x30 마을 프로젝트(`editor-authored-demo-v3.json`, 시작 맵
  `ev_lantern_training` 이 (20,14))로 띄우면 뒤에 새는 타일이 눈에 보인다. RED/GREEN 실측은
  `.omo/evidence/battle-flash-map/` 에 있다.
- 시나리오는 `query` 로 `player.html` 쿼리를 붙일 수 있다(예: `{ e2eVitals: "1" }` → 액터
  바이탈 훅 `__oprnSetActorVitals` 개방). `setVitals` op 은 그 훅으로 파티 전원(또는
  `actorIds`)의 HP/MP 를 세운다. `expect.battleResult` 는 `session.battleResult` 를 대조한다.
- `battle-defeat` 시나리오가 전투 패배 → 게임 오버 결말의 실기 증거다. 파티를 HP 0 으로
  만들어 전투 개시 시점에 `defeat` 을 확정시킨다 — **검증 대상이 전투 산식이 아니라 호스트의
  패배 처리 경로**이기 때문이다. HP 1 로는 패배가 재현되지 않았다(`battleDamage.ts:175` 는
  `power + floor(atk/2) - floor(def/2) <= 0` 이면 데미지 0 → 약한 적 앞에서 1 HP 파티가
  무적이 되고, 실측에서 레벨 1 파티가 108HP 트룹을 이겨 `battleResult=victory` 가 찍혔다).
- `battle` 시나리오는 `map_moonwell_forest` 의 봉인 이벤트(14,2 · `movement: fixed`)로
  `troop_forest_hornets` **3마리 전투**에 들어가고, `battlerGeometry` 기대치가 실브라우저
  rect 로 배틀러 배치를 판정한다(적 이미지가 필드 안에 온전히 있는지 + 발이 백드롭
  지평선 33% 아래인지). CSS 레이아웃은 jsdom 으로 재현되지 않으므로 이 기하는 실브라우저
  측정만이 근거다. 12종 스킨 전수는 `system.battleUiStyle` 만 바꾼 픽스처 사본에
  `--project` / `--out` 을 붙여 같은 시나리오를 돌려서 본다.
- `battlerGeometry` 는 네 축이다: 필드 담기 · 발이 지평선 아래 · 스프라이트 크기 0 아님 ·
  **적끼리 겹침 아님**. 겹침 축이 없던 동안 rm2000/dragonquest/mv 가 3마리를 한 점에 겹쳐
  그리면서 통과했다 — 담기·지평선만 보면 "완전히 겹친 한 덩어리"가 정답으로 보인다.
- 스윕은 스킨마다 서버·브라우저를 새로 띄운다. **도는 중에 `git stash` 같은 트리 변경을 하면
  안 된다** — 실측: 스윕 중 stash 로 ff 런이 "전투가 시작되지 않았다"로 죽었다(내 변경이
  사라진 트리를 읽었다). 결과가 오염되면 그 스킨만 다시 돌려라.

함정 (전부 실측):
- `vite.player.config.ts` 는 `publicDir: false` 다. 그대로 dev 서빙하면 번들 텍스처
  (`assets/easyrpg-*.png`, `public/assets/` 34개)가 전부 404 → **조용한 검은 스크린샷**.
  `vite.player-qa.config.ts` 가 되살린다.
- 워크트리는 `node_modules` 를 메인 레포로 심링크해 `node_modules/.vite` 까지 공유한다.
  다른 config 로 서버를 띄우면 공유 캐시를 재최적화해 **남의 dev 서버를 죽인다**
  (`vite.config.ts:350-354`, 실측 3회). 반드시 전용 `cacheDir` / `VITE_CACHE_DIR`.
- `vite.config.ts` 의 `server.fs.allow` 는 `../rpg-zzu/node_modules`(구 형제 워크트리
  `rpg-zzu-*`)만 넓힌다. **`.claude/worktrees/*` 에서는 존재하지 않는 경로로 풀려 편집기
  dev 서버가 phaser 를 403 으로 막는다.** `realpathSync("./node_modules")` 로는 **부족하다**
  (2026-08-30 실측): 워크트리의 `node_modules` 는 디렉터리 자체가 실물이고 그 안의 패키지가
  하나씩 링크된 형태라 자기 자신으로 풀린다. 링크 **대상**의 부모까지 넓혀야 한다
  (`vite.player-qa.config.ts` 의 `fsAllowRoots()` 가 그 형태다).
- 고정 키 횟수로 대사를 소진하면 닫힌 뒤 남은 Enter 가 NPC 를 재발동시켜 선택지가 다시
  열린다. `pressUntil` op(매 입력 후 조건 확인)을 써라.
- **`__oprnDebug.teleport` 는 맵 비교를 세션 쓰기보다 먼저 해야 한다 (2026-08-28 수정).**
  이전 구현은 `applyAndSync` 로 `session.currentMapId` 를 먼저 갈아치운 뒤
  `getMapId() !== mapId` 를 비교해서 **`loadMap` 이 한 번도 호출되지 않았다** — 세션만 새 맵을
  가리키고 화면은 옛 맵을 계속 그렸고, `expect.mapId` 는 세션 값을 읽으니 그 거짓말을 통과시켰다
  (smoke 시나리오의 맵 전환 비트가 그 상태였다). 지금은 이전 mapId 를 캡처해 비교한다.
  같은 맵 안 재배치는 여전히 스프라이트를 옮기지 않는다(`loadMap` 을 부를 이유가 없다).
  밤의 괴물 체험 검토(2026-09-05)에서도 논리 위치만 통과하고 그림은 다른 위치인 설정을
  발견했다. 상호작용 화면은 실제 이동 후 `__oprnCharacterSprites().player`의 발 좌표와
  타일 좌표를 함께 확인한다. 이동 완료를 관측하기 전에 다음 걸음이 시작될 수 있으므로
  한 칸 준비 이동은 움직임 시작을 감지하면 방향 입력을 놓고 도착을 기다린다.
  맵 간 추격 QA는 teleport로 문 통과를 대신하지 말고 실제 전이→대기→재진입을 검사한다.
  스모크 비트 통과와 실내 구성·물체 식별·은신/밀기·연속 추격의 품질 판정은 따로 기록한다.
- `movement` 가 `fixed` 가 아닌 NPC 는 같은 세션 안에서 배회한다. 고정 좌표 인접을 전제한
  상호작용 비트는 취약하다.
- `__oprnPlayerSprite().resourceId` 가 채워져 있어도 `textureKey` 는 `__MISSING` 일 수 있다
  (Phaser 초록 와이어프레임). 게이트는 `playerSpriteTextureLoaded` 축으로 봐야 한다.
- `test/fixtures/projects/oprn-sample-v3.json` 은 플레이어 캐릭셋이 `__MISSING` 으로 그려진다
  (픽스처 4개 중 이것만, 같은 `resourceId`, 실패 요청 0건). 원인 미규명. 기본 픽스처는
  `editor-authored-demo-v3.json` 을 쓴다.

## sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)

- `src/testing/sceneTestRunner.ts` 는 추격(chase) 무버만 시뮬레이션하고 무작위·접근·사용자 지정
  페이지 이동은 굴리지 않는다. 그래서 `{ kind: "expect", eventAt: <원래 좌표> }` 는 NPC 가
  실제로 움직이든 안 움직이든 통과한다 — "안 움직인다" 류 회귀를 이 러너로 증명하지 말라.
  단위 레벨은 `test/runtimeEventPageMovement.test.ts`, 실물은 브라우저 Test Play 로 잡는다.

## fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)

`vitest.config.ts` 는 `environment: "node"` 라서 DOM 전역이 하나도 없다. `test/fakeDom.ts` 의
`installFakeDom()` 이 주는 것만 존재한다. 그 목록에 **생성자 전역 `Image` 가 빠져 있었다** —
`HTMLImageElement` 는 `instanceof` 용으로 매핑돼 있었는데(`defineDomGlobal("HTMLImageElement", FakeElement)`)
`new Image()` 가 쓰는 생성자는 없었다. 실측: 전체 스위트 오류 230건 중 **222건이
`ReferenceError: Image is not defined`** 였고, 발화점은 `src/editor/panels/chromaKey.ts:110`
(`getAutoKeyedDataUrl`) **한 곳**, 귀속 파일은 `databaseWorkbench`·`databaseFilterChips`·
`databaseRecordThumbnails`·`eventEditorTrustLoop` **4개**였다.

핵심은 스텁이 **무엇을 발화하는가**다. `getAutoKeyedDataUrl` 은 `load` 와 `error` 양쪽에서
resolve 하고 error 분기는 원본 URL 을 캐시·반환한다. 그래서 `FakeImage` 는 `src` 대입 시
`queueMicrotask` 로 `error` 를 **딱 한 번** 발화한다(`addEventListener` 가 `{ once: true }` 를
무시하므로 발화 횟수는 스텁이 보장한다). 아무 이벤트도 쏘지 않는 스텁을 넣으면 222건의 rejection 이
222건의 **무한 pending** 으로 바뀐다 — 오류가 타임아웃으로 옷만 갈아입는 셈이다. 계약 테스트:
`test/fakeDomImageGlobal.test.ts`.

Unhandled Rejection 은 그 순간 실행 중이던 아무 파일에 귀속되므로, 이 종류의 누락은
**비결정적 오귀속**의 원인이 된다. 새 브라우저 전역을 프로덕션이 쓰기 시작하면 `fakeDom` 의
`DomGlobalName` 유니온·save/restore 목록·`defineDomGlobal` 세 곳을 같이 늘려야 한다.

### Shared fake DOM enhancement contracts (2026-09-08)

Adding `insertBefore` enables the real event-editor custom-select controller; it
is not only a checklist capability. `HTMLSelectElement` identity must match the
SELECT tag (including directly constructed `FakeElement("select")`), never every
fake element. Single-select option state now covers direct options and optgroups,
index/value/selected synchronization, disabled defaults and invalid selections.
Collections are fresh arrays on access, not a complete live HTMLCollection API;
multi-select, layout and MutationObserver simulation remain outside this fake.

All insertion/replacement paths adopt nodes from their previous parent. Removal
and text/children replacement clear parent links; wrapper disposal must restore
exactly one select without leaving the dialog root in a wrapper. Keep the real
enhancement enabled. `fakeDomSelectContracts` exercises actual menu selection,
input/change bubbling, subscribed focus restoration, disposal and checklist row
identity. Happy DOM verifies supported reference operations; Firefox additionally
checks edge contracts where the installed Happy DOM differs (duplicate values,
option text/label, detached index, optgroup reordering and self replacement).
Fixtures selecting an ID must create the actual option/record first; the focused
weighted-branch fixture now creates its `roll` variable without changing assertions.

`aiChatObservability` distinguishes the `REQUEST_COVERAGE_AUDIT` sentinel from
intent JSON and streams. Manual chat retains drafts until settlement: the bounded
acceptance-repair execute requests are non-streaming JSON. Reply with valid audit
requirements linked to the original request and count execute requests separately;
do not answer audits with intent JSON or reject execute requests as bad streams.
Subscribe before Send to transport, session and post-apply refresh events, plus
terminal activity. Preserve the actual ghost bounds, single apply and cleanup
assertions. The 10-second terminal deadline is unchanged; no polling or retries
were added to tests. Exact red traces and focused/affected evidence are in
`output/evidence/acceptance-live-fakedom-repair/`; the final full gate is lead-owned.

## bugfix-sweep 실제 표면 하네스 (2026-08-29)

`node scripts/qa-bugfix-sweep-evidence.mjs` 는 **프로젝트의 Vite SSR 모듈 파이프라인**으로
프로덕션 함수를 끝까지 실행해 관측값을 `.omo/evidence/bugfix-sweep/real-surface.txt` 에 남긴다.
검사 4건: 프로젝트 교체 후 Ctrl+Z / 묶음 조건 안 스위치의 삭제 가드 / `inputNumber` 만 쓰는 변수의
prune 판정 / 명시적 초안 저장 뒤 중복 쓰기.

왜 vitest 가 아니라 별도 러너인가: 이 네 가지는 **한 흐름으로 이어 태워야** 사용자가 겪는 순서가
되고, 산출물이 사람이 읽는 증거로 커밋된다. 왜 `npx tsx` 가 아닌가: `supabaseProjectConfig()` 의
`env` 기본값이 `import.meta.env` 라서 tsx 에서 `undefined` 로 터진다 — Vite 파이프라인을 타면 앱과
같은 해석 경로가 된다. `createServer` 에 `watch: null` 을 준 이유는 워처가 시스템 inotify 한도를
넘겨(ENOSPC) 죽었기 때문이다(스위트와 동시에 돌 때 특히).

## 마을 설계서 (2026-09-05)

마을 설계서 집중 검증은 test/villageDesign.test.ts + databaseVillageView/villagePresetPreview/villageAuthoringData/villageBuilder다. 브라우저는 output/evidence/village-design에 실제 편집기 화면과 결과를 기록한다. 상세 계약과 경계는 [마을 설계서](village-design.md).


## 공포 제작 개정 QA와 개발 서버 전송 (2026-09-05)

`horror-authoring.md`의 전용 플레이어 probe와 `capture-horror-authoring.mjs`를 사용한다.
이 호스트의 네트워크 변경 이벤트로 Chromium의 loopback 모듈 요청이 `ERR_NETWORK_CHANGED`로
중단되었다. 두 캡처는 소유한 Vite URL만 Node fetch로 읽어 원본 응답을 전달한다.
엔진 코드는 그대로이며 게임 데이터는 원격에서 읽어 개정한 검토 스냅샷이다.
Chromium local network 검사만 캡처 실행 인자로 끈다. 일반 출하 설정은 바꾸지 않는다.
`vite.player-qa.config.ts`는 기존 파일 감시 비활성화에 맞춰 HMR도 기본 비활성화하며,
`PLAYER_QA_WATCH=1`이면 둘 다 다시 켠다. 실행 성공과 사람이 PNG를 본 시각 판정은 분리한다.

## 상점 진열 중심 편집 검증 (2026-09-05)

- `test/e2e/shop-command-fullscreen.spec.ts`: 실제 이벤트 피커에서 상점을 연다. 상품 추가창에서 전체 자료집의 마지막 행까지 도달하고 취소/일괄 추가/포커스 복원을 확인한다. 가격→계절→다른 상품→원래 상품, 거래 규칙→대사→거래 없음 분기→적용→재열기의 값을 검증한다.
- 1440×900, 1280×800, 1024×768의 실제 행·목록·적용 버튼 기하와 screenshot을 `output/evidence/shop-ux/`에 기록한다. 두 번째 시나리오는 중첩 추가창의 Escape가 부모 상점을 닫지 않는지와 탭 방향키/Tab 순환, 다른 명령의 wide 폭을 확인한다.
- 상점의 `shop-item-check-*`는 상품 추가창에서만 찾는다. 진열 목록은 선택 버튼(`shop-item-row-*`)이다. 기존 저작 시나리오는 `test/e2e/shopAuthoring.ts`의 `addShopGoods`를 사용할 수 있다.
- `event-view-toggle-list`는 role=tab, aria-selected 계약이다. `eventStoryboardPicker.showCommandList`도 이 속성을 검사한다.
- 표면 기준선의 최소 shop은 `item_potion`을 진열한다(`item1`은 captureProject에 없는 ID). 활성 상품 탭만 초기 DOM에 마운트되므로 form/interaction/commit 축의 shop 항목을 함께 캡처하며, 탭과 추가창의 설정 도달성은 위 단위·브라우저 시나리오에서 검사한다. 하한선·반응/no-commit 목록 변경은 별도 커밋으로 검토한다.
- Chromium의 `ERR_NETWORK_CHANGED`가 localhost 모듈을 취소하는 호스트에서는 `SHOP_QA_ROUTE_MODULES=1`을 추가한다. 소유한 baseURL의 GET 응답만 Playwright Node 전송으로 전달하며 앱 응답·편집 동작은 그대로다. 기본 실행은 일반 브라우저 전송을 사용한다.
## 실제 DB로 나가는 전체 검사 요청 (2026-09-05 실측)

- `.env.local`에 실 Supabase 키가 있는 상태의 전체 검사 중 `rpg-zzu-house-template-gallery`에 테스트 문구(`증발 위험 변경`, `마일스톤: 1차 제목` 등)가 저장되고 저작한 꾸러미가 다시 사라졌다. 여러 워크트리에서 동시에 전체 검사가 돌았으므로 어느 실행이 썼는지는 확정하지 못했다. `lakeVillageRebuildFinal`만 제외돼 있어도 안전하다고 보지 마라.
- 이 세션의 무격리 게이트를 중단하고, 환경의 Supabase URL/키/프록시를 비운 뒤 Node `--import`로 **실 네트워크 fetch 차단**을 설치해 다시 실행했다. `.env.local`을 직접 읽는 테스트도 있으므로 환경 변수만 비우는 것으로 충분하지 않다. 네트워크 모의 응답은 그대로 쓰며 실 DB URL과 외부 주소 요청을 거절한다. 로컬 HTTP 하네스는 허용하되 `.env.local`의 실제 DB origin은 로컬이어도 막는다.
- 세션 증거: `output/evidence/concept-expansion/README.md`, 원격 저장 직후 증명 `supabase-proof-first-save.json`. 후속 저장에서는 CAS가 동시 변경을 감지해 덮어쓰기를 거절했다. 실 콘텐츠 작업과 전체 검사를 같은 공유 프로젝트에서 병행하지 말고, 외부 쓰기가 끝난 뒤 최신 스냅샷으로 추가하고 재로드하라.

## Request-bound functional acceptance verification (2026-09-07)

Live followup: `requestCoverage` exercises independent omission, exact-quote gaps,
empty/malformed/failed audits, immutable worker replacement, Ask, grouped R2
refinement and failed resume audit provenance. `fakeDomInsertBefore` supplies the
real row-move semantics now needed when fail-closed fallback exposes the sticky
in existing panel tests; the actual `agentBlueprintTurnEnd` suite remains intact.
The focused serial command in `output/evidence/acceptance-live/README.md` passed
153 assertions in 14 suites. A concurrent-build run had all assertions pass but
exited nonzero on Vitest's `onTaskUpdate` IPC timeout; it is retained, not counted
as green. No assertion, timeout, test or warning was suppressed.

`scripts/qa/acceptance-live.mjs` uses real companion models, declaration/parser,
planner/session and the actual apply/store/Supabase save/reload path, with an
exclusively owned project ID and collision/revision checks. Its before/negative
cases do not write. Authored features come only from model tools. The initial
10-gold potion stock hit the production half-catalog-price floor (50 -> 25), not
a scene/player pricing divergence; a real Codex tool call set the catalog price
to 10. `acceptance-live-check.mjs` independently reloads the exact final revision,
evaluates the captured original live criteria through the canonical ledger and
runs a combined 16-step real-interpreter scenario. It is not a fresh model call,
not a fabricated declaration, and not graphical-player evidence. The latter and
full-gate baseline comparison are separate lead-owned gates. See the evidence
README for the canonical JSON, model IDs, receipt, hashes and player checkpoints.

Focused suites: `functionalScenePurchase`, `functionalAcceptance`,
`functionalAcceptanceSession`, `functionalPersistenceProof`, `npcRewardSession`,
`functionalWalkSuspension`, `functionalClarification`, and `functionalInterpreterResume`.
They exercise the public scene tool, real interpreter/production transactions,
live declaration parser and session gates, immutable plan replacement, actual
proposal apply, and the canonical persistence-read boundary (only transport/model
responses are scripted). Red/green logs live under
`output/evidence/functional-acceptance/`; no sleeps synchronize these tests.

Run the executable public-API browser smoke against an isolated worktree server:

```bash
npm run dev:worktree -- --port 9841
node scripts/qa/functional-acceptance-smoke.mjs http://127.0.0.1:9841
```

The script uses Playwright Firefox (`npx playwright install firefox` if absent),
avoiding this Linux host's documented Chromium `ERR_NETWORK_CHANGED` cancellation.
It loads public session/parser/runtime modules without booting the editor,
uses only `test/fixtures/functionalAcceptance.ts`, blocks all network writes and
external requests, and records `output/evidence/functional-acceptance/public-smoke.json`.
It verifies exact purchase deltas, outgoing/return travel, one-time rewards,
broken variants, stale applied evidence and attempted contract replacement.
The review regressions force travel through a touch-shop corridor, compare split
and unsplit walks, retain post-shop game-over behavior, and refuse nested held
interpreter replacement. Clarification coverage includes original-source linkage,
partial completion, retained known expectations, explicit user corrections,
host-resume clarification, and rejected worker/concrete-contract replacement.
The public smoke also exercises the corridor and a three-message clarification
(`blocked -> blocked -> verified`) with the same requirement ID.
Consumed-hold regressions cover purchase/choice/animation resuming through transfer
into a non-suspending variable initializer, a second suspension under the same
owner, and retained rejection of newly suspended nested interpreters. Animation
tests advance deterministic engine ticks derived from its authored duration;
no wall-clock sleep or polling is used. The public smoke additionally verifies
purchase -> transfer -> initializer ends with 80 gold, two potions and var_0001=1.
It does NOT claim live-model semantic extraction, graphical-player QA or a real
Supabase-authored project. Canonical reload behavior is covered by the focused
transport-boundary tests; independent full gates/build/player QA remain lead gates.
Check the server's worktree identity, not just an HTTP 200; another checkout on the
same port serves different modules. Pass an explicit free port if the assigned
port belongs to another running checkout; do not kill that server.

## 조수 보상 저작과 출하 플레이어 검증 (2026-09-06)

`npcCommandContract`, `aiCompletionAccounting`, `assistantDependencyRetry`, `npcRewardAcceptance`, `npcRewardSession`은 각각 명령 규격, 적용 완료 원장, 종속 보류/재시도, 실제 장면 보상, 세션 완료 판정을 검사한다. 보상 요구는 `IntentDeclaration.npcRewards`에서 오며 최종 이벤트 명령으로 역산하지 않는다. 페이지 두 개나 도구 성공 횟수는 지급 증거가 아니다.

실제 모델 검증은 별도 원격 QA 프로젝트에서 조수를 실행하고 정상 저장 후 같은 project id로 다시 읽는다. 재로드한 JSON을 `npm run qa:runtime -- --scenario assistant-reward --project <path>`에 전달한다. 이 시나리오는 `player.html`에서 실제 상호작용 두 번으로 `item_capture_orb`와 `species_leafling`이 각각 `0/0 → 5/1 → 5/1`인지 검사한다. 맵은 `map_blank_start`, 시작점은 `(10,8)`, 고정 보상 NPC는 `(10,7)`이다. 장면 테스트가 통과해도 출하 플레이어 검증을 생략하지 않는다.

런타임 QA의 선택적 `inventoryCounts`/`ownedMonsterCounts`는 요청한 ID만 manifest에 기록한다. 몬스터 수는 파티와 보관함의 소유 인스턴스를 합쳐 세며, 훅이나 관측 데이터가 없으면 0으로 간주하지 않고 실패한다. 관련 회귀는 `runtimeQaGate`, `runtimeQaInstrumentationBoundary`, `runtimeQaReport`다.

실제 모델 후속 검증에서 `giveMonster`의 `speciesId`/`level`, 장면 스텝의 `dir`/`to`/`ticks`/`index`가 노출 스키마에 빠져 인자가 다른 필드로 반복 전송됐다. 해당 필드의 노출과 컴파일러 계약은 `npcCommandContract`가 검사한다. `sceneVerificationRepair`는 명시 NPC ID·단언·선택지·보상 기준점이 같은 검사에서 이동/방향을 고친 재실행이 과거 실패를 해소하는지 검사한다. 기대 보상이나 NPC 대상을 바꾼 별개 검사는 기존 실패를 지울 수 없다.

## 실내 조립·형상 검증 (2026-09-05)

`test/interiorConceptAssemblies.test.ts`가 19시설×3seed 시공, 상판 소품의 전체 셀, 벽시계 위치, 장소 shape 직렬화·검증, 메타/통행 사용자 오버라이드 보존을 검사한다. 관련 13파일·253테스트 및 앱 타입 게이트가 통과했다. 이번 전체 gates 실행은 최종 리포트를 남기기 전 exit 143으로 종료되어 전체 기준선 비교를 완료하지 못했다. 원인 미확정이며 전체 통과로 보고하지 않는다. 로컬 증거는 `output/evidence/concept-v2/validation.json` 및 `focused-tests.log`.
