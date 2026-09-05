# Native emote recovery validation (2026-09-05)

Recovered native showEmote authoring, serialization and runtime lifecycle, with standalone asset inclusion. No authored demo project or remote records were changed; browser runtime uses a temporary minimal command contract fixture.

- `npm run typecheck:app`: exit 0.
- Eight focused emote/reference/editor contract files: 68 tests passed.
- `test/runtimeQaGate.test.ts` and `test/runtimeQaInstrumentationBoundary.test.ts`: 55 tests passed.
- `node scripts/gen-emote-sheet.mjs --check`: exit 0.
- `npx tsx scripts/qa/emote-runtime.mts`: canonical player.html harness, 2 beats passed, no runtime errors. Waits for NPC heart and player question opacity, verifies following dialogue is already visible.
- `node scripts/qa/emote-editor.mjs`: actual command picker/edit dialog modules and application CSS on an isolated blank route, 12 swatches, music selection and 900 ms applied; no page errors. Screenshot inspected.

Editor artifacts: `verify-shots/emote-editor/`. Runtime artifacts: `verify-shots/runtime-qa/emote/` (generated/ignored; reproduced by the command above).

Broader historical contract run: 254 passed, 6 failed in existing playMovie/setRelationship coverage inventories and whole-project undefined normalization equality. These are unrelated frozen-main gaps; full combined gates belong to supervisor.

## Surface fixture follow-up

The native command was absent from `test/fixtures/minimalCommands.ts`, so three generic surface harvesters passed undefined to the renderer and reported four new failures. Added the command fixture and measured its form, interaction and commit snapshots (3 input probes, all 3 commit). Updated only showEmote entries, the added showEmote option in loop/shop/inn selectors, and commandPickerTab3. Existing face/picture AI, monster-species and NPC-teaching baseline mismatches are preserved. No production rendering or allowlist changes.
