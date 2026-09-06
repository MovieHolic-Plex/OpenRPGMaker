# Database CSS cleanup verification

## Code and review identity

- Product commit:1aba4675; product files exactly match verified candidate376394f6.
- Ownership/required-execution tooling commit:8838acbb.
- Deep handoff:bb0d0a63828d7698ec2fb30af1a867a8d419ef02 in the isolated fix tree.
  Its snapshot ancestry and temporary images are not merged into the product branch.
- Browser harness SHA256:
  c553644ccdc1a0925f1085cf0d9110843337ee6c907adc5697af09ded54bb0e7.
- Initial and subsequent Ultrabrain requests are preserved in initial-review.md,
  review-2.md and review-3.md. Final approval remains a separate explicit verdict.

## Requested behavior and evidence

| Requirement | Evidence |
|---|---|
| Animation scroll, lower controls, entry/return/reopen/playback | Both primary widths plus1024x768 contracts; review3-browser-closure.json |
| One32px numeric box, native states and change/input semantics | Real stepper/native fixtures, populated Life, caption/focus/bounds/caret contracts |
| Common34px section navigation and32px CRUD roles | Actor/enemy/Life role tests, native hover/disabled/confirmation checks |
| Card/legend/list/thumbnail owners and intrinsic card actions | Exact-owner proof tests, ownership-inventory.json, real narrow Battle Commands cases |
| Shared12.5px captions and role-token fonts | Font guard, narrow real captions, UI/mono/pixel and actual preview-family checks |
| Removal rather than another override sheet | Same-scope declarations21910->21687;721 removed/replaced mappings; retained-important reasons |
| Required DB execution | Per-file nonzero/unskipped assertion validation with negative tests |
|32 primary destinations at two widths |64 cases;32 unique destinations at1440 and32 at1024; primary-matrix-summary.json |
| Preserved domain variants | Equipment/gallery/reveal, actor36px art, document36px controls, System, child routes and tileset geometry |
| Opener focus | Attached/replaced/disconnected/reuse unit cases and real modal reopen contracts |
| Real regression detection | Reintroduced animation overflow and numeric chrome are rejected, then restored controls pass |

## Browser execution history

The full42-test Firefox invocation completed with39 passes and3 failures. The
failures were two narrow-screen keyboard harness cases and an obsolete System
preview selector. After local harness corrections, the final focused invocation
passed5/5, with zero failures, skips or retries. It includes all three previously
failed cases and rechecks wide keyboard traversal and destructive-hover contrast.

All42 named contracts therefore have passing evidence across the explicitly
recorded runs. This is NOT a claim of a single post-repair42/42 invocation.
The product files did not change between these browser runs.

- review3-browser-closure.json identifies each case's source run.
- review3-final-browser.json preserves the39/3 run.
- review3-last-seams.json preserves the final5/0 run.
- Destructive-hover contrast is4.98677:1, versus original3.77312:1.
- The64-case matrix summary retains its implementation/harness/server identity.
- Full per-control matrix,85 root PNGs and additional raw traces remain at:
  /home/main/z-project/rpg-zzu-db-css-review2-fixes-20260906/output/evidence/db-css-ownership/firefox/
  and the same checkout's .omo/evidence/db-css-ownership/review3-primary-matrix.json.
  They are retained locally, not copied as temporary binaries into the follow-up PR.

## Supervisor checks

- Full app/player/standalone build:exit0.
- All49 changed CSS sheets parse successfully.
- Product TypeScript diagnostics:four files, no errors.
- Initial frozen increment:independent Firefox4/4 and numeric/control53/53.
- Final exact-owner/font/required-axis/focus supplement:independent27/27.
- Both final inventory generations:exit0.
- Whole gates completed:14471 total,14279 passed,177 failed; typecheck/CSS exit0.
  Surface retains six existing event-editor failures, while the DB axis executes
  and passes. The whole gate is NOT green.
- Frozen baseline:14457 total,14273 passed,169 failed. Twelve additional full-run
  failures across eight unchanged files did not reproduce under identical focused
  commands:both baseline and candidate passed94/94. Whole-suite timing sensitivity
  remains disclosed. Two earlier30-minute timeouts remain incomplete results.
- See whole-gate-comparison.json and supervisor-checkpoint.md for exact identities,
  durations, commands and supplement hashes.

## Existing persistence diagnostic comparison

The two existing persistence suites fail on both checkouts. Candidate-only failing
assertion identities were absent in the focused pair. A3-versus4 global-fetch count
was examined with an uncommitted diagnostic copy retaining the original assertions.
Both instrumented runs emitted the same mocked request sequence:

1. POST /rest/v1/project_commits
2. POST /rest/v1/project_changes
3. GET /rest/v1/projects

The global spy counts commit/change records as well as the project lookup. No
additional project-creation request was demonstrated. These are mocked requests,
not remote writes; production tests and persistence implementation were not edited.
The first diagnostic insertion matched another test's identical assertion and
was corrected before drawing this conclusion.

## Limitations and release boundary

CSS Biome LSP is unavailable; actual parsing/build/tests are recorded instead.
Both available image-provider paths omitted pixels. Screenshots are retained,
but no pixel-level aesthetic approval is claimed. Objective DOM/interaction
evidence and its limitations were accepted as the review basis.

PR636 was merged outside this session at2026-09-06T10:23:46Z, carrying only
e80eb710. The remaining cleanup requires a follow-up PR after explicit final
Ultrabrain approval. Latest-main integration and production restart are not
implied by this verification receipt.
