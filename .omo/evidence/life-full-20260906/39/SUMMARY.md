# Task39 - player save/load reconciliation refusal

## Outcome and identity

Task39's three player boundaries now handle only `LifeReconciliationError` through their existing failure surfaces. The manual writer catches snapshot-construction refusal before calling Storage and uses `rejectInput`. Manual and autosave load catch apply refusal before starting/applying a restored session and use `renderLoad`. Existing localized generic failure copy is rendered as text; exception messages/source IDs are not rendered. Other construction/apply exceptions propagate. Reader selection, overwrite confirmation, storage-writer errors and success bodies are unchanged.

- Task: `st_01a0759d`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-load-errors`.
- Branch: `agent/life-full-load-errors`.
- Base/test-run HEAD: `b7f68fe23e1e1670e0d1d4bbc329708a69256f16`.
- Base tree: `28354fe57c7928181ccad11ef40a0186e05757da`.
- Tested product/test tree, staged before adding task39 evidence: `3b13b1dec8049f721fcc745dcce82402b7e81de2`.
- The final commit/tree are reported in the handoff; they additionally contain this evidence. Source hashes in both native receipts match the final source/test files (see below).
- Owned product paths: `src/player/player.ts`, `src/player/playerStatusMenuController.ts`; new test: `test/lifePlayerSaveFailures.test.ts`. Existing tests were not edited.
- B1 and approved task39 scope were read. Codec/recovery/session, task40, root state, integration worktree, shared wiki and INDEX were not edited. CLAUDE.md was ignored.

## RED before production changes

`red.log`: exit **1**, 6 cases, **3 failed / 3 passed**. All three intended refusal cases failed with `LifeReconciliationError: Life recovery shippingQueue/raw: capacity` from the actual writer/apply and actual player callbacks. The three unrelated-exception controls passed. No success callback bodies were reimplemented or extracted.

The fixture has a known `raw` item, `shippingQueue: {raw: 3}`, and structurally valid recovery `{nextSequence: 4097, claims: <4096 recovery:N claims>}`. Snapshots/old non-null manual slots are created with shipping enabled; the current project then disables shipping. Actual manual and autosave readers return `present`; `snapshotLoadBlocker` is `null`; actual apply throws typed capacity refusal. The manual case selects a real occupied slot once to confirm overwrite, then activates it again.

The initial manual failure assertions were subsequently corrected to inspect the real `emitRuntimeJuice({event})` argument shape, rather than comparing its options object to a string. No assertion was removed: final coverage retains exact one `menu-invalid`, zero success feedback, message change/text-only DOM, complete live/disk equality and no applied/restarted/destroyed scene. Title coverage and both TypeError/DataCloneError controls at every boundary were added before the one final related-suite run.

## GREEN and exact verification commands

Every heavy command was serial under `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`; each child also had the fixed `timeout` shown below. No test baseline, dependency, timeout budget, production QA setter, or successful save outcome was changed. No sleeps or polling were added. Async test/probe observations are installed before activation and use bounded exact DOM/boot signals.

All commands ran from the worktree above. `E=.omo/evidence/life-full-20260906/39` below is notation, not a different output directory.

```sh
# RED: exit1, before any production edit
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300 npm test -- test/lifePlayerSaveFailures.test.ts --maxWorkers=2 --minWorkers=1 --no-cache

# Touched-file compiler API syntactic + semantic diagnostics: exit0, before typecheck/build
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300 node .omo/evidence/life-full-20260906/39/diagnostics.mjs

# Final related tests: exit0, 9 files / 159 tests, one run of final source/test revision
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300 npm test -- test/lifePlayerSaveFailures.test.ts test/playerOpenSaveMenu.test.ts test/playerSaveSlotLoadGuard.test.ts test/playerSaveSlotLegacyFace.test.ts test/autosave.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/lifeRecovery.test.ts test/checkpointEndingRuntime.test.ts --maxWorkers=2 --minWorkers=1 --no-cache

# run.mjs records expanded argv, exit, dates and HEAD/tree in <name>.json.
node .omo/evidence/life-full-20260906/39/run.mjs typecheck
# expands to flock ... timeout 300 npm run typecheck:app; exit0
node .omo/evidence/life-full-20260906/39/run.mjs build
# expands to flock ... timeout 600 npm run build; exit0
node .omo/evidence/life-full-20260906/39/run.mjs browser
# expands to flock ... timeout 600 node E/browser-proof.mjs; Chromium exit1 (retained)
node .omo/evidence/life-full-20260906/39/run.mjs firefox
# expands to flock ... timeout 600 env TASK39_BROWSER=firefox node E/browser-proof.mjs
# navigation-harness revision exit1; node-count-harness revision exit1; corrected harness exit0
node .omo/evidence/life-full-20260906/39/run.mjs index
# expands to flock ... timeout 120 npm run openwiki:index -- --check; exit0
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 120 node .omo/evidence/life-full-20260906/39/cleanup.mjs
# exit0; includes node --check of all seven owned evidence scripts
git diff --check
# exit0
```

`diagnostics.log`: zero diagnostics for all three touched TS files, including the test. This is compiler-API diagnostics, not a claimed LSP-tool result. `green.log`: all 11 new shell/Storage cases plus all 148 related tests pass. Scene endpoints/audio/asset warmup are mocks in unit tests; shell, controller, renderers, readers, Storage, snapshot writer and apply remain real. Exception injection is confined to the unrelated-error controls.

`typecheck.log`, `build.log`: exit0. The build includes app compilation, editor bundle, exported-player bundle/SDK and standalone bundle. Existing circular-chunk, mixed static/dynamic import, unresolved runtime asset and large-chunk warnings remain in the raw build output. No whole gates/full-suite pass is claimed or required for this bounded task.

## Public API and actual native player evidence

`browser-proof.mjs` first runs a **public-module/Happy DOM Storage prelude**, independently constructing the writer fixture, verifying serialize/deserialize, both readers/prechecks/typed refusals and complete input/disk preservation. Its output is `public` in each browser-results JSON. This is NOT native browser evidence by itself.

The final **native Firefox 151.0** proof is `firefox/browser-results.json`, **exit0**, actual dedicated `http://127.0.0.1:33633/player.html` with export store shim, viewport1280x960. `startPlayerQaServer()` allocates a genuinely free dedicated port; provisioned42473 was initially not listening and was not treated as authority. Another attempt happened to allocate42473 dynamically. The final source hashes are identical across attempts and the final tree.

| Actual input/callback route | Verified outcome | Screenshot |
| --- | --- | --- |
| Title ArrowDown -> Enter: resume/autosave | One text-only status failure, all four current/legacy bytes unchanged, no restored canvas | `firefox/title-autosave.png` |
| Title load panel -> manual slot1 -> Enter | Same manual failure/no restore | `firefox/title-manual.png` |
| Actual new game -> Escape -> system group -> load -> slot1 -> Enter | One failure, unchanged complete QA readState/disk, identical live canvas/debug hook | `firefox/running-manual.png` |
| Resulting in-game load panel -> autosave -> Enter | Same failure with the existing scene retained | `firefox/running-autosave.png` |

Final native run: zero page errors, failed requests, HTTP errors and console errors. Distinct failure message nodes are counted by identity; final DOM also contains exactly one message with role=status, no child HTML and non-empty localized copy. These are controlled failure-input fixtures, not earned life gameplay or a fake successful load. Native manual-save refusal is **not** claimed; its verified scope is the real shell/controller + Storage unit fixture with mocked scene endpoints.

Screenshots are genuine captured1280x960 PNGs; dimensions/hashes are in `cleanup.json`. Visual image inspection is unavailable in this child: the image read tool explicitly reported that the current model cannot view images. The verified native UI claims are DOM/input/state assertions, not an aesthetic or clipping review.

### Failed native/harness attempts remain failures

1. `browser-results.json`, `browser.json`, `browser.log`, `failure.png`, `browser-chromium-attempt.mjs`: Chromium149 at39935, navigation200 but **73 ERR_NETWORK_CHANGED module fetch failures**, no HTTP errors; title did not boot, no UI cases executed, exit1. No Chromium retry or transport shim was used. Parent later reported the same transport failure on task40; this receipt remains intact.
2. `firefox-navigation-attempt/` plus matching top-level JSON/log/script: independent installed Firefox at36899, exit1. `page.goto(...domcontentloaded)` accidentally used the10000ms action deadline despite the prearmed120000ms title DOM deadline. Captured HTML already contained title-new-game. The harness now uses navigation `commit` and its existing exact title-ready signal, not a longer timeout or a sleep.
3. `firefox-observer-attempt/` plus matching top-level JSON/log/script: Firefox at42473 reached actual autosave refusal, exit1 because a naive nested-added-node count returned2. Captured DOM independently contains **one** failure message/window. The same message can appear through both added parent and descendant mutation records. Corrected the observer to a Set of actual message nodes, retained count===1 and final DOM count===1 assertions. No production/UI change or weaker assertion was made.
4. Final corrected harness: Firefox at33633, all four cases pass in one execution. No blind unchanged retry-to-green, timeout increase, suppressed error, injected result, dependency install or remote DB write occurred.

## Preservation, cleanup and serial integration notes

`cleanup.json`/`.log` report no task-root Node/Chromium/Firefox runtime leaks, all own untracked dist/cache output removed, no tracked/shared cache deletion, tracked `.vite-cache/deps` byte-identical to base. Every browser/server/context was awaited closed even on failure; each used-port connection check returned ECONNREFUSED. Browser raw receipts' literal public/browser cache cleanup did not cover the environment-selected `st_01a0759d-firefox-cache`; final cleanup explicitly removed it and recorded that correction.

Shared `openwiki/INDEX.md` is unchanged, working/base blob both `ad2dd527f66a6092b8f096e4294e965ef011fd40`; final `openwiki:index -- --check` exit0. No necessary documentation correction was identified: existing approved failure/preservation behavior is now consumed at the missing boundaries. Parent may add a task39 regression/evidence link during serial documentation integration, but no policy rewrite is needed.

Final verified SHA256 values:

- `src/player/player.ts`: `ef42c64ff5b9efe7233fb5b43f18a424400fd97c34faa3db5866c0a2ca369593`
- `src/player/playerStatusMenuController.ts`: `e4bd1b24758c62338b1a871712222b2412b9c4b8c01c9cdd45af9295f2504155`
- `test/lifePlayerSaveFailures.test.ts`: `3aa9cdd2fe3cb299822e44310f3801198150f0c7cf7251eefcfd3ed29390ea90`

Only owned source/test/evidence paths are staged for the requested scoped commit; no push, PR, merge or amend is performed.

Evidence packaging: the first staged `git diff --cached --check` returned2 on original Vite trailing spaces and test/tsc final blank lines. `build.log`, `green.log`, `red.log` and `typecheck.log` are therefore stored as `.log.gz`, compressed with `gzip -n` and verified byte-for-byte against their originals with `cmp` before replacing the plain copies. All references above denote those exact raw outputs (`gzip -dc <path>.gz` to read); no warnings, failures or bytes were sanitized. Final staged whitespace check is rerun after lossless packaging.

## Parent-replay follow-up

Parent replay of e9522cb1 failed the first title-load-window wait (158passed/1failed); its browser did not run. The test-only correction, controlled old-flow RED with actual DOM/callback capture, and fresh160-test/native GREEN are recorded in [observation-correction/SUMMARY.md](observation-correction/SUMMARY.md). The observer timeout and success criteria were not loosened: title navigation is now verified setup before prearming the Enter action. The initial159-pass evidence above is historical, not a claim that the parent's failed replay passed. Production remains unchanged; the final test hash is in the follow-up. Parent-owned receipt/probe files remain untouched and unstaged.
