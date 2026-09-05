# Combined integration code review

Candidate: `46969b57cae1dd357b9b3b27b3c7100c36575e6b`.
Comparison: `0182722b..46969b57`.
Reviewer: integration supervisor, before rollout.

## Findings

No unresolved integration-specific product blocker found. The concrete
integration defect was the missing fourth `recordForm` argument in
`src/editor/panels/databaseInventoryCatalog.ts:121`. The typecheck failed
with TS2554 before the correction. Passing the retained host follows the
existing caller's ownership contract and leaves animation state management
in its existing owner.

Residual limitations are explicit: the full baseline gate exceeded 30 minutes;
three sidebar assertions and six event-surface assertions fail on the clean
upstream baseline as well. The latter's failure names and expected/received
diff lines exactly match the integrated candidate. These are not green tests.
No aesthetic approval is inferred from screenshots the model could not view.

## Programming and integration contracts

- Equipment IDs remain stored identifiers. `equipmentSlots.ts` keeps the five
  legacy slots when the optional catalog is absent; custom slot labels do not
  redefine weapon/shield semantics. `equipmentRules.ts` retains the atomic
  inventory/equipment transition, curse/fixed equipment checks and two-handed
  mirror accounting.
- `shapeDatabaseFields.ts`, `shapeCommandFields.ts`, `references.ts`,
  `commandReferenceValidation.ts`, `saveSlotValidation.ts` and `saveSlots.ts`
  cover distinct external shape, reference and save boundaries. Slot-ID syntax
  checking is not a substitute for project membership checking. The additional
  validation is therefore not a redundant parser layered over trusted values.
- `database.ts` and `databaseModal.ts` retain legacy equipment navigation and
  the selected collection/record while presenting one inventory rail entry.
  World overview routing and the combined DESIGN.md contracts survive merges.
- `world/canon.ts` and `canonNormalize.ts` preserve legacy secret content while
  separating status and visibility. World category/search changes clear stale
  reading selection but keep authored drafts.
- Facility grouping is restricted to the eight named facility types.
  Existing authored omissions are not replaced with a reference template.
  Interaction checks retain reachable approaches for authored loot.
- No integration-only service, data adapter, parser or normalization layer was
  introduced. The correction reuses the existing host rather than extracting
  a helper or weakening the function signature.

## Explicit slop and overfit-test review

The complete 1,427-line test diff was read, including the new facility,
equipment, catalog, history and world tests and all edited E2E call sites.

| Criterion | Result and evidence |
| --- | --- |
| Excessive/useless tests | Catalog cases distinguish cross-collection search, identity collisions, selection, creation, duplication, guarded deletion, modal routing, disclosure and slot transitions. Equipment tests separate malformed input, permissions, serialization and actual menu/event/save behavior. No test addition exists solely to make this merge's diff green. |
| Deletion-only tests | Removing the old equipment rail expectation is paired with combined record count, both record kinds, preserved target routing and actual selected-record editing in `databaseInventoryCatalog.test.ts`. It does not merely assert that a symbol or file was deleted. |
| Removal-only tests | Facility omission assertions prove user-authored removals survive real lookup and construction. World tests assert both the included category and excluded unrelated category. These verify preservation and selection behavior, not just absence. |
| Tautological tests | Custom equipment tests serialize/deserialize, change equipment through real menu/event authorities, inspect derived stat deltas and save/reload. World tests drive controls and verify selected/draft state. No expected result is computed by invoking the same mutation under test. |
| Implementation-mirroring tests | Facility tile decoding uses the shared object catalog and a fixed plank tile in one reachability fixture; this is limited independence, not a general aesthetic oracle. Explicit rug/table containment, door clearance, nine-crate loot reachability and multi-seed complete-object checks provide independent geometric outcomes. |
| Unnecessary extraction/parsing/normalization | Slot catalog helpers have multiple editor/runtime consumers. World properties encapsulate an actual repeated UI boundary. Boundary validators are retained; the integration adds no fallback or compatibility shim beyond the required existing contracts. |
| Test weakening | Event snapshots change only equipment option order and the body-slot label. Existing AI-image/species/portal differences remain failures. No skipped/fixme tests, type suppressions, artificial sleeps or enlarged allowlists were added by this candidate. |
| Timing | New unit/DOM tests use immediate state or explicit control actions. The catalog refresh case invokes refresh directly and is not claimed to prove scheduler timing. Browser checks use bounded readiness assertions; the world test removes the old per-character delay. |
| Prose pins | New world migration tests assert machine-consumed status/visibility fields. The changed lore test checks actual DOM ownership instead of the removed prose pin. No test was added for integration reports, commit text or prompt wording. |

Maintenance notes, not integration blockers: the catalog renderer remains a
large closure, the facility composition module remains complex, and some
fixtures use non-null assertions consistent with their existing test style.
This review does not authorize a redesign or broad cleanup.

## Evidence and limits

The supervisor executed the commands recorded in
`integration-recovery-2026-09-06.md`: app typechecks, 70 passing equipment
assertions with three baseline failures, 116 world assertions, 110 facility
assertions, CSS gates, and exact surface-failure comparison.

Actual surfaces were exercised, not inferred: inventory interactions at three
widths; world save/reopen/search/lock/delete; nine party layouts; five compiled
editor tabs; six built-player equipment beats; eight built-player facility
beats. Artifacts and failed Chromium network execution are listed in that
report. The Firefox facility replay preserves the same assertions and records
to a separate directory instead of overwriting the failed run.

This is the supervisor's combined code review, separate from the gate
reviewer's independent pass. It covers the exact product/test candidate above.
Subsequent review-document changes do not alter that product/test tree.

## Upstream #609 addendum

The subsequent integration delta is upstream `35b651bb` (PR #609) on top of
the reviewed `46969b57` candidate. The generated wiki index is the only merge
conflict; no product conflict resolution was needed.

Reviewed the added graphic-control presentation, playback transport split,
cell-command ownership, and CSS changes. The optional `presentation: graphic`
path retains the default resource-picker behavior for all other callers.
Playback disposal and retained-host state remain in the same implementation.
Removing nonfunctional pattern buttons and the disabled grid checkbox is
paired with functioning graphic selection, frame editing and transport
controls; it does not remove a working authoring capability.

The original UX scenario checks behavior and hit/clip geometry, not source
text. Its graph label assertions compare actual selected resources, and the
stepper assertions cover both visible icon geometry and changed stored values.
Animation clocks are controlled because time is the behavior under test.
No sleep, skipped assertion, weakened test or duplicate production parser was
introduced. Seven focused regression files pass all 38 assertions.

The first UI run exposed a test-observation issue in the long-lived HMR
server: the raw store import was a distinct instance from the active suffixed
module. The active store retained X=23 and two cells. Restarting the server
without HMR made the original unmodified UX test pass in Firefox, retries 0.
Latest full build and CSS checks pass. Earlier runtime scenarios remain
applicable to their unchanged runtime code; this delta changes editor
animation presentation and shared resource-picker presentation only.
