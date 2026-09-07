# P2 dependency-closure repair: lead verification

Implementation: `a4d48591d9408b17ca09e5998f4eba8da9e34ddb`.
Opaque-ID compatibility follow-up:
`12649a6d760ea1de1c169fe90f004de6ad260e6e`.

## Direct lead checks

| Check | Result |
| --- | --- |
| Dependency, save-scope and boot Vitest subset on locked final repair | 36 passed, 0 failed; exit 0 |
| `node --test test/communityDependencyPersistence.test.mjs test/communitySaveIsolation.test.mjs` | Both real PostgreSQL/browser scenarios passed; exit 0 |
| App and community typechecks on the P2 implementation | Exit 0 |
| `npm run build` with both repairs | Exit 0; protected web/standalone/collector runtime retained |
| Community build pipeline through player build, sync and verify | 13 installed files verified |
| Community `npm run build -- --webpack`, including verify-only prebuild | Exit 0 |
| Actual protected editor export/gameplay QA | Eight rows passed; exit 0 |
| Actual protected RPG community upload/gameplay/download | Exit 0; exact download and save/reload confirmed |

The ordinary community pipeline stopped at Next's known Turbopack worktree
symlink error. The supported webpack invocation still ran the normal
verify-player prebuild; no integrity gate was bypassed.

## Adversarial persistence proof

The lead's actual temporary PostgreSQL test rejected these coherent omissions
after their ZIP inventory/digest was recomputed:

- `assets/generated/title/oprn-title-field.png`
- `assets/cc0/audio/bgm/field-of-dreams.mp3`

Both were outside `runtime.requiredAssets`. Unknown and external references
were also rejected while both listing and release tables still had zero rows.
A complete older-runtime release then succeeded after a different frozen
collector became the default, with ingress compiled without current editor
normalization or resource catalogs. Original project and ZIP bytes persisted
unchanged.

The simultaneous P1 regression again proved separate manual/autosave keys,
gold-41 originals surviving another listing's gold-999 save, zero foreign
predecessor controls, explicit selected-file copy, and 422 for unsafe old
runtimes.

## Compatibility proof

The lead additionally reproduced an unintended rejection of a valid uploaded
logical ID containing a space. The editor accepted that project while the
initial collector rejected it. The follow-up removed path-like restrictions
on logical IDs and added real frozen-collector/archive regressions for spaces,
Korean text, nonbreaking spaces and colon/slash-containing IDs. Actual resolved
paths, unknown/external references, media validity and trusted hashes remain
checked.

## Protected full-runtime evidence

Runtime:
`4870f0556bf9ccef25b93c3b450b858e4a4a0335fdc5fa85249f83f34c99d9f9`.
It advertises collector version 2 and both safety capabilities.

- `verify-shots/release-protected-editor/results.json`: actual menu downloads,
  release integrity, root/nested/offline full gameplay, corrupt-script and
  required-PNG rejection, and editor Test Play.
- `verify-shots/release-protected-community/report.json`: actual RPG ZIP
  publication, four decoded party sprites, quest/battle/transfer/save/reload,
  matching upload/download hash, and no resource/runtime failures.
- Protected community release:
  `06ab1859ad07e762c4b99aceff9e2d28bf9a623ade712f4846b25bb9cd0f9aad`.

Existing archives were not rewritten. They are not granted new capabilities
by parsing. New shared-origin publication requires the protected collector and
save-isolation contracts.

## Remaining verification limits

The original broad gate timeout/cancellation and known seven surface failures
remain documented in `BASELINE.md`. The implementation agent also reproduced
three existing `webExportBattleDependencies.test.ts` failures and the existing
`playerManifestContract.test.ts:519` TS2322 on locked P1 `f76bdbe06`; their logs
are `/tmp/p2-baseline-battle.log` and `/tmp/p2-baseline-test-types.log`.
These are not claims that those broader suites pass.

A fresh ultrabrain approval is still required before PR #677 can merge.
