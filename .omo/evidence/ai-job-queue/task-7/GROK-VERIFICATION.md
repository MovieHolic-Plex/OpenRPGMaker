# Task7 GROK UI / image verification

Verifier: xai/grok-4.6 (image input worked; PNGs inspected as pixels).
HEAD: `1c4a8f7a7`. No production files modified. Port 9841 not reused or killed.
This closes existing Task7 UI verification only. Task8 migration is separate.

## Verdict

**PASS**

Product UI, visual inspection (including S12 caption reachability), and this replay’s owned graceful cleanup all passed. No unresolved UI defect remains.

S12 first-viewport crop at 1280×800 is normal below-fold content. After native `scrollIntoView` on the atlas `figcaption`, the caption rectangle is inside the report-body viewport, not behind the footer, and hit-testing reaches `FIGCAPTION`. Inspected after-scroll PNGs show the full string `전체 타일 그림판 · 32 × 16`.

## Current replay (authoritative)

Loaded runner is **pre-follow-up** `run-owned.py` (mtime 2026-09-07 08:00:28 KST, the Astra `RUNNER-CLEANUP-HANDOFF.md` version). This process was already running that file; it is **not** Astra’s later unexecuted rare-cleanup fallback (exited parent + pipe-holding resistant child). This run does **not** claim that new branch was tested. Graceful HTTP shutdown succeeded, so that fallback was not entered.

```text
python3 .omo/evidence/ai-job-queue/task-7/run-owned.py grok-ui-replay \
  node .omo/evidence/ai-job-queue/task-7/grok-ui-replay-workload.mjs
```

Workload: entire `test/e2e/ai-job-inbox.spec.ts` then evidence-only `caption-scroll-probe.mjs` on the same 19841 lifetime (seeded jobs reused). `E2E_RETRIES=0`, `TMPDIR=/dev/shm`. No second 19841 launch after this receipt.

| Layer | Result | Evidence |
| --- | --- | --- |
| Playwright 3/3 | **0**, 7.7m (11.5s + 4.5m + 3.0m) | `grok-ui-replay.log` |
| Caption probe | **0**, both labels reachable | `caption-scroll-proof.json` |
| Command | **0** | `grok-ui-replay-cleanup.json` |
| Shutdown HTTP | **200** | same |
| Fixture / wrapper | **0 / 0** | same; `graceful: true` |
| Escalations / cleanupErrors / remainingPids | `[] / [] / []` | same |
| Fresh UUID | `e2170edb-0513-4ed9-a8b1-f94cd4355c57` | runner + fixture receipts match |
| Temp | `/dev/shm/task7-editor-9zej7i0s` removed | same |
| Port 19841 after | free | `portFree: true`; independent `ss` shows only 9841 |
| Paid / user-project | 0 paid; fixture providerCalls=4 held local | fixture receipt |
| `browser-cleanup.json` | not used | runner never copies it |

Fixture stage receipt: `grok-ui-replay-e2170edb-0513-4ed9-a8b1-f94cd4355c57-fixture-cleanup.json` (`stage: complete`, service/server closed, temp removed, activeBrowsers=0, errors=[]).

Matrix from this replay: `browser-evidence.json` 72 measures, 76 actions, 0 overflow, 0 browser errors. Recovery: `browser-recovery-evidence.json` 9 actions, 0 errors. Context cleanup failures `[]`.

## S12 caption proof (1280×800)

Native UI: open launcher → search seeded id → open report → locate atlas figcaption → subscribe to body `scroll` → `scrollIntoView({block:'nearest'})` → measure + screenshot.

| Label | Before | After | After PNG |
| --- | --- | --- | --- |
| tileset `e184dae6-adb5-434e-996a-df6d69a157d0` | scrollTop 0; caption bottom 729 vs body/footer 718; hit `FOOTER`; reachable false | scrollTop 11; caption 700–718; withinBody, aboveFooter, hit `FIGCAPTION`; reachable true | `caption-tileset-1280-after.png` |
| native-tileset `008aedf2-3ec8-4469-8244-57b4f8214b7e` | same first-viewport crop | same after-scroll pass | `caption-native-tileset-1280-after.png` |

GROK inspected the after PNGs: caption `전체 타일 그림판 · 32 × 16` is fully readable above the footer, not truncated. Before PNGs match the earlier OPEN first-viewport crop. **S12 closed: no defect.**

## Visual (unchanged product, confirmed on this replay’s shots)

Cool-white/indigo studio, Korean-first. Launcher in beginner/standard/expert at 1024/1280/1440. Nonmodal queue, distinct no-results, other-project apply disabled + picker, magenta artwork alpha well, map red/blue hashes, event `빼기` review, 21+ maps, usage `알 수 없음` not zero, 1024 list-return, offline retained input, save-only after auto-apply, guarded apply endpoint.

Pinned hashes (this `browser-evidence.json`):

- `9f6e3477574e5c5076084bb94f60da9ff6488a332cf7a2e189919c535b264642` rgba `[220,50,40,255]`
- `279ae7c541b01c96abcbcb1a9e662e62e4a872090c295ccd4c671acd33bbc251` rgba `[40,90,220,255]`

## Historical (superseded for cleanup; not this receipt)

Earlier `grok-ui-full` Playwright was also 3 passed / 10.8m, then old wrapper `TimeoutExpired` after shutdown 200. That harness failure is not this replay. 47 focused unit tests were not repeated (unchanged). Mixed Node/DOM `Timeout` errors in unchanged `customSelect.ts` / `showAnimationPlayback.ts` remain documented, not suppressed.

## Cleanup

After this receipt: no `/dev/shm/task7-*`, no 19841 listener, 9841 still LISTEN, no leftover owned PIDs. No further 19841 run from this task.

## Out of scope

- No production/UI TS/CSS, model, or config edits.
- Astra’s later rare KILL/pipe fallback: unexecuted here; graceful path succeeded.
- Task8 six-family submission migration.
- Fixture is Vite source on 19841, not production-preview.
