# P1 save-isolation repair: lead verification

Fixed commit: `f76bdbe06ff98128b6c9e2bbfef66faba07add44`.
Verification checkout: locked `rpg-zzu-release-versioning-review` at that commit.

## Directly executed by the lead

| Command | Result |
| --- | --- |
| `node --test test/communitySaveIsolation.test.mjs` | Exit 0; one real Chrome/private PostgreSQL scenario passed |
| Focused Vitest command below | Exit 0; 82 passed, 0 failed |
| `npm run typecheck:app` | Exit 0 |
| Community `npx tsc --noEmit --incremental false` | Exit 0 |

```text
npm test -- test/publicationSaves.test.ts test/publicationSaveImportPanel.test.ts test/oprnGameFile.test.ts test/communitySaveBoot.test.ts test/communityReleaseArchive.test.ts test/publicationExport.test.ts test/runtimeArchive.test.ts test/gameRelease.test.ts test/standaloneHtml.test.ts test/standaloneExport.test.ts test/lifeSaveVersion.test.ts --maxWorkers=2 --reporter=json --outputFile=.omo/p1-parent-tests.json
```

The implementation agent's broader 97-test run is separate evidence and is not
the count of this lead-run subset.

## Browser and persistence observations

The integration test published two identical-public-identity listings and an
accepted-lineage successor into a disposable PostgreSQL cluster. The actual
Chrome save/load DOM and file chooser produced:

```json
{
  "manualAndAutoIsolated": true,
  "victimGold": 41,
  "otherGold": 999,
  "predecessorControlsExposed": 0,
  "originalsUnchanged": true,
  "selectedFileCopyGold": 41,
  "oldRuntimeUploadStatus": 422
}
```

The direct unit/DOM checks also cover refusing foreign default imports before
reading their bytes, preserving occupied destinations, standalone rename-stable
identity, legacy reads, and excluding community boot from global prefix
migration.

## Contract inherited by P2

`RuntimeManifest.capabilities` is optional for honest legacy parsing. Current
runtime factories bind `community-save-isolation-v1` into the runtime digest.
Community ingress requires that capability for new publication. Old archives
are not rewritten, and absent capability is not upgraded by parsing.

This closes the first review blocker's reproduced paths at this commit. P2
dependency-closure repair, integrated rebuilt-runtime QA, and a fresh
ultrabrain approval are still required before PR #677 can merge.
