# E2E baseline comparison — cream retheme (89f4cf56~1 vs HEAD 7b2c78d9)

Method: git worktree C:/Users/USER/.herdr/worktrees/rpg-zzu/_baseline-check @ 89f4cf56~1 (f01f5d26 detached HEAD). Junction node_modules → worktree-lucky-valley-fcfc/node_modules. Vite fs.allow patched to include junction target. Isolated dev servers: baseline 4373, HEAD 4374, `npx playwright test --reporter=list` for the two specs.

## Verdict table

| spec | test name | baseline (f01f5d26) | HEAD (7b2c78d9) | verdict |
|---|---|---|---|---|
| figma-editor-redesign.spec.ts | Figma-like editor shell and Korean event context menu match the dark mockup | ✘ FAIL | ✓ PASS | **FIXED by retheme** — baseline failed the pinned dark colors (Expected rgb(17,19,24) Received rgb(15,17,23)); HEAD passes with cream tokens |
| figma-editor-redesign.spec.ts | Figma-like editor shell keeps Korean labels readable at narrower viewports | ✘ FAIL | ✘ FAIL | **PRE-EXISTING** — both fail (different assertions). Baseline: `Expected "rgb(17, 19, 24)" Received "rgb(15, 17, 23)"` at expectModernEditorShell:195 (color pin). HEAD: `statusLabelsOverflow` overflow `{ client:166 scroll:184 text:"타일 칠하려면: 바닥/장식으로 전환" }` at line 209. Same 768x900 overflow symptom as claimed, but baseline's color mismatch masks it; the narrow-viewport overflow is **NEW REGRESSION signal** (HEAD exposes it after fixing the color gate), though the spec overall was already failing. If scored strictly per-reporter PASS/FAIL: PRE-EXISTING (FAIL→FAIL). If scored by the overflow symptom: NEW (hidden by prior failure). |
| rm2k3-event-layer-interactions.spec.ts | event layer canvas selects on first click and opens the editor on double click | ✓ PASS | ✓ PASS | PASS in both — not disputed |
| rm2k3-event-layer-interactions.spec.ts | event editor owns double-click and picker cancellation one layer at a time | ✘ FAIL | ✘ FAIL | **PRE-EXISTING** — same timeout `waiting for getByTestId('event-editor-modal').getByRole('button', { name: 'List' })` at line 306 in both runs |
| rm2k3-event-layer-interactions.spec.ts | event layer canvas opens the RPG Maker context menu on right click | ✘ FAIL | ✘ FAIL | **PRE-EXISTING** — same backdrop-intercept timeout `<div class="event-subdialog-backdrop" data-testid="event-transfer-player-dialog"> intercepts pointer events` waiting for `event-editor-ok` click at line 416 in both runs |
| rm2k3-event-layer-interactions.spec.ts | NPC graphic slot selection stays staged until the event editor is applied | ✘ FAIL | ✘ FAIL | **PRE-EXISTING** — same `getByRole('radio', { name: 'Down' }) Expected: checked` not found at line 451 in both runs. Claim that rgb(0,128,0) at :449 is fixed is **REFUTED by this run** — the test never reaches :449; it fails earlier at :451. (The green-preview assertion may have been mis-located.) |

Overall: claim "3 of 4 rm2k3 tests fail pre-retheme" is **confirmed** (in fact 3 of 4 fail identically before and after; 1 passes in both). Claim "figma narrower viewports pre-existing" is **confirmed as FAIL→FAIL** but with a different root-cause at baseline vs HEAD (so the specific overflow is a NEWLY-VISIBLE regression gated behind the fixed cream colors). No test flipped from PASS at baseline to FAIL at HEAD — no NEW REGRESSION by strict PASS/FAIL.

## Raw reporter lines (quoted)

### Baseline (C:/.../_baseline-check, port 4373)
```
  ✘  1 [chromium] › test\e2e\figma-editor-redesign.spec.ts:216:1 › Figma-like editor shell and Korean event context menu match the dark mockup (27.3s)
  ✘  2 [chromium] › test\e2e\figma-editor-redesign.spec.ts:232:1 › Figma-like editor shell keeps Korean labels readable at narrower viewports (7.5s)
  ✓  3 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:237:1 › event layer canvas selects on first click and opens the editor on double click (11.3s)
  ✘  4 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:277:1 › event editor owns double-click and picker cancellation one layer at a time (32.6s)
  ✘  5 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:357:1 › event layer canvas opens the RPG Maker context menu on right click (39.8s)
  ✘  6 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:436:1 › NPC graphic slot selection stays staged until the event editor is applied (13.3s)
  5 failed
  1 passed (2.5m)
```

Baseline failures (first assertion / timeout source):

- figma:216 — `Error: expect(received).toBe(expected) // Object.is equality` / `Expected: "rgb(17, 19, 24)" / Received: "rgb(15, 17, 23)"` at `figma-editor-redesign.spec.ts:195:28` inside `expectModernEditorShell`.
- figma:232 — identical `Expected: "rgb(17, 19, 24)" / Received: "rgb(15, 17, 23)"` at `figma-editor-redesign.spec.ts:195:28` (never reaches the narrower-viewport overflow check).
- rm2k3:277 — `Test timeout of 30000ms exceeded.` / `waiting for getByTestId('event-editor-modal').getByRole('button', { name: 'List', exact: true })` at `rm2k3-event-layer-interactions.spec.ts:306:67`.
- rm2k3:357 — `Test timeout of 30000ms exceeded.` / `<div class="event-subdialog-backdrop" data-testid="event-transfer-player-dialog">…</div> intercepts pointer events` waiting for `event-editor-ok` click at `rm2k3-event-layer-interactions.spec.ts:416:45`.
- rm2k3:436 — `Error: expect(locator).toBeChecked() failed` / `Locator: getByRole('radio', { name: 'Down' }) Expected: checked` at `rm2k3-event-layer-interactions.spec.ts:451:59`.

### HEAD (worktree-lucky-valley-fcfc, port 4374)
```
  ✓  1 [chromium] › test\e2e\figma-editor-redesign.spec.ts:216:1 › Figma-like editor shell and Korean event context menu match the dark mockup (27.9s)
  ✘  2 [chromium] › test\e2e\figma-editor-redesign.spec.ts:232:1 › Figma-like editor shell keeps Korean labels readable at narrower viewports (9.0s)
  ✓  3 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:237:1 › event layer canvas selects on first click and opens the editor on double click (10.2s)
  ✘  4 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:277:1 › event editor owns double-click and picker cancellation one layer at a time (33.3s)
  ✘  5 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:357:1 › event layer canvas opens the RPG Maker context menu on right click (35.8s)
  ✘  6 [chromium] › test\e2e\rm2k3-event-layer-interactions.spec.ts:436:1 › NPC graphic slot selection stays staged until the event editor is applied (14.2s)
  4 failed
  2 passed (2.6m)
```

HEAD failures:

- figma:232 — `Error: expect(received).toEqual(expected) // deep equality` / `+ Object { "client": 166, "scroll": 184, "text": "타일 칠하려면: 바닥/장식으로 전환", }` / `expect(metrics.statusLabelsOverflow).toEqual([])` at `figma-editor-redesign.spec.ts:209:40`.
- rm2k3:277 — same `waiting for getByTestId('event-editor-modal').getByRole('button', { name: 'List', exact: true })` at `:306:67`.
- rm2k3:357 — same `event-transfer-player-dialog intercepts pointer events` waiting for `event-editor-ok` at `:416:45`.
- rm2k3:436 — same `getByRole('radio', { name: 'Down' }) Expected: checked` at `:451:59`.

## Notes & caveats

- The figma wider-viewport test FIXED at HEAD because the retheme moved the pinned colors to cream (the baseline color failure ate that spec too).
- For figma:232 the overflow was not observable at baseline due to the earlier color failure; a rerun of baseline with cream-pinned expectations would be needed to prove the overflow existed pre-retheme — on strict reporter lines it counts as PRE-EXISTING, not NEW.
- rm2k3 tests were stable across runs (no flip). Flakiness rerun not needed.

## Cleanup

Intended: revert vite.config.ts patch in _baseline-check (untracked change), remove junction, `git worktree remove .../_baseline-check --force`, kill servers (npx did), confirm `git status --porcelain` in main worktree shows only .omo/evidence outputs and temp `_*output*.txt` files (to be removed) and not the vite patch (which is in the detached worktree only).
