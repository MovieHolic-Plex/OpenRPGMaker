# Corrected Phase 2 review input

## Decision required

Review the whole Phase 2 candidate for its stacked PR, not full completion of the
six-phase life-systems goal. The approved plan is
/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md.
Ignore every CLAUDE.md. The user requests --make-pr, not automatic remote merge.

Frozen candidate: d84001e88b5e0b7f8ff3074de0ec5f6cdbcbf41e.
Phase base: 87de73785d1c309bbbe975636414f70bbc73a4b9.
This detached worktree is locked for review. No product/test/config/wiki edits.

## Prior review and corrections

PHASE2-REVIEW-initial.md is the complete prior REJECT at b7f68fe2. Its two
mandatory blockers were current player refusal guidance and remaining Save5 QA
consumers. Do not treat its REJECT as current approval or erase its failures.

- Task39: e9522cb1 adds the three typed refusal boundaries. 2d6096e2 corrects
  test setup ordering with deterministic RED and unchanged1500ms observation.
  b9257552 archives supervisor proof. See39/SUMMARY.md,
  39/observation-correction/SUMMARY.md, and39/parent/SUMMARY.md.
- Task40: f336552d repairs five initializers and two save/mutation consumers.
  38f08e13 archives supervisor proof. See40/SUMMARY.md and40/parent/SUMMARY.md.
  Three original logs now live byte-for-byte in40/raw-log-archive.json;
  raw-log-archive-verification.json compares decoded bytes with original Git blobs.
- Production/test files in both corrections match their individually verified
  commits after integration. No recovery redesign or later-phase implementation
  was included. Phase2 original tests, ownership primitives, observability,
  reserved-key corrections, and task38 preservation alignment remain in scope.

## Direct supervisor behavior evidence

| Scope | Evidence | Observed |
| --- | --- | --- |
| Real save/load shell and persistence |39/parent/execution.json |160 tests passed, including all existing159 and the controlled ordering regression |
| Dedicated native player.html |39/parent/firefox/browser-results.json |Four title/running manual/autosave refusals; one message, unchanged disk/state, original running canvas/debug identity retained; exit0 |
| Failure guidance visibility |Same native receipt and four PNGs |All messages visible, in viewport, with no DOM scroll clipping;1280x960 viewport |
| Actual current consumer callbacks |40/parent/first-execution.json and http-transport/execution.json |71 tests passed; five cleanup loops and both prearmed save/mutation blocks passed with real writer/Storage |
| Failed paths retained |39/parent-failed-suite.json;39/observation-correction;40/parent/*execution.json |Prior158/1test failure and native Chromium loading failures preserved, not counted as successful runs |

Task40's parent browser proof forwards unchanged Vite response bytes through
Node HTTP to Chromium after native ERR_NETWORK_CHANGED failures. All196responses
were200, with no transport/page/request/HTTP/console errors. This is browser
execution and native Storage proof under a disclosed transport, not proof of
Chromium networking. Task39's parent Firefox proof uses native networking.

Manual-save refusal uses the real shell/controller/Storage unit fixture with
mocked scene endpoints; native manual-save refusal is not claimed. Boundary
fixtures and scripted consumer probes are not earned gameplay or the eventual
51-feature completion. Images were captured, but the current parent/producer
models cannot view them; DOM geometry is not an aesthetic screenshot review.

## Current integrated gates

phase2-corrected/run.mjs executes changed-TypeScript diagnostics, full build,
INDEX check, and all npm run gates axes at this frozen HEAD. Every stage has a
real exit/stdout/stderr/HEAD/tree receipt. The full fresh Vitest JSON is archived
as phase2-corrected/vitest-report.json when available.

At preparation time, diagnostics/build/INDEX passed and whole gates were still
running. No final gate pass or failure attribution is asserted here. The reviewer
must consume the completed current receipts and parent's current comparison
before approving. Archived phase2-integration reports and the initial review
retain the independently characterized pre-existing red baseline; do not update
baselines or mistake old-path differences for a newly introduced failure.

## Delivery and preservation

PR #620 is now observed MERGED, but remote agent/life-full-p1 still points to the
exact phase base87de7378. Phase2 therefore still targets that branch as planned.
Do not push, open/merge a PR, or message GitHub from the review. Parent owns
publication only after approval, and no further remote merge is authorized.

Preserve WISH.md, dependencies, baseline files, tracked caches, other people's
changes, and existing rpg-zzu-stardew-demo. This phase contains engine/test work;
new authored game content and isolated LegacyDb save/reload remain later-phase
requirements and must not be represented as already complete.

Parent owns review-worktree, generated dist/cache and reporter cleanup, archives
all current receipts and the final verdict, and records source identity before
phase handoff. The reviewer cleans only resources it independently creates.
