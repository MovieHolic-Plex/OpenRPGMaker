# U07 portable evidence

MANIFEST.md is authoritative. BLOCKER.md and LOADER-BLOCKER.md preserve the discovered failures
and are historical: both narrow extensions were explicitly authorized and verified.

Required source, tests and replay helpers are ordinary tracked src/, test/ and scripts/ files.
No test imports a module from ignored evidence. The untouched original unit buildFixture remains
usable by the positional H0 CLI; the player proof intentionally consumes the actual editor export.

The atomic commit deliberately includes:
- Final manifest, wiki amendment, diagnostics, cleanup, source/evidence hashes and size report.
- Original prep manifest, original RED JSON/log.gz, original test/fixture gzip copies and hashes.
- Refreshed RED, focused GREEN, resolver RED/GREEN, loader RED/toggle/GREEN and final GREEN.
- Lossless gzip copies of attempt logs; raw logs are not modified or staged.
- Final editor observations, real exported .oprn.gz and JSON.gz, editor cleanup; player inputs,
  all final scenario manifests, loaded-sprite/untargeted-state observations, real walking receipt,
  negative-observation sensitivity check and player cleanup.
- Prior failed scenario manifests, failure summaries and necessary driver/geometry receipts.

Screenshots/videos, caches, local environment files and credentials are never staged.

## Replay from the repository root

```sh
npm test -- test/eventCommandRemediation/U07.test.ts test/eventCommandRemediation/U07/playerSprite.test.ts test/eventCommandRemediation/U07/loader.test.ts test/playerSpriteResources.test.ts test/eventEditorM2CommandBody.test.ts test/actorM2CommandBodies.test.ts test/page3CommandBodies.test.ts test/eventCommandRemediation/U05.test.ts test/generatedMonsterFieldSprites.test.ts test/bundledAssetWarmup.test.ts --maxWorkers=2
U07_STANDALONE=1 node_modules/.bin/vite-node --script test/eventCommandRemediation/U07/runEditor.mts
gzip -dc .omo/evidence/event-command-remediation/U07/surface-utyQuE/editor-exported.json.gz > .omo/evidence/event-command-remediation/U07/surface-utyQuE/editor-exported.json
node scripts/qa/runtime/event-command-remediation-u07.scenario.mjs .omo/evidence/event-command-remediation/U07/surface-utyQuE/editor-exported.json .omo/evidence/event-command-remediation/U07/surface-utyQuE
node_modules/.bin/vite-node --script scripts/prepare-event-command-remediation.mts U07 <unique-owned-directory>
```

Use a >=900-second outer process bound for the 17-flow editor run. Player navigation timeout is
120000 separately from action timeout15000. The runners use Firefox, unique strict ports/caches,
frozen Vite and remote persistence disabled. Native receipts retain original absolute paths for
integrity; replay uses repository-relative code and reconstructs disposable runtime fixtures from
the committed editor export. Replay into a new evidence directory to preserve existing receipts.
