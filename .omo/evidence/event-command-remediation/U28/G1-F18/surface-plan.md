# G1-F18 actual-surface verification journal

Sole writer st_01a07768. Branch agent/event-remediation-text-tools; inherited base a9dcbf32c.
All four lead-handoff sourceBlobs matched git hash-object before new QA work.
Original red.json, availability-red.json and fixture-correction.md remain intact.

## Execution contract

`U28_TEXT_STANDALONE=1 bun run test/e2e/event-command-remediation-U28-text.spec.ts`

- Separate fresh Firefox contexts for native text and raw M2-209 boot fixtures.
- H0 enterLocalEditor uses the dev fixture and real ProjectStore.load. No direct migration invocation or raw209 immediate-import claim.
- Visible map event controls, actor Other and variable Reward, retained caret, selected range, picker Cancel, unsupported legacy_reward/shadowed v2, new canonical variable creation.
- Confirm then parent Apply, reopen, different edit Cancel, real menu download and filechooser import. Entire canonical project equality, not just text body.
- Exact editor-exported native command consumed unchanged by dedicated player.html. Separate QA setup establishes discriminating 11/29 values; original command body/presentation fields unchanged.
- H0 bounded subscriptions before triggers; no sleeps, polling helpers, business mocks, editor play mode or remote persistence.
- 1024x768, 1280x800, 1440x900 geometry/focus/screenshots. Pixel-level visual PASS is not claimed if Read cannot expose pixels.

## Owned artifacts and cleanup

- Each run creates G1-F18/surface-<unique>/ receipts and local-only images/packages; keep receipts, do not add images/packages to git.
- Each run creates G1-F18/tmp-<unique>/ for its editor cache and player runtime input/cache; remove in finally.
- Strict ephemeral editor/player Vite ports, browser contexts/processes and observations close in finally; cleanup receipts record ports.
- Inherited /tmp/event-remediation-text-tools-build and /tmp/event-remediation-text-tools-build-cache must be removed after verification.
- New durable files: test/e2e/event-command-remediation-U28-text.spec.ts and scripts/qa/runtime/event-command-remediation-u28-text.scenario.mjs. Neither imports evidence modules.

## Verification policy

Inherited unit/adjacent/typecheck/build evidence is reused only while hashes match. New QA files receive diagnostics and actual execution. Any failure is retained and diagnosed before a deliberate correction. No production changes planned.
