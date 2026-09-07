# Explicit Continue authorization and small-width reachability

**Current implementation:** `383c27539d8ce94846c660bf45c2a070dfd9b940` (`fix(ai): authorize resume only from the explicit Continue action`). This supersedes c8fa's token-based RunSurface mode switch, without changing the renderer, sticky markup, CSS, layout, backend execution, apply or receipt policy.

Final code verification: **133/133 UI tests, complete build, 148/148 outcome-matrix and 107/107 required-skip, all exit 0**. Additional real small-width click/keyboard runs each pass 107/107; the negative typed/bridge Ask run passes its two additional assertions sets and the original 107/107. Current-source binding is in [ui-explicit-resume-binding.log](ui-explicit-resume-binding.log). All original reports and failures remain unchanged.

## Exact authorization seam and RED

Read `integration-fixture-drain.md`, `qa-user-actions-red.md`, current runner availability, and the independent visual reports before the correction. Integration already owns blocked/budget availability and reuses one visible control. The only runner change is its existing native button click:

```ts
deps.surface.sendText("계속", undefined, { userResume: true });
```

`AiRunSurface.sendText` adds only optional `readonly userResume?: true`. The Panel wrapper switches its owned `composerMode` and calls the actual `composerShell.setMode` **only for that explicit action**, before normal `sendText` dispatch. It does not inspect message text to grant this mode change. The flag is UI plumbing, not a session/backend authorization option or model tool. Ordinary typed, bridge and RunSurface sends remain Ask when Ask is selected.

`test/aiContinueUserAction.test.ts` uses the real Panel/composer/runner and a call-through factory spy to observe the actual Panel RunSurface. A session boundary double records the actual dispatched mode; it does not own or replace the UI interaction under test. The test first sends Ask, then typed `계속`, registered-bridge `계속`, and ordinary `surface.sendText("계속")`, asserting Ask for each. Only clicking the actual `ai-continue-run` changes both dispatch and displayed radio state to Do.

Before the source correction:

```sh
npm test -- test/aiContinueUserAction.test.ts --maxWorkers 1 --minWorkers 1
```

**Exit 1**, actual `do` versus expected `ask` at the ordinary Panel RunSurface seam. Typed and registered-bridge negative controls preceding it passed. [ui-explicit-resume-red.log](ui-explicit-resume-red.log). This is the concrete c8fa bug: ordinary RunSurface token text was treated as the UI action. No backend repair or duplicate Continue control was needed.

## Current-source full responsive packets

- [ui-explicit-resume-outcome-matrix](ui-explicit-resume-outcome-matrix/): **148/148**, 48 PNGs, 36 DOM observations.
- [ui-explicit-resume-required-skip](ui-explicit-resume-required-skip/): **107/107**, 44 PNGs, 33 DOM observations.

Both capture the original scenario states at **1024x768, 1280x800 and 1440x900** plus the default 1440 images. Each contains `actions.json`, `ui-dom.json`, `ui-source-identity.json`, and `ui-source-stable.json`. The expanded UI manifest explicitly includes **aiChatPanel, aiTurnRunner, aiRunSurface, aiChatRenderers, aiStickyChecklist, both owned CSS files, DESIGN and UI tests/capture code**. Supplemental source hashes are in their own observation files. The binding log verifies the union with the native harness's backend/source manifest against the committed bytes of `383c27539`; pre-commit report HEAD is not rewritten.

The earlier `ui-final-*` 92-PNG set remains bound to c8fa. Both Luna reports actually reviewed those 92 images and found no glyph/compositing/contrast/overlap blocker, while retaining E3 reachability and current-source binding as evidence gaps. This report does not claim their approval for the new source. No CSS, renderer or sticky source changed from c8fa (verified by `git diff --exit-code`). Current behavior has fresh captures rather than being inferred from old images.

## E3: actual small-width reachability and activation

These supplemental runs retain the original required-skip scenario and its real existing Continue control. Just before the actual user-resume action, the instrumentation sets the requested viewport, focuses the existing `ai-chat-log`, sends native **Control+End**, then focuses the existing Continue button. It measures exposure, unique control count and center-point hit testing, captures a screenshot, and activates that exact native control. It does not add a fixed control, alter scroll/layout, inject mode, invoke a session method or fabricate outcomes.

| Width | Native activation | Full button rectangle | Exposure/hit/focus | Real action result |
| --- | --- | --- | --- | --- |
| 1024x768 | existing `button.click()` | x=388, y=574, width=42.0667, height=28; bottom=602 inside log bottom=608 | unique=1, fullyExposed=true, inViewport=true, hit=true, focused=true | actual mode Do; same work reactivated; terminal blocked/incomplete/no-change; 107/107 |
| 1280x800 | existing button `press("Enter")` | x=644, y=606, width=42.0667, height=28; bottom=634 inside log bottom=640 | unique=1, fullyExposed=true, inViewport=true, hit=true, focused=true | actual mode Do; same work reactivated; terminal blocked/incomplete/no-change; 107/107 |

At these exact focused action boundaries the transcript reports scrollTop=0 and scrollHeight=clientHeight=428: **no scroll distance was needed after native focus/layout settled**. The evidence establishes full reachability and activation, not a claim that Control+End moved content by a nonzero distance. Earlier partial visibility in sequential resize captures was not a demonstrated permanent product defect. Focus outline measures 3px; no focus/CSS override was introduced.

### Review these specific artifacts

- [1024 screenshot](ui-continue-reachable-1024/continue-reachable-1024-click.png)
- [1024 full geometry/hit test](ui-continue-reachable-1024/continue-reachability.json)
- [1024 actual action result](ui-continue-reachable-1024/continue-action-result.json)
- [1280 screenshot](ui-continue-reachable-1280/continue-reachable-1280-keyboard.png)
- [1280 full geometry/hit test](ui-continue-reachable-1280/continue-reachability.json)
- [1280 actual action result](ui-continue-reachable-1280/continue-action-result.json)

Both directories also contain all 44 original/responsive scenario PNGs, original 107 machine checks, DOM and source manifests. Keyboard activation is labelled explicitly; the unchanged normal/click scenario is separately proven at 1024 and in both full current-source packets. Native Enter invokes the same production click handler, never a synthetic replacement action.

## Negative actual user-surface evidence

[ui-negative-continue-surface-final](ui-negative-continue-surface-final/) extends the real scenario **after its original resumed terminal capture**. It selects Ask via the existing chip, enters the literal continuation token into the actual composer and clicks Send, then sends that same token through the registered browser bridge. The script observes real production options, canonical work/acceptance and actual remaining content; no outcome or option is injected.

Both sends keep the displayed composer and dispatched `composerMode` as **ask**; the same work remains blocked; requirement ID/map/source request ID and false evidence remain; real event content remains empty. Both settle **response-final/incomplete/no-change**, not Do authorization or fabricated completion.

- [negative-user-actions.json](ui-negative-continue-surface-final/negative-user-actions.json): exact before/after observations and instrumentation hash.
- [negative-typed-ask.png](ui-negative-continue-surface-final/negative-typed-ask.png)
- [negative-bridge-ask.png](ui-negative-continue-surface-final/negative-bridge-ask.png)
- [negative-user-actions-pass.json](ui-negative-continue-surface-final/negative-user-actions-pass.json)

The internal ordinary RunSurface negative case is covered through its exact Panel-owned callback in the unit regression; it is not exposed as a fake browser/user control.

An initial supplemental run is preserved in [ui-negative-continue-surface](ui-negative-continue-surface/) with **exit 1**. Its two actual negative cases passed, but adding historical `계속` activity before the original resume test caused that harness's text-based activity observer to find the prior terminal record, so the nine resumed terminal assertions ran before the actual resume settled. This is an instrumentation collision, not credited as a product RED. The supplement was moved after the original terminal capture; no original assertion, transport script, backend or timeout was changed. The corrected run exits 0 with all original checks and extra negative checks passing. Its preserved failed run also closed all owned resources and deleted its fixture with absence proof.

## Exact verification commands and exits

```sh
npm test -- test/aiOutcomePresentation.test.ts test/aiContinueUserAction.test.ts test/aiStickyChecklist.test.ts test/aiAutonomousRunSurface.test.ts test/aiWorkPlanTerminalFocus.test.ts test/aiRetryWorkPlanLifecycle.test.ts --maxWorkers 1 --minWorkers 1
npm run build
node --check test/aiOutcomeBrowserEvidence.mjs
node --check test/aiContinueReachability.mjs
node --check test/aiContinueNegativeSurface.mjs
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/ui-explicit-resume-required-skip xvfb-run -a node test/aiOutcomeBrowserEvidence.mjs --scenario required-skip
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/ui-explicit-resume-outcome-matrix xvfb-run -a node test/aiOutcomeBrowserEvidence.mjs --scenario outcome-matrix
QA_PORT=37025 CONTINUE_WIDTH=1024 CONTINUE_ACTIVATION=click EVIDENCE_DIR=output/evidence/ai-harness/p2/ui-continue-reachable-1024 xvfb-run -a node test/aiContinueReachability.mjs --scenario required-skip
QA_PORT=37025 CONTINUE_WIDTH=1280 CONTINUE_ACTIVATION=keyboard EVIDENCE_DIR=output/evidence/ai-harness/p2/ui-continue-reachable-1280 xvfb-run -a node test/aiContinueReachability.mjs --scenario required-skip
QA_PORT=37025 EVIDENCE_DIR=output/evidence/ai-harness/p2/ui-negative-continue-surface-final xvfb-run -a node test/aiContinueNegativeSurface.mjs --scenario required-skip
```

All commands above exit **0**. Tests: 133 passed in six files, 194.18s; [ui-explicit-resume-green.log](ui-explicit-resume-green.log). Full build: [ui-explicit-resume-build.log](ui-explicit-resume-build.log), warnings retained. Browser raw command logs are beside their named directories with `-command.log` suffix. All three changed source TypeScript files and the changed regression received clear LSP diagnostics. No CSS changed; JS instrument syntax checks passed. No new any/casts/non-null assertions/suppressions, prose tests, sleeps/polling or dependencies. Added observation waits use native frame, DOM mutation or actual bridge completion with bounded cleanup.

The final build/tests ran against the same product/regression bytes committed in `383c27539`. Later additions were supplemental browser scripts, actually executed above. Source whitespace validation passed. No backend, apply, persistence, requirement or native QA contract file was edited. No full gates, push, merge, nested agent or shared-main edit occurred.

## Owned cleanup and remaining approval

Each run reports zero page/route errors, `activeRoutes: 0`, no reused listener, released port37025, closed browser/server/cache/listeners/timers, and project/child-table/observed-commit deletion plus absence proof:

- current required-skip: `qa-ai-surface-2d66e4ab-9154-4275-b54d-3dddffe1afb2`
- current outcome-matrix: `qa-ai-surface-b3b0c3a1-019b-4e82-9917-fb58cf8115e3`
- 1024 reachability: `qa-ai-surface-e9293808-acbb-4c2b-bc4b-75c7b63ee879`
- 1280 reachability: `qa-ai-surface-678084cb-f0a8-4b11-a053-3b3629341fe8`
- initial negative supplement (failed harness timing): `qa-ai-surface-ad5b4002-20e7-4011-ac91-052ede08fea6`
- final negative supplement: `qa-ai-surface-62da0cce-4589-4e10-a625-cf60a204c959`

Configured credential-value scan passed without printing secret values. This model still cannot receive PNG pixels; independent Luna reassessment owns image judgment for the new packets. Earlier 92-image visual findings are cited, not appropriated as current approval. Full gates, final surface verification and exact-head P2 approval remain lead-owned.

Ordered own implementation/evidence chain: `c8fa4e965`, `67002b876`, `383c27539`, then this evidence-only handoff commit (SHA supplied in the final task message). No source changes followed the final capture binding.
