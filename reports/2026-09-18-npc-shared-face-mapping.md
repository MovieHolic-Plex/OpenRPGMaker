# AI NPCs consume the shared face catalog

The NPC tools previously called `charsetFaceMap`'s legacy sheet/index heuristics,
ignoring the host's authored character/face catalog. The compiler independently
repeated that heuristic and could override a missing face or a page's own graphic.

The shared resolver now uses the same bundled default as the host, refreshed from
`/__oprn/shared-character-graphics` before browser/Electron assistant turns and retries.
Successful database-tab loads/saves update that same cache. A failed refresh stops
that turn instead of silently authoring against stale mappings.

Only `mapped` entries supply automatic portraits. `no-face`, `pending`, and missing
entries remain without a portrait. Explicit faces retain precedence; otherwise each
page resolves its actual graphic. Existing saved NPCs are not rewritten.

## Reproducible evidence

- `npm test -- test/npcSharedFaceMapping.test.ts --maxWorkers=2` on the original
  event tool/compiler code: **10 failed, 4 passed**. These failures include both real
  NPC runners ignoring an authored face, resurrecting a `no-face`/pending portrait,
  and ignoring the page-specific graphic. [Raw RED log](npc-shared-face-mapping/red.txt).
- `npm test -- test/npcSharedFaceMapping.test.ts test/aiGraphicAutofill.test.ts test/stardewAuthoringTools.test.ts test/characterFaceCandidates.test.ts --maxWorkers=2`:
  **54 passed / 4 files**, exit 0. [Raw GREEN log](npc-shared-face-mapping/green.txt).
- `QA_BASE_URL=http://127.0.0.1:9842 node scripts/qa/npc-shared-face-mapping.mjs`:
  Chromium reads the actual host catalog (168 mappings), calls both real tools on
  minimal in-memory contract fixtures, checks serialized event commands and decodes
  the referenced portrait PNGs (48×48). The `people4#2` no-face entry remains absent
  rather than receiving the legacy People1 face.
- The same browser probe empties the resolver cache, invokes a real `AssistantSession`
  with a scripted model tool call, and verifies that turn preflight reloads the host
  mapping before the session's `place_npc` call. It ends `final` with the expected face.
  [Browser evidence](npc-shared-face-mapping/browser.json).

The session fixture fills missing tile labels/descriptions/placementRules with empty strings
to avoid an unrelated sparse blank-project metadata failure in contextBuilder. This does
not modify product code or the host catalog.

The browser probe uses a scripted model response, not a live LLM. It performs no
remote project/catalog writes and is not an authored demo or runtime visual QA.

## Expanded gate and baseline comparison

`npm run gates -- --changed` completed its expanded unit leg: **960 files / 10,331
cases: 8,835 passed, 1,485 failed, 11 pending**. It is **not a green aggregate gate**.
The aggregate was stopped during surface checks, before automatic baseline retries
and the aggregate browser stage, to compare the failures directly against original code.

1,279 failures come from unchanged sparse tile metadata: 911 fail while constructing
AI context (`contextBuilder.ts:369`), 368 reject
`forest_harmony.tileGroups[60].placementRules`. The latest pre-PR main CI also fails
parity on exactly that validation error:
[main CI run 35294339431](https://github.com/MovieHolic-Plex/rpg-zzu/actions/runs/35294339431).

For every file with another failure, plus representative context/schema failures,
all five modified existing source files were temporarily restored from base commit
`89d517fbf`, the tests executed, and the changes restored in `finally` (no stash).
This **91-file baseline comparison** produced 762 passed / 279 failed. All failures
from the corresponding expanded-run files match the original-code failures; the
sole raw message difference is a generated `occ_<UUID>` in an unchanged spatial
failure. No new failure signature remains after normalizing that generated ID.
[Machine-readable comparison](npc-shared-face-mapping/gate-comparison.json).

Final `npm run gates -- --only typecheck --no-flake-retry`: **exit 0, errors 0, no regression**. [Raw typecheck result](npc-shared-face-mapping/typecheck.txt).
