# Assistant audit fix verification

Verified candidate: `60baa32d89a3601a9d1805c066f08264198e359a`.
Integrated main: `3f7b89d64`.
Original input: `/tmp/ai-session-audit-20260906-113805.json`.
The original project `oprn-09bce682d0` was not an authoring target.

## Requirement coverage

| Requirement | Regression and observable evidence |
| --- | --- |
| C1: retain A's specification after B, isolate failed updates, expire implicit scope, prune deleted/reset identities | `assistantMultiMapSpec.test.ts`, 18 final cases. Initial RED: 13 failed / 4 passed. The final table correction and added fallback control are explained in `maps/README.md`. Real UI submits A/B specs and subsequently writes A and B successfully. |
| C2: defer dependent calls honestly, preserve independent work and corrected retries, do not acknowledge incomplete work | `assistantBatchCompletion.test.ts` and `assistantDependencyRetry.test.ts`. Initial batch RED: 3 failed / 2 controls passed. Later explicit-verification RED and invalid-fixture corrections are distinguished in `batch/README.md`. Missing plans, unknown IDs, skipped work and open verification remain rejected. |
| C3: actionable NPC corrections without accepting unsafe aliases or mutating on failure | `npcAuditRepair.test.ts`, 26 cases; RED: 6 failed / 20 passed. Parsed examples are passed back through the real compiler/runner. Explicit false, sibling conditions, extra fields and ambiguous none conditions have controls. The related three-file run passed 62 tests. |
| C4: actual assistant surface and remote persistence | `final-browser.json`: real editor, session, tools, application and LegacyDb paths. Recorded model outputs drive the exact malformed cases deterministically. Both accepted milestones persisted; the final accepted revision was verified; an independent remote GET matched the saved SHA, map IDs and NPC pages. |
| Existing unpublished reliability work | All eight prior commits remain in ancestry: `986db8d94`, `eea07df30`, `82ae6a92d`, `80431aca1`, `7a4882008`, `aeaefb0b1`, `3bbba0317`, `2c00261e6`. Their reward, scene, schema, retry and applied-accounting regressions remain present. |

## Final supervisor checks

The final eleven-file run passed **175 tests**, then the complete
editor/player/standalone build exited **0**. The run was inside a Linux network
namespace, with loopback enabled, so no test subprocess could write to the live DB.
See `final-checks.log`.

```sh
unshare -Urn sh -c 'ip link set lo up &&
  npm test -- \
    test/assistantMultiMapSpec.test.ts \
    test/assistantBatchCompletion.test.ts \
    test/npcAuditRepair.test.ts \
    test/aiCompletionAccounting.test.ts \
    test/assistantDependencyRetry.test.ts \
    test/assistantVerificationEvidence.test.ts \
    test/assistantAcceptanceSession.test.ts \
    test/npcRewardSession.test.ts \
    test/npcCommandContract.test.ts \
    test/placeNpcMalformedPage.test.ts \
    test/aiTurnAppliedAccounting.test.ts \
    --pool=threads --maxWorkers=3 --testTimeout=60000 &&
  npm run build'
```

Changed-file diagnostics reported no errors. The merge integrator additionally
passed 389 tests across 21 files, including upstream acceptance, image,
persistence, ending and monster-resource contracts; this is supplemental child
evidence, not a substitute for the supervisor run.

Four enemy fixture literals needed an explicit existing monster resource after
upstream hardening. Original assertions and retry/deferral counts were preserved.
The final merge retained upstream footer stripping, placement-count checks,
ending/item-condition fields and accepted-revision persistence proof.

The whole-suite gate timed out at 30 minutes without a JSON report. Independent
CSS and surface gates completed and reproduced the same failures on clean
baseline main. See `GATES.md`; no whole-suite pass is claimed.

## Actual editor and remote proof

- Owned editor: `127.0.0.1:9847`, serving this worktree with HMR disabled.
- Normal same-origin LegacyDb proxy. The existing key was supplied only to the
  server process; no credentials are in these artifacts.
- Final isolated project: `oprn-fee2e1d872`.
- Scenario: `browser-replay.mjs`, invoked on an already mounted, remotely
  persisted editor project using its public assistant bridge.
- 22 actual tool results: 4 deliberate input rejections, 2 unexecuted dependency
  deferrals, corrected writes and a completed-plan acknowledgement.
- All three immutable acceptance items were visibly verified, **3/3**.
- Terrain milestone: `e5da4a4b-637f-46e9-963a-95611e2a4c4b`, persisted.
- NPC milestone: `72067f54-dc59-4acd-aafc-9159547c95b7`, persisted.
- Accepted revision: `537974e0-322f-45e1-986e-fc51e3f299ab`, verified.
- Remote SHA256:
  `8cbe382485f7d15d417a39907ddbb8f31c2bccfb0736e75bb8a80e88a5655c38`.
- Independent GET returned HTTP 200, both map IDs and identical two-page NPC data.
- Local screenshot: `verify-shots/ai-audit-pr/final-replay.png`.

The replay supplies recorded model outputs, not a claim that a live model
independently generated those repairs. It does not mock tools, application,
acceptance or remote persistence. `browser-replay.json` records the earlier
pre-integration replay; `final-browser.json` is the final candidate's evidence.

## Limits and separate observations

An additional live Gemini 3.8 continuation on pre-integration `cdd9c9017`
successfully reused B/A cached specs, made the two requested small edits without
new specs/maps, preserved the NPC and persisted both edits. Its final acceptance
remained open: newly appended target-change criteria use the conversation-original
baseline, which lacks the later-created map and treats restoration of initial
grass as unchanged. Six attempted criterion repairs/reviews were rejected rather
than weakening that contract. `browser-live.json` explicitly records map-cache
success and completion blocked; it is not full-completion evidence.

Both available image-reading paths omitted the captured pixels. Actual browser
interactions and DOM status text were checked, and PNGs are retained locally, but
no pixel-level aesthetic approval or GitHub-hosted screenshot is claimed.

Initial direct browser DB requests failed. Their local-only applications are not
completion evidence. The configured proxy and final independent remote load
replaced that failed QA attempt.

## Cleanup and release boundary

Owned QA servers and browser processes were closed. Port 9847 has no listener.
Both temporary implementation worktrees were made clean by removing only copies
already preserved in commits, then removed with `wt remove --keep-branch`.
No force deletion or uncommitted user work was discarded.

The PNG directory is intentionally local/untracked. The PR publishes code and
text evidence only. Publishing the PR does not merge it or deploy a running app.
