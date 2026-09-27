# App (Electron) save profile - main @ c39f52029

Real Electron app (`dist-electron/main.cjs` + packaged renderer `dist/`), under Xvfb, driven by Playwright `_electron`.
Project: copy of the real 82MB project `ce922871` (`/tmp/oprn-perf-proj`, SQLite backup of the host row), map `map_blank_start`.
Cycle: `paint_tiles` 1 cell through `__oprnEditorTool` -> menu save (`oprn:lifecycle.save`) -> wait until the SQLite `project.revision` increments.
CPU profile: CDP `Profiler` (500us sampling) over 4 cycles -> `main.cpuprofile` (open in Chrome DevTools > Performance). Raw numbers: `main.json`.

Boot to editable: 32776 ms.

| cycle | paint_tiles ms (1 cell) | menu save -> revision+1 ms |
|---|---:|---:|
| 0 | 5414 | 25292 |
| 1 | 8485 | 17874 |
| 2 | 6838 | 26750 |
| 3 | 7987 | 26682 |

Profile window 127047 ms: idle 42661 ms, GC 17021 ms, (program) 17547 ms.

## Inclusive time (whole window, 4 paint+save cycles)

| function | inclusive ms |
|---|---:|
| persistCurrent (store.ts, 4 saves) | 24320 |
| cloneProjectSharingReferenceDocuments (projectClone.ts) | 10145 |
| summarizeChanges (changeset.ts, commit-log diff) | 9431 |
| shareContentDigests (contentDigest.ts) | 6196 |
| nodeToken (contentDigest.ts) | 10078 |
| createDraft (changeset.ts, tool draft) | 5181 |
| tokenOf (contentDigest.ts) | 10078 |
| isFresh (contentDigest.ts) | 2848 |

## Top self time

| function | self ms |
|---|---:|
| (idle) | 42661 |
| (program) | 17547 |
| (garbage collector) | 17021 |
| cloneProjectSharingReferenceDocuments (projectClone.ts) | 9864 |
| summarizeChanges (changeset.ts, commit-log diff) | 9401 |
| shareContentDigests (contentDigest.ts) | 6194 |
| nodeToken (contentDigest.ts) | 5663 |
| createDraft (changeset.ts, tool draft) | 5106 |
| getBoundingClientRect | 2039 |
| compress main-DxuWfPSi.js | 1564 |
| ft tilePalette-CPM5e54C.js | 1506 |
| tokenOf (contentDigest.ts) | 1273 |
| xHr main-DxuWfPSi.js | 1156 |
| r main-DxuWfPSi.js | 562 |

## Reading

- Network is not involved (IPC only), yet one save is ~18-27 s and a one-cell tool paint is 5-8 s. The cost is the renderer copying and comparing the 82MB document.
- `cloneProjectSharingReferenceDocuments` (deep clone of every tileset on each store.update and each save), `createDraft` (tool draft deep clone), `summarizeChanges` (commit-log diff that JSON.stringifies each non-identical tileset), and the digest memo walk (`shareContentDigests` / `nodeToken` / `isFresh`) are all proportional to total tileset size, not to the edit.
- GC 17021 ms is the by-product of those copies.
- Minified names were mapped by reading the bundle text at each profiled location (no source map in the packaged build).


## After: perf/share-unchanged-tilesets (on main @ 9b91bb4d8)

Same harness, fresh copy of the same project. Note: the "main" run above was an older main (c39f52029);
main has since gained its own save-path work, so the app numbers below include both. The Bun table isolates this change.

Electron app (`branch.cpuprofile`, `branch.json`), boot 33809 ms:

| cycle | paint_tiles ms (1 cell) | menu save -> revision+1 ms |
|---|---:|---:|
| 0 | 3847 | 15475 |
| 1 | 4095 | 13262 |
| 2 | 4965 | 7677 |
| 3 | 4244 | 6656 |

GC 10231 ms (was 17021).

Same-script comparison against current main @ 9b91bb4d8 (Bun, real `ProjectStore` + `createElectronRepository`, bridge stub, 5 cycles of tool paint -> `store.update` -> `flush`):

| | main 9b91bb4d8 | this branch |
|---|---|---|
| tool paint (1 cell) | 2977-3227 ms | 1596-1758 ms |
| `store.update` (title edit) | 950-1123 ms | 178-199 ms |
| `flush` after cycle 0 | 7006-14200 ms | 3223-3692 ms |
