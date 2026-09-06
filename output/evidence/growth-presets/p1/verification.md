# Phase 1 growth art verification

## Verdict and verified revision

Automated real-surface QA: **PASS** on `f6c4a99d` plus export fix `ecfb467f`.
`ecfb467f` is the lead-requested cherry-pick of `63b50925`; the formerly missing
`book-sword.png` and `skill-book.png` export entries are fixed, not blockers.
Only the two growth QA entry points, their direct helper, and this report belong
to the QA commit. No product fix was made by this QA task.

**Visual verdict: PASS from the independent image-capable reviewer.** This child
cannot receive image attachments and does not claim to have personally viewed
them. The lead supplied the completed image-capable `st_01a073ed` review; this child
read its report before closing. It approves artwork, Korean readability, and all
three desktop sizes. Real wheel/focus/hit-test rechecks show all five lower
inspector controls reachable above the footer; initial clipping suspicion was
normal scrollable content, not a product defect. No product blocker remains.

## External supervisor evidence (read and attributed, not rerun here)

Parent evidence root:
`/home/main/.herdr/worktrees/rpg-zzu/wish-2/output/evidence/growth-presets/p1/`.

- `growth-presets-manual-qa.md`: independent image-capable visual **PASS**;
  per-screen artifact table, baseline comparison, CJK review, and inspector
  wheel/focus/hit-test results at 1024/1280/1440. This closes the visual-review
  capability limitation of this child.
- `supervisor-gates.md`: `npm run gates -- --json` exited **1**, not green.
  Typecheck/CSS passed; full Vitest had 289 failures. Reproduction of 66 flagged
  files on original `e07cd4f8` and candidate found **29 identical failures**.
  The sole candidate-only village case then passed isolated on both revisions.
  Supervisor classification: no reproducible new failure attributable to growth.
  No tests or baselines were weakened. This report was read in full.
- Lead additionally reports full build on `63b50925` (same product tree as
  `ecfb467f`) exited 0 for all targets with 60 runtime assets. This is attributed
  to the lead; this child's independently executed build also exited 0 below.
- Lead explicitly directed closure without further full-test/build/visual loops;
  those completed external gates are not left as an outstanding promise.

## Isolation and command journal

All executions were in `/home/main/z-project/rpg-zzu-growth-art-p1`, branch
`agent/growth-art-p1`. Read AGENTS, quickstart, PROJECT_WIKI, editor routing,
observability, growth trees, runtime routing, relevant source, and programming,
frontend audit, visual-QA, and git-master guidance. JS-eval/delegation tools were
not exposed; available parallel tool batching and Node browser evaluation were used.

The exact requested `GROWTH_QA_BASE=http://127.0.0.1:9841 node scripts/qa/growth-tree-studio.mjs`
was **not run**: `ss -ltnp 'sport = :9841'` identified PID 2252417, and
`readlink /proc/2252417/cwd` returned `/home/main/z-project/rpg-zzu` (main).
No server was started or stopped on that occupied port. The predecessor's
`server-handoff.json` explicitly provides port 9849 instead; PID 2882428 has cwd
`/home/main/z-project/rpg-zzu-growth-art-p1`. The alternative below is the actual
verified command, not a claim that the 9841 command passed.

Commands redirected stdout/stderr directly to the named log, captured `$?`
immediately, appended `EXIT=<status>`, and returned that status. No pipeline
exit was substituted for a validator exit.

| Command | Exit/result | Evidence (relative to this directory) |
| --- | --- | --- |
| `git cherry-pick 63b50925` | 0; produced `ecfb467f` | git history; only runtime inventory and export tests |
| `GROWTH_QA_BASE=http://127.0.0.1:9849 node scripts/qa/growth-tree-studio.mjs` | 0 | `qa-editor.log`, `editor/editor-report.json` |
| `node scripts/qa/growth-tree-runtime.mjs` | 0 | `qa-runtime.log`, `runtime/SUMMARY.md`, `runtime/interaction-report.json` |
| `npm test -- test/growthTrees.test.ts test/growthTreeArt.test.ts test/growthTreeArtSurfaces.test.ts test/growthTreeArtExport.test.ts` | 0; 34 tests / 4 files | `qa-tests-final.log` |
| `npm run typecheck:app` | 0 | `qa-typecheck-final.log` |
| `npm run build` | 0; app, player SDK, standalone bundle | `qa-build.log` |
| `node --check scripts/qa/growth-tree-studio.mjs` | 0 | tool execution; no syntax diagnostics |
| `node --check scripts/qa/growth-tree-runtime.mjs` | 0 | tool execution; no syntax diagnostics |
| `node --check scripts/qa/growth-tree-evidence.mjs` | 0 | tool execution; no syntax diagnostics |
| LSP diagnostics on all three QA modules and cherry-picked export test | no diagnostics | tool results |
| `node output/evidence/growth-presets/p1/audit-screenshots.mjs` | 0 | `qa-screenshot-audit.log`, `qa-screenshot-audit.json` |
| `git diff --check` | 0 | tool execution |

Prior validation attempts are retained, not hidden:

- Same editor command, tool deadline 300 seconds: interrupted during setup,
  not an assertion failure (`qa-editor-timeout.log`). No process exit was
  returned by the tool; no success or cleanup receipt is claimed for that attempt.
- Editor exit 1: a redundant `scrollIntoViewIfNeeded` held a detached node after
  rerender (`qa-editor-detached.log`). Locator.click now owns scrolling and
  re-resolution; no product behavior was changed.
- Editor exit 1: intercepting an already-decoded URL produced no 404 request, so
  the badge-state deadline expired (`qa-editor-cache-injection.log`). The fixed
  fixture maps through the real inline-asset resolver to a fresh URL, subscribes
  before redraw, and asserts both HTTP 404 and actual DOM badge replacement.
- Runtime surface-only run exit 0 (`qa-runtime-surface-pass.log`); the later
  export-aware run correctly exited 1 for two omitted paths before the fix
  (`qa-runtime-before-export-fix.log`). Final export-aware run exits 0.
- Initial targeted tests: 30 tests / 3 files, exit 0 (`qa-tests.log`). Initial
  app typecheck exit 0 (`qa-typecheck.log`). Final expanded commands above include
  the cherry-picked export tests and inventory.
- An additional editor surface pass preceded reinstating the original >=200px
  canvas-width assertion (`qa-editor-surface-pass.log`). Final editor pass retains it.

Build warnings remain visible in `qa-build.log`: bundle-size warnings and public
runtime image URLs intentionally left to runtime resolution. Editor console logs
contain localhost assistant-bridge CORS failures and temporary-session autosave
failures. These are reported, not suppressed. Final editor and player `pageerror`
arrays are empty. No Lighthouse score is claimed.

## What the passing checks establish

- Editor: real toolbar -> database -> growth tabs; tree/node creation and rename,
  six connections, illegal cycle rejection, arrange, zoom-out, Alt+arrow movement,
  pointer drag, invest/reset preview, dirty-close guard, tab return, duplicate,
  node deletion, and confirmed tree deletion. Changes stay in the temporary session.
- Editor images: **88 decoded image instances**, **0 unexpected load failures**
  across graph, catalog, and inspector captures. Every image has nonzero natural
  and rendered dimensions, fits its immediate slot, and is non-draggable.
  HTTP 404 produces **7 text badges**, covering graph, catalog, and inspector.
  Unknown class and dangling skill reference render loaded semantic book art;
  the dangling skill retains the invalid-node marker.
- Runtime: a separate `startPlayerQaServer` boots `/player.html` via `runRuntimeQa`
  and the export store shim; the editor toolbar is asserted absent. Real keyboard
  input verifies prerequisite lock -> 3P after passive -> 2P after skill -> promotion
  -> class-tree deactivation -> 5P after refund.
- Runtime images: **12 decoded image instances**, **0 unexpected load failures**;
  passive, skill, reset, and custom-class book images load in the real menu.
  HTTP 404 preserves the readable enabled promotion row, and actual keyboard
  promotion succeeds while its art is absent. This is the existing background-image
  fallback contract; **no replacement runtime badge/image is claimed**.
- Export: all 4 distinct paths observed in runtime are in the actual 191-asset
  export plan (`runtime/export-asset-audit.json`, `missing: []`). The additional
  4 export tests verify all 15 semantic icons, actual ZIP PNG bytes, standalone
  inline PNG data, sorted inventory, and real files without incidental references.
- Layout: editor panes, toolbar, and canvas controls and player menu/title/tabs
  stay inside 1024x768, 1280x800, and 1440x900, with no horizontal overflow in those
  checked containers; editor canvas remains >=200px. Art fits its slot. Graph
  overflow is deliberately scrollable; this does **not** assert that an entire
  multi-column graph or all inspector sections are simultaneously visible.
- Screenshot audit: **17 fresh captures** have valid PNG decoding and matrix
  dimensions. **30 representative icon samples** contain opaque colored pixels
  from their actual source PNG palettes in the captured image rectangles. This
  corroborates painted images rather than merely DOM attributes; it is not a
  perceptual/CJK verdict or a full pixel-perfect reference comparison.
- All explicit delays were removed from runtime key input. DOM changes and image
  events are subscribed before triggering actions, with bounded failure deadlines.
  No sleeps or polling delays were added.

## Fresh screenshots for lead review

Paths below are relative to this directory; images remain ignored/untracked.
Old `failure.png`, `failure.txt`, and `partial-report.json` are retained diagnostic
artifacts from earlier attempts, **not** final screenshots or current failures.

| Screenshot | Dimensions |
| --- | --- |
| `editor/skill-1024.png` | 1024x768 |
| `editor/skill-1280.png` | 1280x800 |
| `editor/skill-1440.png` | 1440x900 |
| `editor/promotion-1024.png` | 1024x768 |
| `editor/promotion-1280.png` | 1280x800 |
| `editor/promotion-1440.png` | 1440x900 |
| `editor/missing-assets-1440.png` | 1440x900 |
| `editor/custom-missing-skill-1440.png` | 1440x900 |
| `editor/custom-class-1440.png` | 1440x900 |
| `runtime/growth-invested-1024.png` | 1024x768 |
| `runtime/growth-invested-1280.png` | 1280x800 |
| `runtime/growth-invested-1440.png` | 1440x900 |
| `runtime/growth-custom-promotion-1024.png` | 1024x768 |
| `runtime/growth-custom-promotion-1280.png` | 1280x800 |
| `runtime/growth-custom-promotion-1440.png` | 1440x900 |
| `runtime/growth-missing-art-1440.png` | 1440x900 |
| `runtime/growth-promoted-refunded.png` | 1440x900 |

The runtime harness also retains field/menu beat screenshots listed in
`runtime/SUMMARY.md`. Inspect the 1024px skill/promotion pairs first, then both
larger pairs and fallback/custom states. Functional/source review passes; the
separate visual/CJK charter is approved by the image-capable reviewer in the
external report above, not inferred from this child's numerical checks.

## Cleanup and handoff

- `editor/cleanup.json`: browser closed, remote-write attempts `[]`, no persistent
  content created. `runtime/cleanup.json`: browser closed, owned player-QA server
  closed, temporary contract JSON removed, remote-write attempts `[]`.
- A final process query found no running `node scripts/qa/growth-tree-*.mjs`.
  The pre-existing 9849 editor server is deliberately left available for lead
  review; it was not owned/started by this QA task. Main's 9841 server is untouched.
- HTTP fault routes and inline-asset test mappings are removed after their checks;
  browser context closure removes temporary local storage and fixture edits.
  No Supabase write, new schema, demo content, dependency, push, merge, or PR.
- The PNG audit script and generated JSON/logs are local evidence. Only this
  verification report is force-added from the ignored evidence directory; no
  temporary PNG is committed.
- Lead gates and image-capable visual review are completed and classified in the
  external reports above. The original port-9841 command remains unverified for
  isolation reasons, not a product failure. No further validation loop is pending.
