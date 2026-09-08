# OUT-001 media durability evidence

Scope: existing showcase persistence and resource-manager audio/video import.
The patch keeps Supabase as the canonical project/media root and reuses the
existing save/reload-verified transaction. No shared remote content was changed.

## Focused verification

Use one worker on the shared host, and lane-owned tmp/cache directories:

```sh
mkdir -p /dev/shm/rpg-zzu-issue693-media/tmp
TMPDIR=/dev/shm/rpg-zzu-issue693-media/tmp npm test -- \
  test/devMediaPromotion.test.ts test/mediaImportDurability.test.ts \
  test/audioDescriptionLifecycle.test.ts test/transactionalNewRemoteProject.test.ts \
  test/noLocalProjectDb.test.ts --maxWorkers=1
```

Red captures under `output/evidence/issue693-media/`:

- `red-promotion.log`: local source rejected at `saved-local`, native quota unclassified.
- `red-import.log`: success callback before persistence, missing consent.
- `red-identity.log`: matching bytes accepted with the wrong returned project ID.
- `red-selection-rollback.log`: original early config commit leaks staged selection
  on the last browser-write quota failure (focused mutation reproduction).
- `red-quota-recovery-status.log`: verified copy still displays source quota error.

`green-related.log` retains an earlier broader focused run, including failures
in the unchanged `storePersistence.test.ts` (cold-import timeouts and showcase
tests without the factory now injected by app boot). It is not a green gate.
`green-final.log` and `diagnostics.log` are the final scoped results. Full gates
and build belong to the lead.

## Reproducible browser run

Check port 38421 is free before starting the lane's server:

```sh
DEV_SERVER_PORT=38421 TMPDIR=/dev/shm/rpg-zzu-issue693-media/tmp \
VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-media/vite npm run dev:worktree
node scripts/qa/issue693-media.mjs
```

The default uses the actual sample-adventure showcase, real Chromium Web Storage
quota, a valid 8 MiB WAV, the actual file input/confirmation and cancellation.
All remote mutation requests are blocked. The second confirmation exercises a
deliberately denied network, not mocked remote success. The report asserts exact
source/recovery equality and records native quota classification and 1024px
modal containment. Screenshots/report are in `output/evidence/issue693-media/browser/`.
The script creates no fixture project and writes no shared remote row.

## Lead-only remote acceptance

After obtaining authorization to create one new isolated remote project:

```sh
MEDIA_QA_OUTPUT=output/evidence/issue693-media/browser-remote \
node scripts/qa/issue693-media.mjs --permit-new-remote-project
```

This runs the same real import, authorizes a generated target distinct from the
configured project, then reloads and verifies the exact 8 MiB byte length/SHA-256
and actual Test Play canvas. It refuses writes to another target and records the
new project ID even on failure. It does not delete remote copies automatically.
This mode was NOT run by the media lane: no claim of live remote 8 MiB capacity
or live remote reload/Test Play acceptance is made. Captures exist for lead visual
review; image-based approval is likewise not claimed.
