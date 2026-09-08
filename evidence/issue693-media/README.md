# OUT-001 media durability evidence

## Native Chromium large-body guard follow-up

Firefox omits `postData()`/`postDataJSON()` for the native 12 MiB JSON probe.
Chromium (verified with the installed Chrome channel) exposes the complete body.
The harness therefore keeps native POST/DELETE inspection and adds an optional
same-origin GET relay (`MEDIA_QA_GET_RELAY=1`) for this workstation's Chromium
Vite boot cancellations. The relay forwards the actual running server's status,
headers and bytes, including auth/profile request headers for real Supabase reads.
No fetch instrumentation, authorization metadata binding, correlation token,
project-payload rewrite, synthetic play response or extra CORS permission ships.

Every intercepted POST row is checked against the one new target at the configured
REST endpoint; child DELETE needs an exact target filter. Another target, the
configured/shared ID, missing bodies and malformed data fail closed. Unknown
background writes are recorded and aborted, not thrown from the route handler.
Guard failures and fresh UI error toasts end the success wait immediately;
`report.json` is retained on failure, including browser-launch failure.
`remoteWrites` counts authorized forwarding attempts, not proven DB commits;
completed live save/reload remains the actual acceptance evidence.

Safe local verification (no Vite server or remote mutation):

```sh
TMPDIR=/dev/shm/rpg-zzu-issue693-media/tmp node --test --test-concurrency=1 test/issue693MediaGuard.node.test.mjs
TMPDIR=/dev/shm/rpg-zzu-issue693-media/tmp MEDIA_QA_CHANNEL=chrome node scripts/qa/issue693-media-guard-probe.mjs
```

The native Chromium probe uses two loopback HTTP servers. It verifies >12 MiB
POST SHA-256/length equality, pending-until-real-response behavior, simultaneous
same-URL valid/invalid row requests, child POST/DELETE ownership, missing bodies,
prompt error signals, actual GET relay content/auth/profile headers and unchanged
cross-origin CORS. Only accepted local requests reach the servers; remote request
count is zero. Reports/logs: `/dev/shm/rpg-zzu-issue693-media/guard-probe/`.
The two-loopback-origin fixture explicitly grants Chrome's `local-network-access`
permission to its own page origin. This is separate from HTTP CORS; the editor
harness does not grant it or bypass browser network policy.

Lead's real new-copy command (requires the assigned Vite server already running):

```sh
TMPDIR=/dev/shm/rpg-zzu-issue693-media/tmp MEDIA_QA_BROWSER=chromium \
MEDIA_QA_CHANNEL=chrome MEDIA_QA_GET_RELAY=1 \
node scripts/qa/issue693-media.mjs --permit-new-remote-project
```

Omit `MEDIA_QA_CHANNEL` to use Playwright's bundled Chromium when installed.
The media lane did not run the permitted remote command. Production logic is untouched.

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
