# Editor Genre Packs

Genre packs are editor-side authoring guidance over the single canonical `Project` schema and the single player runtime. They are not alternate engines or schema variants.

## Ownership

- `src/project/genrePackId.ts` owns the five persisted IDs: `adventure-jrpg`, `monster-collect`, `horror-chase`, `story-cutscene`, and `farm-life`.
- `src/editor/genrePacks.ts` owns the machine-readable registry: starter, navigation, vocabulary, recipes, lint mappings, journeys, and runtime requirements.
- `src/editor/welcomeGenrePresets.ts` maps all seven welcome cards to a real pack and recipe. `buildWelcomeGenrePresetPrompt` remains an optional AI enhancement; it is not the pack contract.
- `src/editor/welcomeGenreStarterAction.ts` is the confirmed manual-start production boundary. It passes a detached adapter result to `store.loadNewRemoteProject`, which mints a new persistence target when DB configuration is present instead of saving over the open project; without DB configuration it still switches only to the detached local project after confirmation.
- `src/project/genrePresets.ts` only applies standard `system.*` opt-ins. Player/runtime modules must not switch on `system.genre`.

`src/project/genrePackId.ts` is also the Phase 4 SSOT. Phase 4 code must import `GenrePackId`, `GENRE_PACK_IDS`, and `isGenrePackId` from that module. Welcome ids such as `horror-gallery` and `school-horror` are recipe/card ids mapped to canonical `horror-chase`; they are not aliases that persistence may accept.

## Safe starter flow

`createGenreStarterPlan(packId, recipeId)` validates a selection without touching project state. Each recipe contains a distinct `adapterId`, title, initial navigation target, and capability list. `adaptGenreStarterPlan(plan)` returns `{ project, receipt }`: the project is a detached `createBlankProject()` using the normal `Project` schema, and the receipt records exactly which adapter applied the canonical `system.genre`. The adapter changes recipe identity and shared system opt-ins only; `authoredContentSeeded` is always `false`, and it does not seed maps, events, crops, monsters, or other authored records.

The live welcome DOM keeps two actions separate. Clicking the illustrated card builds and auto-sends the optional AI prompt against the current project. Clicking the adjacent **새 프로젝트로 시작** button shows an explicit confirmation, returns a validated `starterPlan` with `prompt: null`/`autoSend: false`, and only then reaches `applyWelcomeGenreStarterPlan`. Cancellation leaves the open project and welcome in place.

## Vocabulary and readiness

`resolveGenreVocabulary` provides pack-specific authoring labels without putting farm terms into shared editor core. Supplying `packId` explicitly lets existing pilots, including `createFarmingDemoProject`, be measured without rewriting or relabeling their authored content.

Do not use one ambiguous `ready` flag. The contract has two stages:

1. `evaluateGenrePackConfiguration(project, packId)` evaluates authored/static capability checks and returns `configured`. The farm pilot checks time/gifts, farmable-area presence and in-bounds rectangles, a reachable start-to-farm route, crop records and item references, a hoe and watering can in starting inventory, at least one referenced seed in starting inventory, zero lint errors, and zero reference issues.
2. `evaluateGenrePackPlayableReadiness(project, packId, receipt?)` returns `playable`. A configured project is still `runtime-proof-required` until a runtime or headless runner supplies a versioned `GenrePackRuntimeReceipt` for the exact project signature, reports a real boot, completes the pack's journey id, and reports no lint/reference failures. A receipt for a changed project is rejected.

These checks reuse the canonical `Project`, `projectLint`, `collectProjectReferenceIssues`, collision/reachability helpers, and runtime journey ids. They are advisory authoring evidence, not a second schema or genre-specific runtime. Phase 4 should adapt its real runtime/headless result into `createGenrePackRuntimeReceipt`; it must not synthesize a receipt from a button click or default seed.

## Validation

- `test/genrePackRegistry.test.ts`: exact registry set, complete machine data, all-seven welcome mappings, distinct pure recipe adapter results, detached starter isolation, farm configuration negative controls, receipt-required playability, and stale-receipt rejection.
- `test/genrePersistence.test.ts`: five-ID serialization roundtrip and rejection of arbitrary IDs.
- `test/editorWelcome.test.ts`: the live DOM exposes the confirmed manual starter action separately from AI.
- `test/welcomeGenreStarterAction.test.ts`: confirmed plans use the new-project persistence boundary and do not mutate an open-project object.

When extending packs, add capability requirements that the shared runtime already understands. Add a shared runtime capability first if none exists; never add a genre branch to player code.
