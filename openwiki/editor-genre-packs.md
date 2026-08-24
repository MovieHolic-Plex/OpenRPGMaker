# Editor Genre Packs

Genre packs are editor-side authoring guidance over the single canonical `Project` schema and the single player runtime. They are not alternate engines or schema variants.

## Ownership

- `src/project/genrePackId.ts` owns the five persisted IDs: `adventure-jrpg`, `monster-collect`, `horror-chase`, `story-cutscene`, and `farm-life`.
- `src/editor/genrePacks.ts` owns the machine-readable registry: starter, navigation, vocabulary, recipes, lint mappings, journeys, and runtime requirements.
- `src/editor/welcomeGenrePresets.ts` maps all seven welcome cards to a real pack and recipe. `buildWelcomeGenrePresetPrompt` remains an optional AI enhancement; it is not the pack contract.
- `src/project/genrePresets.ts` only applies standard `system.*` opt-ins. Player/runtime modules must not switch on `system.genre`.

## Safe starter flow

`createGenreStarterPlan(packId, recipeId)` validates a selection without touching project state. `createProjectFromGenreStarterPlan(plan)` is the explicit manual materialization step and always creates a detached `createBlankProject()` using the normal `Project` schema. It never accepts or mutates the currently open project. Recipes currently enable capabilities only; they do not seed maps, events, or database content.

## Vocabulary and readiness

`resolveGenreVocabulary` provides pack-specific authoring labels without putting farm terms into shared editor core. `evaluateGenrePackReadiness(project, packId)` evaluates ordinary project fields against the selected pack's runtime requirements. Supplying `packId` explicitly lets existing pilots, including `createFarmingDemoProject`, be measured without rewriting or relabeling their authored content.

Readiness is advisory editor metadata. It must not become a second validation schema and must not make a project unplayable merely because it is incomplete.

## Validation

- `test/genrePackRegistry.test.ts`: exact registry set, complete machine data, welcome mapping, detached starter materialization, and farm pilot readiness.
- `test/genrePersistence.test.ts`: five-ID serialization roundtrip and rejection of arbitrary IDs.

When extending packs, add capability requirements that the shared runtime already understands. Add a shared runtime capability first if none exists; never add a genre branch to player code.
