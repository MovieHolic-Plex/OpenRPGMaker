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
remote project/AI writes. It never touches the shared Supabase project. No new
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
