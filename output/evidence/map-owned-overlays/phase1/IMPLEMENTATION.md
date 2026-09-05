# Map-owned running-tool overlay - Phase 1

Baseline: `e07cd4f89d8f8b170d6e1052921f72d48a4cc0b4`, branch `agent/map-overlay-p1`.
Task: st_01a073a5. Focused fix and real-browser proof complete. Parent owns full gates/build.

## Investigation and artifact ledger

- Parent browser RED: `/tmp/st_01a0739b-evidence/REPORT.md` and `repro.mjs`.
- Confirmed mechanism: geometry filters map ownership, but all running-name renderer paths read a global name. Clearing that name removes the leaked B chip in parent runtime evidence.
- Alternative map-data leak refuted by parent byte equality; stale blueprint geometry refuted by empty B scene layers.
- `AssistantSession.emitToolStarted` has four callers, resolved args already available at each. Existing event contains only name/index. Both actual consumers (`aiTurnRunner`, `aiRegionTaskRunner`) discard target identity because none arrives.
- Delivered: carry args through that existing event; keep one running-tool owner map in the existing ghost state; filter all renderer name decisions. No new concurrency model or blueprint lifecycle changes. Unknown targets stay chat-only; explicit top-level/nested map targets are supported. Existing optional event args remain compatible with older producers.
- Temporary artifacts: validation logs and browser PNGs under this directory retained locally as evidence, not committed. Browser/context closed in finally. No debug instrumentation in production.
- Port 9841 initially occupied by PID 2252417, cwd `/home/main/z-project/rpg-zzu`; not this checkout. Do not stop or use that server.
- No remote project writes: browser QA uses isolated `blankProject=1` and blocks mutation requests.

## RED / GREEN

All commands below ran in `/home/main/z-project/rpg-zzu-map-overlay-p1`.

### Failing-first RED (production untouched)

Command (2026-09-06 07:21:59):
```sh
npm test -- test/agentGhostRunningTool.test.ts test/aiActivityCanvasChip.test.ts test/assistantSessionYield.test.ts test/aiTurnAppliedAccounting.test.ts
```
Exit **1**, **4 files failed; 18 tests failed, 11 passed**. Raw output: `red.log` (captured before any production edit).
Failures:
- `agentGhostRunningTool`: 9 failures (explicit/nested ownership, same-name owner change notification, four unknown targets, two clear paths). Example: `expected [...] to have a length of 2 but got 1`; state lacked `runningToolMapId`.
- `aiActivityCanvasChip`: 4 failures (render/update A->B->A, unknown target, nonempty local diff). B retained a `<div>` instead of null. Nonempty B label: received `영역을 채우는 중 · 1/1 셀`, expected its preexisting `작업을 진행하는 중 · 1/1 셀`.
- `aiTurnAppliedAccounting`: 4 target-forwarding failures (three chat inputs, region event target differs from view and selection). Received global name with no `runningToolMapId`.
- `assistantSessionYield`: start event omitted expected `args: {mapId:'map_blank_start',x:0,y:0,w:2,h:2}`.

### Candidate focused run

Command (2026-09-06 07:25:12):
```sh
npm test -- test/agentGhostRunningTool.test.ts test/aiActivityCanvasChip.test.ts test/assistantSessionYield.test.ts test/aiTurnAppliedAccounting.test.ts test/agentGhostPreview.test.ts test/agentGhostPreviewHidden.test.ts test/agentGhostPreviewRenderers.test.ts test/agentGhostCumulativeReveal.test.ts test/agentBlueprint.test.ts test/agentBlueprintHardening.test.ts test/agentBlueprintRenderer.test.ts test/agentBlueprintTurnEnd.test.ts test/regionTaskRun.test.ts
```
Exit **1**, **12 files passed, 1 failed; 175 tests passed, 6 failed** (`green.log`). All 18 RED regressions passed. The six failures are confined to unchanged `agentBlueprintTurnEnd.test.ts`: fixture SSE is parsed as JSON (`Unexpected token 'd', "data: {\"ch"... is not valid JSON`).

### Baseline comparison for existing turn-end failure

Saved ONLY my five production-file changes to `production.patch`, reversed them with `git apply --reverse`, ran:
```sh
npm test -- test/agentBlueprintTurnEnd.test.ts
```
Baseline exit **1**, **same 6 failed / 1 passed** at 07:29:01 (`baseline-turn-end.log`). Reapplied `production.patch` successfully (restore exit 0). No turn-end test or blueprint production code changed. This is pre-existing, not a green claim.

### Exact focused GREEN

The same four-file RED command ran on the candidate at 07:41:44:
```sh
npm test -- test/agentGhostRunningTool.test.ts test/aiActivityCanvasChip.test.ts test/assistantSessionYield.test.ts test/aiTurnAppliedAccounting.test.ts
```
Exit **0**, **4 files passed; 29/29 tests passed** (`focused-green.log`). No sleeps/polling were introduced in tests. Prior tests remain intact; the existing pre-cell chip test now supplies its target.

### Static verification

- `npm run typecheck:app`: **exit 0**, no errors (`typecheck.log`).
- LSP diagnostics: no diagnostics in all 5 changed production files and all 4 changed/new tests; browser script also clean.
- `npm run build`: invocation exceeded tool's 300s bound during Vite transforms; result unverified (`build.log`). Own build process is no longer running. No retry/full gates launched; parent explicitly owns long-lived build/gates after commit.
- `git diff --check`: exit 0.

### Browser work / tooling

- `scripts/qa/map-owned-overlays.mjs` adapts parent repro via unified patch, parameterized `BASE_URL`/`EVIDENCE_DIR`; asserts A pre-cell chip, B no chip/layers, delayed A event on B, A return, clear/unknown hidden, byte-equal maps.
- Native `apply_patch` executable unavailable; shell `apply_patch` wrapper used `git apply --recount` to apply `browser-script.patch`. Initial `patch -p1` rejected malformed hunk counts without changing the file; recounted application succeeded.
- First attempt used separately bound/free `127.0.0.3:9841` (own PID 2660603), not either existing server. Navigation timed out; empty body and `ERR_NETWORK_CHANGED`. Retired that process group. Parent then authorized free port **19844**. Chromium also failed boot there with `ERR_NETWORK_CHANGED` (no behavior exercised). Installed Firefox passed the same script; no production workaround was added.

### Real-browser GREEN and cleanup

Verified 19844 had no listener before launching this checkout:
```sh
npm run dev:worktree -- --host 127.0.0.1 --port 19844
BROWSER=firefox BASE_URL=http://127.0.0.1:19844 EVIDENCE_DIR=output/evidence/map-owned-overlays/phase1/browser-firefox xvfb-run -a node scripts/qa/map-owned-overlays.mjs
```
Browser exit **0** (`browser-firefox.log`). Headed Firefox, 1440x900, real map-tree clicks, subscriptions installed before changes; no fixed sleeps. Output:
```text
PASS A chip before cells; B chip/layers absent; late event stays on A; A return visible; clear/unknown hidden; map bytes unchanged
PAGE_ERRORS []
CLEANUP browser/context closed; disposable profile discarded
```
- A: owner `qa_map_a`, zero ghost cells, visible chip and one filtered blueprint entry.
- B: owner still A, no chip, zero filtered/actual ghost and blueprint geometry.
- Late nested-target A activity while viewing B stayed invisible on B; real click back to A restored its chip.
- Clear and unknown target both remove the canvas chip. Map JSON byte equality true for A and B at every recorded phase.
- All non-GET/HEAD/OPTIONS requests blocked: six POST attempts (edit/AI activity logs and browser bridge), including `/rest/v1/ai_activity_logs`. Remote persistence false. Expected blocked-request CORS and temporary-session autosave console errors; zero page errors. No user DB writes.
- Artifacts: `browser-firefox/observations.json`, `00-A-before.png`, `01-A-running.png`, `02-B-running-GREEN.png`, `03-A-returned.png`. This child cannot view image attachments; DOM/scene assertions are verified, visual image review belongs to parent.
- Own server PID 2762714 / process group 2762572 stopped; `ss -ltnp '( sport = :19844 )'` showed no listener. Existing .1/.2:9841 servers untouched. No browser/server remains from this task.

## Handoff

- One atomic fix commit includes five production files, four direct test files, focused wiki, reusable browser script, and this bounded report. Logs/screenshots remain local evidence, not staged artifacts.
- Preserve `1dc6570d` retirement/no-revival and `e103a8a8` inheritance: no blueprint implementation edits; blueprint state, hardening, and renderer suites passed.
- **Phase 2:** repair the pre-existing six-case `agentBlueprintTurnEnd.test.ts` SSE/JSON harness failure; parent accepted the baseline comparison. No tests deleted/skipped or fixture workaround shipped here.
- Full build/gates remain parent-owned; this report does not claim they passed.
