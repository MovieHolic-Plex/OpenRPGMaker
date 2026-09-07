# Real large-world assistant QA

## Deliverable

- Project ID: `rpg-zzu-qa-world-2026-09-06-f51eb3ca-final`.
- Real provider/model: `google-antigravity` / `gemini-3.7-flash`, saved high reasoning with max autonomy.
- Final remote save and reload: `final-review-persistence.json`, canonical SHA
  `07ebf405bd01c45cbd1120e940768180a8998399acf1aa39c6d4bb014de639de`.
- Runtime input file SHA (pretty JSON bytes):
  `93e42af1a3373047f1a64f8f4ed16e7ac5d896b2aaa9320a531a89e5a1b7796e`.
  This is not the canonical database serialization hash.
- World: 128x128; seven maps including six linked interiors; ten original houses;
  eight original guide events and start position preserved.
- Actual terrain: 144 conifer canopy cells, 1,748 snow cells, 1,084 water cells,
  and 73 water cells on the bottom/right map edge.
- Repairs relative to the first snow-capable world changed 269 forest cells,
  335 mountain-region cells, 729 wetland cells and 42 ruin cells.
- Independent `projectLint`: zero errors, 55 warnings.

The initial model output was not accepted merely because it claimed success.
This was **not one-shot autonomous success**: real failed runs, code repairs,
follow-up content corrections and a separate full-map inspection were needed.
No model response was mocked, and no manually constructed world fixture replaced
the assistant's work.

## Evidence matrix

| Requirement | Action and observed result | Evidence |
| --- | --- | --- |
| C1: isolated remote project | Empty baseline saved through the shipped API and loaded; normal editor confirmed remote persistence and the explicit QA ID | Local `final-baseline-proof.json`, `final-connection.json` |
| C2: actual model and decomposition | Real HTTP model requests; original 19-item plan incorrectly collapsed to five in the RED run; later repairs retained independent work IDs and blocked invalid completion | Local `connected-events.jsonl`, `remaining-retry-events.jsonl`; regression tests below |
| C2: full visual inspection | On the latest integrated code, actual model requests carried 203 tool schemas and invoked 36 successful `show_map_region` calls covering all 16,384 world cells; game maps stayed unchanged | `model-proof.json`; local `integrated-result.json`, `integrated-events.jsonl` |
| C3: physical content | Broad forest, snow, sand, coastal water, stone ridge structures and masonry ruins; original houses/guides/start preserved | `structural-analysis.json`; selected runtime screenshots |
| C3: official shipped-player boot | `NODE_OPTIONS="--import=./output/evidence/live-world-qa/runtime-relay.mjs" npm run qa:runtime -- --scenario live-world-start --project output/evidence/live-world-qa/integrated-project.json --out output/evidence/live-world-qa/runtime-current-final-official` passed both beats with zero errors | `runtime-current-final-official/SUMMARY.md`, `runtime-current-final-official/manifest.json` |
| C3: eight actual arrivals | On the latest runtime, directional input through the real engine produced 416 observed tile arrivals, eight landmarks, nine passing beats and no runtime errors | `runtime-current-final/SUMMARY.md`, `manifest.json`, `steps.jsonl` |
| C4: regressions | Final integrated run: 112 tests passed in 16 files with no unhandled worker error; app typecheck and app build exited 0 | Local `latest-main-final-checks.log` |
| C4: adjacent checks | Earlier house/protection control: 96 passed, six pre-existing failures matching unchanged controls; failures were not deleted or weakened | Local `final-house-regressions.log`, `house-atomic-child-baseline-regressions.log` |

Read each runtime `SUMMARY.md` before opening its selected images. The boot
scenario is not movement proof; the complete input trace is separate.

## Defects fixed in product code

- Preserve item IDs, completed state and evidence during same-goal plan repair.
- Preserve required verification instead of deleting or skipping it after failure.
- Keep authoritative incomplete results in the final audit and expose acceptance state.
- Honor explicit max/high execution settings.
- Require image review to cover actual requested changes rather than a smaller crop.
- Resolve the real bundled flower material in house yards.
- Restore active `paint_tiles`: semantic fill did not replace numeric tile painting.
- Advertise active canonical tools rather than hidden legacy names.
- Continue bounded repair for stale/failed explicit checks; expose the exact stale
  tool/argument scope instead of an opaque tool-name-only message.
- Reject uncleared tree atoms before house construction seals their remnants into
  completed-house ownership.

Tests include `workPlanIdentity`, `assistantFinalAudit`,
`assistantExecutionEffort`, `assistantReviewScope`,
`assistantVerificationContinuation`, `assistantVerificationEvidence`,
`paintToolExposure`, `houseLotFlowerMaterial` and `authorHouseTreeClearance`.

## Honest limits and failed QA infrastructure

- Four-tree "forest" and an isolated pond were detected despite the model's first
  36-image success claim. Actual subsequent tool writes corrected those omissions.
- Mountain terrain uses stylized masonry ridge pieces and stone sprites from the
  available town atlas. This is basic spatial/content coverage, not an art-quality score.
- The main coding model could not consume image attachments. `read` was attempted;
  `look_at` was used only to extract basic visible elements. No pixel-perfect or
  polished-aesthetic claim is made.
- A QA script imported a second Vite HMR store instance and accidentally saved an
  empty map to this QA ID. The genuine model-authored backup was restored through
  `saveProjectToSupabase`, after checking the remote row still matched that accidental
  write. Reload proved exact map restoration. The script now pins the actual UI
  module URL and rejects an uninitialized/wrong-sized store. User projects were not touched.
- A renderer crash stalled an attempt after successful remote writes. Remote
  progress was preserved; the crashed browser was closed. The QA scripts now
  observe renderer crashes and avoid constrained shared-memory allocation.
- On the latest tree the default Chromium host profile timed out before title.
  With byte-identical static GET relay, both boot beats passed but Chromium reported
  blocked local-network Vite WebSockets. The host-only profile now permits local
  network access; the official CLI then passed without filtering those errors.
  No model, DB or game-data response is replaced by the relay.
- Immediate tap and held-direction driver failures were retained. The final
  driver queues a single direction tap at an animation-frame boundary and awaits
  exact scene/session/rendered arrival. It never sets player coordinates.
- The earlier broad control had six known failures: two construction-outcome
  equality expectations, invalid-wing normalization, yard-shortfall code
  expectation, sign-yard capacity, and a forest fixture missing `image.type`.
- Two integration runs had passing assertions but a Vitest worker RPC timeout;
  neither was counted as green. The heavy multi-map fixture now uses its existing
  `yieldToUi` hook with Node `setImmediate`, allowing RPC acknowledgements between
  synchronous tools. The planner-isolation fixture prepares real original context
  before priming old evidence. All original assertions and timeouts remain.

## Reproduction

Use the repository's configured Supabase and real companion credentials.
No credentials are included in these artifacts.

```sh
node output/evidence/live-world-qa/serve.mjs
# In another terminal, create a fresh unique QA ID for a new actual-model run:
QA_PROJECT_ID=rpg-zzu-qa-world-UNIQUE QA_ATTEMPT=reproduction \
  node output/evidence/live-world-qa/run.mjs

# Read the retained final project using the shipped API:
node node_modules/vite-node/vite-node.mjs --script \
  output/evidence/live-world-qa/read-remote.mts
NODE_OPTIONS="--import=./output/evidence/live-world-qa/runtime-relay.mjs" \
npm run qa:runtime -- --scenario live-world-start \
  --project output/evidence/live-world-qa/latest-remote-project.json
QA_PROJECT_FILE=output/evidence/live-world-qa/latest-remote-project.json \
QA_TARGETS_FILE=output/evidence/live-world-qa/final-targets.json \
QA_ATTEMPT=reproduction \
  node output/evidence/live-world-qa/walk.mjs
```

The full 5 MB project snapshots, raw model transcripts and failed-run logs remain
in the local evidence directory; the final project also remains in Supabase.
The committed selection contains the compact proof, input driver and selected
screenshots rather than publishing all raw conversation payloads.
