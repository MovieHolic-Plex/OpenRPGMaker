# OUT-007 focused patch evidence

Base: `15b95dc138ea71602f2cabf7d9cce9a10584f498`.
Worktree: `rpg-zzu-issue693-assets`; branch: `fix/issue693-assets`.

## Finding and scope

The real Event editor > graphic picker > advanced direct-ID input accepted an
unavailable charset and closed the picker. This entered a dangling sprite ID in
the local event draft. No broad character-data-loss finding is claimed.
The existing shared AI query path already reports `graphic-not-found`, preserves
the complete project on rejection, and supports explicit manual/transparent retry.
Its incompatible `old woman monster` query is covered without changing the resolver.

The picker now returns a local typed no-match, preserves the input and project,
and exposes manual selection, explicit no-image and cancellation through the
existing components. Confirmation rechecks the shared catalog, including uploads
removed after opening. Empty catalogs no longer throw on render. No network,
decode, generation or save exception is caught and relabelled as a lookup miss.

## Red and green

- Browser red: `node scripts/qa/character-asset-recovery.mjs --reproduce`
  failed with `pickerOpen: false`, expected true, before production edits.
- Test red: `NODE_DISABLE_COMPILE_CACHE=1 npm test -- test/npcGraphicRecovery.test.ts`
  produced 4 expected failures (unknown ID, cancellation after miss, empty catalog,
  removed upload) and 1 pass (existing incompatible-query/retry behavior).
- Test green: `NODE_DISABLE_COMPILE_CACHE=1 npm test -- test/npcGraphicRecovery.test.ts test/npcGraphicPickerRich.test.ts test/charsetQuery.test.ts test/placeNpcGraphicQuery.test.ts`
  passed 27 tests in 4 files. Changed TS/JS files have clean LSP diagnostics;
  `node --check scripts/qa/character-asset-recovery.mjs` and `git diff --check` pass.
- Firefox browser runs passed at 1024x768, 1280x900 and 1440x900: no-match request
  retention, zero event mutation, cancel, manual retry, no-image, preserved dialogue
  and event save. The final 1280 run also asserts that Save removes the draft flag.

Local artifacts (not committed): `output/evidence/issue693-assets/` contains
`before.json`, `before-no-match.png`, `red-tests.log`, `green-tests.log`, and
`1024/`, `1280/`, `1440/` with `recovery-<width>.json` and fresh screenshots.
Empty catalogs use a focused catalog stub only in the unit regression; the browser
uses the actual bundled catalog, project store and editor, with no mocked assets.

## Independent rerun

Check port 38424 is free before starting; never reuse adoption's 9841 port.

```sh
mkdir -p /dev/shm/rpg-zzu-issue693-assets/tmp
export TMPDIR=/dev/shm/rpg-zzu-issue693-assets/tmp
export VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-assets/vite
export DEV_SERVER_PORT=38424 NODE_DISABLE_COMPILE_CACHE=1
npm run dev:worktree
# In another terminal, same worktree:
QA_WIDTH=1280 BASE_URL=http://127.0.0.1:38424 node scripts/qa/character-asset-recovery.mjs
# Focused tests on a disk-constrained host:
npm test -- --maxWorkers=1 test/npcGraphicRecovery.test.ts test/npcGraphicPickerRich.test.ts test/charsetQuery.test.ts test/placeNpcGraphicQuery.test.ts
```

The browser driver creates only a temporary freshProject event draft and blocks
remote project/AI writes. It never touches the shared LegacyDb project. No new
production content, dependency or resolver abstraction is included.

## Limitations and infrastructure

An initial test attempt hit ENOSPC before collecting any tests. Disabling the
inherited Node compile cache allowed the behavioral red and green runs above.
Two parallel viewport runs hit the tool's 120-second outer timeout after manual
recovery screenshots; separate bounded runs then completed successfully. Those
infrastructure timeouts are not reported as code failures or passing evidence.
There were no failed or truncated source writes; `git diff --check` is clean.
The image-reading tool cannot render images for this model; screenshots and DOM
geometry are captured, not independently visually approved. Full gates/build,
independent visual review and PR integration remain lead-owned.

## Follow-up: no-image -> saved draft -> manual graphic (2026-09-08)

Reviewed base: `a88aa08d5aa68e858817b8348a18bf2a25c3512b`.
The suspected regression reproduced. The placeholder action set `transparent`
while removing `sprite`; the normal confirmation path intentionally preserves
authored graphic fields. `pageProps.ts` exposes transparency as a separate hide
checkbox, and `editorEventMarkerTexture` returns null for either no sprite or
`transparent: true`. Consequently, the new placeholder unnecessarily enabled a
persistent hide setting that survived reopening the picker and saving a selection.

The fix removes only that forced transparency assignment. No-image still removes
the sprite and has no map image; undefined/false/true authored transparency is
preserved. Confirmation and the resolver are unchanged. Existing saved `true`
flags are not migrated: they cannot be distinguished from intentional hiding;
the existing hide checkbox remains the way to unhide them.

- Test red: the three added round-trip cases produced two expected failures:
  `expected true to be undefined` and `expected true to be false`. Intentionally
  hidden graphics and all five existing recovery tests passed.
- Browser red (Firefox, 1280x900, port 38424): no-image -> Save -> reopen editor
  -> picker -> People1 slot 3 -> Confirm produced `hidden: true`, `marker: null`
  with a valid sprite ID/frame 34. The new assertion failed on `true !== false`.
- Green: the focused command below passed **30 tests in four files in one run**.
  Coverage retains empty catalog invisibility, cancellation, removed uploads,
  query atomicity, authored data and intentional hiding, and adds visible recovery.
- Browser green: the same real UI round trip reports `hidden: false` and marker
  `{ texture: "tex_easyrpg_charset_people1", frame: 34 }`; a second Save preserves
  the recovered graphic, dialogue and page name with no draft flag or page errors.
  This extends rather than replaces the original no-match/cancel/no-image checks.
- Changed TS/JS LSP diagnostics, `node --check` and `git diff --check` pass.
  `npm run typecheck:app` and the editor production build pass. Vite reports
  mixed static/dynamic import and chunk-size warnings, plus the intentional
  outside-root output-directory notice. Full repository gates/export builds
  were not run for this focused follow-up. Markdown has no configured LSP.

```sh
export TMPDIR=/dev/shm/rpg-zzu-issue693-assets/tmp
export VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-assets/vite
export NODE_DISABLE_COMPILE_CACHE=1 DEV_SERVER_PORT=38424
npm test -- --maxWorkers=1 test/npcGraphicRecovery.test.ts test/npcGraphicPickerRich.test.ts test/charsetQuery.test.ts test/placeNpcGraphicQuery.test.ts
BASE_URL=http://127.0.0.1:38424 QA_WIDTH=1280 node scripts/qa/character-asset-recovery.mjs
npm run typecheck:app
npm run build:app -- --outDir /dev/shm/rpg-zzu-issue693-assets/build
```

Local artifacts: `output/evidence/issue693-assets/roundtrip/` contains red/green
test and browser logs, typecheck/build logs, and `roundtrip-red/` and
`roundtrip-green/` JSON and screenshots. Temporary execution artifacts are also
under `/dev/shm/rpg-zzu-issue693-assets/evidence/`. An initial cold-server browser
attempt timed out waiting for the canvas; a separate boot diagnostic loaded the
editor successfully before the behavioral red run. Screenshots were captured
but cannot be visually reviewed by this model. No remote content was written.
