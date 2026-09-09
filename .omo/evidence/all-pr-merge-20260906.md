# All-PR integration under the updated user policy

The user explicitly directed merging even incomplete, Draft and approval-pending
PRs. That instruction supersedes the historical PR-body merge holds.
Incomplete future features are not represented as implemented by this merge.

| PR | Included snapshot | Validation and limitation |
| --- | --- | --- |
| 613 | Mac launcher/private local setup | 26 Node tests pass. Fixed test-only inherited environment isolation after six reproduced failures. Real macOS/Finder execution was not performed. |
| 614 | Event draft/history/validation snapshot | Child typecheck passed; 269 focused passes and four identical baseline failures. Parent event/life cross-suite passes. Missing command forms remain unfinished. |
| 617 | Concept-first Map database navigation | Child combined navigation suite: 170 passes. Parent three browser scenarios pass, covering child return, graphic copy/edit and retired-entry routing. Future room-rule migration remains separate. |
| 620 | Life-system test contracts | 28 tests pass. Runtime feature implementation was not added by this test-only phase. |
| 621 | World structure tools and rendering | Child World/render/intersection suite: 195 passes. Existing local World code is now tracked. No new remote game content was written during integration. |

## Shared-tree preservation

- Original World work was backed up in stash
  `3748b9ab536f6556f6ae59c11aca330b10dc7286`.
- Twenty-six overlapping files match the original work byte-for-byte.
- Three renderer differences consolidate equivalent World/interior-fire
  predicates; one test preserves approved chipset-description precedence.
- The complete personal autotile/World authoring notes were restored as an
  unstaged addition, alongside the new integration documentation.
- The other eight dirty files retained their hashes. Unrelated user edits
  and report artifacts were not staged.

## Parent verification

- Final `npm run build && npm run gates:css`: exit 0.
- Shared event/life cross-suite: seven files, 85 passed, exit 0.
- Shared navigation/World/save cross-suite: nine files, 193 passed, exit 0.
- Mac launcher/setup: 26 passed, exit 0. Environment isolation changes only
  the test process and preserves explicit environment-precedence assertions.
- Concept browser suite: three passed, retries zero. This mounts the shipping
  database component with its real store and serializer.
- Separate direct Firefox full-editor checks: staged character-name edits
  leave the canonical name unchanged; Cancel preserves it; Apply commits it.
  Full-editor concept-bundle entry also succeeds.
- Full supervisor gate was started but remained incomplete; it was stopped
  after build and focused/real-surface checks to complete the requested
  rollout. No whole-suite pass is claimed.

## Evidence

- `.omo/evidence/wish-event-audit/PR614_MERGE.md`
- `reports/pr617-621-integration.md`
- `.omo/evidence/all-pr-event-apply.png` (local)
- `.omo/evidence/all-pr-concept-entry.png` (local)
- Playwright results for `test/e2e/concept-first-map.spec.ts`

Future completed integration/build reports use a PR/result/limitation table,
as requested by the user.
