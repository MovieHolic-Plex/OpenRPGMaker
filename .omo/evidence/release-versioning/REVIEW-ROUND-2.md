# Ultrabrain review round 2: REQUEST_CHANGES

Reviewed candidate: `db6f6ab9c131a13dcac43f96a90dfd66433e19f1`.
Reviewer: `st_01a079c5`, high confidence (0.98).

The reviewer confirmed that original P1 save isolation and the original P2
coherent PNG/audio omission paths are repaired. A new compatibility regression
still blocks merging.

## Supported map clear selections

`src/editor/panels/mapProps.ts` produces a blank enabled background:

```json
{"imageId":"","scrollX":0,"scrollY":0}
```

It also permits a cleared custom BGM selection:

```json
{"mode":"custom","resourceId":""}
```

Both pass existing editor export preparation. The frozen collector currently
permits blank resource values only in command contexts, so the map states fail
with `release resource가 존재하지 않습니다: `.

The reviewer executed both publication exporters with the actual retained
collector. Blank background failed ZIP and HTML; cleared custom BGM failed
collection as well. No input project bytes or retained archive were modified.

Required repair:

1. Preserve the retained runtime's empty/no-selection semantics for supported
   optional map-resource fields.
2. Prove both publication exports accept the editor-produced blank states.
3. Prove corresponding complete community archives validate with exact project
   bytes preserved.
4. Keep nonempty unknown/external references and coherently omitted used PNG/
   audio rejected before persistence.
5. Keep command clearing, opaque/Unicode IDs, P1 isolation and supported older
   collector regressions passing.

Build a new matching web/standalone collector/runtime after the fix. Never
rewrite the already retained digest.

## Nonblocking display correction

`publishingDialog.ts:97,120` still labels the collector contract as 1 while the
current verified manifest says 2. Display the selected/installed verified
manifest value rather than a hard-coded version.

## Integration state

The PR API reported base `147218a2` while actual `git ls-remote` reported main
`83bd6098d94dd6d7082d2ded6d557be928592623`. Git merge-tree confirmed a real
conflict against that latest main in generated `openwiki/INDEX.md` only.

The lead started that merge with `--no-commit`. The implementation worktree is
now in that merge state. Regenerate the index from both sides' merged wiki
content, do not choose one side blindly. Main's auto-merged project/export
changes come from monster metadata commit `b8a69cc50`; inspect their semantics
alongside the frozen collector, including editor-only metadata exclusions.

After the coherent repair and merge are committed and reverified, request a
fresh ultrabrain review of the new exact SHA. No approval has been granted.
