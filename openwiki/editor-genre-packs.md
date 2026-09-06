# Editor Genre Packs

Genre packs are editor-side authoring guidance over the single canonical `Project` schema and the single player runtime. They are not alternate engines or schema variants.

## Ownership

- `src/project/genrePackId.ts` owns the five persisted IDs: `adventure-jrpg`, `monster-collect`, `horror-chase`, `story-cutscene`, and `farm-life`.
- `src/editor/genrePacks.ts` owns the machine-readable registry: starter, navigation, vocabulary, recipes, lint mappings, journeys, and runtime requirements.
- `src/editor/welcomeGenrePresets.ts` maps all seven welcome presets to a real pack and blank-project system-preset recipe. The first-screen briefing shows three featured posters (`monster-collect`, `story-cutscene`, `adventure-jrpg`). Horror, farm, and partner-raise posters stay in the collapsed 「이런 세계도 있어요」 tier — hidden, not deleted. The DOM still carries exactly one `data-pack-id` per official pack. `buildWelcomeGenrePresetPrompt` remains an optional AI enhancement; it is not the pack contract.
- `src/editor/welcomeGenreSystemPresetAction.ts` is the project-creation boundary shared by AI posters and confirmed manual system presets. It passes a detached result to `store.loadNewRemoteProjectTransactionally`; there is no local-only success fallback.
- `src/project/genrePresets.ts` only applies standard `system.*` opt-ins. Player/runtime modules must not switch on `system.genre`.

`src/project/genrePackId.ts` is also the Phase 4 SSOT. Phase 4 code must import `GenrePackId`, `GENRE_PACK_IDS`, and `isGenrePackId` from that module. Welcome ids such as `horror-gallery` and `school-horror` are recipe/card ids mapped to canonical `horror-chase`; they are not aliases that persistence may accept.

## Safe blank-project system-preset flow

`createGenreBlankProjectSystemPresetPlan(packId, recipeId)` validates a selection without touching project state. Recipes declare `starterKind: "blank-project-system-preset"` plus the exact shared `system.*` fields they apply; they do not carry fictional executable adapter IDs. `materializeGenreBlankProjectSystemPreset(plan)` returns a detached `createBlankProject()` on the normal `Project` schema with the selected `system.genre` and shared system opt-ins. `authoredContentSeeded` is always `false`: a card label such as adventure village, gallery horror, or farm life is inspiration, not a promise that authored maps/events/records exist.

The live welcome DOM keeps two actions separate. Clicking an illustrated preset poster first awaits `applyWelcomeGenreSystemPresetPlan` through the injected `applySystemPreset` callback. It creates a detached blank project with the selected system settings, flushes the open project, saves the new remote row, reloads it, verifies equality, and only then switches the store/URL and focuses the start map. Only after that callback succeeds does welcome dismiss and return an auto-send prompt. No extra confirmation is added to the poster. The gear keeps its explicit confirmation and the same verified transaction, but returns no AI prompt. Free-text input and the additional free-text world posters still use the current project.

Before deleting drafts or adopting the candidate, the transaction snapshots local project/vault/URL state and stages the target browser config. Save/reload/verification/config failure preserves the open project and keeps welcome visible with an inline `role=alert`; it must not dismiss or release an AI intent. Controls (including keyboard input) are blocked during preparation, preventing another start from bypassing this boundary. Cancellation of the manual confirmation remains a no-op. `finishEditorBoot` still applies `applyWelcomeGenrePresetToOpenProject` to the now-created project before handoff, guaranteeing engine settings and the empty-world canon seed without relying on model tool calls.

**AI handoff ordering (2026-09-06):** store project creation and AI conversation readiness are different boundaries. Both the startup poster and the returning-user `menu.ts:newProject` path can change project identity. Store notification starts `adoptConversationForCurrentProject`, which awaits IndexedDB history before resetting the old conversation (aborting active turns and dropping queued sends). `loadNewRemoteProject` resolving alone does not await that adoption; a fast lookup can hide the race. The panel's registered AI boot target therefore awaits `whenAiChatPanelSettled()` before inserting the prompt or calling `sendText`, and does nothing if that panel was disposed. Do not substitute a timeout, or send first and suppress the project-switch reset: that would keep the wrong conversation scope. The menu retains its existing nonblocking remote autosave behavior; startup preset creation uses the verified transaction above.

## Vocabulary and readiness

`resolveGenreVocabulary` provides pack-specific authoring labels without putting farm terms into shared editor core. Supplying `packId` explicitly lets existing pilots, including `createFarmingDemoProject`, be measured without rewriting or relabeling their authored content.

Do not use one ambiguous `ready` flag. The contract has two stages:

1. `evaluateGenrePackConfiguration(project, packId)` evaluates authored/static capability checks and returns `configured`. The farm pilot checks time/gifts, farmable-area presence and in-bounds rectangles, a reachable start-to-farm route, crop records and item references, a hoe and watering can in starting inventory, at least one referenced seed in starting inventory, zero lint errors, and zero reference issues.
2. `evaluateGenrePackPlayableReadiness(project, packId)` is deliberately fail-closed: `playable` is always `false`, and a configured project reports `unverified`. There is no public caller-supplied receipt factory. Phase 4 must add a file-backed or runner-backed evidence adapter before this contract can report playable.

These checks reuse the canonical `Project`, `projectLint`, `collectProjectReferenceIssues`, collision/reachability helpers, and runtime journey ids. They are advisory authoring evidence, not a second schema or genre-specific runtime. Phase 4 must import the five IDs from `src/project/genrePackId.ts` and supply evidence from a real runner-owned artifact; it must not synthesize evidence from a button click, default seed, or caller-shaped `{ booted, journeyIds }` object.

## Validation

- `test/genrePackRegistry.test.ts`: exact registry set, complete machine data, all-seven welcome mappings, honest blank-system-preset results, detached preset isolation, farm configuration negative controls, and fail-closed playability.
- `test/genrePersistence.test.ts`: five-ID serialization roundtrip and rejection of arbitrary IDs.
- `test/editorWelcome.test.ts`: the live DOM exposes the confirmed system-preset action separately from AI, renders three featured posters plus four collapsed genre posters, keeps the canonical five `data-pack-id` values exactly once, and defers auto-send until project preparation succeeds, staying mounted on failure.
- `test/newProjectPresetHandoff.test.ts`: real menu/chooser/boot-target/panel wiring with independently deferred project creation and conversation adoption; no premature composer text, one model request after adoption, and cancellation without handoff. Network requests are stubbed.
- `test/welcomeGenreSystemPresetAction.test.ts`: confirmed plans use the verified remote-switch boundary and do not mutate an open-project object.
- `test/transactionalNewRemoteProject.test.ts`: target save/reload and staged browser-config quota failures preserve the open project, draft storage, config, URL, and welcome DOM.
- `test/e2e/director-first-briefing.spec.ts`: Chromium boots the production editor welcome, gates the three featured posters, and reveals the remaining genre posters only after expanding 「이런 세계도 있어요」.

When extending packs, add capability requirements that the shared runtime already understands. Add a shared runtime capability first if none exists; never add a genre branch to player code.
