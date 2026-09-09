# Shared main integration: PR624, PR626, PR628

## Scope and preservation

- Shared main was fast-forwarded from `882a53e1` to upstream `4c7cf588`,
  incorporating the previously missing 103 commits.
- PR626 was merged as `564ce225`.
- Verified UI candidate `23570003` includes both PR624 and PR628 and was
  merged into shared main as `ac527283`.
- The only dirty/upstream overlap was the AI tools wiki. Its backup is stash
  `ca4c31f93342906428018e0204ae4f02875a9d65`. Both the new completed-house
  documentation and the existing World tool notes were retained.
- Every other originally dirty tracked file retained its hash. User work
  remained unstaged and was not included in the merge commits.

## Review

PR626 uses the existing loader to compare normalized values with stable object
key order. Persisted serialization/hashes are unchanged. Array order, authored
content, concurrent edits and rollback remain significant.

PR624/628 combined without source conflicts. The isolated audit rechecked all
118 deleted declarations against current upstream, preserving surviving ASTs,
later owners and the upstream assistant/System implementations. This is not
a broad CSS rewrite. Its commands are in `integration-ui-624-628.md`.

## Supervisor checks

- PR626: application typecheck and 49 focused assertions passed.
- Final shared-tree cross-domain suite: 83 assertions in eight files passed.
- `npm run build && npm run gates:css`: exit 0. Editor, player, SDK and
  standalone bundles built. CSS budget regressions and graph orphans are zero.
- Original sidebar adversarial E2E: one scenario passed, retries zero,
  covering expert/standard/beginner at 1440/1280/1024 widths. This existing
  scenario uses its documented Node GET transport.
- Separate direct Firefox session, no transport relay: physical canvas
  painting and toolbar undo passed in beginner, standard and expert modes.
  Store subscriptions were registered before each action; the complete lower
  and upper tile arrays returned to their exact pre-paint values.
- Built editor, direct Firefox: actors/items/enemies/System at 1024x768 and
  1440x900, eight states with no document overflow or page errors.
- The full supervisor gate was started but did not finish before the user
  requested immediate restart. It was stopped after build, focused tests and
  actual UI checks passed. Whole-suite success is not claimed.

## Fresh artifacts

- `output/evidence/mode-ux-after/shared-paint-{beginner,standard,expert}.png`
- `output/evidence/mode-ux-after/shared-db-{actors,items,enemies,system}-{1024,1440}.png`
- Playwright output for `test/e2e/left-sidebar-adversarial.spec.ts`

No subjective screenshot/pixel approval is claimed: the current model cannot
receive image pixels. The cited interaction, data and geometry checks were
executed directly.
