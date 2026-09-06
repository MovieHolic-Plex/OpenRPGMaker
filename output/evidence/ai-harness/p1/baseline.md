# P1 unchanged behavior baseline

## Scope and result

Captured on 2026-09-06 by task `st_01a075e2`, before any P1 product changes.
Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p1-20260906`.
Branch: `agent/ai-harness-p1-20260906`.
Tested source HEAD: `693f2c28156ea5a58d3551a34d40b02060dc5eef`.
Node `v24.11.1`, npm `11.6.2`, Linux x64; existing linked dependencies and
private environment were preserved. No source, test, QA script, configuration,
or user project edits were made. Only this baseline evidence is added.

**Characterization GREEN:** five files / 64 tests passed in one run, exit 0.
**Real editor baseline RED:** the required unchanged script exited 1 during
initial canvas boot. No AI scenario completed. This is not a persistence-proof
RED test and is not a successful browser gate.

## Exact commands and receipts

Commands ran from the worktree above, in this order. stdout/stderr were redirected
to files without a pipeline; `$?` was captured immediately after each command.

```sh
npm test -- test/assistantVerificationEvidence.test.ts test/aiComposerModeSession.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/applyProposedProjectHouseProtection.test.ts
QA_PORT=19846 EVIDENCE_DIR=output/evidence/ai-harness/p1/baseline-editor xvfb-run -a node scripts/qa/map-owned-ai-turns.mjs
```

| Command | UTC start / finish | Actual exit | Evidence |
| --- | --- | --- | --- |
| Focused Vitest | 08:44:24 / 08:45:57 | 0 | `baseline-tests.log`, `baseline-tests.receipt` |
| Headed Firefox editor QA | 08:46:22 / 08:47:48 | 1 | `baseline-editor.log`, `baseline-editor.receipt`, `baseline-editor/` |

Vitest reported 91.47 seconds. The editor command reached its own 60-second
canvas assertion failure; the outer command runner did not time it out.
Neither command was retried to obtain a favorable result.

## Existing contracts characterized

These are the assertions in the unchanged focused suites, not claims of new
implementation or broad full-suite coverage.

| Suite | Passing tests | Machine-level behavior covered |
| --- | ---: | --- |
| `assistantVerificationEvidence` | 20 | Tool execution `ok:true` does not imply a passing verdict; failed explicit checks reject completion; a new write invalidates old checks; same-target recheck can recover; other-target success cannot erase failure; advisory checks remain nonblocking and separate from explicit requirements. |
| `aiComposerModeSession` | 6 | Ask hides writes and rejects attempted writes with `composer-mode-ask`, preserving the draft; a new plan turn executes no tools, including autonomous entry and planner `direct`; explicit resume executes tools; do exposes writes. |
| `aiMilestoneTurnAccounting` | 3 | Tool-budget continuation retains prior successes; already-applied calls survive auto-continue and remain distinct from empty/pending proposals; real in-memory store contains the expected authored items. |
| `aiAssistantTurnCleanup` | 14 | Final/error/abort/throw cleanup retires owner presentation without changing retained store, spec or independent region approval; apply/reject accounting remains accurate; orphaned completion cannot retire a replacement turn's blueprint. |
| `applyProposedProjectHouseProtection` | 21 | Agent and milestone application reject stale completed-house drafts without apply/commit/undo side effects; unchanged accepted drafts create one undo entry and one commit; human edits made before the new baseline survive; real milestone application respects the live house baseline. |

The current non-house overwrite policy is deliberately retained:
`test/applyProposedProjectHouseProtection.test.ts:128-145` expects a stale custom
region preview to apply and replace a later human upper tile with `-1` (for both
agent sources). This baseline does not implement the later stale-proposal phase.
The selected suites include legacy prose assertions; none were added or changed.
The results above describe their machine-value coverage, not wording guarantees.
An undo entry is covered; an interactive browser undo action was not executed.

## Actual editor surface: pre-existing baseline failure

`baseline-editor/actions.json` records:

- Sequence 1: exclusive probe succeeded for `127.0.0.1:19846`; no listener reused.
- Sequence 2: `completed` scenario boot started.
- Sequence 3: `expect(locator).toBeVisible()` failed for
  `.phaser-container canvas`, timeout 60000 ms, element(s) not found, at
  `scripts/qa/map-owned-ai-turns.mjs:282:58`.
- Sequence 4: captured body text was empty.
- Sequence 5: session evidence was `null`.
- `states` is `{}`; `errors`, `routeErrors`, and `blockedWrites` are empty.
- Sequence 6: `browserClosed:true`, `ownedServerStopped:true`,
  `reusedListener:false`.

Exact startup assertion (full stack is retained in both browser log artifacts):

```text
Error: expect(locator).toBeVisible() failed

Locator: locator('.phaser-container canvas')
Expected: visible
Timeout: 60000ms
Error: element(s) not found
```

Paths from the worktree root:

| Evidence | Path / availability |
| --- | --- |
| Browser command output and stack | `output/evidence/ai-harness/p1/baseline-editor.log` |
| Browser action/state/error records | `output/evidence/ai-harness/p1/baseline-editor/actions.json` |
| Screenshot | `output/evidence/ai-harness/p1/baseline-editor/failure.png` |
| Vite server log | `output/evidence/ai-harness/p1/baseline-editor/server.log` |
| Network evidence | Only empty `routeErrors` / `blockedWrites` arrays in `baseline-editor/actions.json`; no request/response trace, HAR, or network log was captured. Empty arrays do not establish successful asset loading. |
| Cleanup and port release | `output/evidence/ai-harness/p1/baseline-cleanup.json`, plus browser log sequence 6 |

The server log records Vite ready on the correct origin (966 ms) and three
optional proxy-key warnings. It does not establish why the canvas failed to
boot. No console/network trace identifying a deeper cause was captured. The
failure occurred before the fixture/session observer and scripted LLM transport
were installed; completed, lookup, and aborted AI behaviors are therefore
**unverified through the real browser in this run**. No unrelated boot fix was
attempted and no successful scenario state is fabricated.

`baseline-editor/failure.png` is the actual captured 1440x900 failure screenshot.
The image tool could not render it for this agent, so no subjective visual review
is claimed. `actions.json` is the captured state/action artifact, including the
empty state map; there are no completed-scenario screenshots.

The script's intended later path uses the real composer/session/tool/apply/store
and event subscriptions armed before actions. It deliberately uses
`?blankProject=1`, asserts remote persistence disabled, and blocks non-read
requests except its scripted local LLM endpoint. Even a passing execution of
this script would not prove Supabase save/read consistency or autonomous
milestone remote proof. No remote test fixture was authored by this baseline.

## Exact current persistence proof gap (source inspection)

These findings are from the tested HEAD, not from a passing remote experiment.

1. **Proof is gated by completed plan, not accepted revision.**
   `src/ai/assistantSession.ts:2517-2540` requires a plan, milestone auto-apply,
   no apply failure and `isWorkPlanComplete(plan)`. It compares
   `runEndProofPlanId` and assigns it *before* checking remote enablement,
   flushing, or reading. A disabled/failed/skipped attempt consumes that plan's
   proof slot. The same completed plan cannot retry through this method without
   its marker being reset. A planless ordinary apply does not enter this proof.

2. **Returned read failures are promoted to saved-proof messaging.**
   After `flushResult.kind === "saved"`, the method awaits
   `store.reloadFromRemote()` and unconditionally emits the `agent_run_saved`
   audit/status at `assistantSession.ts:2566-2570`. It interpolates
   `reloadResult.kind` but never requires `reloaded`, checks its `projectId`, or
   compares content. `store.ts:661-698` returns `failed`, `cancelled` and
   `disabled` as values, not exceptions, so those results bypass the catch and
   reach the claimed proof-complete status. Thrown errors do use the failure
   path, but still leave the plan marker consumed.

3. **Target, accepted content and commit are not bound together.**
   The session reads `supabaseProjectConfigDraft().projectId` after reload,
   takes only optional `flushResult.sha256`, and asks `list_project_commits`
   for the latest row (`assistantSession.ts:2537-2563`). That row is not the
   actual apply receipt. `ProjectFlushResult` (`store.ts:109-119`) exposes no
   typed accepted-revision/project-id/content-identity receipt. There is no
   comparison tying returned read content to the accepted save result.

4. **The proof read mutates the editor and can erase newer local edits.**
   `reloadFromRemote` checks dirty state only before awaiting
   `loadProjectFromSupabase()`. After the await, it replaces `this.current`,
   normalizes, resets the persisted baseline and clears dirty state
   (`store.ts:669-690`) without a mutation-generation check. A local edit made
   while the read is in flight is not protected by that pre-await check.
   Normalization also uses its default persistence behavior. This is an
   editor-reload operation, not a read-only verification API.

5. **Existing reusable storage semantics already distinguish accepted vs live.**
   `persistCurrent` (`store.ts:1112-1153`) captures `generationAtSubmit`, uses
   `result.project ?? submittedProject`, stores the accepted baseline and
   preserves current local content during save RTT. The new-project
   transactional path (`store.ts:398-445`) fixes target config and compares
   `serializeForComparison(projectWithoutEventDrafts(saved.project ?? candidate))`
   with the similarly filtered reloaded project, then checks concurrent edits.
   Those protections are not connected to run-end proof today.

Caller chain inspected: `sendUserMessage` -> `runAutonomousDriver`
(`assistantSession.ts:1412-1445`) -> `maybeRunEndProof` -> `store.flush` /
`reloadFromRemote`; storage save and transactional comparison boundaries were
also read. No remote target or live user project was used to reproduce the race.

**RED/GREEN boundary for downstream owners:** this deliverable supplies the
unchanged 64-test GREEN and the real editor boot RED. It does not claim a newly
executed failing-first assertion for wrong-target/wrong-content/retry/concurrent
read behavior. The persistence/session owners still need those behavioral RED
assertions before product changes, then GREEN and independent editor/isolated
remote proof. A printed `agent_run_saved` or this local browser script alone is
not that proof.

## Cleanup, artifacts, and limitations

- The script's finally block closed its context/browser and stopped its owned
  Vite process. Its `actions.json` cleanup receipt confirms this even on failure.
- `baseline-cleanup.json` independently records successful exclusive rebinding
  of `127.0.0.1:19846`, closure of that probe, and no listener in `ss` output at
  08:48:23Z. Other browser processes were not killed or altered.
- No deferred LLM gates were created (failure preceded `installLlm`). Disposable
  browser context storage was closed, not copied into any user profile.
- Existing user data, private environment and configuration were preserved.
  No remote fixture was created, so no remote fixture deletion is required.
- A preliminary tool-location `find` command hit its 20-second execution bound;
  this was inspection only, not a validation gate. It is not counted GREEN.
- No full build/gates/typecheck was run for this evidence-only task. No product
  implementation, merge, or main-worktree edit is included.
- Markdown LSP diagnostics were requested but unavailable (no `.md` server).
  Artifact JSON parsing, PNG dimensions, credential-shaped token scan and hash
  checks passed. Source/test/script diffs were empty.
- `git diff --cached --check` returned 2: `baseline-tests.log:75: new blank line
  at EOF.` The raw Vitest output is deliberately preserved byte-for-byte rather
  than modified to remove its trailing blank line. This warning is not hidden.

Artifact inventory (relative to this directory):

- `baseline.md`: this bounded report.
- `baseline-tests.log`, `baseline-tests.receipt`: full focused test output and exit.
- `baseline-editor.log`, `baseline-editor.receipt`: exact browser command output/exit.
- `baseline-editor/actions.json`: action log, actual empty state and cleanup.
- `baseline-editor/server.log`: owned Vite stdout/stderr.
- `baseline-editor/failure.png`: captured failure screenshot.
- `baseline-cleanup.json`: independent port-release receipt.
- `baseline-artifacts.sha256`: artifact integrity hashes, excluding itself.

Per the lead's follow-up, a separate baseline-repair node precedes persistence.
Startup diagnosis/repair belongs to that node. This capture has not retried the
browser command, changed product code, or claimed the repair completed.

**DoneClaim:** unchanged baseline evidence and the exact current persistence
proof gap are recorded. Unit characterization passed; real-editor execution
failed at boot and remote persistence remains unverified. This claim closes
only the baseline node, not P1 implementation or its release gates.
