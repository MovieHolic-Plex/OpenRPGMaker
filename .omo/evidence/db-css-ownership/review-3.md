# Ultrabrain review 3: REQUEST_CHANGES

- Reviewer:st_01a0762d, category ultrabrain.
- Candidate:376394f690d8f0c454cfb46633a9caad58772746.
- All15 source-ready manifest entries matched both candidate and fix checkout.
- No additional demonstrated product CSS/TS defect was found.
- One CODE_CHANGE_REQUIRED blocker remains in audit/helper/tests.
- Browser and whole-gate evidence remain pending. No approval/merge authorization.

## C1. Exact designated-owner identity, not substring descendants

`scripts/lib/db-css-owner-proof.mjs` still uses
`d.selector.includes(owner.selector)`. Property matching alone is insufficient.
Reviewer reproduced with real parsed candidate declarations in memory:

- Remove only sidebar.css's actual modal-body overflow:hidden declaration.
  Proof still succeeds using the inner .db-body or sidebar-tab descendants.
- Remove only studio-v2.css's actual shared-card border-radius declaration.
  Proof still succeeds using .db-ws-card-head border-radius.

Neither descendant owns the ancestor's property. Existing negative tests remove
all matching properties/family selectors and therefore miss the false positives.

Smallest repair:

1. Designate owners using exact file/selector/context/property identities,
   retaining valid shorthand coverage.
2. Add negative tests removing only the actual modal-body/card declaration while
   leaving unrelated descendants and similarly prefixed rules intact.
3. Correct narrowing/split mappings before heuristic role fallback:
   - Baseline studio-theme readability font-size list falsely maps to input
     fonts, including18px inputs. Its narrowed readability rule still exists;
     only shared actions were excluded. The regex /input|select|textarea/ falsely
     matches `tileset-selected-layer-badge`.
   - growth-tree outline-offset:3px falsely maps to intrinsic0 while the same
     property survives on the narrowed non-radio rule. Represent removed radio
     consumers separately from retained consumers.
4. Regenerate both inventories and rerun helper/guard tests.

This is an audit/helper/test repair, NOT another product CSS rewrite. The
specific retained-important explanations and bounded product fixes are supported.
Parent's immutable full-gate/build run can continue; record this tooling delta
and supplement its verification explicitly rather than pretending fingerprints
never changed.

## E1. Complete browser acceptance

At review time review2-firefox-final.json was not green:
6 passed,13 failed,23 skipped/interrupted,0 flaky. Retained matrices had only
8 cases at1440 and25 at1024. A later wheel/stepper run had1 pass/2 failures.
Failures included price readiness, matrix navigation, old Concepts sentinel,
scroll-end deadlines and keyboard readiness. Latest harness restored click
handling for non-button group disclosures, but code correction alone is not PASS.

Require32 unique destinations at each width, all targeted contracts and both
deliberate CSS mutation rejections, with no failed/skipped/interrupted/retried
cases in the final fingerprinted execution. Preserve previous failed runs.
Do not categorize all failures as product or environment without evidence.

## E2. Complete supervisor gates

Final8-core60-minute gates remained running with no completed Vitest JSON at
review time. Need completed output and assertion-level frozen-baseline comparison
against169 failures/92 files. The six old surface failures and DB-axis pass are
not whole-suite clearance. Both earlier30-minute timeouts remain incomplete.

## Supported repairs and verification

Restored intrinsic card action alignment, resolved the named old important
ownership collisions, actual danger token contrast fix, logical-opener restore,
per-file nonzero/unskipped required axes and font syntax/alias fixes are present.
Reviewer independently ran5 files/24 tests, exit0,55.30s, but those tests do not
overrule the C1 counterexamples.

Latest inspected browser spec SHA256:
f3f639861f745ad7d72189040c409458a203f1f2acabb77179531cb7b1a44c94.
Playwright config SHA256:
60535ab4836245d6273311ffd77643b90b857b83e0316a49bbcc6a4c4309661b.

Re-review repaired tooling/inventory delta and complete fingerprint-bound evidence
before approval. Objective DOM/browser evidence is acceptable with retained
screenshots and explicitly unavailable pixel interpretation.
