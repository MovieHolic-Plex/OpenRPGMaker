# Third-review candidate: lead verification

Production repair and latest-main merge:
`fb0488864b277b7a67847e88453efb4fad1ffb38`.
Integrated main: `83bd6098d94dd6d7082d2ded6d557be928592623`.

## Executed checks

- Locked-candidate focused Vitest: **178 passed, 0 failed** across 15 files.
  Report: review checkout `.omo/round2-parent-tests.json`.
- Real PostgreSQL dependency persistence and Chrome save isolation: **2 passed,
  0 failed**, exit 0.
- App typecheck: exit 0.
- New actual map-clear probe: exit 0 for background-only, custom-BGM-only and
  combined-clear states, using the newly retained collector and both real
  publication APIs.
- Export-QA typecheck including the new probe: exit 0.
- Actual publication controls: exit 0, including upgrade/cancel/fork/apply,
  original data and focus preservation, and two viewport sizes.
- Current installed player: 13 files synchronized and verified.
- Community production build with `--webpack`, including its normal
  verify-player prebuild: exit 0.

The dependency persistence test rejects nonempty unknown/external references,
coherent PNG/audio omissions and mandatory empty images before any rows exist.
It then persists all three optional-map clear variants byte-for-byte. Existing
old-collector and P1 isolation/file-copy checks remain in that run.

## New immutable runtime

Use this NEW runtime when reproducing the round-2 repair:

`91170d81127c186534826ea81da581475e588fcc46965c772ea2e191e52788ce`.

The previously reviewed `4870f055...` collector is deliberately unchanged and
does not acquire the repair in place. Source-input, web/standalone collector,
payload and runtime manifest checks passed when retaining the new build.

`npm run build` completed all compilation stages but initially failed during
archive copy with ENOSPC. After recovering only owned checkout/cache space, the
lead reran the failed `archive:runtime` stage successfully, then synchronized
and built the community app. The original nonzero command is not relabeled as
an uninterrupted successful build.

## Actual map-clear exports

Command:

```text
TMPDIR=/dev/shm npx vite-node scripts/qa-map-resource-clears.mts
```

Report: `verify-shots/release-map-clears/report.json`.
All three variants produced ZIP and HTML, validated through community ingress,
preserved exact prepared project/ZIP bytes, and left authored clear selections
unchanged. The probe reads only the selected retained archive.

## Full gameplay and user interface

- `verify-shots/release-round3-editor/results.json`: actual editor downloads and
  integrity, nested HTTP/offline HTML full gameplay, invalid-script/required-PNG
  rejection and editor Test Play passed.
- The first root-URL row failed solely with host Chrome
  `ERR_NETWORK_CHANGED`. It remains recorded. The exact same ZIP was rerun at a
  root URL using real HTTP API-response forwarding, not fixture responses:
  `verify-shots/release-round3-root/report.json`. Full quest/battle/transfer/
  save/reload/movement passed, with zero resource, page or transport errors.
- `verify-shots/release-round3-community/report.json`: real RPG ZIP upload,
  qualified playback, full gameplay, save/reload and byte-identical download
  passed with exit 0 and zero resource/runtime failures.
- Community release:
  `1ef7bef24dd59882662224ede0c169d2726ce9ca926c6bbfa6563cb8fcc74cfc`.
- `verify-shots/release-round3-controls/report.json`: the owned-server Firefox
  control run passed.

Small JSON/text/PNG evidence and exact `project.json` are in
`verify-shots/release-round3-editor`. Large temporary `game.zip` and `game.html`
remain at `/dev/shm/release-round3-editor`; they were not committed. All
previous retained runtime directories remain intact.

## Environment and residual limits

Implementation and review checkouts use sparse patterns excluding only unrelated
historical `output/evidence` and other `.omo/evidence` subdirectories. All source,
tests, scripts, docs, public assets and this release evidence are included. The
review checkout shares the already installed community dependencies. These are
local environment settings, not changes to repository content.

Historical broad-gate timeout/cancellation, baseline surface/battle-test/type
limits and Turbopack's worktree symlink limitation remain documented in the
earlier ledgers. Sparse checkout must not be mistaken for missing historical
evidence in an unrelated suite. No full-suite pass or production DB deployment
is claimed. Fresh ultrabrain approval is still required.
