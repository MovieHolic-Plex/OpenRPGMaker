# Right-button region drag — before / after

Native OPRN editor, Playwright Chromium, same VM and viewport 1440×900. Small UI-only project fixture: 32×24, 16px tiles, zoom 1, paint tool. No model requests or canonical SQLite writes. Before production code is merge commit ca9bab5fbf; after is the local patch on that commit, identified by source SHA-256 in the JSON reports.

The pointer travels from tile (2,2) to (27,18) in 40 steps, waiting for rAF each step. Three measured drags use the same fixture and procedure. Screenshot capture runs separately. Native Chrome DevTools `devtools.timeline` records main-thread style/layout/paint costs. The trace window includes all three drags and their Escape/reset pauses; the compact `*-trace-costs.json` files contain the contributing durations without network URLs or stack metadata.

| Measurement | Before | After |
|---|---:|---:|
| Main-thread style recalculation, trace window total | 1,190.4ms | 183.3ms (−84.6%) |
| Layout, trace window total | 68.2ms | 36.0ms |
| Selection publications per drag, median | 31 | 1 |
| DOM child-list mutations per drag, median | 188 | 8 |
| Full scripted drag including rAF waits and 100ms settle, median | 1,634ms | 1,636ms |
| Long tasks ≥50ms over measured windows | 1 (max 65ms) | 2 (max 60ms) |
| Uncaught page errors | 0 | 0 |

This proves reduced UI work during the drag. The paced input sequence does not show an elapsed-time speedup. The observer's capture-pointermove-to-rAF values in the raw report are callback timing, not pixel presentation latency. Long-task counts include unrelated page work; they do not establish an improvement. Missing local account-service network requests appear in console output; no uncaught page error occurred.

After behavior checks: live 4×3 badge with no selection publication/action bar, release publishes and opens toolbar, Escape cancels without losing the previous selection or recreating it on release, reverse drag normalizes to 6×5, map-edge clipping yields 30×22, a right tap picks tile 16 with no leftover preview, and left painting still works. All seven passed, in addition to the same 26×17 endpoint/badge assertions on every timed and captured drag.

`before.gif` and `after.gif` are native screenshot sequences with **equal playback durations**. They demonstrate the live selection feedback and final action bar; they are not continuous recordings or speed evidence. Original PNGs remain beside them.

Reproduce on the corresponding production version with a fresh dev server to avoid HMR module duplication:

```bash
npm run dev:worktree
BASE=http://127.0.0.1:9911 LABEL=before TRACE=1 node scripts/qa/right-region-drag-perf.mjs
# Apply the patch and restart only this checkout's server.
BASE=http://127.0.0.1:9911 LABEL=after TRACE=1 node scripts/qa/right-region-drag-perf.mjs
python3 scripts/qa/right-region-drag-gifs.py
```

Full test suites, gates and full typecheck were not run under the session restriction. TypeScript syntax transformation, script syntax and diff whitespace were checked.
