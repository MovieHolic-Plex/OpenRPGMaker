# Independent read-only exported trainer-intro diagnosis

## Confirmed causal chain

1. Failed QA log times out at `scripts/qa/runtime/emerald-native-battle.mjs:89`; native old-save Continue had already succeeded, record browser errors are empty. Failure project SHA: `c774c3d2c49d17c4550990c914ac56ddfcce695f4466ba3bb9053d2323a4cc65`.
2. At first inspection, `/tmp/oprn-pokemon-motion-20261004/export-native/project.json` uploaded keys matching trainer contained only `mx_audio_trainerBattle`; `oprn_emerald_trainer_rival` and `oprn_emerald_trainer_hero_back` were absent. Canonical reloaded project retained both as picture64×64.
3. `mx_map_lab_rival` has one unconditional page, uploaded `oprn_emerald_field_cast_1`, down, pattern28. Resolver slot formula yields character1 → rival. Troop `mx_troop_mx_map_lab_rival` has `trainerBattle:true`. No condition, event-id, row or role mismatch.
4. HEAD `src/project/webExportAssets.ts:195-198` retained implicit trainer dependencies only when width64 AND height96. New native64×64 trainer assets were pruned because their IDs are computed at runtime rather than stored in authored command fields.
5. `src/player/emeraldTrainerIntro.ts:40` correctly accepts native64×64 and legacy64×96, but missing uploaded pictures return null; line46 returns undefined. `mountEmeraldTrainerIntro` then returns no-op at line53. No image requests or browser errors are expected, and the ordinary battle reaches command phase while the QA waits for a DOM layer that was never mounted.

## Root patch and new artifact independently read

Root changed the retention condition to height64 OR96. During inspection root re-exported the same path; the inspected artifact now has SHA `0b2c62d5aab54015faa608e80d51c117178b12119f12d9825a8eeaab1a59faef`. This is a different artifact from the failed run, not retrospective evidence that the failed run had assets.

- All17`oprn_emerald_trainer_*` pictures are retained with metadata64×64.
- Rival actual embeddedPNG header64×64, bytes2382, SHA `4ba0ba3ae7cb154afa9979d9736d65bbf4ad3607db070c91f13c1b3132b5a171` matches canonical ref.
- Hero back embeddedPNG header64×64, bytes3390, SHA `04e76ad26aee4566e06ae0c016e2357fdd00ec2ccf33bb6983651ecebc70ef37` matches canonical ref.
- Opening `oprnOpeningBook.portraitMotion.resourceId` is `oprn_emerald_professor_motion`; retained embeddedPNG384×64, SHA `fdba46432044c5b9b82168a19cf61601b84112b410d2980c4a31e94b79adcafa` matches reviewed final professor source.

## Related dependency review

`collectUsedUploadedAssetIds` calls the same `collectProjectStrings`; retention therefore applies to project pruning and uploaded-file collection. Current cast sheet IDs match the resolver's two supported IDs. Portrait-kind and dimension filters now match the runtime accepted64×64/64×96 contract. Book-only motion retention is explicit at `webExportAssets.ts:185`; current authored motion ID is present. Species sibling icon retention is separately explicit at188-191. No additional missing dependency found in the focused current-artifact inspection.

The implicit resolver intentionally requires `mx_troop_` ID derivation and the two shared cast IDs; custom troop/sheet conventions remain outside this current feature contract and use fallback. This was not the failed run's cause.

## Limits

No code, canonical, shared assets, service or approval writes. This diagnosis used read-only log/project/source inspection and embeddedPNG header/SHA checks. It did not rerun the QA or use editor play. Actual rendering, image decode callbacks and1200ms trainer intro/send-out visibility must be verified on the new exact exported player by root's runtime QA.
