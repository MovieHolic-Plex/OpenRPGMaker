# Editor Genre Packs

Genre packs are editor-side authoring guidance over the single canonical `Project` schema and the single player runtime. They are not alternate engines or schema variants.

## Ownership

- `src/project/genrePackId.ts` owns the five persisted IDs: `adventure-jrpg`, `monster-collect`, `horror-chase`, `story-cutscene`, and `farm-life`.
- `src/editor/genrePacks.ts` owns the machine-readable registry: starter, navigation, vocabulary, recipes, lint mappings, journeys, and runtime requirements.
- `src/editor/welcomeGenrePresets.ts` maps all seven welcome presets to a real pack and blank-project system-preset recipe. The production briefing renders exactly one card for each of the five canonical packs with stable `data-pack-id`; `partner-raise` and `school-horror` remain nested inspiration prompts rather than duplicate pack cards. `buildWelcomeGenrePresetPrompt` remains an optional AI enhancement; it is not the pack contract.
- `src/editor/welcomeGenreSystemPresetAction.ts` is the confirmed manual system-preset boundary. It passes a detached result to `store.loadNewRemoteProjectTransactionally`; there is no local-only success fallback.
- `src/project/genrePresets.ts` only applies standard `system.*` opt-ins. Player/runtime modules must not switch on `system.genre`.

`src/project/genrePackId.ts` is also the Phase 4 SSOT. Phase 4 code must import `GenrePackId`, `GENRE_PACK_IDS`, and `isGenrePackId` from that module. Welcome ids such as `horror-gallery` and `school-horror` are recipe/card ids mapped to canonical `horror-chase`; they are not aliases that persistence may accept.

## Safe blank-project system-preset flow

`createGenreBlankProjectSystemPresetPlan(packId, recipeId)` validates a selection without touching project state. Recipes declare `starterKind: "blank-project-system-preset"` plus the exact shared `system.*` fields they apply; they do not carry fictional executable adapter IDs. `materializeGenreBlankProjectSystemPreset(plan)` returns a detached `createBlankProject()` on the normal `Project` schema with the selected `system.genre` and shared system opt-ins. `authoredContentSeeded` is always `false`: a card label such as adventure village, gallery horror, or farm life is inspiration, not a promise that authored maps/events/records exist.

The live welcome DOM keeps two actions separate. Clicking the illustrated card builds and auto-sends the optional AI prompt against the current project. Clicking **빈 프로젝트 시스템 설정** shows an explicit confirmation, then waits for the production callback to complete. The transaction flushes the open project, saves the detached target to a newly minted Supabase ID with an explicit target config, reloads that same target, and compares the reloaded project to the saved payload. Before deleting drafts or adopting the candidate it snapshots local project/vault/URL state and stages the target browser config, so a quota/security error aborts before the switch; any later local commit error restores those snapshots and the exact previous config value. Only a successful local commit adopts the project, removes the old draft storage, updates the URL, dismisses the DOM, and persists the welcome-dismissed flag. Save/reload/verification/config failure leaves the current project, draft storage, config, URL, and welcome DOM untouched and exposes an inline `role=alert` error.

## Vocabulary and readiness

`resolveGenreVocabulary` provides pack-specific authoring labels without putting farm terms into shared editor core. Supplying `packId` explicitly lets existing pilots, including `createFarmingDemoProject`, be measured without rewriting or relabeling their authored content.

Do not use one ambiguous `ready` flag. The contract has two stages:

1. `evaluateGenrePackConfiguration(project, packId)` evaluates authored/static capability checks and returns `configured`. The farm pilot checks time/gifts, farmable-area presence and in-bounds rectangles, a reachable start-to-farm route, crop records and item references, a hoe and watering can in starting inventory, at least one referenced seed in starting inventory, zero lint errors, and zero reference issues.
2. `evaluateGenrePackPlayableReadiness(project, packId)` is deliberately fail-closed: `playable` is always `false`, and a configured project reports `unverified`. There is no public caller-supplied receipt factory. Phase 4 must add a file-backed or runner-backed evidence adapter before this contract can report playable.

These checks reuse the canonical `Project`, `projectLint`, `collectProjectReferenceIssues`, collision/reachability helpers, and runtime journey ids. They are advisory authoring evidence, not a second schema or genre-specific runtime. Phase 4 must import the five IDs from `src/project/genrePackId.ts` and supply evidence from a real runner-owned artifact; it must not synthesize evidence from a button click, default seed, or caller-shaped `{ booted, journeyIds }` object.

## Validation

- `test/genrePackRegistry.test.ts`: exact registry set, complete machine data, all-seven welcome mappings, honest blank-system-preset results, detached preset isolation, farm configuration negative controls, and fail-closed playability.
- `test/genrePersistence.test.ts`: five-ID serialization roundtrip and rejection of arbitrary IDs.
- `test/editorWelcome.test.ts`: the live DOM exposes the confirmed system-preset action separately from AI, renders the canonical five `data-pack-id` values exactly once with variants nested, and stays mounted on failure.
- `test/welcomeGenreSystemPresetAction.test.ts`: confirmed plans use the verified remote-switch boundary and do not mutate an open-project object.
- `test/transactionalNewRemoteProject.test.ts`: target save/reload and staged browser-config quota failures preserve the open project, draft storage, config, URL, and welcome DOM.
- `test/e2e/director-first-briefing.spec.ts`: Chromium boots the production editor welcome and gates the exact canonical five pack nodes plus nested partner/school-horror inspirations.

When extending packs, add capability requirements that the shared runtime already understands. Add a shared runtime capability first if none exists; never add a genre branch to player code.
