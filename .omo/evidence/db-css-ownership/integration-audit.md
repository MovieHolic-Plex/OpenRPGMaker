# Latest-main CSS ownership audit integration

Task: st_01a07697, 2026-09-06. Worktree:
`/home/main/z-project/rpg-zzu-db-css-ownership-20260906`.
Pending merge base for verification: origin/main
`5384e607b6d4495b6c1fde998fe49901550653af`.

## Patch

- `scripts/audit-db-css-ownership.mjs`: default to `git merge-base HEAD origin/main`;
  preserve the explicit positional base argument. Validate the base as a tree and
  inventory its paths before treating absent baseline files as zero declarations.
  Invalid revisions, non-tree objects and existing-blob read failures remain fatal.
- The integrated CLI exposed another exact boundary: four shared Studio input
  selectors lower their stepper-exclusion specificity using `:where(...)`. Map
  only those complete selectors, in the exact Studio file and top-level context,
  to surviving property evidence. Do not mistake the excluded stepper for a
  consumer. No general selector equivalence or unknown-removal fallback added.
- `test/databaseCssOwnershipAudit.test.ts`: nine deterministic real-Git/real-CLI
  tests cover added CSS, exact retained property evidence, merge-base rather than
  remote tip, explicit historical unknown removals, all four specificity rules
  with missing-property/descendant/wrong-context/wrong-file negatives, invalid
  revision/blob bases, and a missing existing Git blob. Disposable `/tmp` fixture
  history uses Git plumbing; the actual worktree index/history is untouched.

## Verification

Commands run from the worktree above:

- `npm test -- test/databaseCssOwnershipAudit.test.ts test/databaseCssOwnerProof.test.ts --maxWorkers=2`
  - Final run exit 0: 15/15 tests, two files, 7.67s. All six existing C1 tests pass.
  - Initial run exit 1: two fixture tests failed with `ENOENT ... open ''` because
    `src/main.ts` did not match the existing `src/**/*.ts` Git glob. Corrected the
    fixture to `src/app/main.ts`; no unrelated production glob changes.
- `npm run audit:db-css-ownership -- 5384e607b6d4495b6c1fde998fe49901550653af /tmp/db-css-integrated-inventory.json`
  - Final exit 0: 22046 -> 21861 declarations, net 185 removed, 641 removed/replaced,
    180 retained important declarations. Initial exit 1 identified the exact
    shared-input transition owner issue repaired above.
  - Node assertions on the emitted JSON: exit 0. Upstream checklist is 141 -> 141
    with zero mapped removals. Growth mappings contain only the cleanup's focus
    `outline` and `outline-offset`; no upstream preset removals are attributed.
    All 17 specificity-adjusted declarations retain file/context/property/value.
- `npm run audit:db-css-ownership -- 49067218aebf889d98c2dc05be08231787483427 /tmp/db-css-historical-integration.json`
  - Expected exit 1: `Unmapped removal` for upstream growth-preset composition,
    not missing-file `git show` failure. No invented owners. Full diagnostic:
    `/tmp/db-css-historical-integration.log`.
- LSP diagnostics: no diagnostics on the changed script or new test.
- `node --check scripts/audit-db-css-ownership.mjs` and `git diff --check`: exit 0.
- `npm run build:app -- --outDir "$(mktemp -d /tmp/db-css-integration-build.XXXXXX)"`
  - Exit 0, 1m22s; Vite reports external-output-directory, mixed static/dynamic
    import and large-chunk warnings. Build log:
    `/tmp/db-css-integration-build.log`; output `/tmp/db-css-integration-build.dBsill`.

## Preservation and remaining lead-owned verification

The staged binary-diff SHA-256 before and after this work is identical:
`f465c8419fd34754e6cb006d32ec6870cc46c2ab732f7e61004dcfa7b2e00b88`.
Only the script, new test and this receipt were edited. No product CSS/TS,
proof helper, C1 tests, browser harness or baselines changed; no worktree staging,
commit, reset, abort, push or merge performed. The requested `apply_patch` tool
was not exposed to this child; available exact-edit/write tools were used.
The new receipt matches `.gitignore:19` (`.omo/evidence/*`); the lead must include
it explicitly if committing the receipt. Markdown has no configured LSP server.

The merge remains pending. Its current HEAD merge-base is still
`e80eb71089bbfb245b688e396ed65831eedc70b3`, so integrated verification intentionally
uses the explicit origin SHA. Default behavior is proven in the Git fixture;
real-checkout default verification after the lead commits the merge remains
lead-owned. No browser or full release-gate verdict is claimed by this tooling patch.
