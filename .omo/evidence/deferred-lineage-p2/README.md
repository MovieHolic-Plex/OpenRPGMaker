# P2 deferred persistence scheduling ownership

Task: `st_01a07921`.
Base: `9a0c335f29c372ce0bead33419e20143ff645192`.
Branch: `agent/ai-deferred-lineage-p2-0907`.
Worktree: `/home/main/z-project/rpg-zzu-ai-interior-load-consistency-0907`.

The clean existing worktree was adopted on a NEW branch at the exact requested
base. Its old branch `agent/ai-interior-load-consistency-0907` still points to
`6fbd83124883dac55d03678abe5ed22ccf45ecd0`; its previous evidence remains in place.
Parent/review trees and the frozen characterization were read only. No NPC proof
modules, live project, UI, game, model, or credential configuration were edited.

## Repair

`src/project/store.ts` now captures scheduling lineage and timer identity before
registering deferred autosave work. The callback checks both before clearing its
handle, publishing save state, or invoking persistence. Registration precedes the
synchronous `pending` notification, so a replacement/edit subscriber keeps its own
new timer rather than having the outer scheduler overwrite it.

Only directly related deferred retry work was included:

- Retry callbacks check the failed save's lineage and their own handle. An error
  subscriber cannot transfer the old failed save's retry to its replacement.
- Health intervals belong to their scheduling lineage and handle. Their async
  response rechecks ownership before cancelling retry state or initiating a save.
  A new lineage can register its own health probe instead of inheriting A's probe.
- Obsolete callbacks are ignored, not treated as clean-save successes. Reload
  normalization, clean-flush behavior, save RTT catch-up, detached faceset guards,
  saving-subscriber guards, and timer/backoff/deadline durations are unchanged.

## Red / green

All commands below ran locally; no whole gates were rerun.
Committed console logs have trailing whitespace/blank EOF lines trimmed only;
the corresponding untrimmed logs are preserved in `/tmp/st_01a07921-raw-logs`.

1. `npm test -- test/storeDeferredLineage.test.ts --maxWorkers=2`
   against unchanged base source: **10 failed, 2 passed**, exit 1,
   `red-final.log`. The migration callback writes clean B once (expected 0,
   received 1), retry does the same, health invokes fetch on B, and old callbacks
   consume newer handles. Both current-lineage migration/retry catch-up controls
   already pass. Earlier fixture-development logs remain local: a row-level layer
   assertion was corrected to assert the actual two resolved upper-layer cabinet
   cells, and retry lookup uses the real error state's backoff count. No production
   source was changed before the final red run.
2. Same command after the source repair: **12 passed**, exit 0,
   `green-focused.log`. A thirteenth positive control was then added for current
   health-probe save/catch-up; all **13 passed** in `green-regressions.log`.
3. Related lifecycle/persistence/lineage/interior regression command is recorded
   verbatim at the top of `green-regressions.log`: **141 passed, 5 failed** across
   14 files, exit 1. This file is NOT an all-green report. All 13 files other than
   legacy `storePersistence.test.ts` pass, including detached repair, saving
   subscribers, accepted-receipt lineage, interior load/failure/catch-up, room
   pipeline, draft preservation, map updates and SHA evidence.
4. `npm run typecheck:app`: exit 0 (`typecheck-app.log`).
   `npm run build:app`: exit 0, 1,524 modules (`build-app.log`). Build warnings
   remain: missing optional proxy keys, a record-picker circular chunk re-export,
   mixed static/dynamic imports and large chunks. No build settings were changed.
5. LSP diagnostics: no diagnostics for `src/project/store.ts`,
   `test/storeDeferredLineage.test.ts`,
   `test/audioDescriptionConcurrentPersistence.test.ts`, and the two executable
   evidence scripts. Markdown has no configured LSP server; no markdown-LSP pass
   is claimed. `git diff --check` passed.
6. Real public-store replay, with local serialized persistence transports:
   `unshare -Urn bun .omo/evidence/deferred-lineage-p2/store-replay.ts`, exit 0.
   `store-replay.log` records migration genuinely dirty/pending first, clean B
   unchanged after the exact A callback, **0 obsolete callback writes**, B's newer
   timer still cancellable by its own flush, exactly **1 B edit write**, final
   dirty false. This is store API exercise, not browser/game acceptance.

## Five legacy persistence failures: baseline, not a repair regression

An owned detached baseline worktree at `/tmp/st_01a07921-base` was created from
the exact base for comparison. Network-isolated command on BOTH base and candidate:

`unshare -Urn npm test -- test/storePersistence.test.ts --maxWorkers=2`

Both exit 1 with **5 failed, 6 passed**. Full output is in
`baseline-legacy-persistence.log` and `candidate-legacy-persistence.log`:

- Pre-load no-fetch assertion observes the existing edit-activity mirror POST.
- Three obsolete dev-showcase/fresh-project fixtures receive undefined mocked
  fetch responses and fail reading `response.ok`.
- The dev-showcase availability fixture has no fetch stub, attempts the canonical
  loader, and fails with `fetch failed / EAI_AGAIN dbserver` under isolation.

The first broad run was not OS-network-isolated: that last legacy fixture received
an invalid-auth response to its GET using its test key. No remote write was
observed. All subsequent transport comparisons/replays used `unshare -Urn`.
These five tests were neither edited, deleted nor skipped to manufacture green.

## Parent-requested audio fixture correction

The three missing/cleared/authored replacement-description failures in the
parent's `gates-9a0-failures.json` were independently reproduced. Original test
command on base and candidate:

`unshare -Urn npm test -- test/audioDescriptionConcurrentPersistence.test.ts --maxWorkers=2`

Both: **3 failed, 19 passed**, expected accepted titles `[PROJECT_A, PROJECT_B]`,
actual `[PROJECT_A]`. See `baseline-audio-concurrent.log` and
`red-audio-concurrent.log`. The fixture awaited only A's flush after replacement;
its expectation silently relied on now-forbidden cross-lineage catch-up.

The test-only correction retains every original current/description/remote/write
assertion. It additionally proves A completes with only `[PROJECT_A]` accepted and
B still dirty, then explicitly flushes B after A finishes, with commit signals
registered before each action. Both writes `[PROJECT_A, PROJECT_B]`, exact B
description state, fresh remote read and final clean state remain required.

- Corrected three cases against unchanged base source: **3 passed** (19 unrelated
  cases filtered only for this baseline fixture comparison), exit 0,
  `baseline-corrected-audio-fixture.log`.
- Full candidate concurrent suite plus audio persistence suite:
  `unshare -Urn npm test -- test/audioDescriptionConcurrentPersistence.test.ts test/audioDescriptionPersistence.test.ts --maxWorkers=2`
  **59 passed**, exit 0, `green-audio.log`.

## Explicit overlap limit: already submitted A is not cancelled

The parent also requested an explicit B flush while A is held. The read-only
transport characterization is `overlap-characterization.ts`; it deliberately
asserts an existing unsafe outcome, NOT a desired-contract regression or approval.
Commands (network isolated, both exit 0):

```
unshare -Urn bun .omo/evidence/deferred-lineage-p2/overlap-characterization.ts
unshare -Urn bun .omo/evidence/deferred-lineage-p2/overlap-characterization.ts /tmp/st_01a07921-base
```

`overlap-candidate.log` and `overlap-baseline.log` agree for the authored-description
case: B's explicit full save finishes while A's PATCH is held; A then loses one
CAS race, retries and writes afterward. Accepted titles are **[B, A]**. Current
title is B and current dirty is false, but remote title is A and remote map name
is A_EDIT. B's descriptions survive in both current and remote content. This is
an existing transport-flight ordering defect, not introduced or repaired by the
deferred callback guard. The corrected fixture therefore uses ordered explicit
ownership (finish A, then flush B). No guarantee of safe overlapping cross-lineage
saves is made; serializing/cancelling already-submitted flights is a separate repair.

## Limits

No live DB/browser/model/game acceptance, player/standalone build, whole-gates
success, source-wide sign-off, push, PR, remote merge, or R6 approval is claimed.
The archived Round8 result remains failed and fresh AI-game acceptance remains
OPEN. Evidence assumes the existing lineage increment boundaries and actual
timer registration semantics; it adds no polling, sleep or duration changes.
