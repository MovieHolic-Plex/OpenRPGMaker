# Phase 2: deterministic actual-AI-turn browser regression

## Outcome

**GREEN, exit 0:** `scripts/qa/map-owned-ai-turns.mjs` exercised real composer submissions, the real `AssistantSession` tool loop, `aiTurnRunner`, spatial draft tools, and the production proposal/store apply pipeline in Firefox. Both completion and abort passed. **Mutation RED, exit 1:** removing only the renderer's running-tool map-ownership comparison made the same script fail on A's chip appearing on B. The mutation was restored before GREEN and is not a production change in this commit.

- Worktree: `/home/main/z-project/rpg-zzu-map-overlay-p2-browser`
- Branch: `agent/map-overlay-p2-browser`
- Base: `9e355914` (includes phase-1 ownership fix `43f721ee`)
- Task: `st_01a073e5`
- Verification: 2026-09-05 UTC / 2026-09-06 host-local date
- Production files changed: **none**. Parallel-worker tests `test/agentBlueprintTurnEnd.test.ts` and `test/aiActivityLiveRow.test.ts` were not edited.

## Exact GREEN command

```bash
cd /home/main/z-project/rpg-zzu-map-overlay-p2-browser
mkdir -p output/evidence/map-owned-overlays/phase2/green
EVIDENCE_DIR=output/evidence/map-owned-overlays/phase2/green \
  xvfb-run -a node scripts/qa/map-owned-ai-turns.mjs \
  > output/evidence/map-owned-overlays/phase2/green/run.log 2>&1
# Exit: 0
```

The script itself performs an exclusive bind/close probe of **127.0.0.1:19846**, then launches its own server using:

```bash
DEV_SERVER_NO_TLS=1 E2E_FREEZE_DEV_SERVER=1 DEV_SERVER_PORT=19846 NO_COLOR=1 \
  node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 19846 --strictPort
```

It does not reuse an existing listener. The browser URL is exactly `http://127.0.0.1:19846/?blankProject=1`; no alternate loopback aliases or port 9841 are used. Each scenario owns a fresh headed Firefox browser/context, 1440x900 viewport. Context/browser and the owned server process group are closed in cleanup. `ss -ltnp '( sport = :19846 )'` showed no listener after verification.

## What is real, what is controlled

Only local `/v1/chat/completions` network responses are scripted. Routing uses whether `body.tools` is populated, never prompt wording or request timing. No-tools responses carry valid intent/planner fields. Tools responses follow a fixed finite protocol; unexpected extra rounds fail. The script checks the LLM request origin is the owned local server. All other POST/PUT/PATCH/DELETE requests are blocked, including activity/conversation/commit persistence. GREEN recorded 40 blocked writes, **0 page errors and 0 route errors**. This is local apply proof, not a claim of remote save.

Before any AI action, the isolated fixture asserts both:

- imported `store === window.__oprnEditorStore` (same production module singleton);
- `store.remotePersistenceEnabled === false`.

The only direct project mutation is initial two-map fixture setup. No blueprint/ghost setters are called by the test. A pass-through observation wrapper around `AssistantSession.prototype.sendUserMessage` delegates the original method, original options/signal and original event callback. Real tool results are captured after the production callback; no tool executor, draft, proposal or apply function is replaced.

`agentMode: "chat"` explicitly exercises the normal one-turn apply path, not autonomous milestone application. The composer uses `do` for construction and `ask` for the follow-up lookup. The same session and active A BuildSpec survive the completed turn and lookup.

Synchronization is event-based and installed **before** actions:

- exact session `tool_started` / successful `tool_call` events;
- ghost store emission with the expected 9 or 18 real diff cells;
- canonical project store change for apply;
- editor map-selection subscription before real map-tree clicks;
- Phaser `postrender` for actual renderer state;
- DOM `MutationObserver` on the send button's `disabled` attribute, the production `turnBusy` projection, for runner completion;
- explicit promises controlling each pending LLM response, with bounded failure timeouts.

No sleeps, polling, retry-to-pass loop, or manual overlay state injection are used. The production ghost throttle remains unchanged: the test waits for its emitted state, not for an assumed duration.

## GREEN observations

| Boundary | Real state and assertions |
| --- | --- |
| A plan | `set_build_spec` succeeds; three `planned` entries; actual blueprint layer present; owner chip visible before ghost cells. |
| A draft, next tool pending | First `clear_region` succeeds in the session draft; 9 ghost cells; blueprint `building/planned/planned`; both canonical maps byte-identical to baseline. |
| B during pending A work | Real tree click; actual blueprint/ghost layer children both 0; filtered overlays 0; chip absent; B bytes unchanged. |
| Return A during work | Same 9-cell draft and blueprint statuses reappear; canonical A still unchanged. Return to B before releasing the next response. |
| Late tool delivered while viewing B | Second A-targeted `clear_region` emits `tool_started` and successful `tool_call` while viewed map is B; draft now 18 cells; blueprint `done/building/planned`; B remains empty of overlays and unchanged. |
| Successful apply | Real `skip_work_item` explicitly skips the intentionally unbuilt remainder; session returns `final`; two spatial proposals apply; A changes exactly 18 lower cells, B does not change; one real change card; blueprint entries and ghost state empty. |
| Return A after apply | Applied tiles remain, no old blueprint/ghost/chip. |
| Follow-up lookup | Same session, active A BuildSpec, successful real `get_map_region`; blueprint entries remain empty both while final LLM response is held and after runner completion. Entire map collection stays byte-identical to its post-apply snapshot. A may show the truthful current lookup chip while lookup is running; it clears at completion. |
| Abort while B is viewed | Abort the real pending turn after two draft writes. Session returns `aborted`; zero canonical map changes, zero change cards, no ghosts/chip on B. Speculative `done/building/planned` becomes `planned/planned/planned`. |
| Return A after abort | Unapplied plan is visible and entirely `planned`, no completion claim. Releasing the canceled late response does not execute its `skip_work_item`. |

The script additionally observes every rendered B frame and every store change; both scenarios recorded **0 B violations**. A separate rendered-frame check during lookup recorded no retirement revival. All **8 actual tool calls** across the two isolated scenarios succeeded (completed: spec, clear, clear, skip, lookup; aborted: spec, clear, clear).

### Existing completion focus is explicitly not hidden

The production apply adapter calls `focusAcceptedAgentChanges(before, proposed)` (`src/editor/tools/applyChangesetToStore.ts:263`). Successful application consequently changes the viewed map from B back to A. `green/completed-05a-completion-focus.png` and the matching state record capture this. The script then explicitly clicks B to check its final renderer/data state, then returns to A for lookup.

This regression proves overlay/data ownership **while B is viewed** and truthful completion/abort/lookup state. It does **not** prove that B stays selected after completion, nor cover autonomous milestone retirement. No focus-policy production change was made outside the authorized overlay/test scope.

## Mutation RED and restoration

The narrowly targeted mutation removes only the ownership comparison inside `AgentGhostPreviewRenderer.currentState()`:

```diff
- runningToolName: mapId && state.runningToolMapId === mapId ? state.runningToolName : "",
+ runningToolName: mapId ? state.runningToolName : "",
```

Exact replay from the clean base/restored tree:

```bash
cd /home/main/z-project/rpg-zzu-map-overlay-p2-browser
# This host has no apply_patch executable. This explicit wrapper applies the
# saved unified patch with git; restoration is the reverse patch, not checkout.
apply_patch() { git apply "$@"; }
apply_patch output/evidence/map-owned-overlays/phase2/red-chip/mutation.patch
trap 'apply_patch -R output/evidence/map-owned-overlays/phase2/red-chip/mutation.patch' EXIT
EVIDENCE_DIR=output/evidence/map-owned-overlays/phase2/red-chip \
  xvfb-run -a node scripts/qa/map-owned-ai-turns.mjs \
  > output/evidence/map-owned-overlays/phase2/red-chip/run.log 2>&1
# Browser exit: 1; EXIT trap restores the mutation.
```

Observed failure, not a timeout or boot failure:

```text
Error: A activity chip must not appear on B
expect(received).toBeNull()
Received: {"text": "영역을 지우는 중 · 0/0 셀", "visible": true}
```

At `completed/03-B-pending-tool`, B had zero blueprint/ghost layer children but the mutated renderer created A's chip on B. Both maps were still unchanged; A had a real 9-cell draft and the next real tool response was held. The test failed specifically on chip ownership. Cleanup closed the pending route, browser/context, and owned server.

The temporary mutation was restored with `apply_patch -R` (the transparent wrapper above). `git diff --exit-code -- src/editor/agentPreviewRenderers.ts` and subsequently `git diff --exit-code -- src` both exited 0. The exact GREEN command then passed on the restored production code.

## Artifact index

Committed primary evidence:

- `green/actions.json`: ordered actions, all 19 state captures, real session events/results, blocked writes, error arrays.
- `green/run.log`, `green/server.log`: direct browser stdout and owned server output.
- `red-chip/actions.json`, `red-chip/run.log`, `red-chip/server.log`, `red-chip/mutation.patch`.
- Selected PNGs: A live draft, B pending/late work, completion focus, A lookup after completion, B abort/A return, and RED B chip.

The script also leaves the full screenshot set in the evidence directories on this worktree. Screenshots were captured, **not visually reviewed**; assertions are based on actual DOM/Phaser/store state. No image-review claim is made.

SHA-256:

```text
6e70d15db80b442a6c4683e7782fed21aed8e91614a4c728a9d99e7af191d1ef  scripts/qa/map-owned-ai-turns.mjs
9b0f785bb9b2207dbb931a5f3f1c335ef043f711d2de9736cdd694f3593de24e  green/actions.json
e487056edd015ea0485beec7ec0457ef225079401d94a776d9e83303c00fdedb  red-chip/actions.json
```

## Validation and development disclosures

- Final script LSP diagnostics: no diagnostics. Markdown diagnostics were unavailable (no `.md` language server configured); documentation received diff/whitespace validation.
- `node --check scripts/qa/map-owned-ai-turns.mjs`: exit 0.
- `git diff --check`: exit 0.
- Exact real-browser GREEN: exit 0, both scenarios, no retries.
- Narrow chip mutation RED: exit 1 for the expected ownership assertion, then restored.
- No production source edits, so no source typecheck/unit-test changes were required. Full gates/build were deliberately not run per task scope.

Earlier harness-development runs are not counted as proof: an unbuilt work-plan item correctly caused Ralph continuation until the script used explicit `skip_work_item`; checklist-based lookup completion timed out because question turns remove that checklist; an attempted mutation command initially found no `apply_patch` executable, and the resulting unmutated development run hit the outer command timeout between scenarios. Its orphaned **owned** Vite process group was explicitly stopped, and port freedom was checked again. Separate Firefox lifecycle ownership per scenario and exact send-button completion observation are in the final script. Stale development screenshots were removed from the RED directory; only captures listed in its current `actions.json` are used as RED evidence.
