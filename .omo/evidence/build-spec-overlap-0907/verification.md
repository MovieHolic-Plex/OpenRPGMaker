# BuildSpec overlap diagnostic repair - st_01a079a1

## Scope and isolation

- Exact base: `566aad7b1fa8265116ecd5539a4e22acae898b69`.
- Owned tree: `/home/main/z-project/rpg-zzu-ai-npc-prerequisite-0907`.
- New branch: `agent/build-spec-overlap-repair-0907`. The previously clean tree
  was reused without deleting its old branches, evidence, dependencies or build.
- Three source files: `src/ai/buildSpec.ts`, `src/ai/assistantSession.ts`,
  `src/ai/contextBuilder.ts`. Tests: `test/buildSpecOverlapRecovery.test.ts` and
  `test/fixtures/buildSpecOverlapPlans.json`. Matching wiki: `openwiki/editor-ai-panel.md`.
- No parent/review tree edits, archived Round9 edits, geometry acceptance changes,
  schema restrictions, budgets, templates, label inference, or content operations.
  No live DB, UI, model, game or ledger operations; only in-memory test projects.

## Delivered contract

New-plan intersections emit `spec-new-plan-overlap`. Existing placement and clear
protection emit `spec-existing-content` and `spec-destroy-confirmation`, so mixed
recovery is selected entirely from codes, not localized messages or asset IDs.
The session preserves these codes to events, audit and model JSON. Rejection data
exposes existing counters/flags plus the selectors used for recovery:
`{rejections, repeated, discarded, recovery:{newPlanOverlap, remedyFields}}`.
The generic `spec-invalid` guidance issue remains on every rejection, preserving
aggregate target retry accounting even when failure classes alternate.

Dispatched tool/context guidance explains explicit road kinds, road-road crossing,
complete terrain-before-road order, and nonoverlapping terrain partitions.
Neither build order nor overExisting legalizes arbitrary same-layer terrain pairs.
Existing-content remedies remain separate and are not offered as overlap repairs.

## Red/green matrix

| Validator/session assertion | Exact-base red run | Final candidate |
| --- | --- | --- |
| Recorded plan intersection codes | FAIL: undefined | PASS |
| Session event/audit/model code propagation, overlap-only | FAIL: spec-invalid | PASS |
| Mixed existing/new conflicts and code-selected remedies after prose changes | FAIL: spec-invalid | PASS |
| Remedy-looking asset ID does not manufacture demands | FAIL: no structured recovery | PASS |
| Existing-only remedies and rejection reset after valid correction | FAIL: no structured recovery | PASS |
| Repeat/discard/capture counters exposed without changing behavior | FAIL: no structured rejection data | PASS |
| Original four plans: 5/5/5/7 errors | PASS | PASS |
| Terrain + crossroads; absent/empty/reversed/incomplete order | PASS | PASS |
| Duplicate/intersecting terrain with keep/clear and varied order | PASS | PASS |
| Adjacent partition, existing placement/clear protections, flexible kinds | PASS | PASS |
| Alternating failure classes: 4 failures, 2 exhausted calls + 1 dependent deferral | PASS | PASS |
| Real fill_region then two crossing paint_road calls | PASS | PASS |

Red was run before any source edit: **6 failed / 20 passed** in the new 26-test
file. The first preliminary test run also exposed two test-fixture mistakes:
missing spatial work-item mapTargets and expecting explicit zero rather than
the existing omitted zero-deferral field. Those were corrected before the
source edit; neither production behavior nor assertions about the intended
contract were relaxed. Both preliminary logs are retained locally.

Focused baseline command, executed on the exact base:

```sh
npm test -- test/aiSpecGate.test.ts test/aiSpecGateHardening.test.ts \
  test/assistantMultiMapSpec.test.ts test/assistantDependencyRetry.test.ts \
  test/aiToolCapabilityIndex.test.ts test/toolSchemaProviderCompat.test.ts \
  --maxWorkers=2 --minWorkers=2
```

Baseline: **110 passed / 1 failed**, exit 1. Candidate with
`test/buildSpecOverlapRecovery.test.ts` added to that command:
**136 passed / 1 failed**, exit 1. Same failure in both:

```text
FAIL test/aiSpecGateHardening.test.ts
  > 암묵 스펙 — 선택 영역
  > 선택 영역 암묵 스펙은 그 턴에만 유효하고 다음 턴으로 승격되지 않는다
AssertionError: expected undefined to be false
test/aiSpecGateHardening.test.ts:319:27
expect(second[0]?.ok).toBe(false)
```

That pre-existing fixture was not edited, skipped, retried to green or hidden.
The final new-test-file run (after fixing its resize fixture to retain the real
tool context) passed **26/26**, exit 0. Tests await real turn promises with event
collectors installed before dispatch; no sleeps, polling or timeout changes.
No unrelated whole-suite or Bun test target was run.

## Other verification

- `npm run typecheck:app`: exit 0.
- `npm run build:app -- --outDir /dev/shm/st_01a079a1-app-build --emptyOutDir`:
  exit 0. Large-chunk warning remains. The old dist symlink/build is preserved.
  Player/standalone bundles are outside this app-only verification.
- LSP initially returned no diagnostics for all four changed TypeScript files.
  Final test-only edits caused two 3000ms freshness timeouts from the LSP tool.
  A direct TypeScript program using repository tsconfig then reported **zero
  syntactic/semantic diagnostics on each final changed TypeScript file**.
- JSON LSP unavailable (Biome not installed); Markdown has no configured LSP.
  No dependencies installed. JSON parsed successfully and equals all four exact
  archived parsed call arguments. `npm run openwiki:verify`: exit 0, failures [].
- Offline `AssistantSession.sendUserMessage` manual exercise captured the actual
  dispatched tool schema and system prompt, event and model response. Explicit
  road/order/partition guidance is present; `kind` is still a free string and
  overlap-only `remedyFields` is empty. First observer capture failed; its log is
  retained separately from the corrected successful serializable capture.
- TypeScript-transpiled schema comparison with descriptions removed: all machine
  values equal the exact base. All three overlap-acceptance helper bodies are
  byte-identical to base. `git diff --check` passed.

Local raw receipts (same directory, not all included in the commit):
`baseline-focused.log`, `red.log`, `red-corrected-fixture.log`,
`green-focused.log`, `green-final-regression.log`, `typecheck-app.log`,
`build-app.log`, `changed-file-types.log`, `openwiki-verify.log`,
`manual-surface.log`, `manual-environment-diagnosis.log`,
`manual-surface-corrected.log`, `dispatched-surface.json`,
`boundary-comparison.json`.

## Limits

This improves an existing repair path; it does not guarantee P1 success. The
validator still evaluates declared geometry, not material identity/passability.
Changing only the first capture's road kinds and order still leaves one rejected
terrain/water intersection. Round9 remains failed initial generation and frozen.
No new controlled game, gameplay/image acceptance, push, PR or remote merge was
performed. Those remain parent-owned after verified integration.
