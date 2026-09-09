# Review 3 C1: tooling repair ready for independent review

Changed only the three authorized tooling paths:
- scripts/audit-db-css-ownership.mjs
- scripts/lib/db-css-owner-proof.mjs
- test/databaseCssOwnerProof.test.ts

Production CSS/TS remains identical to the frozen candidate. The 12 other
source-ready manifest entries are unchanged. Exact before/after hashes are in
review3-tooling-manifest.json; this is an explicit supplement to 376394f6, not a
claim that its tooling fingerprint stayed unchanged.

## Repair

Designated owners use explicit file, complete selector, at-rule context and
property identities. Selector whitespace is normalized for formatting, but no
ancestor, descendant or prefixed-class lookup is accepted. Valid shorthand
coverage is retained; border-spacing and border-image are not border shorthand.
The unused substring fallback was removed. Intrinsic replacements are limited
to actual documented removals; sizing/layout replacements carry supporting
exact min-height/display declarations rather than excusing a missing owner.

Six proof tests include removal of ONLY the actual modal-body overflow, shared
card radius, row radius and direct-child action alignment declarations. All
other declarations remain, including actual descendant/prefixed rules. Every
single-declaration deletion throws, and restoring it restores proof. Wrong-file
and wrong-context decoys also fail.

Narrowing precedes role fallback: the retained Studio readability rule stays
11.5px, excluding only shared actions. The selected-layer-badge class never maps
to input fonts. Growth focus retains outline-offset:3px for non-radio consumers;
removed radio consumers map separately to modern-controls' actual 2px owner.
These exact generated JSON values were checked after regeneration.

## Verification

- Both inventories regenerated: exit 0. Overall 21910 -> 21687 declarations;
  snapshot delta 21709 -> 21687; 180 retained important declarations.
- Focused 5-file guard/focus/primary run: 27/27 PASS, exit 0 (55.16s).
- Final owner/font proof run: 15/15 PASS in 2 files, exit 0 (1.92s).
- LSP errors on all three paths: 0; node syntax and git diff checks: exit 0.
- Logs: /tmp/db-css-review3-tooling-tests.log,
  /tmp/db-css-review3-proof-final.log,
  /tmp/db-css-review3-inventory-final.log,
  /tmp/db-css-review3-delta-final.log.

## Browser status remains separate

The first complete 42-test one-worker run finished: 39 PASS, 3 FAIL, exit 1,
38.6m; both 32-destination width tests passed (64 actual measurements).
Failures were two narrow keyboard count assumptions and an incorrect System
preview-menu selector, not new demonstrated product defects. Firefox adds a
native Tab stop for the narrow timing scroller (404px viewport / 644px content);
System owns db-title-workbench-menu-item, not rm-title-menu-button. Corrected
focusin-driven traversal and actual preview lookup passed in the final focused
run: five tests passed, exit 0, including all three formerly failed cases and
explicit settled destructive-hover contrast (4.986771986444722). The full 39/3
run remains labeled as such; review3-browser-closure.json records the composed
evidence without claiming a single post-repair 42/42 execution.
Artifacts/log: review3-final-browser.json and
/tmp/db-css-review3-final-browser.log. The subsequent focused seam results are
review3-last-seams.json and /tmp/db-css-review3-last-seams.log.

## Release status

PR636 was externally merged with only e80eb710. It does not contain the full
cleanup. Parent's later product commit 1aba4675 and this tooling/browser delta
need the parent-owned follow-up integration after final Ultrabrain approval.
No approval, push, PR creation or merge was performed by this child.
