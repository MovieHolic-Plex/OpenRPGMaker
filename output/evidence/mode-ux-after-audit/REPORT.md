# After-mode workflow audit: pre-final-CSS evidence; handoff ready

Task st_01a073ad. Product source was read-only for this child. Original lead evidence and lead-qa.mjs were not overwritten. Lead owns server http://127.0.0.1:29887; it was not stopped.

## Revision boundary and verdict

The corrected lifecycle auxiliary completed **8/8 workflow checks** at 1280x800 and 1024x768, plus six state-preserving mode transitions and six expert advanced-menu open/close checks. Both contexts and the browser closed successfully.

**This is not final verification of the latest source.** After that run, the lead reported a separate freshProject expert/1440 failure: toolbar wrapping produced a 134px toolbar and 104px map list, violating >=108. The lead then changed toolbar scroll flex to `1 1 0`. That latest CSS change was not exercised by this child. The lead is taking ownership of the final auxiliary and freshProject e2e reruns.

Verdict on the measured pre-fix blank-project scenario: bounded sidebar workflow PASS, with existing shell/accessibility issues below. Overall latest-source verdict: pending lead rerun, not a blanket product PASS.

## Scores using the before REPORT rubric

These are functional/geometry engineering judgments for the measured pre-final-CSS snapshot, not visual-design certification or scores for the unverified latest revision.

| Rubric | Weight | Beginner | Standard | Expert |
|---|---:|---:|---:|---:|
| Real tile selection, painting, undo and retained state | 30 | 30 | 30 | 30 |
| Discoverability and repeated painting workflow | 25 | 24 | 20 | 23 |
| Accessibility and control targets | 20 | 16 | 14 | 15 |
| Canvas budget and supported narrow layout | 15 | 11 | 10 | 9 |
| Meaningful mode differentiation | 10 | 9 | 8 | 9 |
| **Total** | **100** | **90** | **82** | **86** |
| Before baseline | 100 | 73 | 77 | 71 |
| Change | | +17 | +5 | +15 |

Beginner gains a persistent working palette and labeled recovery action but trades 216px of canvas width for it. Standard retains its working surface and gains larger utility targets. Expert earns its differentiation through directly operable inspector, rules, and history menus. Narrow shell overflow and an unlabeled/non-focusable canvas constrain all claims of completeness. The separately reported multi-map regression is outside this blank-project coverage; do not use these scores to dismiss it.

## Exact failures and auxiliary correction

1. Original lead trace `../mode-ux-after/1280-trace.zip`: `TypeError: Cannot read properties of null (reading 'events')` in readiness evaluation. Its network records show both `/src/app/mode.ts?t=1788646072274` and `/src/app/mode.ts`. Source `mode.ts` owns a module-local game singleton. Importing the untimestamped module is not a reliable way to read the instance started by the timestamped application graph. Canvas visibility alone also does not establish EditScene readiness. This was harness failure, not an observed paint failure.
2. Requested unchanged Node import/replay: `page.goto: Timeout 30000ms exceeded`, awaiting domcontentloaded. See root `result.json`, `audit.log`, and `1280-trace.zip`. Context and browser cleanup completed.
3. Auxiliary `audit-canonical.mjs` resolved store, editor-state, and mode imports using the application's actual resource URLs and increased navigation's bounded timeout to 120s. It completed both cycles. Its frame-event readiness check was then superseded to satisfy the stricter lifecycle/no-polling requirement.
4. **Handoff executable: `audit-lifecycle.mjs`.** It keeps canonical module identity and awaits `EditScene.events.once('create')`, or returns if the actual scene hook is already installed. The scene's create lifecycle installs the world-to-client hook; Phaser's SceneManager emits CREATE after calling scene.create. Missing game/scene/hook produces an explicit error; a bounded 90s timeout removes the listener. No fixed sleeps or frame polling. `node --check` succeeded and this exact module completed another 8/8 run.

The handoff module also asserts advanced dropdown visibility after physical click and absence after Escape, and records control geometry. No production/test source was edited by this child.

## Verified browser behavior

At each viewport, beginner -> standard -> expert -> beginner completed:

- Physical palette selection returned selectedTile=7 from the live canonical editor-state module.
- Beginner grid was visible without opening anything and remained visible after selection, in both initial and returned beginner.
- Physical canvas clicks changed the target lower tile to 7; upper tiles remained exactly unchanged.
- A physical click on visible `oprn-tool-undo` restored the exact complete map object.
- Another physical stroke was committed after undo, and subsequent mode transitions preserved the exact map, currentMapId, and selectedTile.
- Store mutation subscriptions were installed before paint/undo. Hidden export mirrors were not used as the authoritative state oracle.
- Search retained focus and insertion caret: fill 7, Home, type 1 -> value 17, caret 1.
- Inspector/rules/history direct controls were absent from the closed standard surface, visible in expert, and each dropdown opened and closed with Escape at both widths. This proves menu operation, not every advanced action inside those menus.
- Paint cell indices were 63,64,65,66 at each viewport. Desktop coordinates: (576,335), (616,335), (658,335), (672,335). Narrow: (448,319), (488,319), (530,319), (544,319).

`palettePersistent:false` in non-beginner PASS rows is the harness's beginner-only flag, not evidence that standard/expert palette disappears.

## Geometry and remaining issues

| Viewport | Beginner canvas | Standard canvas | Expert canvas |
|---|---|---|---|
| 1280x800 | 992x677, x=288 | 974x677, x=306 | 954x677, x=326 |
| 1024x768 | 736x645, x=288 | 718x645, x=306 | 698x645, x=326 |

Left widths: 288/300/320px. Returned beginner exactly restored its initial geometry. All eight canvas rectangles exceeded the harness floor of 600x500 and began at or beyond the left panel's right edge. Rectangles are raw canvas sizes, not unobstructed map-area measurements. The assistant was collapsed for comparison.

- Beginner undo is labeled, 88x36, and center-hit-testable. Standard/expert undo is 28x28. Measured tile-reveal and tileset-name controls are now 24px high; auto-connect is 40x24. Expert advanced controls are 32px high and center-hit-testable.
- **Existing fixture-conditioned narrow topbar defect remains:** at 1024, standard AI settings x=1018.84375 and fullscreen x=1052.84375; expert x=1030.71875 and x=1064.71875. All are 32px wide and fail center hit-testing. These match the before report. Captured after intentionally local blank-project saving displays save-error chrome; no claim is made about normal online-save layout. Beginner trailing controls remain inside the viewport.
- Canvas role, aria-label and tabindex are null in every measured state. No screen-reader or full keyboard-paint accessibility certification was performed.
- One-map blank fixture does not validate the freshProject multi-map >=108 requirement.

## Separate e2e review handoff

The reviewed `test/e2e/left-sidebar-adversarial.spec.ts` initially replaced expect.poll with a one-shot map-list clientHeight read. Source resize handling schedules map-tree fitting through requestAnimationFrame, so intervening tool assertions do not prove layout completion. This was flagged, not edited here. The lead subsequently reported adding a pre-trigger ResizeObserver/window.resize helper, then discovering and fixing the actual toolbar wrapping regression described above. Those revised test/source changes were not executed by this child. Lead owns that final validation.

## Evidence and replay

All child evidence is in this directory, separate from original lead evidence:

- `audit-lifecycle.mjs`: final handoff module; export `runLeadQa(artifact)`.
- `lifecycle/result.json`: final completed child run, ok=true, eight PASS rows, all controls, transitions, menus and cleanup receipts.
- `lifecycle.log`: execution log and returned result.
- `lifecycle/{1280,1024}-trace.zip`: real-input traces.
- `lifecycle/*-{paint,undo}.png`: 16 screenshots, signatures and exact requested dimensions validated in `image-validation.json`.
- `summary.json`: compact geometry/key-control evidence extracted from lifecycle result.
- `browser-cleanup.json`: both contexts closed and browser closed.
- `canonical/` and `canonical.log`: preceding successful canonical-import run, retained as historical evidence.
- Root `result.json`, `audit.log`, `1280-trace.zip`: unchanged Node replay timeout, retained without overwriting lead evidence.

Node replay (use a NEW output directory to preserve this evidence):

```js
import { runLeadQa } from './output/evidence/mode-ux-after-audit/audit-lifecycle.mjs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const out = resolve('output/evidence/mode-ux-final-lead');
await mkdir(out, { recursive: true });
console.log(await runLeadQa(name => resolve(out, name)));
```

Images were not viewable: the image tool explicitly reported that this model does not support images. Screenshots and PNG dimensions are evidence artifacts, not a claim of visual inspection. No full tests/build were run by this child; lead-reported build/gate results are not independently certified here. All own browser resources closed. Server and unrelated browsers remain untouched. Auxiliary ownership is handed back to the lead; no further child polish or rerun is pending.
