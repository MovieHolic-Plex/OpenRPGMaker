# Final app build receipt - exact frozen owner-transition bytes

Result: **PASS, actual npm exit 0**. Exactly one `npm run build:app` was launched.
Vite v6.4.3 transformed 1566 modules and reported `built in 1m 1s`.
This receipt closes only the app-build limitation in `../REPORT.md`; all prior
reports/manifests remain unchanged as historical evidence.

## Target / command

HEAD: `57757e41e0c233ee9ca9ef9f45ef5057ccdb1571`.
Production source SHA-256:
`8c4d6231a3f8024afecd5de42511e2eacd1643504ed47801cec77a6d3f6c14ae`.
All four files in `../frozen-files.sha256` matched before AND after this build.

```sh
cd /home/main/z-project/rpg-zzu-unbounded-integrate-01a07570
ulimit -c 0
VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570/.vite-cache/question-owner-build.4jrL2I npm run build:app
```

The existing Vite configuration consumes `VITE_CACHE_DIR`. A unique `mktemp -d`
cache was allocated for this invocation and removed afterward. Default existing
`dist` output was reused; no output-directory override or source/test/config edit.

## Disk gate

- Initial observed free: 2,111,311,872 bytes.
- Observed previous `dist` allocated footprint: 247,840,768 bytes
  (apparent content size: 242,816,004 bytes).
- Immediate pre-launch free: **17,337,651,200 bytes**, above the observed footprint.
  This was a second actual measurement, not an assumed cleanup amount.
- Final observed allocated `dist`: 247,664,640 bytes.
- Later post-build free: 16,191,225,856 bytes.
- The launch gate compared actual free bytes with the allocated footprint and would
  have exited without launching if insufficient. Core dumps were disabled locally.

## Real warnings / notices (not suppressed)

`build-app.log` retains complete stdout/stderr:
- Two Zod `@__PURE__` comment-position warnings (`core/util.js`, `core/regexes.js`).
- One circular cross-chunk re-export warning for `openRecordPickerPanel` through
  `recordPickerDialog.ts`, consumed by `databaseEnemyActionDialog.ts`.
- Six mixed static/dynamic import warnings: `playSceneInterpreter.ts`,
  `editorUiMode.ts`, `devProjectPersistence.ts`, `player/audio/index.ts`,
  `mapSelection.ts`, and `player/player.ts`.
- The chunk-size warning for chunks larger than 500 kB.
- Three configuration notices: absent APITOPIA, QWENCLOUD and CPENROUTER keys leave
  their optional proxy routes unregistered.

These categories also appear in the preceding build log. No warnings were fixed,
filtered from the saved log, or converted into a broader runtime-success claim.

## Receipt artifacts / verification

- `build-app.log`, `build-app.exit`: full output and direct command status.
- `command.txt`, `preflight.txt`, `disk-after.txt`, `dist-after.txt`: exact invocation
  and resource observations.
- `hashes-before.log`, `hashes-after.log`: all frozen source/test/wiki hashes match.
- `cache-footprint.txt`, `cache-cleanup.txt`: owned cache measurement and cleanup.
- `output.sha256`: built index and main-bundle fingerprints.
- `receipt.sha256`: this receipt package's frozen hashes.

`git diff --check` passed and tracked/untracked source status remains the same four
intended patch files. Both preceding evidence manifests still validate. The temporary
build-journal section is removed; the earlier gate journal is preserved.

No tests were repeated, no further typecheck was run, and no full product/player,
browser, provider, or whole-gate validation was launched. The earlier current-byte
46-test/LSP/typecheck evidence remains applicable. The full test harness is still
not green. No commit, push, merge, rebase or unlock was performed.
