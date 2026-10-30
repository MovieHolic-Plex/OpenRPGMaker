<!-- 생성 파일 — 직접 고치지 말고 `npm run openwiki:index` 를 돌려라. -->
# OpenWiki 항해 색인

이 저장소의 위키는 **188쪽 / 7685KB / 약 2,257,443 토큰** 이다. 통째로 읽을 수 있는 크기가 아니므로, 필요한 절만 좌표로 잘라 읽어라.

```
read("openwiki/editor-database.md", offset=<절 시작줄>, limit=120)
grep -n "찾는말" openwiki/*.md          # 어느 페이지 몇 줄인지부터 찾는다
```

## 통째 읽기가 잘리는 페이지 (도구 상한 50KB)

이 페이지를 `read` 로 한 번에 열면 **조용히 잘린 채** 전달된다. 아래 절 목록의 줄 번호로 잘라 읽어라.
「가장 큰 절」이 상한 아래면 절 단위 읽기로 페이지 전부에 닿을 수 있다.

| 페이지 | 통짜 크기 | 가장 큰 절 | 줄 | 토큰 추정 |
|---|---|---|---|---|
| `openwiki/asset-store.md` | 56KB | 19KB | 358 | ~16,627 |
| `openwiki/assistant-v2.md` | 165KB | 46KB | 443 | ~50,425 |
| `openwiki/atlas-biome-interior.md` | 109KB | 21KB | 534 | ~32,760 |
| `openwiki/beodeul-city.md` | 231KB | 19KB | 1135 | ~70,177 |
| `openwiki/charset-actor-harness.md` | 70KB | 7KB | 501 | ~22,135 |
| `openwiki/editor-ai-panel.md` | 718KB | 100KB ⚠상한 초과 — 절을 더 쪼개라 | 4650 | ~211,017 |
| `openwiki/editor-ai-tools.md` | 598KB | 90KB ⚠상한 초과 — 절을 더 쪼개라 | 3972 | ~175,580 |
| `openwiki/editor-database.md` | 458KB | 64KB ⚠상한 초과 — 절을 더 쪼개라 | 2681 | ~134,655 |
| `openwiki/editor-event-authoring.md` | 185KB | 78KB ⚠상한 초과 — 절을 더 쪼개라 | 1136 | ~54,218 |
| `openwiki/editor-event-commands.md` | 78KB | 32KB | 327 | ~21,831 |
| `openwiki/editor-genre-packs.md` | 54KB | 7KB | 358 | ~14,186 |
| `openwiki/editor-interior-room-harness.md` | 98KB | 6KB | 469 | ~28,406 |
| `openwiki/editor-observability.md` | 64KB | 6KB | 725 | ~18,890 |
| `openwiki/editor-pre-edit-routing.md` | 189KB | 73KB ⚠상한 초과 — 절을 더 쪼개라 | 1176 | ~55,736 |
| `openwiki/editor-validation.md` | 61KB | 16KB | 406 | ~17,278 |
| `openwiki/editor-workflows-misc.md` | 91KB | 33KB | 636 | ~25,541 |
| `openwiki/editor-workshop.md` | 76KB | 15KB | 337 | ~22,898 |
| `openwiki/harnesses/assistant-capability.md` | 59KB | 8KB | 380 | ~18,190 |
| `openwiki/harnesses/building-kit.md` | 99KB | 4KB | 984 | ~29,868 |
| `openwiki/harnesses/interview-scene-bank.md` | 56KB | 38KB | 197 | ~17,387 |
| `openwiki/harnesses/monster-collect-species.md` | 63KB | 18KB | 353 | ~19,132 |
| `openwiki/harnesses/object-gate.md` | 89KB | 12KB | 642 | ~26,964 |
| `openwiki/harnesses/super-harness.md` | 102KB | 4KB | 1063 | ~32,225 |
| `openwiki/jp-city.md` | 108KB | 14KB | 511 | ~32,141 |
| `openwiki/runtime-battle.md` | 440KB | 32KB | 2417 | ~129,307 |
| `openwiki/runtime-m2-flow-controls.md` | 58KB | 29KB | 352 | ~15,674 |
| `openwiki/runtime-pre-edit-routing.md` | 205KB | 103KB ⚠상한 초과 — 절을 더 쪼개라 | 1233 | ~60,998 |
| `openwiki/runtime-project-schema.md` | 264KB | 83KB ⚠상한 초과 — 절을 더 쪼개라 | 1825 | ~74,678 |
| `openwiki/runtime-sessions.md` | 166KB | 64KB ⚠상한 초과 — 절을 더 쪼개라 | 922 | ~45,466 |
| `openwiki/team-project-host.md` | 51KB | 5KB | 536 | ~15,628 |
| `openwiki/testing.md` | 265KB | 48KB | 2403 | ~74,707 |
| `openwiki/tileset-reference-documents.md` | 60KB | 4KB | 603 | ~18,386 |

## 한국어 산문이 깨진 페이지

EUC-KR→UTF-8 모지바케가 남은 줄이다. **그 줄의 한국어는 믿지 말고** 같은 줄의 파일 경로·식별자만 쓰고, 의미는 해당 소스 파일에서 직접 확인하라. 복원은 불가능하다(원본 바이트가 소실). 문장 끝 물음표(「만들까요?」, “뭔가요?”)는 깨진 줄이 아니므로 이 목록에 없다.

| 페이지 | 깨진 줄 수 | 예시 줄 번호 |
|---|---|---|
| `openwiki/editor-ai-panel.md` | 24 | 3093, 3094, 3095, 3096, 3097, 3098, 3112, 3172 |
| `openwiki/editor-ai-tools.md` | 5 | 2443, 2444, 2448, 2450, 2452 |
| `openwiki/editor-database.md` | 6 | 1204, 1211, 1212, 1221, 1247, 1250 |
| `openwiki/editor-event-authoring.md` | 16 | 549, 550, 553, 558, 559, 560, 561, 562 |
| `openwiki/editor-event-command-fixes.md` | 11 | 11, 12, 14, 15, 16, 17, 18, 19 |
| `openwiki/editor-event-commands.md` | 6 | 147, 160, 161, 163, 166, 167 |
| `openwiki/editor-pre-edit-routing.md` | 3 | 923, 933, 946 |

## 없는 파일을 가리키는 참조

문서가 이름을 부르는데 저장소에 없는 파일이다. 대부분은 **의도적으로 삭제된 모듈** 을 기록으로 남긴 것이지만(그 경우 문단이 삭제 사실을 말한다), 살아 있는 안내처럼 읽히면 에이전트가 없는 파일을 찾아 헤맨다. 문서를 고칠 때 이 목록이 줄어드는지 보라.

| 페이지 | 건수 | 참조 |
|---|---|---|
| `openwiki/PROJECT_WIKI.md` | 2 | `.part-N.css`, `src/styles/editor/core.part-1.css` |
| `openwiki/agent-worktrees.md` | 1 | `scripts/gen-combined-town-chipset-report.mts` |
| `openwiki/ai-workflow.md` | 10 | `.omo/evidence/ai-assistant-failure-modes.md`, `20260709000000_ai_activity_logs.sql`, `docs/2026-07-10-tool-calling-architecture-review.md`, `docs/tool-catalog.md`, `latest.json`, `src/ai/plannerSkip.ts`, `test/authorVillageScopeGate.test.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/tilesetAiClient.test.ts`, `test/volumeContractSession.test.ts` |
| `openwiki/architecture.md` | 10 | `.lazy.ts`, `.mjs`, `app.cjs`, `bridge.js`, `dist-electron/main.cjs`, `dist-electron/project-core.cjs`, `dist/start-screen.html`, `editor-demo-load.mjs`, `player.js`, `project.json` |
| `openwiki/asset-store.md` | 21 | `DATA/store-uploads.json`, `OpenRPGMaker-store/scripts/storeCli.ts`, `deploy/README.md`, `installed.json`, `loading.json`, `migrations/012_games.sql`, `migrations/016_game_saves.sql`, `migrations/017_creator_voice.sql`, `packs/pNNN.json`, `preload-files.json`, `preload-sw.js`, `public/cloudsave.js`, `scripts/check-contract.mjs`, `scripts/games-host.mjs`, `src/gameSaves.ts`, `src/games.ts`, `src/markdown.ts`, `src/posts.ts`, `src/web/changelog.ts`, `src/web/discoverPages.ts`, `test/changelog.test.ts` |
| `openwiki/assistant-v2.md` | 7 | `assistant-whole-game/tools/hplay.mjs`, `refs/anchors.json`, `scene.json`, `scene_start.mts`, `suite/dungeon-design-fp.py`, `suite/ledger/handoff-study.md`, `suite/prompts.json` |
| `openwiki/atlas-biome-interior.md` | 8 | `.loop.json`, `.loop.png`, `interior-merged-palette.html`, `public/assets/atlas-biomes/jungle-chipset.png`, `public/assets/atlas-interior/dungeon-chipset.png`, `scripts/content/atlas-dungeon/split-dungeon.mjs`, `src/assets/atlasBiomeDungeonTileset.json`, `verify-shots/interior-bake-4/new-objects.png` |
| `openwiki/authoring-play-presets.md` | 1 | `catalog-96.json` |
| `openwiki/autotiles.md` | 13 | `install-pixel-art-world-shared-host.mjs`, `pixelArtWorldAutotiles.ts`, `prepare-pixel-art-world-xp-library.mjs`, `publish-pixel-art-world-xp-library.mjs`, `reports/pr617-621-integration.md`, `src/assets/tiboRecoveredTileset.json`, `src/project/defaults/iceGrandPlain64.ts`, `src/project/defaults/tallGrassArrange.ts`, `test/iceGrandPlain64.test.ts`, `test/placeConceptRender.test.ts`, `test/villageBuilder.test.ts`, `tiboRecovery.test.ts`, `wildRouteForest.ts` |
| `openwiki/battle-impact-contact.md` | 1 | `verify-shots/battle-impact/README.md` |
| `openwiki/battle-motion-programs.md` | 7 | `verify-shots/battle-motion/SUMMARY.md`, `verify-shots/battle-motion/adversarial/trajectory-review.json`, `verify-shots/battle-motion/editor-audit.json`, `verify-shots/battle-motion/multihit/SUMMARY.md`, `verify-shots/battle-motion/player-final/SUMMARY.md`, `verify-shots/battle-motion/rules-audit.json`, `verify-shots/battle-motion/swap/SUMMARY.md` |
| `openwiki/beodeul-city.md` | 27 | `behavior.mjs`, `bench.mjs`, `beodeulDungeonTools.ts`, `compare.json`, `drive.mjs`, `fallenAstel.ts`, `forestHarmony.ts`, `fp.json`, `harness-data/object-gate/vqa/beodeul-town-wall-r1..r5/receipt.json`, `pdiff.py`, `pixel-diff.json`, `render.png`, `space.json`, `tampers.json`, `tiledata/city-refs/outskirts-wooden-houses.png`, `trace.json`, `verify-shots/assistant-house-entry/README.md`, `verify-shots/beodeul-assistant/reloaded-render.png`, `verify-shots/beodeul-building-refinement/README.md`, `verify-shots/beodeul-default/bd-existing-combined-town.png`, `verify-shots/beodeul-door/applied/README.md`, `verify-shots/beodeul-door/storage-proof.json`, `verify-shots/beodeul-ground/README.md`, `verify-shots/beodeul-native-restoration/README.md`, `verify-shots/beodeul-small-village/README.md`, `verify-shots/gabled-roof/SUMMARY.md`, `villageContract.ts` |
| `openwiki/bgm-catalog.md` | 4 | `artifacts/bgm-release/bgm-release-v1.json`, `catalog.raw.json`, `output/evidence/agy-interface-smoke-transcript.json`, `output/evidence/audio-ai-final/ingestion-report.json` |
| `openwiki/charset-actor-harness.md` | 43 | `SOURCE.md`, `alpha-render.json`, `alpha.png`, `alpha/SUMMARY.md`, `alpha_sheet.png`, `archive-readback.json`, `browser-proof.json`, `charset-eight-transparent.png`, `charset-eight.json`, `charset-eight.png`, `charset-normal.png`, `charset-strong.png`, `charset-weak.png`, `context.png`, `delivery-readback.json`, `delivery.json`, `desc.json`, `discarded.json`, `driver.json`, `evidence/20261004-continuation/harness-contracts-final.json`, `experiment.json`, `export-readback.json`, `gate.json`, `initial-images-readback.json`, `licenses/easyrpg/AUTHORS.md`, `live-reload.json`, `live-review.png`, `mixed100-002__gpt-r1/views/context.png`, `model-frames.json`, `novelty-transfers.json`, `novelty.json`, `pack/characters.json`, `pack/editor-assets.json`, `pack/index.html`, `pixel-edits.json`, `pixel-proof.png`, `production-errors.json`, `readback.json`, `shared-library-error.json`, `sheet_rgba.png`, `visual-inputs.json`, `walk-qa.json`, `walk-transfer.json` |
| `openwiki/chipset-gap-inventory.md` | 5 | `20261007-gpt/fantasy-smithy-r1/judge.json`, `genre-20261007/gemini-harbor-romance/project.json`, `qa-runs/genre-20261007/gemini-harbor-romance/project.json`, `qa-runs/harnesses/space-craft/20261007-gpt/murim-dojo-r1/trace.json`, `romance-preset-first-build.md` |
| `openwiki/copyright-purge.md` | 6 | `atlas-biomes/jungle-chipset.png`, `benchmark.html`, `city_v6/v3_final.png`, `forestHarmonyTileset.json`, `sharedCastleReferences.json`, `tiledata/jp-city/forest-r3/spec-tree-x8.png` |
| `openwiki/delayed-tooltip.md` | 1 | `verify-shots/oprn-024/06-rerender-clears.png` |
| `openwiki/dungeon-themes.md` | 1 | `-theme-allows.json` |
| `openwiki/editor-ai-panel.md` | 134 | `.omo/evidence/assistant-glass-fold/measure.json`, `.omo/evidence/autonomous-ai-rpg/task-8-autonomous-ai-rpg.md`, `.omo/evidence/db-ai-review/live-review-chain.md`, `.playwright-mcp/cap.mjs`, `04-source-page.png`, `05-report-modal.png`, `06-page-modern-forms.css`, `07-wide-compact.png`, `15-assistant-readable.css`, `17-assistant-modern-shell.css`, `DRAFT_20260706_auth_rls.sql`, `SUMMARY.json`, `_adversarial-tile-qa.spec.ts`, `after/measure.json`, `agent-reps3.json`, `ai-tool-usage-YYYY-MM-DD.json`, `aiCommandBar.ts`, `aiGlassPanelWidth.test.ts`, `aiSkillDrawer.ts`, `aiTeamDeck.ts`, `aiTemperatureMenu.ts`, `aiVolatileController.ts`, `assistant-skills.css`, `assistantP2ReviewIntegration.test.ts`, `broker-results.json`, `broker.json`, `browser-measurements.json`, `candidate-private.json`, `cap2.mjs`, `chat-dock-switch.spec.ts`, `chatDock.ts`, `claude-viz/autonomous-loop-2.html`, `docs/2026-09-03-ai-assistant-modern-ui-proposal.html`, `docs/2026-09-14-team-panel-plan.html`, `docs/qa/2026-09-06-ai-assistant-ui-audit.md`, `docs/superpowers/specs/2026-08-20-ai-glass-dock-design.md`, `docs/superpowers/specs/2026-09-03-ai-studio-console-design.md`, `docs/superpowers/specs/2026-09-03-assistant-deck-design.md`, `docs/superpowers/specs/2026-09-03-llm-intent-routing-design.md`, `docs/superpowers/specs/2026-09-15-studio-agent-lanes-design.md`, `facts.json`, `frames.json`, `functionalCompositeClarification.test.ts`, `houseLotDecor.ts`, `intentClarify.ts`, `newmain-after-measure.json`, `output/evidence/acceptance-live/README.md`, `output/evidence/ai-activity-levels/06-wide.png`, `output/evidence/ai-team-budget/SUMMARY.json`, `output/evidence/ai-team-menu/SUMMARY.json`, `output/evidence/ai-team-sidebar/SUMMARY.md`, `output/evidence/ai-work-tab/SUMMARY.md`, `output/evidence/assistant-clean-glass/phase-2/implementation.md`, `output/evidence/assistant-ui-modern/newmain-before-measure.json`, `output/evidence/studio-drawer/qa/capture-report.json`, `output/evidence/ultrabrain/settings.png`, `plan-wire.json`, `project.json`, `provider-reps3.json`, `regionIntentRouter.ts`, `reports/2026-09-21-assistant-creation-choice.md`, `reports/2026-09-21-village-contract-live.md`, `reports/region-polish/index.html`, `review-input.png`, `roles-wire.json`, `scripts/build-inn-interior-map.mts`, `scripts/qa/ai-team-budget.mjs`, `scripts/qa/assistant-side-seam-hittest.mjs`, `setup.json`, `specialists.png`, `src/ai/intentClarify.ts`, `src/ai/plannerSkip.ts`, `src/ai/skills.ts`, `src/benchmark/llmClient.ts`, `src/editor/chatDock.ts`, `src/editor/tools/houseLotTools.ts`, `src/styles/editor/ghost-phase-chip.css`, `stampPlace.ts`, `test/agentBlueprintTurnEnd.test.ts`, `test/aiActivityLiveRow.test.ts`, `test/aiChatObservability.test.ts`, `test/aiChatPanelUxRepairs.test.ts`, `test/aiChatSessionScope.test.ts`, `test/aiComposerEffortPanel.test.ts`, `test/aiConversationRemoteHistory.test.ts`, `test/aiGlassFold.test.ts`, `test/aiGlassPanelWidth.test.ts`, `test/aiNewGoalDraftRetirement.test.ts`, `test/aiNewGoalEarlyOwnership.test.ts`, `test/aiPanelContextSurfaces.test.ts`, `test/aiStickyChecklist.test.ts`, `test/aiToolCallSessionProtocol.test.ts`, `test/aiWorkItemStall.test.ts`, `test/assistantAcceptance.test.ts`, `test/assistantAcceptanceSession.test.ts`, `test/assistantImageTransport.test.ts`, `test/assistantSpatialObligations.test.ts`, `test/chatDock.test.ts`, `test/e2e/_ai-composer.spec.ts`, `test/e2e/_aichat-bug-hunt.spec.ts`, `test/e2e/_assistant-glass-shots.spec.ts`, `test/e2e/_glass-dock-report.spec.ts`, `test/e2e/_probe-event-editor.spec.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/mode-switch-camera-stability.spec.ts`, `test/editSceneCameraFocus.test.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/plannerSkip.test.ts`, `test/regionIntentExposure.test.ts`, `test/regionTaskRun.test.ts`, `test/tilesetAiClient.test.ts`, `test/turnGuideSharedRules.test.ts`, `test/volumeContractSession.test.ts`, `test/workspaceBarAssistantDock.test.ts`, `town-trial.mts`, `verify-shots/ai-activity-live/02-canvas-chip-anchored.png`, `verify-shots/ai-canvas-activity/summary.json`, `verify-shots/ai-composer-mode/do-mode-blocked-item.png`, `verify-shots/ai-dock-log-mount/matrix-after.json`, `verify-shots/ai-map-ownership/controlled.json`, `verify-shots/ai-map-ownership/three-maps/timeline.json`, `verify-shots/ai-parallel-live/timeline.json`, `verify-shots/ai-team-agent-centered/SUMMARY.md`, `verify-shots/aichat-bug-hunt/REPORT.md`, `verify-shots/feature16-ai/01-library.png`, `verify-shots/first-core-opening/SUMMARY.md`, `verify-shots/first-scene-v7/SUMMARY.md`, `verify-shots/monster-assistant-opening-2026-10-03/REPORT.md`, `verify-shots/perf-ai-ui/README.md`, `verify-shots/preset-first-team-e2e/SUMMARY.json`, `verify-shots/quest-library/SUMMARY.md`, `verify-shots/right-region-drag/README.md`, `verify-shots/team-village-live/SUMMARY.json`, `writer-wire.json` |
| `openwiki/editor-ai-tools.md` | 107 | `.omo/evidence/ai-editor-reach-20260827/coverage-audit.md`, `.omo/evidence/ai-tool-exposure/README.md`, `.omo/evidence/house-protection/p2/exercise.mts`, `ai/modernTilesetPolicy.ts`, `aiCommandBar.ts`, `aiProposalModal.ts`, `defaults/forestGrove.ts`, `docs/qa/saesol-three-hour-ai-authoring.md`, `docs/reviews/2026-09-20-data-integrity-fixes.md`, `docs/superpowers/plans/2026-09-25-mz-layers-assistant.md`, `docs/superpowers/specs/2026-09-03-llm-intent-routing-design.md`, `docs/tool-catalog.md`, `forest-cliff-village-atlas.png`, `forestContour.ts`, `forestGroves.ts`, `forestTrunkTiles.ts`, `objectgen/footprint.py`, `ohMyPiNumericEnumLocal.test.ts`, `output/evidence/monster-catalog/README.md`, `output/lpc-shared-organized-20260923/shared-proof.json`, `output/shared-spatial-catalog/probe.mts`, `projectWikiSession.test.ts`, `public/assets/emerald-monster/cast/theme-cast.json`, `public/assets/forest-harmony/tree-shadows.png`, `reports/2026-09-20-event-command-assistant.md`, `reports/2026-09-21-ai-forest-default.md`, `reports/2026-09-21-ai-tool-parallel.md`, `reports/2026-09-21-forest-groves.md`, `reports/2026-09-21-restore-original-forest-trunks.md`, `reports/place-concept-inn/e2e/receipt.json`, `scripts/content/bake-forest-harmony-tree-shadows.py`, `scripts/content/pack-theme-cast.py`, `scripts/gen-place-concept-report.mts`, `src/ai/villageReferenceExamples.ts`, `src/assets/forestHarmonyTreeShadows.json`, `src/editor/authoredHouseFormStamp.ts`, `src/editor/tools/authorHouseToolDef.ts`, `src/editor/tools/authorVillageSupport.ts`, `src/editor/tools/fenceRepairTools.ts`, `src/editor/tools/houseLotTools.ts`, `src/editor/tools/interiorVariety.ts`, `src/project/defaults/authoredHouseFormCatalog.ts`, `src/project/defaults/dewVillageDialogue.ts`, `src/project/defaults/forestHarmonyTreeShadows.ts`, `src/project/defaults/forestTrunkOnlyParts.ts`, `src/project/flagship/fallen/act2Places.ts`, `tabs-b-assistant-panel.css`, `test/aiEventPlacementSurfaceGate.test.ts`, `test/aiOutdoorTilesetDefaults.test.ts`, `test/aiStaleProposal.test.ts`, `test/aiToolCallSessionProtocol.test.ts`, `test/applyProposedProjectHouseProtection.test.ts`, `test/assistantMapPreservationGuard.test.ts`, `test/authorHouseTreeClearance.test.ts`, `test/authorVillageViewportBounds.test.ts`, `test/authoredHouseForm.test.ts`, `test/bossPhaseQuestOutcomeGate.test.ts`, `test/clusterAiModalHouseProtection.test.ts`, `test/conceptFacilityTemplates.test.ts`, `test/conceptWingLayout.test.ts`, `test/constructionContracts.test.ts`, `test/e2e/_concept-inn-audit.spec.ts`, `test/e2e/_intent-router-cases.spec.ts`, `test/e2e/_place-concept-inn-evidence.spec.ts`, `test/elementRatesPartialAccept.test.ts`, `test/forestGroves.test.ts`, `test/forestTreeShadows.test.ts`, `test/houseDoorOpen.test.ts`, `test/houseKitDomainSeam.test.ts`, `test/houseLotFlowerMaterial.test.ts`, `test/intentClarify.test.ts`, `test/interiorConceptRoutes.test.ts`, `test/interiorPresetExamples.test.ts`, `test/interiorRoomPipeline.test.ts`, `test/interiorSeedFallback.test.ts`, `test/npcCastSession.test.ts`, `test/placeConceptAssistant.test.ts`, `test/placeConceptRender.test.ts`, `test/projectLint.test.ts`, `test/propRejectionDiagnostics.test.ts`, `test/questGraph.test.ts`, `test/refactorTools.test.ts`, `test/regionTaskRun.test.ts`, `test/villageBoulevard.test.ts`, `test/villageBuilder.test.ts`, `test/villageBuilderSeam.test.ts`, `test/villageCrossRoad.test.ts`, `test/villageReferenceExamples.test.ts`, `test/villageSketch.test.ts`, `test/volumeContractSession.test.ts`, `test/worldAiExclusion.test.ts`, `tools/village/constants.ts`, `verify-shots/beodeul-building-refinement/README.md`, `verify-shots/beodeul-door/applied/canonical-proof.json`, `verify-shots/beodeul-ground/README.md`, `verify-shots/beodeul-small-village/README.md`, `verify-shots/charset-mapping-audit-20261005/SUMMARY.md`, `verify-shots/charset-reference-evidence-20261005/SUMMARY.md`, `verify-shots/full-character-reference-audit-20261005/SUMMARY.md`, `verify-shots/retro-choreo-a2/e-preview-choreography-0.png`, `verify-shots/terrain-ai-edit/SUMMARY.md`, `verify-shots/terrain-assistant-live/SUMMARY.md`, `verify-shots/terrain-seams/SUMMARY.md`, `village-layout-research.md`, `village/builder.ts`, `village/fenceRepair.ts`, `village/houses.ts` |
| `openwiki/editor-database.md` | 108 | `.omo/editor-skill-stage/capture.mjs`, `.omo/evidence/css-refactor/declarations.json`, `.omo/evidence/db-ai-review/live-03-error.png`, `.omo/evidence/shared-character-faces/README.md`, `.oprn-kit.json`, `after/probe.json`, `before/probe.json`, `bronze-sword-icon.png`, `bronze-sword-image.png`, `browser-proof.json`, `builtinHouseStructureKits.ts`, `capture.mjs`, `curatedVillagePlaceReferences.ts`, `databaseCinematics.test.ts`, `databaseUxLevel.ts`, `databaseVillageModel.ts`, `defaults/fixtures/dew-village-demo.json`, `desc.json`, `desktop-record-shell.css`, `desktop-record-shell/13-actor-studio.css`, `docs/2026-09-15-db-ai-review-overlay-mockup.html`, `docs/reviews/2026-09-20-data-integrity-fixes.md`, `docs/reviews/db-beginner-adversarial-qa-findings.md`, `docs/reviews/db-beginner-adversarial-qa.md`, `docs/superpowers/specs/2026-08-28-db-structures-editor-design.md`, `editor-actor2.png`, `editor-conflict.png`, `editor-no-match.png`, `enemy-art-NNN.png`, `forestPlaceReferences.ts`, `form-hierarchy-modern.css`, `g1-handles-after.png`, `hero-01-charset.png`, `houseKitTools.ts`, `houseTemplates.test.ts`, `modernNocturneGame.ts`, `observations.json`, `outline-native.png`, `output/evidence/battle-animation-ux/p1-implementation.md`, `output/evidence/battle-animation-ux/p2-implementation.md`, `output/evidence/battle-rules-ux/st_01a07318-manual-qa.md`, `output/evidence/battle-rules-ux/verification.md`, `output/evidence/character-face-correction/actor2-before-after.png`, `output/evidence/concept-expansion/legacy-db-proof.json`, `output/evidence/concept-v2/legacy-db-proof.json`, `output/evidence/monster-concepts/b1/fix.md`, `output/evidence/monster-concepts/p2/verification.md`, `output/evidence/monster-concepts/r1/fix.md`, `output/evidence/places-ux-audit/after/card-outline.png`, `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`, `output/spatial-ux-verify.mjs`, `potion-red-icon.png`, `potion-red-image.png`, `publish-forest-place-library.mjs`, `qa-db-beginner-mode.spec.ts`, `regionReferences/ships.json`, `reports/2026-09-06-css-cascade-audit.md`, `reports/chipset-label-confirmed-v2-2026-09-05.html`, `reports/concept-facilities/index.html`, `reports/generated-effect-showcase-2026-08-24.html`, `reports/pr617-621-integration.md`, `reveal-fix.md`, `scripts/bake-village-archetype-previews.mts`, `scripts/build-tile-semantics.mts`, `scripts/content/recolor-forest-stone-well.py`, `scripts/generate-default-item-icons.mts`, `scripts/lib/effectSheet/paintersMonster.mjs`, `scripts/lib/effectSheet/paintersUtility.mjs`, `scripts/qa/render-ship-place-references.py`, `scripts/repair-capture-rate-residue.mts`, `scripts/tmp-phase3-probe.mjs`, `sharedVillageObjects.json`, `shipPlaceReferences.ts`, `skyStairGame.test.ts`, `src/styles/editor/harness-suggestion.css`, `src/styles/shell/editor-welcome.css`, `test/conceptFacilityTemplates.test.ts`, `test/databaseModalAiConnection.test.ts`, `test/databaseStudioV2.test.ts`, `test/databaseSystemView.test.ts`, `test/databaseTilesetFolder.test.ts`, `test/databaseVillageView.test.ts`, `test/editorWelcome.test.ts`, `test/houseTemplateCatalog.test.ts`, `test/houseTemplates.test.ts`, `test/p0ProjectSchema.test.ts`, `test/regionReferences.test.ts`, `test/spatialLegacyImport.test.ts`, `test/toolActionAuthoringParity.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `test/villageArchetypePreviews.test.ts`, `test/villageAuthoringData.test.ts`, `test/villageHousePreview.test.ts`, `test/villagePresetPreview.test.ts`, `test/villageWingGeometry.test.ts`, `troops.part-1.css`, `verify-shots/db-ux/after/probe.json`, `verify-shots/db-ux/before/probe.json`, `verify-shots/db-ux/pseudo-baseline/probe.json`, `verify-shots/editor-ux-audit-round2-20261004/agents/database.md`, `verify-shots/editor-ux-improvements-20261004/README.md`, `verify-shots/retro-choreo-b/g0-handles-before.png`, `verify-shots/retro-editable/SHOTS.md`, `verify-shots/runtime-qa/menu-eras/EDITOR.md`, `verify-shots/shared-hand-fx-20261005/SUMMARY.md`, `village/authoringData.ts`, `villageHousePreview.ts`, `villagePresetPreview.ts` |
| `openwiki/editor-event-authoring.md` | 33 | `.omo/evidence/wish-event-audit/PR614_MERGE.md`, `03-legend-toolbar.css`, `05-force-modern-actor-page3.css`, `_event-map-items-after.spec.ts`, `audit-before.md`, `docs/2026-09-17-event-editor-authoring-adversarial-review.md`, `docs/interior-wall-frame-autotile-cases.html`, `docs/proposals/2026-08-28-event-editor-ui-improvement.html`, `docs/proposals/2026-09-03-event-editor-ux-redesign.html`, `docs/reviews/2026-09-05-event-runtime-audit.md`, `docs/reviews/2026-09-20-data-integrity-fixes.md`, `docs/specs/2026-07-14-character-id-relationship-gate.md`, `event-editor-ai.css`, `event-editor.balanced.css`, `event-editor.part-3/08-inline-validation-badges.css`, `openwiki/castle-map.md`, `output/evidence/event-ai-assist-ux/960x900-compact.png`, `scripts/generated/toolCatalog.json`, `src/editor/content/skyStairMaps.ts`, `src/project/defaults/legacyInteriorWallContract.ts`, `src/styles/editor/event-editor.balanced.css`, `src/styles/editor/event-editor.modernize.css`, `test/e2e/_event-ai-adv-shots.spec.ts`, `test/e2e/_event-ai-queue-shots.spec.ts`, `test/e2e/_event-editor-layout-shots.spec.ts`, `test/e2e/_evpage-do-shots.spec.ts`, `test/eventEditorTrustLoop.test.ts`, `verify-shots/editor-ux-audit-round2-20261004/agents/events-storage.md`, `verify-shots/editor-ux-improvements-20261004/README.md`, `verify-shots/event-diary-graphic/README.md`, `verify-shots/event-drag-audit/README.md`, `verify-shots/page-preview-probe/02-preview-open.png`, `verify-shots/runtime-qa/cheolsu-keyboard-fixed/SUMMARY.md` |
| `openwiki/editor-event-command-fixes.md` | 21 | `.omo/evidence/event-command-remediation/U04/api-ownership.md`, `.omo/evidence/event-command-remediation/U14/verification.md`, `.omo/evidence/event-command-remediation/U28/G1-F18/verification.md`, `docs/battle-command-ux-plan.html`, `docs/reviews/2026-09-20-data-integrity-evidence/observations.json`, `event-editor-rich-forms.css`, `gate-review/classification.md`, `scripts/qa/runtime/event-command-remediation-u02.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u04.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u05.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u06.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u14.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u28-text.scenario.mjs`, `test/e2e/event-command-remediation-U02.spec.ts`, `test/e2e/event-command-remediation-U04.spec.ts`, `test/e2e/event-command-remediation-U05.spec.ts`, `test/e2e/event-command-remediation-U06.spec.ts`, `test/eventCommandRemediation/U02.test.ts`, `test/eventCommandRemediation/U04.test.ts`, `test/eventCommandRemediation/U05.test.ts`, `test/eventCommandRemediation/U06.test.ts` |
| `openwiki/editor-event-commands.md` | 17 | `02-changeface-play-mock-larger.css`, `07-identifiable-previews.css`, `choicesDialog.ts`, `docs/2026-09-17-event-editor-authoring-adversarial-review.md`, `event-editor.command-preview.css`, `event-editor.command-preview/01-event-editor-modern-import.css`, `event-editor.commerce.css`, `event-editor.part-1.css`, `event-editor.part-2/3.css`, `event-editor.shop.css`, `eventCommandSupportRepairs.test.ts`, `messageCommandDialogs.ts`, `messageDialogControls.ts`, `src/styles/editor/event-editor.part-2.css`, `test/dialoguePreviewPresentationCss.test.ts`, `test/eventEditorTrustLoop.test.ts`, `textCommandDialog.ts` |
| `openwiki/editor-genre-packs.md` | 20 | `c1-after.json`, `c4-report.json`, `docs/superpowers/specs/2026-10-07-concept-feed-design.md`, `firstWorldArrival.ts`, `scripts/capture-cinematic-interview.mjs`, `scripts/capture-first-world-arrival.mjs`, `scripts/capture-preset-ai-gate.mjs`, `src/editor/panels/newProjectDialog.ts`, `src/editor/ui/newProjectDialog.ts`, `src/start/firstWorldArrival.ts`, `start/startInterview.ts`, `startInterview.ts`, `startLobby.ts`, `test/editorWelcome.test.ts`, `test/modalEscapeLayerGate.test.ts`, `test/newProjectDialog.test.ts`, `verify-shots/gap-fixes/c1-before.json`, `verify-shots/interview-adversarial/validation.json`, `verify-shots/interview-live-handoff/SUMMARY.md`, `verify-shots/preset-ai-connect-gate/SUMMARY.json` |
| `openwiki/editor-interior-room-harness.md` | 58 | `bake-atlas-interior-tiles.py`, `conceptFacilityVariants.ts`, `dungeonRoomPipeline.ts`, `hearth-lit.json`, `hearth-unlit.json`, `output/audit-element-cliff-seams.py`, `output/audit-element-complex-seams.py`, `output/audit-four-context-dungeons-v3.py`, `output/audit-four-context-dungeons.py`, `output/build-element-complex-caves.mts`, `output/build-element-confluence-caves.mts`, `output/build-element-contour-caves.mts`, `output/build-four-context-dungeons-v2.mts`, `output/build-four-context-dungeons-v3.mts`, `output/build-four-context-dungeons.mts`, `output/context-element-caves.mts`, `output/decorate-element-caves.mts`, `output/element-complex-qa.mjs`, `output/element-confluence-qa.mjs`, `output/element-contour-qa.mjs`, `output/evidence/concept-v2/index.html`, `output/evidence/inn-exploration-v4/index.html`, `output/evidence/inn-inspection-v5/index.html`, `output/evidence/pr618-fixtures/inn.json`, `output/four-context-dungeons-qa.mjs`, `output/four-context-dungeons-v3-qa.mjs`, `output/save-element-complex-caves.mts`, `output/save-element-confluence-caves.mts`, `output/save-four-context-dungeons-v3.mts`, `output/save-four-context-dungeons.mts`, `player/SUMMARY.md`, `register-atlas-interior-tiles.mjs`, `register-climate-interior-tiles.mjs`, `reports.json`, `reports/inn-freeform/index.html`, `scripts/content/bake-climate-interior-tiles.py`, `scripts/demo-assistant-interior-build.mts`, `scripts/lib/renderInteriorMapPng.mts`, `seam-audit.json`, `src/editor/tools/interiorRoomSession.ts`, `src/project/defaults/iceGrandPlain64.ts`, `test/buildPalette.test.ts`, `test/conceptFacilityComposition.test.ts`, `test/conceptFacilityScore.test.ts`, `test/conceptFacilityTemplates.test.ts`, `test/innConceptRebuild.test.ts`, `test/innExploration.test.ts`, `test/interiorConceptAssemblies.test.ts`, `test/interiorConceptRoutes.test.ts`, `test/interiorLoadConsistency.test.ts`, `test/interiorLongTable.test.ts`, `test/placeConceptRender.test.ts`, `test/spatialRoomNativeDefault.test.ts`, `test/spatialRoomQualifier.test.ts`, `test/stoneHearth.test.ts`, `test/storeDeferredLineage.test.ts`, `test/storeSaveOrdering.test.ts`, `verify-shots/atlas-interiors/QA.md` |
| `openwiki/editor-observability.md` | 9 | `scripts/qa/issue693-boot-diagnostics.mjs`, `scripts/qa/issue693-diagnostics.mjs`, `verify-shots/editor-ux-audit-20261004/README.md`, `verify-shots/editor-ux-fixes-round2-20261004/storage/README.md`, `verify-shots/editor-ux-improvements-20261004/README.md`, `verify-shots/perf-editor-subs/SUMMARY.md`, `verify-shots/perf-editor-subs/texture-node.json`, `verify-shots/terrain-ai-edit/SUMMARY.md`, `verify-shots/terrain-placement/observations.json` |
| `openwiki/editor-pre-edit-routing.md` | 47 | `@/styles/database/index.css`, `authoringTestGate.ts`, `dbConnectionAdvancedSettings.ts`, `docs/2026-09-03-studio-bar.md`, `docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md`, `docs/superpowers/specs/2026-09-27-shared-tilesets-by-reference-design.md`, `editor/coachMarks.ts`, `event-editor.part-4.css`, `figma-editor/10-map-tree.css`, `legacyDb-root-cache.spec.ts`, `output/paw-380-corrections/editor-observations.json`, `panels/basicLeftRail.ts`, `panels/basicTilePalette.ts`, `panels/databaseUxLevel.ts`, `referencePresetSnapshot.ts`, `reliefBake.ts`, `reports/2026-09-16-editor-zoom-rebuild-perf.md`, `reports/2026-09-18-map-list-navigation.md`, `reports/2026-09-18-map-switch-performance.md`, `shell/editor-responsive-expert.css`, `src/editor/content/largeRiverMarketVillageBuild.ts`, `src/editor/editorUiMode.ts`, `src/editor/tools/worldTools.ts`, `src/project/legacyDbProjectSync.ts`, `src/styles/editor/event-editor.balanced.css`, `src/styles/editor/left-sidebar.modern.css`, `src/styles/editor/map-location-layer.css`, `src/styles/editor/map-props.css`, `src/styles/editor/region-task.css`, `styles/database/modern/monster-ux.css`, `surface.json`, `test/basicLeftRail.test.ts`, `test/e2e/_large-map-perf.spec.ts`, `test/exteriorDoorBackground.test.ts`, `test/modalEscapeLayerGate.test.ts`, `test/regionTaskHouseProtection.test.ts`, `test/worldAiExclusion.test.ts`, `verify-shots/editor-lag-fix/D/probe.mjs`, `verify-shots/editor-lag-fix/E/profile-round2.md`, `verify-shots/loc-adopt/SUMMARY.md`, `verify-shots/map-size-1024-20261001/SUMMARY.md`, `verify-shots/official-map-1024-20261001/SUMMARY.md`, `verify-shots/oprn-020/SUMMARY.md`, `verify-shots/perf-app-save/SUMMARY.md`, `verify-shots/sidebar-map-field/beginner-left-panel-map-field.png`, `villageContract.ts`, `worldTools.ts` |
| `openwiki/editor-preview-performance.md` | 1 | `verify-shots/editor-ux-audit-round2-20261004/agents/assets-idle.md` |
| `openwiki/editor-validation.md` | 9 | `final-layout.json`, `test/aiBlockedEventRelocation.test.ts`, `test/aiToolDiscoveryEscalation.test.ts`, `test/databaseSystemView.test.ts`, `test/interiorLongTable.test.ts`, `test/p0ProjectSchema.test.ts`, `test/projectLint.test.ts`, `verify-shots/balt-parity/RESULTS-without-fix.json`, `viewport-matrix.json` |
| `openwiki/editor-workflows-misc.md` | 45 | `.qa.json`, `basicTilePalette.test.ts`, `basicTilePalette.ts`, `default.json`, `dependency-collector.js`, `docs/village-plan-architecture-easy.md`, `firstWorldArrival.ts`, `game.html`, `loadNewRemoteProject.test.ts`, `release.json`, `runtime.json`, `scripts/build-dungeon-themed-maps.mts`, `scripts/build-grand-ice-cave.mts`, `scripts/build-ice-pass-map.mts`, `scripts/extend-home-8pyeong-with-dungeons.mts`, `skyStairMaps.ts`, `src/editor/authoringTestGate.ts`, `src/project/defaults/dungeonThemedLayouts.ts`, `src/project/defaults/iceDiagonalTerrain.ts`, `src/styles/editor/audio-test-dialog.css`, `src/styles/editor/event-editor-help.css`, `src/styles/editor/help-modal.css`, `src/styles/editor/map-event-search.css`, `src/styles/editor/map-props.css`, `test/audioDescriptionCommandSurfaces.test.ts`, `test/audioDescriptionLifecycle.test.ts`, `test/devRuntimeArchive.test.ts`, `test/dungeonRoomPipeline.test.ts`, `test/dungeonThemedLayouts.test.ts`, `test/editorWelcome.test.ts`, `test/forestDensity.test.ts`, `test/iceDiagonalTerrain.test.ts`, `test/mapSurfaceFocus.test.ts`, `test/runtimePictureStacking.test.ts`, `transactionalNewRemoteProject.test.ts`, `verify-shots/editor-ux-audit-round2-20261004/agents/palette-maps.md`, `verify-shots/props-pane/SUMMARY.md`, `village/decor.ts`, `village/forestDressing.ts`, `villageBuilder.ts`, `villageEvaluate.ts`, `villagePlan.ts`, `villageRequirements.ts`, `villageSession.ts`, `villageTerrainPass.ts` |
| `openwiki/editor-workshop.md` | 18 | `anchors/oprn-beodeul-bases/set.json`, `candidates.json`, `checks.py`, `cli.py`, `docs/images/hero.png`, `docs/superpowers/plans/2026-10-02-workshop-editor.md`, `docs/superpowers/specs/2026-10-02-workshop-editor-design.md`, `objectGenKit.json`, `objectgen/flow.py`, `objectgen/picker.py`, `objectgen/reference.py`, `pack.py`, `prompts.py`, `quality.py`, `scripts/content/extract-objectgen-kit.py`, `scripts/make_bases.py`, `set.json`, `vqa.py` |
| `openwiki/emerald-fields.md` | 35 | `ANALYSIS.md`, `VALIDATION.md`, `VISUAL-SUMMARY.md`, `author-emerald-wide.mts`, `before.json`, `checks.json`, `cliff-contours.json`, `editor-saved-proof.json`, `emerald-basin-atlas.png`, `emerald-wide-v2/reloaded-project.json`, `exit-seam-proof.json`, `fidelity/fidelity-proof.json`, `fidelity/reference-vs-editor.png`, `fidelity/runtime-visual/SUMMARY.md`, `inspection-16-fixed/manifest.json`, `inspection-16/REVIEW.md`, `legacy-db-proof.json`, `map-open-saved.png`, `output/evidence/emerald-fields/fidelity/VALIDATION.md`, `output/evidence/emerald-region/legacy-db-proof.json`, `output/evidence/emerald-wide/reloaded-project.json`, `public/assets/region-references/emerald-basin.png`, `refine-emerald-reference.mts`, `region-saved.png`, `road-graph.json`, `scripts/author-emerald-fields.mts`, `scripts/author-emerald-wide.mts`, `scripts/refine-emerald-reference.mts`, `scripts/refine-emerald-wide.mts`, `scripts/register-emerald-region.mts`, `src/project/regionReferences/emerald-basin.json`, `test/regionReferences.test.ts`, `verify-shots/runtime-qa/emerald-fields/SUMMARY.md`, `verify-shots/runtime-qa/emerald-wide-v2/SUMMARY.md`, `verify-shots/runtime-qa/emerald-wide/SUMMARY.md` |
| `openwiki/emerald-monster-art-v2.md` | 3 | `emerald-art-v2-register-npc.mjs`, `public/assets/emerald-monster/cast/uploaded-cast.json`, `verify-shots/emerald-art-v2-20261004/SUMMARY.md` |
| `openwiki/emerald-monster-production.md` | 3 | `docs/content/emerald-monster-production-contract.md`, `scripts/content/emerald-field-cast.py`, `verify-shots/emerald-monster-2026-10-04/REPORT.md` |
| `openwiki/feature16-battle-ui.md` | 1 | `verify-shots/runtime-qa/feature16-battle-ui/SUMMARY.md` |
| `openwiki/field-enemy.md` | 1 | `chrono-bell.play.json` |
| `openwiki/getting-started.ko.md` | 1 | `.oprn-local.json` |
| `openwiki/gothic-manor.md` | 1 | `dist-electron/browser-bridge.js` |
| `openwiki/growth-trees.md` | 3 | `.omo/evidence/growth-integrated/browser-presets/report.json`, `applied-bundle.json`, `verify-shots/runtime-qa/growth-tree/SUMMARY.md` |
| `openwiki/harnesses/README.md` | 1 | `docs/superpowers/specs/2026-10-05-unified-harness-production.md` |
| `openwiki/harnesses/assistant-capability.md` | 23 | `REPORT.md`, `agent-briefs.json`, `assessment.json`, `asset-receipts.json`, `before/after/original/trace.json`, `boxes.json`, `dist-electron/browser-bridge.js`, `dist/export-player/player.html`, `film-log.json`, `live.json`, `map-portals/after.png`, `matrix-native.json`, `matrix-score.json`, `matrix-validation.json`, `native-result.json`, `output/qa/vn2/seed-novn.json`, `page-errors.json`, `project.json`, `report.html`, `runtime-recheck.json`, `seed-novn.json`, `selfcheck.json`, `visual.json` |
| `openwiki/harnesses/battle-backdrop.md` | 3 | `capture.png`, `facts.json`, `reference.png` |
| `openwiki/harnesses/beodeul-architecture.md` | 1 | `qa-runs/harnesses/beodeul-architecture/structural-families-review.png` |
| `openwiki/harnesses/beodeul-building-review.md` | 19 | `.pixels.json`, `DATA/store-uploads.json`, `output/beodeul-building-review/round7-v3-gate-status.json`, `round4-mill-pass-courtyard-rejection.json`, `round7-browser-proof.json`, `round7-new-candidates.png`, `round7-save-proof.json`, `round7-v2-texture-rejection.json`, `scripts/content/prepare-beodeul-reviewed-references.mts`, `verify-shots/beodeul-building-review/round6-save-proof.json`, `verify-shots/beodeul-building-review/round6-v1-rejection.json`, `verify-shots/beodeul-building-review/round6-v2-rejection.json`, `verify-shots/beodeul-building-review/round6-v3-rejection.json`, `verify-shots/beodeul-building-review/round6-v4-rejection.json`, `verify-shots/beodeul-building-review/round6-v5-structure-rejection.json`, `verify-shots/beodeul-building-review/round6-v6-top-rejection.json`, `verify-shots/beodeul-building-review/round6-visualqa-proof.json`, `verify-shots/beodeul-building-review/round7-v1-texture-rejection.json`, `verify-shots/beodeul-building-review/round7-visualqa-proof.json` |
| `openwiki/harnesses/building-kit-city-plan.md` | 1 | `.../research/castles-and-cities.md` |
| `openwiki/harnesses/building-kit.md` | 33 | `-4x.png`, `-x2.png`, `-x4.png`, `.finish_draw.py`, `.json`, `_finish-demo.png`, `bk-beodeul-noble-style-r8.html`, `bk-fantasy-kingdom-style-r8.html`, `bk-northern-snow-style-r8.html`, `building.png`, `compare-inn.png`, `compare.png`, `dry.json`, `finish_draw.py`, `finished.png`, `finished/sheet.json`, `ivqa/PROMPT.md`, `kit.json`, `legend.json`, `mask.png`, `preview/compare.png`, `preview/finished-4x.png`, `projection-gable-front-1x/4x.png`, `projection-l-combo-1x/4x.png`, `qa-runs/harnesses/building-kit/_finish-demo.png`, `qa-runs/harnesses/building-kit/_user-refs/rejected-T-house-no-depth.png`, `refs/actor1-front-1x.png`, `refs/palette.png`, `regions.json`, `regions.png`, `round_module.py`, `shade.png`, `style_r6.py` |
| `openwiki/harnesses/cast-portrait.md` | 3 | `REVIEW-PROMPT.md`, `blind.json`, `checks.json` |
| `openwiki/harnesses/charset-actor.md` | 9 | `.scenario.mjs`, `actions.px.json`, `chip.png`, `delivery.json`, `model-frames.json`, `novelty-transfers.json`, `people2.png`, `pixel-edits.json`, `visual-inputs.json` |
| `openwiki/harnesses/dungeon-chipset.md` | 3 | `castle-tower-door-door-open.png`, `compose-proof.mts`, `render-proof.py` |
| `openwiki/harnesses/game-concepts.md` | 1 | `docs/superpowers/specs/2026-10-07-concept-feed-design.md` |
| `openwiki/harnesses/interior-prop-derivations-operations.md` | 4 | `.check.json`, `library.json`, `live.json`, `verify-shots/props-image-first/deployment.json` |
| `openwiki/harnesses/interior-prop-derivations.md` | 7 | `.png`, `actions.json`, `live.json`, `lock.json`, `seed.png`, `shared-audit.json`, `verify-shots/harness-props-ux/storage-proof.json` |
| `openwiki/harnesses/interior-props.md` | 5 | `.loop.json`, `.loop.png`, `docs/superpowers/plans/2026-10-02-workshop-editor.md`, `docs/superpowers/specs/2026-10-02-workshop-editor-design.md`, `native-hosts.json` |
| `openwiki/harnesses/interview-scene-bank.md` | 82 | `checkpoint-194-original-source-audit-proof.json`, `checkpoint-194-technical-hold-proof.json`, `checkpoint-198-opaque-native-recovery-proof.json`, `checkpoint-198-original-source-audit-proof.json`, `checkpoint-202-original-source-audit-proof.json`, `checkpoint-206-original-source-audit-proof.json`, `checkpoint-210-original-source-audit-proof.json`, `checkpoint-210-restored-child-recomparison-prior-metadata.json`, `checkpoint-210-restored-child-recomparison.json`, `checkpoint-214-native-diagnostics.json`, `checkpoint-214-original-source-audit-proof.json`, `checkpoint-216-restored-child-recomparison.json`, `checkpoint-218-native-diagnostics.json`, `checkpoint-218-original-source-audit-proof.json`, `checkpoint-218-positive-findings-normalization-history.json`, `checkpoint-220-native-diagnostics.json`, `checkpoint-220-normalization-proof.json`, `checkpoint-220-original-source-audit-proof.json`, `checkpoint-226-original-source-audit-proof.json`, `checkpoint-226-worktree-recovery-proof.json`, `checkpoint-227-restored-child-recomparison.json`, `checkpoint-228-original-source-audit-proof.json`, `checkpoint-236-original-source-audit-proof.json`, `checkpoint-244-original-source-audit-proof.json`, `checkpoint-252-original-source-audit-proof.json`, `checkpoint-260-original-source-audit-proof.json`, `checkpoint-270-original-source-audit-proof.json`, `checkpoint-755-stage182-root-proof.json`, `checkpoint-785-stage190-root-proof.json`, `checkpoint-799-stage194-root-proof.json`, `checkpoint-829-stage198-root-proof.json`, `checkpoint-851-stage202-root-proof.json`, `checkpoint-858-stage206-root-proof.json`, `checkpoint-868-stage210-root-proof.json`, `checkpoint-887-stage214-root-proof.json`, `checkpoint-893-stage218-root-proof.json`, `checkpoint-901-stage220-root-proof.json`, `checkpoint-912-stage226-root-proof.json`, `checkpoint-928-stage228-root-proof.json`, `gallery-799-stage194-browser-proof.json`, `gallery-829-stage198-browser-proof.json`, `gallery-851-stage202-browser-proof.json`, `gallery-858-stage206-browser-proof.json`, `gallery-868-stage210-browser-proof.json`, `gallery-887-stage214-browser-proof.json`, `gallery-893-stage218-browser-proof.json`, `gallery-901-stage220-browser-proof.json`, `gallery-912-stage226-browser-proof.json`, `gallery-928-stage228-browser-proof.json`, `obsolete-public-cleanup-194-proof.json`, `obsolete-public-cleanup-198-proof.json`, `obsolete-public-cleanup-202-proof.json`, `obsolete-public-cleanup-206-proof.json`, `obsolete-public-cleanup-210-proof.json`, `obsolete-public-cleanup-214-proof.json`, `obsolete-public-cleanup-218-proof.json`, `obsolete-public-cleanup-220-proof.json`, `obsolete-public-cleanup-226-proof.json`, `obsolete-public-cleanup-228-proof.json`, `obsolete-public-cleanup-244-proof.json`, `production-191-194-stage-proof.json`, `production-195-198-stage-proof.json`, `production-199-202-stage-proof.json`, `production-203-206-stage-proof.json`, `production-207-210-stage-proof.json`, `production-211-214-stage-proof.json`, `production-215-218-stage-proof.json`, `production-219-220-stage-proof.json`, `production-221-226-stage-proof.json`, `production-227-228-stage-proof.json`, `production-261-270-stage-proof.json`, `published-799-stage194-integrity-proof.json`, `selected-paths-click-proof.json`, `settled-screenshots-click-proof.json`, `verify-shots/interview-scene-bank-v2/checkpoint-182-original-source-audit-proof.json`, `verify-shots/interview-scene-bank-v2/checkpoint-190-original-source-audit-proof.json`, `verify-shots/interview-scene-bank/production-177-182-stage-proof.json`, `verify-shots/interview-scene-bank/production-183-190-stage-proof.json`, `verify-shots/interview-scene-bank/production-229-236-stage-proof.json`, `verify-shots/interview-scene-bank/production-237-244-stage-proof.json`, `verify-shots/interview-scene-bank/production-245-252-stage-proof.json`, `verify-shots/interview-scene-bank/production-253-260-stage-proof.json` |
| `openwiki/harnesses/jp-city.md` | 1 | `kit-x3.png` |
| `openwiki/harnesses/modern-chipset.md` | 3 | `.input.json`, `previous-tileset.json`, `public/assets/modern-exteriors/modern-city-atlas.png` |
| `openwiki/harnesses/monster-collect-species.md` | 4 | `-lineup-before/after.png`, `astra-starters-5.html`, `qa-runs/battle-anim3/anim.js`, `run.json` |
| `openwiki/harnesses/native-space-installation.md` | 9 | `art-supplementary-evidence.json`, `authoring-input.json`, `canonical-proof.json`, `draft-project-proof.json`, `input-manifest.json`, `library.json`, `preparation-proof.json`, `project.oprn.json`, `stair-binding.json` |
| `openwiki/harnesses/object-gate.md` | 2 | `.board.png`, `claude-viz/gate-blocked-1.html` |
| `openwiki/harnesses/pokemon-character-casting.md` | 15 | `changes.png`, `context.png`, `data/waves/full-cast-v1.json`, `harness-data/pokemon-character-casting/seed.json`, `harness-data/pokemon-character-casting/templates/full-cast-v1/README.md`, `harness-data/pokemon-character-casting/templates/theme-cast-v1/cast.json`, `naru.px.json`, `references/sources.json`, `register-pokemon-character-motion.mjs`, `template.png`, `verify-shots/pokemon-character-casting-full-cast/SUMMARY.md`, `verify-shots/pokemon-character-casting-naru/SUMMARY.md`, `verify-shots/pokemon-character-casting-template/SUMMARY.md`, `waves/theme-cast-v1.json`, `world-manifest.json` |
| `openwiki/harnesses/pokemon-character-motion.md` | 16 | `apply-emerald-native-motion.mjs`, `apply-pokemon-reviewed-hero.mjs`, `authoring.json`, `gate.json`, `hero/quality-gate.json`, `motion.json`, `portrait.png`, `register-pokemon-character-motion.mjs`, `review.json`, `scripts/asset-gen/pokemon-characters/references/ATTRIBUTION.md`, `verify-shots/emerald-native-motion-20261004/SUMMARY.md`, `verify-shots/pokemon-hand-pixels-20261004/SUMMARY.md`, `verify-shots/pokemon-hero-reference-revision/SUMMARY.md`, `verify-shots/pokemon-hero-refinement-2/SUMMARY.md`, `verify-shots/pokemon-hero-refinement/SUMMARY.md`, `verify-shots/pokemon-hero-shape-revision/SUMMARY.md` |
| `openwiki/harnesses/romance-scene.md` | 2 | `verify-shots/romance-art/SUMMARY.md`, `verify-shots/romance-scene/SUMMARY.md` |
| `openwiki/harnesses/space-craft.md` | 4 | `events.json`, `judge.json`, `measure.json`, `space.json` |
| `openwiki/harnesses/super-harness-integration.md` | 1 | `docs/superpowers/specs/2026-10-05-unified-harness-production.md` |
| `openwiki/harnesses/super-harness.md` | 40 | `.aN.png`, `B.json`, `DATA/reference-catalog.json`, `art-acceptance.json`, `art-actor-actions-next.json`, `art-actor-actions.json`, `art-actors-status.json`, `art-actors.json`, `art-context-review.json`, `art-feedback.json`, `art-installation.json`, `art-output/acceptance-contract.json`, `art-pending-materials.json`, `art-prepare-result.json`, `art-result.json`, `art-result.previous.json`, `art-supplementary-evidence.json`, `brief.md`, `card.json`, `concept-request.json`, `ctx-cand.png`, `gaps.json`, `ground-context-x1.png`, `material-review.json`, `materials.json`, `monitoring/space-progress/latest.json`, `parking-repair-brief.json`, `planning-reviews/A.json`, `planning.json`, `reference-source.json`, `request.json`, `result-review.json`, `runtime-assets.json`, `supervisor-authorization.json`, `theme-material-progress.json`, `verdict.json`, `verify-shots/keyword-seeds-desktop.png`, `verify-shots/keyword-seeds-mobile.png`, `verify-shots/theme-draft/desktop.png`, `visual-input.json` |
| `openwiki/harnesses/town-props-300.md` | 1 | `verify-shots/props-town-300/production.json` |
| `openwiki/harnesses/wand-runtime-preparation.md` | 2 | `project.oprn.json`, `shelf-binding.json` |
| `openwiki/harnesses/worldmap-icons.md` | 1 | `verify-shots/worldmap-shared-db/publication.json` |
| `openwiki/horror-authoring.md` | 2 | `motion-sheet.png`, `projectLint.test.ts` |
| `openwiki/i18n.md` | 1 | `docs/terminology/product-terminology.md` |
| `openwiki/joseon-baram.md` | 2 | `.oprn.json`, `map-from-sheet.png` |
| `openwiki/jp-city.md` | 8 | `-x2.png`, `.css`, `.empty.json`, `scripts/tmp-jp-gen.mts`, `src/ai/modernTilesetPolicy.ts`, `town-x3.png`, `verify-shots/jp-city/editor-town-full.png`, `verify-shots/jp-city/town-1x.png` |
| `openwiki/licensing.md` | 2 | `PUBLIC_EXPORT.json`, `docs/legal/ugc-terms-draft.md` |
| `openwiki/location-layer-affordance-audit.md` | 2 | `src/styles/editor/map-location-layer.css`, `verify-shots/loc-draw-cta/SUMMARY.md` |
| `openwiki/modern-campus-interior.md` | 1 | `modernCampusInteriorSpec.json` |
| `openwiki/modern-campus.md` | 8 | `campus_layout.py`, `campus_props.py`, `mc_core.py`, `preview/_all-x4.png`, `props_a.py`, `props_b.py`, `props_c.py`, `src/assets/modernCampusLayouts.json` |
| `openwiki/modern-city.md` | 3 | `-plan.json`, `.oprn.json`, `modernTilesetPolicy.ts` |
| `openwiki/monster-campaign-menu.md` | 3 | `docs/content/monster-expedition-contract.md`, `frames.json`, `verify-shots/monster-campaign-menu/SUMMARY.md` |
| `openwiki/monster-expedition.md` | 8 | `patch-monster-expedition-opening.mjs`, `patch-monster-expedition-storyboard.mjs`, `scripts/content/monster-expedition-templates.py`, `scripts/content/patch-monster-expedition-balance.mjs`, `scripts/qa/runtime/monster-expedition-play.probe.mjs`, `verify-shots/monster-assistant-opening-2026-10-03/REPORT.md`, `verify-shots/monster-authoring-dogfood-2026-10-03/REPORT.md`, `verify-shots/monster-expedition/SUMMARY.md` |
| `openwiki/monster-kit-origin.md` | 19 | `_demo.py`, `assessment.json`, `candidate.png`, `demo.png`, `layouts.json`, `lib/pret_ref.py`, `pokemon-baked-town.html`, `pokemon-house-variety.html`, `recipes/interior.py`, `roles.json`, `sheet-3x.png`, `showcase.json`, `test/encounterTerrainCondition.test.ts`, `tiles.json`, `tiles.png`, `tileset.json`, `verify-cave.json`, `verify-map.json`, `verify-route.json` |
| `openwiki/monster-sfx.md` | 1 | `poke-sfx-2.html` |
| `openwiki/native-enemy-retirement.md` | 5 | `scripts/generate-monster-images.mts`, `verify-shots/hydra-rm2003/SUMMARY.md`, `verify-shots/legacy-monsters/retired-images.json`, `verify-shots/monster-redraw-all/SUMMARY.md`, `verify-shots/monster-refresh/SUMMARY.md` |
| `openwiki/night-monster.md` | 6 | `.omo/evidence/night-monster-review/REPORT.md`, `.omo/evidence/night-monster-upgrade/REPORT.md`, `.omo/evidence/night-monster/sprint-escape.json`, `build-night-monster.mts`, `src/project/examples/nightMonster.ts`, `verify-shots/runtime-qa/night-monster/SUMMARY.md` |
| `openwiki/object-spec.md` | 3 | `objectgen/spec.py`, `schema/objectspec.v1.schema.json`, `types/objectspec.ts` |
| `openwiki/opening-animatic-authoring.md` | 7 | `@oh-my-pi/pi-ai/src/registry/oauth/google-antigravity.ts`, `SUMMARY.json`, `activity.json`, `main.cjs`, `project.json`, `record.json`, `timeline.json` |
| `openwiki/opening-still-pack.md` | 4 | `artifacts/stills-library-plan.json`, `queue-status.json`, `review/index.html`, `run-status.json` |
| `openwiki/pixel-art-world-bath-gym.md` | 6 | `externalTilesetCatalog.ts`, `externalTilesetImport.ts`, `pixelArtWorldBathGym.ts`, `pixelArtWorldBathGymCatalog.json`, `prepare-pixel-art-world-bath-gym.mjs`, `publish-pixel-art-world-local-library.mjs` |
| `openwiki/pixel-art-world-civic.md` | 4 | `scripts/content/prepare-pixel-art-world-tabletops.mjs`, `scripts/content/revise-pixel-art-world-civic-completion.mjs`, `scripts/content/save-pixel-art-world-patch.mjs`, `src/assets/pixelArtWorldTabletopComposites.json` |
| `openwiki/pixel-art-world-doors.md` | 5 | `pixelArtWorldDoorCatalog.ts`, `pixelArtWorldDoorImport.ts`, `pixelArtWorldDoorReferences.ts`, `publish-pixel-art-world-local-library.mjs`, `read-pixel-art-world-host.mjs` |
| `openwiki/pixel-art-world-eventprops.md` | 6 | `pixelArtWorldEventPropCatalog.ts`, `pixelArtWorldEventPropImport.ts`, `pixelArtWorldEventPropReferences.ts`, `pixelArtWorldEventProps.ts`, `pixelArtWorldWaterSupportReferences.ts`, `prepare-pixel-art-world-eventprop-library.mjs` |
| `openwiki/pixel-art-world-facility-complements.md` | 7 | `current-portable.json`, `library.json`, `pixelArtWorldFacilityComplementsCatalog.json`, `preparation-proof.json`, `preparation-seal.json`, `prepare-pixel-art-world-facility-complements.mjs`, `publish-pixel-art-world-facility-complements-library.mjs` |
| `openwiki/pixel-art-world-food.md` | 8 | `output/paw-food-install/ui-import-proof.json`, `panels/pixelArtWorldFoodCatalog.ts`, `pixelArtWorldFood.ts`, `pixelArtWorldFoodCatalog.json`, `pixelArtWorldFoodImport.ts`, `prepare-pixel-art-world-food-library.mjs`, `prepare-pixel-art-world-food.mjs`, `publish-pixel-art-world-food-library.mjs` |
| `openwiki/pixel-art-world-home.md` | 7 | `ST-Town-I01.png`, `output/paw-home/report.json`, `revise-pixel-art-world-homes.mjs`, `save-pixel-art-world-patch.mjs`, `scripts/content/prepare-pixel-art-world-dense-interiors.mjs`, `scripts/content/prepare-pixel-art-world-home.mjs`, `src/assets/pixelArtWorldHomeCatalog.json` |
| `openwiki/pixel-art-world-hospitality-complements.md` | 4 | `scripts/content/prepare-pixel-art-world-hospitality-complements.mjs`, `scripts/content/render-pixel-art-world-hospitality-complements.mjs`, `src/assets/pixelArtWorldHospitalityComplementsCatalog.json`, `src/project/externalTilesetCatalog.ts` |
| `openwiki/pixel-art-world-japanese-interiors.md` | 6 | `externalTilesetCatalog.ts`, `externalTilesetImport.ts`, `pixelArtWorldJapaneseInteriors.ts`, `prepare-pixel-art-world-direct-reference.py`, `scripts/content/prepare-pixel-art-world-izakaya-ceiling.mjs`, `scripts/content/prepare-pixel-art-world-modern-interiors.mjs` |
| `openwiki/pixel-art-world-loose-supplements.md` | 10 | `append-pixel-art-world-region-candidates.mjs`, `current-portable.json`, `library.json`, `pixelArtWorldLooseSupplements.ts`, `pixelArtWorldLooseSupplementsCatalog.json`, `preparation-proof.json`, `preparation-seal.json`, `prepare-pixel-art-world-loose-supplements.mjs`, `scripts/content/publish-pixel-art-world-loose-supplements-library.mjs`, `src/assets/pixelArtWorldLooseSupplementsCatalog.json` |
| `openwiki/pixel-art-world-loose.md` | 6 | `scripts/content/prepare-pixel-art-world-loose.mjs`, `scripts/content/render-pixel-art-world-loose.mjs`, `src/assets/pixelArtWorldLooseCatalog.json`, `src/editor/panels/pixelArtWorldLooseCatalog.ts`, `src/editor/pixelArtWorldLooseImport.ts`, `src/project/pixelArtWorldLoose.ts` |
| `openwiki/pixel-art-world-mansion-exteriors.md` | 4 | `externalTilesetImport.ts`, `output/paw-mansion-exterior-install/automatic-project-proof.json`, `pixelArtWorldMansionExteriors.ts`, `publish-pixel-art-world-local-library.mjs` |
| `openwiki/pixel-art-world-mansion-interiors.md` | 4 | `externalTilesetCatalog.ts`, `externalTilesetImport.ts`, `pixelArtWorldMansionInteriors.ts`, `publish-pixel-art-world-local-library.mjs` |
| `openwiki/pixel-art-world-maps-51.md` | 3 | `object-names.json`, `paw-maps.html`, `scripts/content/paw-maps/README.md` |
| `openwiki/pixel-art-world-native-complements.md` | 8 | `install-pixel-art-world-shared-host.mjs`, `prepare-pixel-art-world-native-install.mjs`, `publish-pixel-art-world-local-library.mjs`, `read-pixel-art-world-host.mjs`, `scripts/content/prepare-pixel-art-world-native-complements.mjs`, `scripts/content/render-pixel-art-world-native-complements.mjs`, `src/assets/pixelArtWorldNativeComplementsCatalog.json`, `src/project/externalTilesetCatalog.ts` |
| `openwiki/pixel-art-world-retrotown-exteriors.md` | 6 | `pixelArtWorldRetrotownExteriorsCatalog.json`, `pixelArtWorldRetrotownExteriorsLayout.json`, `prepare-pixel-art-world-native-install.mjs`, `prepare-pixel-art-world-retrotown-exterior-browser.mjs`, `prepare-pixel-art-world-retrotown-exteriors.mjs`, `src/editor/pixelArtWorldRetrotownExteriors.ts` |
| `openwiki/pixel-art-world-school-sewer.md` | 4 | `externalTilesetCatalog.ts`, `prepare-pixel-art-world-school-sewer-library.mjs`, `prepare-pixel-art-world-school-sewer.mjs`, `publish-pixel-art-world-school-sewer-library.mjs` |
| `openwiki/pixel-art-world-school.md` | 7 | `pixel-art-world-school-stair-reference.mjs`, `pixelArtWorldSchoolBuilding.json`, `prepare-pixel-art-world-school-building.mjs`, `save-pixel-art-world-school-host.mjs`, `scripts/content/prepare-pixel-art-world-school.mjs`, `scripts/qa/pixel-art-world-school-building-capture.mjs`, `src/assets/pixelArtWorldSchoolCatalog.json` |
| `openwiki/pixel-art-world-static-expansion.md` | 6 | `read-pixel-art-world-host.mjs`, `scripts/content/prepare-pixel-art-world-static-expansion.mjs`, `scripts/content/render-pixel-art-world-static-expansion.mjs`, `src/assets/pixelArtWorldStaticExpansionCatalog.json`, `src/editor/externalTilesetImport.ts`, `src/project/externalTilesetCatalog.ts` |
| `openwiki/pixel-dot-authoring.md` | 6 | `docs/experiments/ff6-reference-study-20261005/README.md`, `docs/experiments/hand-magic-20261005/README.md`, `docs/experiments/hero-magic-rework-20261005/README.md`, `review-decision.json`, `verify-shots/hero-magic-rework-20261005/SUMMARY.md`, `verify-shots/snes-study-redraw-20261005/SUMMARY.md` |
| `openwiki/pokemon-like-field-kit.md` | 3 | `compose.mjs`, `lib/musicScore.ts`, `package.mjs` |
| `openwiki/project-wiki.md` | 2 | `projectWikiSession.test.ts`, `projectWikiTimeout.test.ts` |
| `openwiki/quest-preset-research.md` | 2 | `verify-shots/quest-library/SUMMARY.md`, `verify-shots/quest-play-proof/SUMMARY.md` |
| `openwiki/quickstart.md` | 1 | `.oprn-local.json` |
| `openwiki/release-and-version.md` | 2 | `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md`, `src/games.ts` |
| `openwiki/relief-terrain.md` | 5 | `verify-shots/relief-slope-fix/SUMMARY.md`, `verify-shots/terrain-ai-edit/SUMMARY.md`, `verify-shots/terrain-assistant-live/SUMMARY.md`, `verify-shots/terrain-body-rims/SUMMARY.md`, `verify-shots/terrain-seams/SUMMARY.md` |
| `openwiki/runtime-action-combat.md` | 4 | `export-player/player.html`, `src/project/defaults/actionCombatDemoProject.ts`, `test/actionDemoProject.test.ts`, `test/e2e/_verify-action-demo.spec.ts` |
| `openwiki/runtime-battle.md` | 68 | `.omo/mx-rt/timeline-audit.ts`, `.omo/pixel-enemy-review/browser/report.json`, `.omo/r2check/a1-v2/MECHANICS.md`, `.omo/r2check/a1-v3/DISPLAY.md`, `.omo/retro-monsters/all/preview-big.png`, `.omo/retro-skills/big-target/preview.png`, `.omo/retro-skills/new-1/preview.png`, `_dragonquest.css`, `_mv.css`, `_octopath/_chrono/_bravely/_dragonquest/_ff/_mother/_goldensun/_mv/_vxace/_hud-templates.css`, `_retro-themes.css`, `ally-creature-back.png`, `assets/generated/charset-battlers/actorN-k.png`, `audio-score.js`, `battle.css`, `deprecated/README.md`, `dist/cli.mjs`, `docs/2026-09-30-battle-adversarial-review.md`, `docs/2026-09-30-battle-fixes.md`, `docs/experiments/hand-magic-20261005/README.md`, `docs/experiments/hero-magic-rework-20261005/README.md`, `docs/experiments/shared-hand-fx-20261005/README.md`, `docs/experiments/snes-study-redraw-20261005/README.md`, `docs/reviews/2026-09-20-battle-review-feedback.md`, `docs/reviews/2026-09-20-battle-review-fixes.md`, `docs/reviews/2026-09-20-pokemon-reference.md`, `docs/superpowers/specs/2026-09-03-battle-effect-hires-design.md`, `hero-03-battle-idle.png`, `metrics.json`, `output/evidence/event-command-completion/battle/VERIFICATION.md`, `pose-events.json`, `qa-runs/battle-moves/anim.js`, `qa-runs/battle-sfx/audio-score.js`, `raw.png`, `reference.png`, `review-decision.json`, `scripts/asset-gen/charset-battler/art3/actorN.py`, `scripts/capture-ice-grand-adventure.mts`, `scripts/legacy-db-resource-root/catalog.mjs`, `skyStairGame.ts`, `src/styles/runtime/battle/18-pokemon-layout-redesign.css`, `starter/hires/hero-0N-battle.png`, `t1500.png`, `test/battleLookFrontSkin.test.ts`, `test/e2e/_battle-menu-fixed.spec.ts`, `test/troopBattlePageTools.test.ts`, `verify-shots/hand-magic-20261005/SUMMARY.md`, `verify-shots/hero-magic-rework-20261005/SUMMARY.md`, `verify-shots/hydra-redesign/SUMMARY.md`, `verify-shots/hydra-rm2003/SUMMARY.md`, `verify-shots/monster-battle-av/SUMMARY.md`, `verify-shots/monster-battle-four/SUMMARY.md`, `verify-shots/monster-redraw-all/SUMMARY.md`, `verify-shots/monster-redraw-studies/README.md`, `verify-shots/monster-refresh/SUMMARY.md`, `verify-shots/monster-refresh/runtime/SUMMARY.md`, `verify-shots/poke-sys-battle/ad1-double-attempt.png`, `verify-shots/retro-assistant/SUMMARY.md`, `verify-shots/retro-btl-b/probe.mts`, `verify-shots/retro-btl-b/reconnect.py`, `verify-shots/retro-choreo-a1/SUMMARY.md`, `verify-shots/retro-choreo-b/SUMMARY.md`, `verify-shots/retro-states/probe.mts`, `verify-shots/retro-states/reconnect.py`, `verify-shots/runtime-qa/retro2003-skills/SUMMARY.md`, `verify-shots/shared-hand-fx-20261005/SUMMARY.md`, `verify-shots/snes-study-redraw-20261005/SUMMARY.md`, `vite-node/vite-node.mjs` |
| `openwiki/runtime-m2-flow-controls.md` | 7 | `.omo/evidence/event-runtime-adversarial/README.md`, `cloud-amount-editor.png`, `docs/reviews/2026-09-05-event-runtime-audit.md`, `scripts/capture/capture-parallax-easing.mjs`, `test/runtimePictureStacking.test.ts`, `verify-shots/runtime-qa/cloud-shadows/SUMMARY.md`, `verify-shots/runtime-qa/coordinate-move/SUMMARY.md` |
| `openwiki/runtime-pre-edit-routing.md` | 11 | `.json`, `.omo/evidence/dialogue-face-url-r13/README.md`, `_trace.json`, `dialogueControlBar.ts`, `docs/reviews/2026-09-05-event-runtime-audit.md`, `editor/core.part-1.css`, `replay.mjs`, `test/playerInputCss.test.ts`, `test/runtimeQaInstrumentationBoundary.test.ts`, `verify-shots/romance-art/SUMMARY.md`, `verify-shots/runtime-qa/emote/SUMMARY.md` |
| `openwiki/runtime-project-schema.md` | 60 | `.json`, `.png`, `20260827000000_ai_log_anon_delete_revoke.sql`, `@/styles/map/delayed-tooltip.css`, `DRAFT_20260706_auth_rls.sql`, `bake_fallen_star_backdrops.mts`, `communitySaveBoot.test.ts`, `devMediaPromotion.test.ts`, `dist-electron/main.cjs`, `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md`, `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md`, `docs/superpowers/specs/2026-10-07-concept-feed-design.md`, `firstWorldArrival.ts`, `interiorLoadConsistency.test.ts`, `largeRiverMarketVillageBuild.ts`, `mediaImportDurability.test.ts`, `newProjectDialog.ts`, `openwiki/large-village-generation.md`, `output/evidence/event-command-completion/legacy-persistence/ledger.json`, `persist-trace.mjs`, `phaser.min.js`, `presets-editor.json`, `project.json`, `render-relief-maps.mts`, `scripts/lib/fixtureDefaultDatabase.mts`, `scripts/lib/legacyDb-database-ops.mjs`, `scripts/publish-first-visit-demo.mts`, `scripts/qa/issue693-media.mjs`, `scripts/sync-fixture-default-database.mts`, `small-village-generation.md`, `src/project/defaults/fixtures/dew-village-demo.json`, `src/project/legacyDbProjectSync.ts`, `startLobby.ts`, `storeLifecycleReentrancy.test.ts`, `storePersistenceLineage.test.ts`, `tamper-doc.mjs`, `test/aiBlockedEventRelocation.test.ts`, `test/audioDescriptionConcurrentPersistence.test.ts`, `test/cropRegrowthContract.test.ts`, `test/fixtureDefaultDatabaseDrift.test.ts`, `test/fixtures/life-full/coverage.json`, `test/interiorConceptRoutes.test.ts`, `test/io.test.ts`, `test/legacyDbCanonicalRoundtrip.live.test.ts`, `test/legacyDbDatabaseOps.node.test.mjs`, `test/legacyDbMapPatchRecovery.test.ts`, `test/legacyDbProjectSync.test.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/mapPlanningReuse.test.ts`, `test/sampleAdventureNeedsNoBackfill.test.ts`, `test/sharedDemoStore.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `transactionalRemoteSourceLineage.test.ts`, `verify-shots/battle-fix-2026-09-30/rules-probe.json`, `verify-shots/editor-lag-fix/F/normalizer-cost.mts`, `verify-shots/editor-lag-fix/F/ref-roundtrip-eq.mts`, `verify-shots/editor-ux-fixes-round2-20261004/storage/README.md`, `verify-shots/loc-transition/SUMMARY.md`, `verify-shots/worldmap-autotile-adversarial/export-checked.json`, `village/builder.ts` |
| `openwiki/runtime-sessions.md` | 18 | `assistant-whole-game/tools/hplay.mjs`, `docs/qa/saesol-three-hour-ai-authoring.md`, `docs/reviews/2026-09-18-menu-design.md`, `docs/reviews/2026-09-18-menu-eras.md`, `docs/reviews/2026-09-22-game-over/README.md`, `docs/reviews/2026-09-22-terminal-flows/README.md`, `output/evidence/cinematics-p1/runtime.md`, `output/evidence/cinematics-stall.md`, `output/evidence/stardew/stardew-legacyDb.json`, `reports/shots/companion/gap4-follow.png`, `scripts/qa/runtime/opening-assistant-native.cjs`, `src/project/defaults/actionCombatDemoProject.ts`, `test/emberQuestGame.test.ts`, `test/p1DayTransitionIntegration.test.ts`, `test/p1WeatherDayTransition.test.ts`, `verify-shots/runtime-qa/feature16-player/SUMMARY.md`, `verify-shots/runtime-qa/menu-design/SUMMARY.md`, `verify-shots/runtime-qa/weather-after/SUMMARY.md` |
| `openwiki/se-catalog.md` | 9 | `.mjs`, `audio-features.json`, `audition.html`, `cross-check.json`, `dist/se-staging/audition.html`, `inventory.json`, `lib/staticFile.ts`, `placed.json`, `test/audioDescriptionCommandSurfaces.test.ts` |
| `openwiki/spatial-ai-tools.md` | 6 | `build-shared-object-index.mjs`, `publish-pixel-art-world-local-library.mjs`, `read-pixel-art-world-host.mjs`, `revise-pixel-art-world-civic.mjs`, `save-pixel-art-world-patch.mjs`, `scripts/content/lib/shared-object-catalog-entry.ts` |
| `openwiki/spatial-authoring-controller.md` | 2 | `output/evidence/tile-to-world/task-11/refresh-identity/Scope.json`, `storeMutationInstrumentation.test.ts` |
| `openwiki/spatial-catalog-ui.md` | 10 | `all-places-scrolled.png`, `bench-compile.mts`, `diff-digests.mjs`, `output/evidence/interior-removal-executed/host-proof.json`, `output/evidence/place-previews/proof.json`, `project/defaults/riverVillageStyle.ts`, `public/assets/reviewed-places/place_river_forest_village.png`, `public/places-mockup.html`, `reviewedPlaces/riverVillage.json`, `riverVillagePlace.ts` |
| `openwiki/spatial-geography-compiler.md` | 4 | `.omo/ulw-execute/tile-to-world/execution-policy.md`, `plazaLayout.ts`, `test/smallVillageDesign.test.ts`, `test/spatialSettlementRegion.test.ts` |
| `openwiki/spatial-geography-ui.md` | 28 | `.oprn.json`, `author-diverse-villages.mjs`, `author-harbor-town.mjs`, `civic-programs.json`, `diverseVillageReferences.ts`, `extra-parts.json`, `forestHarmonyTileset.json`, `lake-persistence.json`, `lake-regions-desktop.png`, `prepare-forest-grass-joins.mjs`, `public/assets/region-references/castle-town.png`, `public/assets/region-references/walled-settlement.png`, `regionReferences/lake-village.json`, `regionReferences/river-forest-village.json`, `reports/2026-09-21-shared-river-forest-region.md`, `scripts/qa/capture-shared-river-forest-region.mjs`, `src/assets/sharedDiverseVillageReferences.json`, `src/project/defaults/forestHarmony.ts`, `src/project/regionReferences/castle-town.json`, `src/project/regionReferences/walled-settlement.json`, `test/regionReferences.test.ts`, `tile-labels.json`, `tiledata/forest-villages/diverse/cliff-source.json`, `tiledata/forest-villages/diverse/fullness-rules.md`, `tiledata/forest-villages/diverse/landmarks.json`, `tiledata/forest-villages/diverse/research-layout.md`, `village-civic-props.mjs`, `village-household-props.mjs` |
| `openwiki/spatial-overview-associations.md` | 2 | `complete-271.json`, `complete-43.json` |
| `openwiki/spatial-place-compiler.md` | 2 | `interior-catalog-editor.mjs`, `scripts/register-house-spatial-catalog.mts` |
| `openwiki/stair-entrance-contract.md` | 1 | `interior-inn-tavern-1f.oprn.json` |
| `openwiki/stardew-core-elements-research.md` | 1 | `scripts/save-stardew-demo.mts` |
| `openwiki/storage-retirement.md` | 1 | `.oprn-local.json` |
| `openwiki/store-agent-contribution.md` | 3 | `.scratch.json`, `deploy/README.md`, `migrations/008_agent_tokens.sql` |
| `openwiki/sunlight-shadows.md` | 4 | `verify-shots/building-shadow-shapes/SUMMARY.md`, `verify-shots/gabled-roof/SUMMARY.md`, `verify-shots/sunlight/SUMMARY.md`, `verify-shots/terrain-shadows/SUMMARY.md` |
| `openwiki/teaching-assistant-tilesets.md` | 24 | `_specs.py`, `check_examples.py`, `docs/superpowers/plans/2026-09-25-mz-layers-assistant.md`, `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md`, `fold_layers.py`, `mz_autotile.py`, `openwiki/refmap-town-outside.md`, `publicTileRecipes.ts`, `scripts/content/mv-pack/build-project.mts`, `scripts/content/rasak/apply-assistant-pack.mts`, `scripts/content/rasak/bake_atlas.py`, `scripts/content/rasak/build_assistant_pack.py`, `scripts/content/rasak/check_examples.py`, `scripts/content/rasak/compose_examples.py`, `scripts/content/rasak/mz_autotile.py`, `src/ai/piAgent/packTownRoute.ts`, `src/assets/dungeonSheetTilesets.json`, `src/assets/forestHarmonyVillageExtension.json`, `src/editor/tools/packTownTools.ts`, `src/project/defaults/dungeonSheetTilesets.ts`, `src/project/defaults/forestHarmonyExtension.ts`, `src/project/rpgmakerMv/townLayout.ts`, `stack_to_layers.py`, `tiledata/rasak-fantasy/bundles.json` |
| `openwiki/team-project-host.md` | 6 | `SUMMARY.json`, `dist-electron/dist-electron/browser-bridge.js`, `dist-electron/main.cjs`, `install-pixel-art-world-shared-host.mjs`, `read-pixel-art-world-host.mjs`, `userData/recent-teams.json` |
| `openwiki/terrain-design-suite.md` | 2 | `verify-shots/terrain-assistant-live/SUMMARY.md`, `verify-shots/terrain-seams/SUMMARY.md` |
| `openwiki/terrain-placement-tools.md` | 1 | `verify-shots/terrain-placement/SUMMARY.md` |
| `openwiki/testing.md` | 97 | `../dialogue.css`, `.mts`, `.omo/evidence/house-protection/p2/README.md`, `.omo/evidence/house-protection/p2/exercise.mts`, `.omo/evidence/life-full-20260906/10/VERIFY.md`, `.omo/evidence/life-full-20260906/5/q1/browser-proof.mjs`, `.omo/evidence/life-full-20260906/phase3-verification/final/VERIFY.md`, `.omo/gates-vitest-report.json`, `5/correction/browser-proof.mjs`, `COMPARISON.md`, `SOURCE-EVIDENCE.md`, `X.quarantine.test.ts`, `X.test.ts`, `acceptance-live-check.mjs`, `actions.json`, `aiChatObservability.test.ts`, `aiChatPanelTransportError.test.ts`, `aiSelectionChipScope.test.ts`, `before/probe.json`, `boot-failure.json`, `browser-play-start.png`, `browser-proof.mjs`, `browser-title.png`, `checks.json`, `completion.json`, `dist/cli.mjs`, `docs/reviews/db-beginner-adversarial-qa-findings.md`, `docs/reviews/db-beginner-heuristics-rubric.md`, `event-editor.command-preview/07-identifiable-previews.css`, `generation.json`, `harness-proof.mjs`, `legacyDb-proof-first-save.json`, `node_modules/vite-node/vite-node.mjs`, `output/evidence/acceptance-gate-followup/README.md`, `output/evidence/acceptance-live/README.md`, `output/evidence/concept-expansion/README.md`, `output/evidence/concept-v2/validation.json`, `output/evidence/functional-acceptance/public-smoke.json`, `output/evidence/horror-mystery-prototype/browser-qa.json`, `output/evidence/map-owned-overlays/phase2/BROWSER.md`, `priority.mjs`, `probe.json`, `project.json`, `public-probe.mjs`, `qa-db-beginner-mode.spec.ts`, `raw-results.json`, `reloaded.json`, `reports/feature16/README.md`, `reports/region-polish/facts.json`, `scripts/author-natural-village-harness.mts`, `scripts/author-natural-village-reference.mts`, `scripts/build-horror-mystery-prototype.mts`, `scripts/capture-horror-browser-evidence.mts`, `scripts/qa/acceptance-live.mjs`, `scripts/qa/maker-interview-ui.mjs`, `src/testing/horrorExperienceQa.ts`, `src/testing/horrorMysteryQaPlan.ts`, `test/actionRpgAuthoringAcceptance.test.ts`, `test/aiEventPlacementSurfaceGate.test.ts`, `test/autosaveStatus.test.ts`, `test/buildPalette.test.ts`, `test/databaseKoreanRtpDefaults.test.ts`, `test/debugSession.test.ts`, `test/dialoguePreviewPresentationCss.test.ts`, `test/dungeonRoomPipeline.test.ts`, `test/dungeonThemedLayouts.test.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/dialogue-nameplate-clears-body.spec.ts`, `test/e2e/stardew-resident-runtime.spec.ts`, `test/horrorBrowserEvidenceFreshness.test.ts`, `test/horrorSemanticScenarios.test.ts`, `test/iceDiagonalTerrain.test.ts`, `test/interiorConceptAssemblies.test.ts`, `test/loadNewRemoteProject.test.ts`, `test/p0DayTransitionSceneFailure.test.ts`, `test/p0RuntimeIntegration.test.ts`, `test/p1DayTransitionIntegration.test.ts`, `test/p1RuntimeUi.test.ts`, `test/p1WeatherDayTransition.test.ts`, `test/regionTaskRun.test.ts`, `test/stardewDemo.test.ts`, `test/storePersistenceProof.test.ts`, `test/tilesetAiClient.test.ts`, `test/toolActionAuthoringParity.test.ts`, `test/villageBuilder.test.ts`, `verify-shots/db-ux/pseudo-baseline/probe.json`, `verify-shots/maker-click-first/README.md`, `verify-shots/map-size-benchmark-20261001/SUMMARY.md`, `verify-shots/map-size-optimized-20261001/SUMMARY.md`, `verify-shots/official-map-512-20261001/SUMMARY.md`, `verify-shots/runtime-qa/action-rpg/SUMMARY.md`, `verify-shots/runtime-qa/coordinate-move/SUMMARY.md`, `verify-shots/runtime-qa/esc-menu/SUMMARY.md`, `verify-shots/runtime-qa/monster-town/SUMMARY.md`, `verify-shots/runtime-qa/romance-vn-ui2/17-title-load-card.png`, `verify-shots/runtime-qa/status-menu-adversarial/SUMMARY.md`, `verify-shots/runtime-tile-window-20261001/SUMMARY.md` |
| `openwiki/tile-geometry.md` | 12 | `checks.json`, `editor-checks.json`, `output/slates-reference/source-row.json`, `public/assets/slates/slates-reference-recipes.json`, `reports/slates-study/index.html`, `scripts/content/save-slates-reference.mjs`, `slates-reference-tile-provenance.json`, `verify-shots/character-auto-scale/SUMMARY.md`, `verify-shots/slates-reference/SUMMARY.md`, `verify-shots/slates32/persistence.json`, `verify-shots/tile-geometry/SUMMARY.md`, `verify-shots/tile-size-support/SUMMARY.md` |
| `openwiki/tile-layer-policy.md` | 19 | `.omo/evidence/castle-tiles/NOTES.md`, `.omo/evidence/chipset-transparency/NOTES.md`, `Castle2_5.png`, `castle-map.md`, `clean_furniture.png`, `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md`, `lpcWoodenFurniture.ts`, `modern-exteriors/modern-city-atlas.png`, `public/assets/forest-harmony/chipset.png`, `public/assets/opengameart-castle-reference-composite.png`, `public/assets/opengameart-castle-tiles.png`, `public/assets/opengameart-lpc-wooden-furniture-16px.png`, `public/assets/opengameart-lpc-wooden-furniture.png`, `scripts/bake-village-archetype-previews.mts`, `scripts/compare-castle-reference.py`, `src/assets/forestHarmonyTileset.json`, `src/project/defaults/castleTileset.ts`, `src/project/defaults/lpcWoodenFurniture.ts`, `src/project/defaults/lpcWoodenFurnitureObjects.ts` |
| `openwiki/tileset-reference-documents.md` | 66 | `author-diverse-villages.mjs`, `author-pixel-art-world-city.mjs`, `author-rpg-places.mjs`, `build-climate-chipsets.py`, `civic-programs.json`, `embed-public-tile-recipes.mjs`, `externalTileGrounding.ts`, `extra-parts.json`, `forestHarmony.ts`, `forestHarmonyTileset.json`, `forestTrunkTiles.ts`, `pixel-art-world-school-rooms.mjs`, `pixelArtWorldCity.json`, `pixelArtWorldLayoutGuidance.json`, `prepare-forest-grass-joins.mjs`, `prepare-pixel-art-world-city.mjs`, `prepare-pixel-art-world-layout-guidance.mjs`, `prepare-pixel-art-world-retail-interiors.mjs`, `prepare-pixel-art-world-school.mjs`, `prepare-pixel-art-world-urban.mjs`, `prepare-public-tile-recipes.mjs`, `prepare-rpg-places-references.mjs`, `prepare-rpg-places-regions.mjs`, `publicTileRecipes.ts`, `publish-pixel-art-world-local-library.mjs`, `regionReferences/fantasy-places.json`, `register-executable-tile-guides.mjs`, `register-forest-public-references.mjs`, `render-public-recipe-references.mjs`, `save-pixel-art-world-city.mjs`, `scripts/content/build-dewbank-references.mjs`, `scripts/content/build-tile-assembly-catalog.mjs`, `scripts/content/pixel-art-world-ceiling-walls.mjs`, `scripts/content/prepare-diverse-village-references.mjs`, `scripts/content/prepare-forest-public-references.mjs`, `scripts/content/prepare-pixel-art-world-dense-interiors.mjs`, `scripts/content/prepare-pixel-art-world-izakaya-ceiling.mjs`, `scripts/content/prepare-pixel-art-world-references.mjs`, `scripts/content/publish-executable-tile-guides.mjs`, `scripts/content/register-castle-references.mjs`, `scripts/content/register-dewbank-references.mjs`, `scripts/content/save-pixel-art-world-host-patch.mjs`, `scripts/content/save-tileset-references.mjs`, `scripts/qa/capture-rpg-places.mjs`, `src/assets/climateVillageTilesets.json`, `src/assets/pixelArtWorldCatalog.json`, `src/assets/sharedCastleReferences.json`, `src/assets/sharedDiverseVillageReferences.json`, `src/editor/externalTilesetImport.ts`, `src/project/defaults/climateVillages.ts`, `src/project/defaults/forestHarmony.ts`, `src/project/forestRecipes.ts`, `tile-labels.json`, `tiledata/castle-tiles-rpgs/ai-references/README.md`, `tiledata/forest-villages/canopy-leaves/README.md`, `tiledata/forest-villages/diverse/cliff-source.json`, `tiledata/forest-villages/diverse/landmarks.json`, `tiledata/forest-villages/diverse/research-layout.md`, `tiledata/rpg-places/sign-labels.json`, `tilesetAiQuestionEditor.ts`, `tilesetCheckerSummary.ts`, `verify-shots/beodeul-building-refinement/README.md`, `verify-shots/beodeul-ground/README.md`, `verify-shots/beodeul-small-village/README.md`, `village-civic-props.mjs`, `village-household-props.mjs` |
| `openwiki/title-opening-effects.md` | 5 | `.effects.json`, `assistant-receipt.json`, `features/SUMMARY.md`, `verify-shots/opening-typography/README.md`, `verify-shots/runtime-qa/title-effects/SUMMARY.md` |
| `openwiki/ui-discovery-pilot.md` | 3 | `direct/RESULTS.json`, `output/evidence/ui-discovery-v2/report.html`, `trace.json` |
| `openwiki/unified-place-authoring.md` | 1 | `.omo/evidence/unified-place-authoring/verification.md` |
| `openwiki/village-design.md` | 21 | `.omo/evidence/house-spatial-catalog/legacy-db-proof.json`, `20260907000000_spatial_authoring_cas.sql`, `ai/villageDesignContext.ts`, `databaseVillageView.test.ts`, `databaseVillageView.ts`, `depth-review.json`, `editor/tools/village/designContract.ts`, `large-village-generation.md`, `output/evidence/house-heights/REVIEW.md`, `output/village-direction/index.html`, `scripts/build-house-study-gallery.mts`, `scripts/publish-compact-village.mts`, `scripts/publish-object-village.mts`, `test/villageBuildStages.test.ts`, `test/villageDesign.test.ts`, `test/villageDesignRebuild.test.ts`, `villageAuthoringData.test.ts`, `villageBuilder.test.ts`, `villageDesign.test.ts`, `villageDesignPanel.ts`, `villagePresetPreview.test.ts` |
| `openwiki/wizarding-world.md` | 2 | `.verdict.json`, `docs/tool-catalog.md` |
| `openwiki/world-generation-rules.md` | 15 | `src/editor/panels/databaseWorldGenView.ts`, `src/editor/panels/worldGenPreview.ts`, `src/project/worldGenPresets.ts`, `test/databaseWorldGenView.test.ts`, `test/worldGenRules.test.ts`, `verify-shots/recovery-database-20260905.md`, `village/builder.ts`, `village/pipeline.ts`, `villageBuilder.test.ts`, `villageEvaluate.ts`, `villagePlan.ts`, `villageRequirements.ts`, `villageSession.ts`, `villageTerrainPass.ts`, `worldGenPreview.ts` |
| `openwiki/world-structure-authoring.md` | 1 | `verify-shots/runtime-qa/world-structure-tools/SUMMARY.md` |
| `openwiki/worldmap-game-research.md` | 2 | `tiledata/worldmap-kit/kit/build_world.py`, `tiledata/worldmap-kit/themes/monster.json` |
| `openwiki/worldmap-navigation-structures.md` | 8 | `all-six.png`, `assistant-tool-handoff.json`, `canonical-reload.json`, `editor-capture.json`, `verify-shots/worldmap-default-choice/SUMMARY.md`, `verify-shots/worldmap-structures-v3/assistant-tool-handoff.json`, `verify-shots/worldmap-structures-v3/canonical-projects.json`, `verify-shots/worldmap-structures-v3/shared-library.json` |
| `openwiki/worldmap-terrain-editing.md` | 13 | `journeys/src/make_culture_journeys.py`, `kit/lib/kit_geo.py`, `kit/lib/kit_realgeo.py`, `kit/lib/kit_terrain.py`, `kit/lib/kit_tilemap.py`, `kit_fit.py`, `kit_terrain.py`, `tiledata/worldmap-kit/docs/README.md`, `tiledata/worldmap-kit/kit/lib/kit_variant.py`, `verify-shots/worldmap-real-geography/README.md`, `verify-shots/worldmap-terrain/qa-assist-r1/REPORT.md`, `verify-shots/worldmap-terrain/qa-assist-r2/REPORT.md`, `verify-shots/worldmap-theme-readiness/README.md` |

## 페이지별 절 좌표

### `openwiki/PROJECT_WIKI.md` — 16KB · 184줄 · ~4,174 토큰

- `L5` Purpose
- `L16` Required pre-edit read order
- `L63` Project identity
- `L72` Main ownership boundaries
- `L107` Authored tile placement references
- `L113` How an AI should use this wiki
- `L124` 프로젝트 정본 저장 (see root `AGENTS.md`)
- `L132` Desktop UI integration truth (2026-08-11)
- `L145` Per-project wiki structure
- `L161` Staleness rule
- `L167` 지형 설치 도구 (2026-10-03)
- `L172` Original monster campaign

### `openwiki/agent-worktrees.md` — 20KB · 273줄 · ~6,245 토큰

- `L8` hard rule — gates / vitest / stash 금지 (2026-09-17)
- `L16` 적용 범위
- `L26` 명령
- `L38` `git stash` 를 쓰지 마라 (실측 2026-09-10, 남의 작업을 꺼내 버렸다)
- `L65` 회수 규칙 (커밋이 유일한 안전망)
  - `L77` 에이전트에게 줄 지시
  - `L124` 동시 생성 (에이전트 수십 개)
  - `L146` e2e 는 `DEV_SERVER_PORT` 없이 돌리면 **남의 코드를 검증한다** (실측 2026-08-29)
- `L168` 검증 게이트
  - `L170` 통합 작업의 검증 대상 고정 (2026-09-06)
  - `L192` 왜 기준선 방식인가
  - `L203` 왜 별도 스크립트인가
- `L212` 감독 절차
- `L223` 알려진 함정

### `openwiki/ai-context-compaction.md` — 17KB · 201줄 · ~5,058 토큰

- `L7` 대화 복원과 실행 체크포인트의 경계 (2026-09-09)
- `L40` 1. 3개 예산·압축 계층의 분리와 실행 순서
  - `L66` 계층별 책임 비교
- `L76` 2. 주요 상수 및 위치
- `L95` 3. 핵심 알고리즘 및 엔진 동작 (`src/ai/contextCompaction.ts`)
  - `L97` 토큰 추정 (`estimateMessageTokens`, `estimateContextTokens`)
  - `L103` 압축 트리거 판정 (`shouldCompact`, `resolveThresholdContextTokens`)
  - `L111` 절단점 탐색 (`findCompactionCutPoint`)
  - `L116` 잔존 꼬리 수리 (`repairRetainedTail`)
  - `L120` 요약 프롬프트 및 요청 구성 (`buildSummarizationRequest`)
- `L129` 4. 세션 통합 및 실패 방어 (`src/ai/assistantSession.ts`)
  - `L131` 호출 위치
  - `L134` 턴당 실패 캡 (`compactionFailedThisTurn`)
  - `L139` 실측 사용량 기록 (`recordPromptUsage`)
  - `L143` 무중단 실패 정책
- `L150` 5. 실측 데이터 (Real-HTTP Proof)
- `L166` 6. 업스트림(Senpi) 대비 설계 및 의도적 차이점
- `L185` 7. 계약 테스트 및 검증 스크립트
- `L191` 최신 검수 이미지의 요청 예산 우선순위 (2026-09-14)

### `openwiki/ai-tools-deprecation-roadmap.md` — 4KB · 63줄 · ~1,350 토큰

- `L5` 현황 (2026-09-04 갱신)
- `L21` 왜 지금 당장 지우지 않는가
- `L28` 제거 단계
  - `L30` 1단계 — 호출 계측 (즉시 가능)
  - `L35` 2단계 — 실행 차단 + 안내 오류 (관측 후)
  - `L40` 3단계 — 이름 삭제 (메이저 정리)
- `L45` 개별 판단 메모

### `openwiki/ai-workflow.md` — 39KB · 277줄 · ~10,510 토큰

- `L7` Before changing files
- `L15` While changing files
  - `L163` Request-bound NPC prerequisite proof (CR-NPC-PREREQ-01, 2026-09-07)
- `L219` After changing files
- `L226` Tool-calling architecture (human review map)
- `L236` Headless Tool and MCP Access
- `L253` Live editor AI assistant MCP (same UI session)
- `L272` Refreshing the wiki

### `openwiki/architecture.md` — 35KB · 163줄 · ~10,237 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/asset-store.md` — 56KB · 358줄 · ~16,627 토큰 · 통째읽기 잘림

- `L6` 어디에 무엇이 있나
- `L25` 계약 동기화 절차
- `L35` 올리기(내보내기) 경로
  - `L40` 제외(Rasak·REFMAP·RPG Maker MV/MZ·PAW) 집행 지점
- `L64` 받기(가져오기) 경로
  - `L73` 캐릭터 칸의 짝 초상 (char-gen 캐릭터 세트, 2026-10-20)
  - `L88` 음악 팩의 곡별 고르기 설명 (2026-10-25)
  - `L98` 조수가 스토어 음악을 찾아 넣는다 (2026-10-25)
- `L162` 게시기
- `L192` 상태 확인
- `L196` 에디터 첫 진입 화면 (2026-10-12)
- `L203` 스토어 창 UX (2026-10-20, 「사용자들이 매우 쉽게」)
- `L228` 에디터에서 열기 링크 (2026-10-20)
- `L245` 주인 초안 (D2, 2026-10-20)
- `L253` 바로 플레이 게임 (2026-10-23)
  - `L350` 조수와 평가 (2026-10-25)

### `openwiki/assistant-v2.md` — 165KB · 443줄 · ~50,425 토큰 · 통째읽기 잘림

- `L16` 다양성 — 같은 요청이 같은 맵이 되지 않게 (2026-10-23)
- `L24` 방은 모델이 설계한다 — 견본을 깔지 않는다 (2026-10-29 맵 같음 감사)
- `L48` 게임 요소 — 퀘스트·아이템·전투·파티·스위치 (2026-10-24)
- `L62` 새 플레이어 길잡이 — 목표 줄·보이는 이야기 이벤트 (2026-10-26, J90~J96)
  - `L81` 2차 (2026-10-27, J98·J101~J106 — romance-j91·toy-j91 판정)
- `L108` 게임 조립 기본값 — 타이틀·오프닝을 청사진에 맞춘다 (2026-10-28 스위트 조립 장부)
- `L146` 모델 호출 무응답 한도·고치기 차례 상한 (2026-10-29 vm1 argon)
- `L161` 이벤트 자리·시작 칸 (2026-10-29 야외 자동 플레이)
- `L166` 번호 자물쇠·빈 맵 탈출 (2026-10-29 vm3 flash escape 판정 «가짜 단서·자동 입력»·«단일 빈 맵»)
- `L180` 조사 자리·조사 표식 (2026-10-29 vm3 terra escape «책상 정면에서는 반응 없음·하이라이트가 흐림»)
- `L259` 길 찾기 2차 (2026-10-29 vm7 판정 «동굴 가는 길·나무 구멍·용사의 검·안락의자 단서»)
- `L283` 던전·동굴은 조수가 설계한다 (2026-10-29 맵 똑같음 조사 «동굴 28장 중 26장이 한 공식»)
- `L307` 씬 벤치 1회차 수리 (2026-10-30 sc-1030a terra · sc-1030s-b1~b4 opus)
- `L328` 끝맺음 단계 더하기 (2026-10-29 단계 목록화)
- `L337` 켜는 법
- `L344` 구조 — v1 실행기를 그대로 쓴다
- `L362` 빌더가 하는 것 / 못 하는 것
- `L421` 시험
- `L429` v1 비교 결과 (2026-10-23, 코드 e06766bd8d)

### `openwiki/atlas-biome-interior.md` — 109KB · 534줄 · ~32,760 토큰 · 통째읽기 잘림

- `L8` 원본과 칸
- `L37` 코드
- `L140` 참고문서 「손 도트 실내 (v5)」
- `L145` 가구 메모·방 표 (2026-09-29)
- `L164` 예제 맵·정본
- `L170` 검증
- `L176` 배·던전 — atlas_biome_dungeon
- `L181` 기물 묶음 배치 — vignette (2026-10-29, 사용자 결정)
- `L218` 남은 것
- `L225` 편집기 「새 맵 → 실내」 기본 (2026-10-01)
- `L233` 고른 후보 반영 (2026-10-01)
- `L251` 새 기물 길 (2026-10-01)
- `L264` 소품 하네스 — 여러 명이 찍고 사용자가 고른다 (2026-10-01)
  - `L279` 서버 하네스의 자동 공용 등록 (2026-10-04)
- `L289` 박물관·배 안·투기장 — interior-plus (2026-10-14)
- `L318` 3/4·품질 재검 — 의자 밖 기물 (2026-10-20, props34)
  - `L338` 2판 — 독립 적대 판정으로 다시 (2026-10-20)
- `L358` 퍼즐 방 조각 — interior-plus `puzzle` (2026-10-20)
- `L375` 천문대 조각 — interior-plus `observatory` (2026-10-21, 사람 허용 대기)
- `L396` 폴른 스타 방 조각 — interior-plus `fallen` (2026-10-21~22, 위임 허용·굽기 완료)
- `L451` 조수 실력 시험 — 폴른 스타 세 방 (2026-10-22)
- `L471` 조수 실력 시험 2 — 1배 확인 루프·독립 비평 (2026-10-22)
- `L502` 손으로 짠 방 견본 (2026-10-29)

### `openwiki/authoring-play-presets.md` — 11KB · 88줄 · ~3,520 토큰

- `L7` 목록
- `L27` 조수 연결
- `L63` 편집기 표면
- `L72` 실제 기능과 한계

### `openwiki/autotiles.md` — 24KB · 218줄 · ~6,924 토큰

- `L5` World 지형과 공통 구조물
- `L25` 1. RM2K식 3×4 템플릿 블록 문법
- `L41` 2. 지형 앵커 카탈로그 — 4행 밴드 × 열 0/3/6/9 격자
- `L62` 3. 물 계열 — 오토타일 그룹이 아닌 별도 시스템
- `L80` 3-1. 던전 칩셋 절벽(빙암) — 벽은 두 행이다
- `L114` 4. 오토타일 등록 경로 3가지
- `L122` Integrated World snapshot (2026-09-06)
- `L136` Terrain placement regression contracts (2026-09-08)
- `L153` 5. 검증
- `L161` Tibo recovery (2026-09-17)
- `L174` 실내 천장 기본 등록과 쿼터 합성 (2026-09-18)
- `L182` Pixel Art World XP 사용자 원본 (2026-09-24)
  - `L208` XP 공용 로컬 설치와 조립 표본

### `openwiki/battle-impact-contact.md` — 6KB · 68줄 · ~1,865 토큰

- `L7` 참고한 개발자의 설명
- `L17` 실측과 원인
- `L27` 구현 소유와 계약
- `L50` 검증·재현

### `openwiki/battle-motion-programs.md` — 14KB · 115줄 · ~4,198 토큰

- `L6` 진입점
- `L17` 저장과 호환
- `L33` 동작 목록
- `L42` 판정 계약
- `L56` 편집
- `L63` 확인 근거
- `L74` 동작의 적대적 검토 (2026-10-02)
  - `L91` 히트스톱 뒤 위치/자세 시계가 벌어지는 결함
- `L103` 결과 선택은 재생 분기다 (2026-10-02 정정)

### `openwiki/battler-idle-playbook.md` — 11KB · 176줄 · ~3,490 토큰

- `L10` 런타임 코드는 건드릴 일이 거의 없다
- `L20` 순서
  - `L22` 1. 표시 상자를 먼저 실측한다 (셀 종횡비가 여기서 나온다)
  - `L34` 2. 클립을 만든다 (프롬프트에 긍정 제약까지 넣는다)
  - `L53` 3. 창을 탐색한다 (눈으로 고르지 마라)
  - `L70` 4. 패킹한다
  - `L85` 5. 카탈로그에 등록한다
  - `L90` 6. 검증한다
- `L101` 네 계약 — 넷 다 상대값이다
  - `L114` 상한은 불량 쪽에서 정한다
  - `L122` 머리 계약은 얼굴 검출기가 아니다
- `L131` 함정 목록
- `L161` 실린 자산의 실측값

### `openwiki/beodeul-city.md` — 231KB · 1135줄 · ~70,177 토큰 · 통째읽기 잘림

- `L3` 출처 정정 (2026-10-22) — RTP 파생 칸은 크레딧, 나무는 다시 그렸다
- `L46` 2026-10-05 건물 반려와 사람의 허용/거절 대기열
  - `L73` 나무 연결 보정과 집 5채 작은 마을 (2026-10-04 후속)
  - `L80` 마을마다 다르게 (2026-10-22)
- `L117` 마을 성벽 bd-wall (2026-10-22, 3판) — 3/4 성벽 길·성문루·망루·계단·쪽문, 눈·사막 변형, 칸 28,544~29,567
- `L183` 왕도 아스텔 조각 bd-capital (2026-10-27) — 칸 33,408~, 마당 꼬리 바로 뒤
- `L199` 던전 주제 2 꼬리 bd-pick-dungeon-theme2 (2026-10-27) — 칸 33,664~, 왕도 꼬리 바로 뒤
- `L205` 동굴 기물 꼬리 bd-pick-dungeon-cave (2026-10-29) — 칸 33,920~, 주제 2 꼬리 바로 뒤
- `L218` 민가·성당 외장: 원본 보존 보정 (2026-10-04 사용자 정정)
- `L244` 원본 유지 일광·길 경계·잔디 보정 (2026-10-04)
- `L251` 기본 타일셋 (2026-09-30)
  - `L272` 빠른 집·도로 도구 (2026-10-03)
  - `L287` 팔레트 실측 (2026-09-30, 헤드리스 chromium, dev 서버, 1600×900)
- `L313` 무엇이 어디에 있나
- `L333` 칸 자르기 규칙
- `L345` 정본 저장·재로드 (2026-09-28)
- `L353` 조수 시험 — 「버들항 비슷한 로마풍 항구 도시를 깔아줘」
  - `L364` 결과 (2026-09-28, 두 번)
- `L384` 라운드 2 (2026-09-29, v7) — 원본이 아닌 도시를 가르치기
  - `L388` 무엇을 더했나
  - `L401` 예시 배치 둘과 배치 자
  - `L412` 참고문서 (v7)
  - `L418` 정본 (v7)
  - `L422` 조수 재시험 (klb/claude-opus-5.5, 「원본 좌표에 찍지 말고 새로 설계, 예시도 베끼지 말 것」)
- `L444` 라운드 3 (2026-09-29, v8) — 블록 키트로 빈 풀밭 없애기
  - `L449` 무엇을 더했나
  - `L465` 배우며 찾은 것
  - `L473` 조수 재시험 (klb/claude-opus-5.5, 라운드 2 과제 + 「블록 키트로」, 블록 25종 번들)
  - `L493` 정본 (v8)
- `L497` 다음 방향 (보류 — 이번에는 다시 그리지 않음)
- `L515` 농장 beodeul_farm 2판·3판 (2026-10-14, 1판 2026-10-13 PR #2489 다시 그림) — 경작지 `farmland`·`farmland_watered` · 작물 · 울타리 · 헛간·닭장
- `L554` 남은 것
- `L565` 조수 마을 경로 (2026-10-01) — 「마을 만들어 줘」가 버들항으로 안 가던 원인과 수리
- `L576` 고른 장소 조각 (2026-10-01) — 변형 20곳에서 사용자가 고른 것을 공용 시트로
  - `L589` 칸·키트
  - `L612` 기존 프로젝트
  - `L618` 참고문서 (조수)
  - `L625` 화면 증거
  - `L629` 남은 것
- `L634` 마을 문법 (2026-10-01 오후) — 「마을 만들어 줘」가 바둑판이 아니라 고른 변형 마을처럼
  - `L658` 마을 형태 넷 + 이어진 밭 울타리 (2026-10-11)
  - `L680` 그림자·자연 물가·놓기 규칙·지형 (2026-10-11 사용자 8가지 지적 + 「지형 먼저」)
  - `L728` 높은 단 오르막·고립 방지·포구 길가·둥근 울타리 (2026-10-11 후속)
  - `L751` 지형 먼저 — 마을 짓기의 기본 순서 (2026-10-29)
  - `L796` 코드 지형 + 조수 배치 + 칩셋 계단 (2026-10-30)
  - `L824` 코드 지형 2판: 끊긴 절벽·낮은 기본 땅·늪 널판·어촌 물가·빈 단 쓰임 (2026-10-30)
  - `L844` 코드 지형 3판: 굽은 띠·넓은 돌계단·집 크기 고르기·과수원·길가 소품·집 보호 다시 짓기 (2026-10-30)
- `L857` 작은 마을 길·마당 구도 보정 (2026-10-04)
- `L862` 우물 공동마당으로 원본 마을 재배치 (2026-10-04)
- `L867` 공동마당 식생·울타리/돌벽 보정 (2026-10-04)
  - `L872` 마을·붓 숲 = 이어진 수관 오토타일 (2026-10-22, 「숲 오토타일을 제대로 적용해야 함」)
  - `L902` woodland 보정 (2026-10-20)
- `L921` 기와 복원 · stone 박공 벽/중앙 창 (2026-10-04 사용자 정정)
- `L926` 물굽이 조밀한 마을 표본 (2026-10-04)
- `L932` 색 역할 정리 · 따뜻한 황록 확정 (2026-10-05)
- `L938` 황록 마을 50×50 · 실제 선택 색 적용 (2026-10-05)
  - `L946` 포석길 끊김 정정 (2026-10-05)
- `L950` RPG 시설과 생활 역할 (2026-10-05)
- `L958` 서로 다른 건축 구조의 강변 마을 (2026-10-05 초안 기록 · 4종 반려)
- `L966` 던전 층: 받침 규칙 + `author_beodeul_dungeon` (2026-10-14, 사용자 스크린샷 · field-enemy fe1)
  - `L987` 던전 시공기 2판 — 적대 시각 QA 뒤 한 번 고침 (2026-10-14 같은 날)
  - `L1010` 던전 시공기 3판 — 종류(`type`) 8가지 (2026-10-14, 사용자: 「던전 종류가 좀 다양해야 할 것 같다」)
  - `L1035` 던전 시공기 4판 — 장르 × 칩셋 어댑터 (2026-10-15, 사용자: 「던전을 장르별로 — 포켓몬풍 / 일반 RPG / 그 밖」)
- `L1112` 마당 바닥 오토타일 (2026-10-23, village-art)
- `L1125` 자연 기물 beodeul_organic (2026-10-24) — 숲·들판의 바위·덤불·통나무·버섯·들꽃·고사리·풀·이끼 돌·고목·사당 돌

### `openwiki/bgm-catalog.md` — 27KB · 368줄 · ~7,175 토큰

- `L8` Why this exists
- `L19` Facts an agent needs
- `L36` Files and ownership
- `L57` Release pack installation (2026-09-07)
- `L94` In-editor installation and live inventory (2026-09-09)
- `L131` Producing and publishing the pinned pack
- `L158` Regenerating
  - `L168` sha256 caveat
- `L176` CDN wiring
- `L206` Desktop app and baked demos (2026-10-27)
- `L214` How authors reach the tracks
- `L246` Project audio descriptions
  - `L278` Shared AI analysis drafts (2026-09-08)
- `L319` Traps
- `L353` 후보가 없는 오프닝의 원곡 (2026-10-04)
- `L360` 맵 OST·키 입력 효과음의 직접 저작 (2026-10-05)

### `openwiki/character-battle-motion.md` — 5KB · 59줄 · ~1,407 토큰

- `L3` 공용 적용과 우선순위
- `L26` 런타임과 편집기
- `L39` 그림의 접촉점
- `L51` 저장과 증거

### `openwiki/charset-actor-harness.md` — 70KB · 501줄 · ~22,135 토큰 · 통째읽기 잘림

- `L3` GIF 공방: AI 자유 저작과 사람 선택 (2026-10-04)
  - `L22` 검토 화면과 제작 관리 (2026-10-05)
  - `L30` 에디터 전체 원본을 섞은 100종 (2026-10-05)
  - `L42` 비슷한 개체의 반복과 서로 다른 원본 배정 (2026-10-06)
  - `L49` 반복 몬스터 폐기와 새 몸 구조 주문 (2026-10-06)
  - `L64` 대량 주문의 검토 대기 병목과 연속 제작 (2026-10-05)
  - `L72` 남긴 픽셀을 기준으로 한 반복 생산 (2026-10-04)
  - `L97` 기본 제작을 원본 격자 변형으로 복귀 (2026-10-04 사용자 피드백)
  - `L105` 좌표 부분 수정 비교 실험 (2026-10-04)
  - `L127` 픽셀 참고 이미지 첨부 실험 (2026-10-04)
  - `L139` 모델이 걷기까지 전부 저작 (2026-10-04 사용자 변경 지시)
  - `L159` 버튼 반응과 저장 (2026-10-04)
  - `L175` 선택 응답과 공용 등록 분리 (2026-10-05)
  - `L190` 한 캐릭터 검토 화면 (2026-10-04)
  - `L198` 적대적 alpha QA와 검사 정책 2 (2026-10-04)
  - `L216` 이전 걷기 전파 v2: 새 면의 픽셀 전달 (2026-10-04)
  - `L235` 남김 → 공용 캐릭터와 설명 (2026-10-04)
- `L248` 진입점과 저장 대상
- `L263` 픽셀 결손 폐기 게이트 v2 (2026-10-03 사용자 지적)
- `L287` 묶음 저작과 에디터용 내보내기
  - `L289` 2026-10-04 신뢰성 감사와 v3
- `L342` 이전 걸음 전파 계약 (2026-10-03)
- `L360` 재개 당시 근거
- `L368` GPT high 원샷 비교 (2026-10-03 사용자 요청)
- `L386` 첨부 그림 3명 원샷 비교 (2026-10-03 사용자 요청)
- `L409` 같은 첨부 그림의 조선시대 변형 (2026-10-03 사용자 요청)
- `L437` 몸통 고정과 걷기 검사 정책 1 (2026-10-04)
- `L452` 동물 기반 필드 몬스터 (2026-10-05)
- `L469` 바람의나라를 떠올리는 고전 RPG 8종 (2026-10-03 사용자 요청)

### `openwiki/chipset-gap-inventory.md` — 22KB · 100줄 · ~6,434 토큰

- `L3` 0. 기준과 주의
- `L16` 표 A — 배송 칩셋 (origin/main)
- `L39` 표 B — 장르 프리셋별 필요 공간과 빈칸
- `L66` 표 C — 구체적 빈칸 (맞은 장르·시험 수 순)
- `L90` 제안 웨이브 (무림·jp_city 상점 실내 제외)

### `openwiki/chipset-roadmap.md` — 7KB · 74줄 · ~2,241 토큰

- `L6` 원칙 (어기지 않는다)
- `L14` Phase 0 — 길 내기 (그림 없음)
- `L25` Phase 1 — 빈칸 목록 (조사 완료 2026-10-08)
- `L52` Phase 2 — 무림 칩셋 (새 계열 `oprn-murim`)
- `L64` Phase 3 — 있는 칩셋의 빈칸
- `L71` Phase 4 — 다음 장르 칩셋

### `openwiki/community-service.md` — 1KB · 13줄 · ~265 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/copyright-purge.md` — 11KB · 101줄 · ~3,368 토큰

- `L9` 남기는 칩셋 (직접 만든 것)
- `L14` 1단계 — 장소 (완료)
- `L27` 2단계 — 자산 (2026-10-07 완료)
- `L48` 3단계 — 지운 칩셋에 묶인 코드·문서 (2026-10-07)
  - `L64` 남은 일
- `L72` 주의
- `L77` 정정 (2026-10-22) — 버들항은 「직접 만든 것」만이 아니었다: RTP 파생은 크레딧, 나무는 다시 그렸다

### `openwiki/delayed-tooltip.md` — 7KB · 87줄 · ~1,980 토큰

- `L11` 동작 계약
- `L30` 문구 규칙
- `L38` 맵 도구바·접이식 왼쪽 레일 (2026-09-18)
- `L47` 1차 롤아웃 대상
- `L66` 설치 지점
- `L72` 테스트

### `openwiki/desert-east.md` — 7KB · 49줄 · ~2,146 토큰

- `L6` 파일 지도
- `L18` 바닥 문법
- `L23` 구성기 규칙 (적대 검수 2026-10-14 뒤 한 번 고친 것)
- `L31` 3/4 관문
- `L35` 조수 경로
- `L39` 현황 (2026-10-14)

### `openwiki/desktop-window-controls.md` — 11KB · 86줄 · ~3,192 토큰

- `L5` 한눈에
- `L21` 코드 지도
- `L38` 계약
- `L61` 화면별 여백·끌기 (여기가 어긋나기 쉽다)
- `L77` 실측 (이 저장소 Linux, xvfb + xfwm4, Electron 44.7.0)

### `openwiki/dungeon-themes.md` — 22KB · 127줄 · ~6,601 토큰

- `L6` 무엇이 바뀌었나
- `L12` 종류 (`DUNGEON_TYPES`, `src/editor/dungeonKit/types.ts`)
- `L36` 새 그림 키트 이름 (`TK(id)` = `bd-pick-dungeon-theme-<id>`)
- `L42` 배치 가족 (`layout`, `layoutRooms.ts`·`layouts.ts`)
- `L47` 게임 참고 (`inspiration`, `DUNGEON_REFERENCES` in `grammar.ts`)
- `L53` 주제 장치 (`gimmick`, `src/editor/tools/dungeonGimmicks.ts`)
- `L69` gap 조각 배선 (#3283 꼬리 29568~30847)
- `L85` 주제 그림 꼬리 (30848~, `bake_theme.py`)
- `L100` 조수 실경로 수리 (dt r2 VQA, 2026-10-23)
- `L110` 주제 적 (`dungeonThemeTroops.ts`)
- `L122` 시험

### `openwiki/editor-ai-panel.md` — 718KB · 4650줄 · ~211,017 토큰 · 통째읽기 잘림 · 깨진 줄 24

- `L3` 조수 v2 스위치 (2026-10-23, 기본 꺼짐)
- `L10` 로컬 에이전트 CLI 엔진 — `local-cli:claude|codex|gemini` (2026-10-20, opt-in)
- `L49` 조수 「턴 사이 기록」 (2026-10-05)
- `L77` AI 존재감 — 지도 이름표 · 상태 줄 · 받은함 (2026-10-07)
- `L120` B안 1단계 — 진행·확인·실패는 대화 속 카드 하나 (2026-10-15)
- `L138` B안 1단계 보정 — 드래그·팀·접힘에서 사라지던 입구 (2026-10-16)
- `L152` 작업 목록 (안 A) — 다섯 줄기를 한 목록으로, 렉 없이 (2026-10-16)
  - `L162` 렉 방지 계약 (깨지 말 것)
  - `L171` 접근성
  - `L174` 측정 harness
- `L179` 지도에 집중하는 AI 작업 창과 로그 추출 (2026-10-05)
- `L210` 첫 요청의 단계적 노출 (2026-10-05)
- `L231` 플레이 프리셋 선택 (2026-10-05)
- `L238` UX 추가 조사 2 — 공간 체크포인트·사람 칸 비교 (2026-10-04)
- `L257` UX 추가 조사 2 — 활동 그림 캡처·그림판·보관 정리 (2026-10-04)
- `L283` UX 추가 조사 2 — 대화 요약 색인·범위 검색 (2026-10-04)
- `L334` 조수 실행 중 읽기·손편집·승인 보존 (2026-10-04)
- `L344` 사용자가 요청한 위치 안내만 화면을 옮긴다 (2026-10-04)
- `L359` 핵심 플레이를 먼저 작성하는 첫 제작 (2026-10-04)
  - `L374` 첫 장소와 도입을 반드시 구성한다 (2026-10-04)
- `L432` 실제 첫 제작의 워커 준비와 사본 (2026-10-03)
- `L456` 도구 사용량 (2026-09-25)
- `L463` 새 프로젝트 게임 기획 전달 (2026-09-22)
- `L485` 제작 전 그래픽 선택과 자동 큰 창 (2026-09-21) — 2026-10-03 제거
- `L516` 이미지 중심 작업 피드 (2026-09-21)
- `L547` 조수와 팀 크게 보기 (2026-09-21)
- `L577` 작업 표시 네 단계와 별도 실행 기록 (2026-09-21)
- `L611` 첫 페인트 스타일 소유권 (2026-09-19)
- `L625` 채팅 입력창 작업 설정 묶음 (2026-09-18)
- `L641` 검토 대기 액션은 작업 과정 밖에 둔다 (2026-09-18)
- `L661` 팀 초기 생성의 맵 사이 연결 계약 (2026-09-28)
- `L681` 팀 분업 유즈케이스와 맵 밖 작업 배정 (2026-09-18)
- `L717` 팀 내 A2A 메시징 (2026-09-18)
- `L748` 오른쪽 AI 도크 + 왼쪽 활동 막대 (2026-09-26, 아래 2026-09-18 절을 대체)
- `L776` 조수 중심 팀 활동 화면 (2026-10-04)
  - `L805` 팀 실행 명령 간소화 (2026-10-05)
- `L842` 왼쪽 AI 대화 + 오른쪽 팀원 아바타 (2026-09-18, 과거 배치)
- `L883` 빈 대화의 읽기 전용 프로젝트 제안 (2026-09-18)
- `L893` 사이드바 AI 추천이 거의 작동하지 않던 세 원인 (2026-09-20)
- `L927` 진단 카드를 캔버스 오른쪽 아래 느낌표 버튼으로 옮긴다 (2026-09-21)
- `L962` 팀 설정 목록과 편집 화면 (2026-09-18)
- `L971` 팀 초안 격리와 최종 보정 (2026-09-18)
- `L979` 밑그림이 Pi 경로로 돌아왔다 — 워커가 툴마다 `map_delta` 를 흘린다 (2026-09-17)
- `L1012` 턴 슬롯은 의도 분류 전에 잡는다 + Pi 턴 감사 누적 (2026-09-16)
- `L1036` 결과 보고서 모달 — 변경 지점마다 before/after 한 쌍 (2026-09-15, P2)
- `L1057` 조수 데크 「대화|작업」 탭 + 스튜디오 상세 — 팀원이 어디서 일하는지 한 곳 (2026-09-14, A안)
- `L1091` 조수 채팅은 Pi 하나다 — 세션 경로를 걷어냈다 (2026-09-11)
- `L1209` 단독 작업은 결과 중심으로 표시한다 (2026-09-14)
- `L1229` 바로 깔기 (2026-09-25)
  - `L1272` 물건은 이름으로 칩셋에서 찾는다 — 없으면 깔지 않는다 (2026-10-15 적대적 감사)
  - `L1305` 연속 주문 대기열 (2026-09-28)
- `L1344` 단순 생성·수정은 계획 필요 여부로 실행한다 (2026-09-18 갱신)
- `L1372` Five model roles and whole-map harmony review (2026-09-14)
  - `L1434` 수리는 한 바퀴 + 전후 대결로 되돌림 (2026-10-11)
  - `L1450` 검수 응답 재시도와 정직한 보고 (2026-09-16)
- `L1500` Retained map planning items and explicit reuse (2026-09-10, OPRN-019)
- `L1541` Run outcome line: four independent axes (2026-09-09)
- `L1592` P3 run retirement and stale drafts (2026-09-07)
- `L1672` Map-scoped conversation archive (2026-09-08)
  - `L1732` Editor history surface
- `L1774` Independent result review and repair (2026-09-06)
- `L1877` Combined P2 and independent-review ownership (2026-09-07)
- `L1911` P2 run outcomes and user scope actions (2026-09-06)
  - `L1967` Canonical requirements and genuine user actions
- `L2039` User-confirmed interaction approach correction (CR-P7-1, 2026-09-08)
- `L2076` Live large-world QA: plan repair and final audit (2026-09-07)
- `L2165` Assistant control audit fixes (2026-09-07)
- `L2176` World structure activity labels (2026-09-06)
- `L2185` Multi-map construction specifications (2026-09-06)
- `L2252` Plan authoring has no small-plan quota (2026-09-06)
- `L2271` Acceptance sticky note (2026-09-07)
  - `L2321` Session-owned acceptance contract
- `L2659` 자동 프로젝트 위키 (2026-09-07)
- `L2691` Independent image generation settings (2026-09-07)
- `L2692` Independent image generation settings (2026-09-08)
- `L2730` 브라우저 포커스와 도구 실행 대기 (2026-09-05)
- `L2737` Map-targeted work outcomes (2026-09-06)
- `L2752` 계획 항목의 연속 실행 증거 (2026-09-05)
- `L2758` 계획 규모와 선언 자세 (2026-09-09)
- `L2768` 조회 선행·계획 완료와 실행 종료 (2026-09-05)
- `L2777` 조수 카메라 이동 수명·부드러운 줌 (2026-09-05)
- `L2787` 조수의 맵 전환은 크로스페이드다 — 하드컷 금지 (2026-09-15)
- `L2873` 패널 셸 · 도크 · 접기 · 컴포저
- `L3021` 세션 수명 · 대화 컨텍스트
- `L3038` 제안 적용 · 복구 · 완성도 린트
- `L3126` 고스트 미리보기 · 활동 표시 · 청사진 · 카메라
- `L3187` 영역 작업 · 시공 · 실내/집 파이프라인
- `L3211` 툴 노출 · 프롬프트 · 의도 판정 · NPC
- `L3225` 타일셋 이해 · 검토 위저드 (T1a/T1b)
- `L3251` 저장 · 내보내기 · 프로젝트 생성
- `L3259` 제공자 · OAuth · 동반 서비스
  - `L3261` 첫 연결과 실제 작업 계정 (2026-10-01)
- `L3327` Autonomous run mode (autonomous-ai-rpg, todos 1-6)
- `L3370` 분리 브랜치 마일스톤 회계 복구 (2026-09-05)
- `L3403` 배치 의존성과 완료 멱등성 (2026-09-06)
- `L3411` 모험 완료와 실제 적용 횟수 (2026-09-05)
- `L3416` Assistant clean conversation — Phase 1 (2026-09-06)
- `L3453` Assistant deck width resize (2026-09-07)
  - `L3465` Legacy AI contract verification (2026-09-08)
- `L3487` 의도 선언과 커버리지 감사는 각자 예산을 쓴다 (2026-09-16)
- `L3504` 동반 서비스 자격: OMP 로그인 재사용과 명시적 해제 (2026-09-19)
- `L3523` 에이전트 레인 — 묶음별 병렬 실행과 레인별 적용 (2026-09-15)
- `L3552` 스튜디오 3분할 — 가운데는 맵, 왼쪽은 실시간 조수·채팅, 오른쪽은 지금 보는 채팅 (2026-09-16)
- `L3568` 하단 덱 → 오버레이 드로워 (2026-09-16)
- `L3582` 수용 기준: DB 레코드 값과 지연 적용의 런 수명 (2026-09-16)
- `L3600` 조수 턴 예산 확대 (2026-09-18)
- `L3608` 결과 본문과 접힌 작업 과정 (2026-09-18)
- `L3618` 팀원 작업 예산 버튼 (2026-09-18)
- `L3630` 왼쪽 팀 운영 메뉴 (2026-09-18)
- `L3652` 다섯 적용 모드와 실제 맵 증분 반영 (2026-09-18)
- `L3691` Feature16 — 프롬프트 라이브러리·대사 검토·실제 요청 검사기 (2026-09-21)
  - `L3693` 퀘스트 프리셋 (2026-10-01)
- `L3765` Pi 단일 마을 요청 계약 (2026-09-21)
- `L3821` Pi 시공 연출과 공간 밑그림 복구 (2026-09-21)
- `L3852` 실시간 맵 연출 헤드리스 (2026-09-22)
- `L3862` 맵 하나에 조수 한 명 (2026-10-04)
  - `L3901` 확인 카드가 열린 채 새 메시지가 오면 (2026-10-29)
- `L3929` 실시간 작업 상태판 (2026-10-04)
- `L3958` 조수 적용은 바뀐 칸만 다시 그린다 (2026-09-22)
- `L4040` 큰 프로젝트의 Pi 요청 전송 (2026-09-24)
- `L4048` 대형 프로젝트의 AI 적용 기준선 메모리 (2026-09-24)
- `L4059` 체크포인트 적용 권위는 노드 요약으로 비교한다 (2026-09-25)
- `L4081` 우클릭 드래그 바 → 채팅 한 경로 («영역 작업» 창 폐기, 2026-09-25)
- `L4099` 우클릭 영역 드래그 미리보기와 최종 선택 (2026-10-04)
- `L4117` 턴 단계 계측과 실행 추론 강도 (2026-09-26)
  - `L4122` 기록은 어디서 만들고 어디에 쓰이나
  - `L4139` 다이얼이 실행 루프의 사고 강도를 정한다
  - `L4147` 실측 (2026-09-26, 동반 서비스 127.0.0.1:17832 직결 · 실제 OAuth · gemini-3.8-flash)
- `L4160` AI 패널 렌더 비용 (2026-09-28)
  - `L4182` 검증 권한 정정과 브라우저 재실측 (2026-09-28)
- `L4192` 실제 Pi 오프닝 제작 경로 복구 (2026-10-03)
- `L4234` 일반 포켓몬형 요청의 전체 제작 계약 (2026-10-04)
  - `L4253` 일반 문장 실제 Pi 평가 러너 (2026-10-04)
  - `L4289` 기록된 실제 모델 결과의 프런트엔드 적용 재생 (2026-10-04)
- `L4315` 전송 직후 캔버스 피드백과 체크포인트 따라가기 (2026-10-03)
- `L4323` 마을 요청 바로 시공 · 실제 시공 순서 재생 · 조수창 제때 반영 (2026-10-03)
  - `L4336` 실제 시공 순서 재생 (`tools/constructionLog.ts` 기록 + `agentConstructionReveal.ts` 계획 + `agentConstructionRevealRenderer.ts` 그리기)
  - `L4368` 맵별 실행 대기열과 3-way 병합 (`editor/aiMapRunQueue.ts` + `panels/aiMapRunCard.ts` + `project/projectMerge.ts`)
  - `L4393` 조수창
  - `L4402` 재현·증거
- `L4415` 완료 음원 결과와 연결 재개 (2026-10-05)
- `L4421` 응답 오류와 이미 반영된 변경의 분리 (2026-10-05)
- `L4426` 조수 통째 교체 직후 쓰기가 「작업 중 프로젝트가 바뀌었습니다」로 거절되던 원인 (2026-10-14)
- `L4445` 사용자 지정(OpenAI 호환) 연결 (2026-10-14)
  - `L4449` 구성
  - `L4461` 비밀 처리
  - `L4467` 주소 안전
  - `L4474` 모델 허용/차단 패턴 (비싼 모델 실수 호출 방지)
  - `L4487` 추론 강도 세 방식 (엔드포인트별 `reasoningMode`)
  - `L4497` 연결 시험과 오류
  - `L4501` 초기 설정 메모
  - `L4508` 검증 (2026-10-14)
  - `L4518` Windows 앱에서 「mdc-server:8318 이 안 된다」 (2026-10-25)
- `L4525` 조수·팀 모드 렉 (2026-10-15)
  - `L4529` 측정법
  - `L4537` 기준선(같은 머신·같은 대본, 전→후)
  - `L4549` 고친 병목 (한 커밋씩)
  - `L4555` 못 고친 것 · 불확실한 것
- `L4562` 이미지 용도 분리 — 배경·대형은 이미지 모델, 도트는 텍스트 모델 (2026-10-16, 미결 5건 결정 2026-10-16)
  - `L4583` 용도 분류표 (근거 = 파일:줄, 2026-10-16 origin/main 15f8ce5 기준)
  - `L4608` 결정 (2026-10-16)
- `L4637` 왼쪽 사이드바(그리기·지형·활동 막대) 탭 전환 계약 (2026-10-17)
- `L4645` UX 2차 — 도크 배치·서버 AI 꺼짐 문구 (2026-10-21, F24)

### `openwiki/editor-ai-tools.md` — 598KB · 3972줄 · ~175,580 토큰 · 통째읽기 잘림 · 깨진 줄 5

- `L3` 설정집 쓰기 `upsert_world_codex` · 인물 한 줄 소개 · 데모 「이야기」 탭 (2026-10-29)
- `L13` 평면도대로 버들항 맵 칠하기 `paint_beodeul_plan` (2026-10-29)
- `L38` 파티원 유대 `configure_party_bonds` · 「관계」에 유대 (2026-10-25)
- `L52` 「드러났다」를 지도에 보이기 `stage_map_reveal` · 장면 대형 `sceneFormation` · 보스 HP 숨김 (2026-10-25)
- `L79` 이야기 흐름 읽기 `get_story_outline` · `read_story_script` · `set_scene_summaries` (2026-10-25)
- `L92` 공식 윤문 스킬 `dialogue-polish` · 윤문 린터 `lint_dialogue` — general-good-writing(코드 연규) (2026-10-29)
- `L109` 대사 관리·윤문 `list_dialogue` · `get_dialogue_context` · `rewrite_dialogue` · `set_speaker_voice` (2026-10-24)
- `L134` 계단 입구 계약 — 조립기·stamp_object·create_transfer_pair (2026-10-22)
- `L138` 없는 기물 그리기 `generate_missing_object` (2026-10-21)
- `L165` 조수 스킬 읽기 `read_assistant_skill` · 장면 다듬기 `game-scene-polish` (2026-10-21)
- `L177` 장르 칩셋 잠금 `system.genreLock` — 조수·도구 경로 강제 (2026-10-15)
  - `L201` 캐릭터 칩(걷기 그림)도 같은 잠금 + 장르 표지 `system.genre` (2026-10-16)
  - `L217` 얼굴·전투 그림(faceset·battler·트레이너·배경)도 같은 잠금 (2026-10-16)
- `L236` 몬스터 자산 역방향 잠금 — 몬스터 프로젝트가 아니면 포켓몬식 도구·자산이 보이지도 쓰이지도 않는다 (2026-10-17)
- `L252` find_tools 별칭 사전·인자 교정·조우표 거절 (2026-10-15 FF6 감사 #34)
- `L264` 빈 잔디 맵 방지 — create_map themeScene · check_map_emptiness (2026-10-15 FF6 감사 #35)
- `L275` stamp_object 높이 단 규칙 · 트인 땅 배치 기준 (2026-10-11)
- `L345` 방 루프 2차 — 천장 매달기·고친 곳만·속도 (2026-10-23)
- `L364` 출입구 도달·문앞 좌표 계약 (2026-10-07)
- `L374` 조수 한 번 호출의 크기 줄이기 · 통째로 다시 쓰기 (2026-10-07)
- `L392` EasyRPG 계열 칩셋 차단 — 대체품이 생기기 전까지 (2026-10-06)
- `L413` 월드맵 자동 붓 자연어 경로 (2026-10-05)
- `L425` 캐릭터 칩 선택의 실제 이미지와 적용 관문 (2026-10-05)
  - `L433` 칩 이름·태그 전수 조사 (2026-10-05)
- `L452` 공용 플레이 프리셋 조회 (2026-10-05)
- `L460` 대화 초상 선택과 게임 글꼴 (2026-10-04)
- `L497` 버들항 공용 접지·잔디 꾸밈 (2026-10-04)
  - `L509` 집 3~5채 작은 잔디 마을
- `L520` 버들항 원본 유지 일광 보정 (2026-10-04)
- `L525` 버들항 기존 집 외장 보정 (2026-10-04)
- `L539` 버들항 공용 문 열림 적용 (2026-10-04)
- `L555` FF6 마석 성장 도구 — upsert_equipment_slot · apGrants · levelUpBonus (2026-10-15)
- `L561` FF6 전투 특수 효과 — 스케치 · 폭주 · 대열 섞기 · 강제 교대 · 좀비 · 트랜스 (2026-10-15)
- `L569` 조수 스킬 저작 — 기믹·연출 빌리기 (2026-09-30)
- `L580` 실내 설계는 검토된 실내 프리셋을 함께 본다 (2026-09-28)
- `L598` 마을 시공도 완성 마을 사례를 본다 (2026-09-28)
- `L630` 배치 매칭은 대체하지 않고 거절한다 (2026-09-27 전수 조사)
- `L642` 탈것 배치 도구 — place_vehicle (2026-09-26)
- `L659` 보수·단계 요청 전용 도구 — repair_fence, improve_title_screen (2026-09-26)
- `L674` 절벽 높이 도구 — read_relief · sculpt_relief · check_relief (2026-09-26)
- `L690` 지형 설계·고지 집·실제 통행 조수 연결 (2026-10-04)
- `L724` 조수 쓰기 도구의 네 층 — 1~4층·그림자 (MZ식 4층, 2026-09-25)
  - `L766` 실행기 계약 — 업로드 타일셋 칩셋 바꿔치기 거부 (2026-09-25)
  - `L786` 실행기 계약 — 칩셋 계열 검사 `tileset-family-change` 와 `ask_tileset_change` (2026-09-25)
  - `L808` 남은 일 (네 층)
- `L818` 일본 도시(jp_city) 조수 연결 (2026-10-04)
- `L826` 조수가 보는 네 층 — 읽기 도구·도구 이미지 (MZ식 4층, 2026-09-25)
- `L849` 그림 연출 — script_cutscene_staged · generate_cutscene_art · 대화창 위치 (2026-10-02)
- `L859` 충격 연출 (2026-09-22)
- `L865` 단독 조수의 병렬 도구 실행 (2026-09-21)
  - `L888` 검색 중 사용자에게 보이는 것 (2026-09-21 실측)
- `L889` AI 새 야외·마을의 기본 칩셋 (2026-09-21, 2026-10-01 갱신)
- `L930` 숲 나무 물체 산포 — 수관이 빠지던 문제 (2026-09-27)
- `L947` 나무 밑 그림자 (2026-09-27)
- `L970` 마을 군락 — 굽이숲 절벽마을 조립 (2026-09-21)
- `L1012` 참조 작품 비유 → 자율 웹 검색 (2026-09-21)
  - `L1025` 죽은 Codex 자격이 검색·완성을 영구히 막던 문제
  - `L1033` 검증
- `L1041` 조수 웹 검색 도구 (2026-09-21)
- `L1065` 감사 후속: 부분 갱신과 미사용 삭제 (2026-09-20)
- `L1073` 전투 저작 입력 수정 (2026-09-20)
- `L1075` 이벤트 명령 AI 공용 도구 (2026-09-20)
- `L1125` 전투 저작 입력 수정 (2026-09-20)
- `L1136` NPC 공용 얼굴 매핑 연결 (2026-09-18)
  - `L1147` 캐릭터 참조 전수 교정 (2026-10-05)
  - `L1167` 얼굴 짝 전수 교정 (2026-09-28)
- `L1193` 이식 타일 최초 검수 준비 대기 (2026-09-18)
- `L1205` paint_tiles 타일 인덱스 검증 — 유일하게 빠져 있던 가드 (2026-09-16)
- `L1224` 오프닝 미디어 배선 — 스틸 카탈로그·배경음악·부분 편집 (2026-09-14)
- `L1261` 오프닝 시네마틱 AI 저작 — system.opening (2026-09-14)
- `L1298` 도면 문법에 wing(세로 복도) 추가 — 실루엣 변주와 물건 대체군 (2026-09-11)
  - `L1323` 후속: 석조 화로는 복도 끝 알코브에 (2026-09-11)
  - `L1340` 팔레트 확장 — 안 쓰던 칩셋 그림 16종을 물건으로 (2026-09-11)
- `L1360` 실내는 찍어내지 않는다 — place_concept 은 설계를 요구하고, author_house 는 interiorPlan 을 받는다 (2026-09-11)
- `L1392` 초안은 씨앗이고 저작본만 도면 정본이다 — 절차 도면 되살리기 + 실내 다양성 리포트 (2026-09-12)
- `L1419` 맵 생성 테두리 옵션은 모델에게 주지 않는다 (2026-09-11)
- `L1439` 맵 전체 청소 `clear_map` — 파괴적 한 콜 + 사용자 허가 모달 (2026-09-11)
- `L1504` 명명 로케이션 툴 7종 (OPRN-OUT-020 + LOC-ADOPT, 2026-09-10)
- `L1543` Exact project values and sourced declarations (2026-09-08)
- `L1571` Measured zero-prop rejection diagnostics (2026-09-07)
- `L1668` Logical walkthrough versus real player traversal (2026-09-07)
- `L1676` Tile-query selector and filter boundaries (2026-09-07)
- `L1685` Action enemy profile edits (2026-09-07)
- `L1703` Explicit field-spawn mutations (2026-09-07)
- `L1729` Monster resource discovery and AI appearance evidence (2026-09-07)
- `L1806` House-site tree clearance before ownership (2026-09-07)
- `L1817` Flower-yard material in house lots (2026-09-07)
- `L1830` Pre-write original grounding (2026-09-06)
- `L1905` Hybrid native tool exposure (2026-09-19)
- `L1944` Review approval lifetime (R3, 2026-09-06)
- `L1962` Audio description tools and event candidates
  - `L1982` Search pages and full detail
  - `L1996` Event prompt projection is not ID authority
- `L2030` list_resources picture 검색 (2026-09-21)
- `L2042` P3 captured proposal base (2026-09-07)
- `L2114` Project wiki application ownership (2026-09-07)
- `L2127` Character appearance image candidates v1 (2026-09-06)
- `L2185` Completed-house transaction protection - Phase 1 (2026-09-05)
- `L2261` Completed-house construction protection - Phase 2 (2026-09-06)
- `L2300` 퀘스트 입력과 완주 증거 계약 (2026-09-05)
- `L2327` DB 조회 페이지와 마을 전체 범위 (2026-09-05)
- `L2470` P2 requirement and exact-verdict inputs (2026-09-06)
- `L2545` Project-wide quality evaluation
- `L2559` prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)
- `L2595` Action controls guide (2026-09-07)
- `L2638` NPC 대사는 코드가 지어내지 않는다 — 캐스트 라이터 계약 (2026-09-03)
- `L2669` 「이 세계」 캐논은 문장 3채널에 강제된다 (2026-09-04)
- `L2684` 마을 설계서 (2026-09-05)
- `L2688` 저수준 이벤트 입력은 명령 위치를 검증한다 (2026-09-05)
- `L2729` 보물상자는 노출된 수면을 거부한다 (2026-09-05)
- `L2736` 모험 저작 완료와 재시도 (2026-09-05)
- `L2766` 실제 이미지 입력 보존 (2026-09-07)
- `L2780` Physical tile passage exposure (2026-09-08)
- `L2804` NPC 자율 이동 아키타입 추론 (2026-09-17)
- `L2834` Full RPG first-turn foundation (2026-09-19)
- `L2852` Party, actor appearance, and event-linked inventory tools (2026-09-19)
- `L2872` Opening, game-over, and audio discovery tools (2026-09-19)
- `L2910` 범용 이미지 에셋 생성 (2026-09-19)
- `L2926` Feature16 combat and climate authoring tools (2026-09-21)
- `L2936` 마을 시공 후 완료 계약 (2026-09-21)
- `L2958` 타일 참고문서 선행 조회 (2026-09-21)
  - `L2965` 저장된 AI 계획 본문 조회 (2026-09-23)
  - `L2969` 호스트 공용 DB 참고문서 갱신 (2026-09-23)
- `L2991` 실제 타일 규칙 수정 도구 노출 (2026-09-23)
  - `L2996` 타일셋별 맵 의미 조회 (2026-09-23)
- `L3000` Pi 완성 맵 이미지 반환 경로 (2026-09-23)
- `L3034` 공용 LPC 자료 정리와 지역·오브젝트 조회 (2026-09-23)
  - `L3057` 공용 저작 장면 → 명시적인 복사 요청 (2026-09-25)
  - `L3081` 실내 직접 배치와 읽기 전용 검사 (2026-09-25)
  - `L3100` 현대 맵의 PAW 전용 소재 선택 (2026-09-25)
  - `L3129` 실내 요구조건과 같은 실행 안의 재검사 (2026-09-25 후속)
- `L3160` Isaiah 물 태그 판정 보완 (2026-09-24)
- `L3164` 전투 결과 분기의 퀘스트 완료 플래그 (2026-09-24)
- `L3174` Monster follower graphic authoring (2026-09-25)
- `L3190` 기존 서사 플래그의 설명 수정 (2026-09-25)
- `L3203` 타이틀 오프닝 효과 도구 (2026-09-25)
- `L3218` 크로노 트리거식 필드 도구 인자 (2026-09-26)
- `L3247` Pi 오프닝 제작·그림 검토 계약 (2026-10-03)
- `L3275` Independent opening timelines
- `L3279` Monster collector setup and verification (2026-10-03)
- `L3285` Structured optional read arrays (2026-10-04)
- `L3295` NPC, shop and readable opening production (2026-10-04)
- `L3304` 에메랄드 참고 전체 몬스터 제작 (2026-10-04)
- `L3359` Emerald native sprite contract (2026-10-04 correction)
- `L3365` 세계 지도 지형 도구 (2026-10-03)
- `L3375` Bounded romance authoring tools
  - `L3379` 선택 정수 enum의 Antigravity 전달 (2026-10-04)
- `L3387` 글자·장면 오프닝 연출 (2026-10-04)
- `L3397` 오프닝 스토리보드·그림 배우·원곡 BGM (2026-10-04)
- `L3405` OST·효과음 직접 작곡 (2026-10-05)
- `L3409` 작은 편집의 래스터 보존과 선택지 취소 (2026-10-05)
- `L3415` 슈퍼하네싱 사용자 선택 기물 우선 사용 (2026-10-05)
- `L3424` 키트 시트 야외 빈 터 꾸미기 — `find_empty_ground` · `furnish_outdoor_area` (2026-10-07)
  - `L3439` naturalize_beodeul_hamlet (2026-10-04)
- `L3444` compose_beodeul_courtyard_village (2026-10-04)
- `L3449` refine_beodeul_courtyard_vegetation (2026-10-04)
- `L3454` 오프닝 그림 프롬프트 구조화 (2026-10-11)
  - `L3460` 그림 기본 경로 = ChatGPT(GPT Image) (2026-10-11)
  - `L3466` 오프닝 바이블·cast·화풍 기법 (2026-10-11)
  - `L3473` 오프닝 후보 생성 + 독립 판정자 (2026-10-11)
  - `L3479` 시연 오프닝 6컷 mp4 (2026-10-12)
  - `L3484` 조수가 도트를 직접 찍는다 — `author_pixel_art` · `author_actor_charset` · Argon 기본 (2026-10-14)
  - `L3491` 대형 유닛 walker · smash — 세계가 반응하는 행군 (2026-10-14)
  - `L3498` 사람 비율·지문·색조·자세 (2026-10-15, 오프닝 1라운드 장면 분석 뒤)
- `L3507` 몬스터 자유 경로 도구 (monster-free-b, 2026-10-14)
- `L3516` 몬스터 캠페인 규모 인자화 · 정의 일치 검사 (2026-10-14, monster-free-a)
- `L3541` 세계 변형판 · 장소 입구 · 지형 조우 (2026-10-15, worker B, FF6급 감사)
- `L3555` 필드 스킬 게이트 증명: `useFieldSkill` + `partyKnowsSkill` (2026-10-15, FF6 수정 C)
- `L3559` 무대 공연 도구 — author_stage_performance (2026-10-15, FF6급 감사 #31)
- `L3569` `place_field_obstacle` — 비전머신(HM) 필드 기술 게이트 (2026-10-15, poke-fix-p Phase 2)
- `L3586` 포켓몬풍 필드·진행 규칙 도구 (2026-10-15, poke-fix-p)
- `L3594` 팀 교대 전투 도구 (2026-10-15, FF6 수정 A)
- `L3602` 비행 시점 모드7 — place_vehicle flightView (2026-10-15, FF6급 감사 #31, 안 A)
- `L3613` `upsert_item.heldEffect` — 지닌 도구 (2026-10-16, poke-depth PR4)
- `L3621` `define_monster_species.ability` — 특성 (2026-10-16, poke-depth PR3)
- `L3628` `upsert_state` 의 맹독·혼란 (2026-10-16, poke-depth PR2)
- `L3636` `upsert_skill.statStageEffects` — 능력치 단계 (2026-10-16, poke-depth PR1)
- `L3645` 세계 카드 AI 공개 범위가 걸리는 도구 (2026-10-16)
- `L3650` `upsert_skill.weather` — 날씨 기술 (2026-10-16, poke-depth PR5)
- `L3656` 연애 루프 도구 변경 (2026-10-16)
- `L3663` `upsert_item.captureProfile.condition` — 조건부 볼 (2026-10-16, poke-depth PR6)
- `L3668` `upsert_item` 몬스터 필드 아이템 — 부활·PP·이상한 사탕·진화의 돌·가방 포켓 (2026-10-16, poke-sys-items)
- `L3675` `upsert_item.repelSteps` / `escapeTo` · `configure_monster_system.escapeGraceSteps` — 필드 도구 (2026-10-16, poke-sys ②)
- `L3681` 이야기형 연애 기본값 `apply_romance_preset` (2026-10-25, 시타마치)
  - `L3685` 대화 중 인물 보이기 `system.dialogueKeepActorsVisible` (2026-10-25)
  - `L3692` 장르 기본값 걷어 내기 — HUD·오프닝 그림·결말 그림 (2026-10-25, 시타마치 2차)
- `L3705` 연애 3차 수리 — 칩·ESC 메뉴·뼈대·완료 문 (2026-10-16, romance-fix-3)
- `L3714` `set_dialogue_system` — 대사창 읽기 보조 (2026-10-17, 미연시 시스템 UI 1단계)
- `L3722` 공용 규칙 모듈 `src/project/menuSystem.ts` — 자료집 「메뉴·시스템」 탭과 같은 검증 (2026-10-17, 미연시 3단계)
- `L3727` `set_vn_extras` — 갤러리·엔딩 목록·세이브 카드 (2026-10-17, 미연시 시스템 UI 2단계)
- `L3734` `set_vn_look` — 미연시 대사창 룩(프리셋·이름표·선택지·대기 표시·글자) (2026-10-17, vn-look-1)
- `L3746` 바로 깔기 `place_house` — 장식 정리 후 집 배치·`jp_city` 지원 (2026-10-17)
- `L3751` `list_puzzle_presets` · `author_map_puzzle` — 상태 공간 모형(BFS) 퍼즐 프리셋 카탈로그 20종 (2026-10-20, jrpg-puzzle-presets-r2)
- `L3762` 마을 종류 표 — `find_village_type` · `dress_village_quarter` · `dress_joseon_market` (2026-10-22, village-eras)
- `L3833` `make_timed_escape` — 제한 시간 탈출(무너지는 바닥·카운트다운·체크포인트) (2026-10-25, 폴른 2막 과제 10)
- `L3845` 연계기·기술 정체성·결과 팡파레 — `list_combo_techs` · `upsert_combo_tech` · `battle.fanfare` (2026-10-24, fs-battle-2)
- `L3856` 폴른 스타 제작을 조수 도구로 (2026-10-25, 폴른 재현 트랙)
- `L3871` 충전 끊기 — `upsert_skill chargeBreak` (2026-10-25, fs2 과제 9)
- `L3882` `author_party_split` — FF6 식 파티 나누기·전환·레버 짝·합류 + 풀이 검사 (2026-10-25, 폴른 2막 과제 4)
- `L3890` 이야기 일지 — `configure_story_journal` · m2 «Journal Line»(일지에 한 줄 쓰기) (2026-10-25, 폴른 2막 과제 7)
- `L3901` 전투 중 손님 `add_battle_guest` · 보이는 적 진영 싸움 (2026-10-25, 폴른 스타 2막 과제 8·11)
- `L3917` `write_blueprint` — 게임 청사진 먼저 (2026-10-28, suite-blueprint)
- `L3939` `build_blueprint_path` — 청사진 경로를 함수가 짓는다 (2026-10-28, fix-gamepath)

### `openwiki/editor-database.md` — 458KB · 2681줄 · ~134,655 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L3` 이야기 › 대사 탭 「대본」 보기 — 이야기 순서 시나리오 (2026-10-25)
- `L29` 대사 탭 화면 다듬기 (2026-10-27, 독립 검수 지적 4건)
- `L36` 대사 색인에 퀘스트·엔딩 글 추가 (2026-10-27)
- `L48` 이야기 › 대사 탭 — 모든 대사 한 화면, 창 넘침, 말투 메모, 조수 윤문 받기 (2026-10-24)
- `L71` 주인공 마법 5종 · 노출 시간과 앞뒤 층 (2026-10-05)
- `L83` 아이템·장비 카탈로그의 입력과 가상 스크롤 (2026-10-04)
- `L100` 시스템(게임 설정) 탭 전수 점검 — 양쪽 전신 대화창이 해상도를 잠그던 버그 (2026-10-21)
- `L122` 시스템(게임 설정) 탭 구획 목록·폼 격자·스위치 통일 (2026-10-17, 메뉴 감사 PR-5)
- `L130` 자료집 장르 프로필 접기 — 「숨긴 탭 N개 · 모두 보기」 (2026-10-17, 메뉴 감사 PR-4)
- `L144` 자료집 6그룹 재배치·소제목·「게임 설정」 라벨 (2026-10-17, 메뉴 감사 PR-3)
- `L161` 자료집 시각 깨짐·잘림 9건 수리 (2026-10-17, 메뉴 감사 PR-2)
- `L175` 자료집 길찾기 — 구획 낱말 검색·3단 크럼·최근 탭 (2026-10-17, 메뉴 감사 PR-1)
- `L186` 자료집 「메뉴·시스템」 탭 — ESC 메뉴·대사창·갤러리/엔딩/저장 카드 한 화면 (2026-10-17, 미연시 3단계)
- `L202` 자료집 전투 정리 — 전투 방식 두 가지·전투 화면 탭·안 쓰는 칸 삭제 (2026-10-02)
- `L221` 전투 배경은 종류로 고른다 — 도트 측면 (2026-10-03)
- `L234` 레트로 전투 기믹 편집 칸 (2026-09-30)
- `L242` 도트 연출 탭 · 애니메이션 갤러리 (2026-09-30, A2)
- `L256` 연출 손잡이 카드 · 상태 「몸에 남는 표시」 (2026-09-30, B)
- `L262` 스킬 탭 「도트 연출」 고르기 (2026-09-30)
- `L266` 적 그룹 「전투 뒤」 구획 (2026-09-28)
- `L272` 자료집 개선안 2단계 — 헤더 저장 상태·얇은 발 줄·연결 칸 (2026-09-27)
- `L280` 자료집 개선안 1단계 — 그룹 띠·쿨 인디고 팔레트·흰 카드 (2026-09-27)
- `L293` 맵 그룹 목록 수리 — 출처·썸네일·레일 (2026-09-27)
- `L301` 자료집 열기 (2026-09-24)
- `L305` 게임 오버 라이브러리 저작 (2026-09-23)
- `L325` 장소 탭 재설계 — 라이브러리 우선 배치 (2026-09-21)
- `L365` 몬스터 종족의 전투 뒷모습 (2026-09-20)
- `L376` 이벤트 초안 원본의 삭제 참조 (2026-10-02)
- `L382` DB 삭제의 스킬·주인공 권한 참조 (2026-10-02)
- `L389` 감사 후속: 참조를 보존하는 삭제 경로 (2026-09-20)
- `L397` 장소 편집 1차 UX 수리 — 이름·툴바·속성·카드 (2026-09-15)
  - `L439` 2차 (같은 날) — 갤러리 복귀와 속성 패널 통합
  - `L454` 3차 (같은 날) — 이 탭이 뭔지 말하게 한다: 목적·쓰임·배치 감사
- `L530` 장소 통합 진행: 방·층과 재료 (2026-09-14)
- `L543` 새 장소 생성 흐름 (2026-09-14, 2단계)
- `L560` 장소 목록 통합 1단계 (2026-09-14)
- `L575` 복합 공간 편집기 (2026-09-13)
- `L599` Placed-place child proposal adapter (2026-09-08)
- `L604` Monster resource metadata worksheet (2026-09-07)
- `L612` Shared database CSS ownership (2026-09-06)
- `L653` 전투 몬스터 표시 크기 (2026-09-06)
- `L660` 전투 명령 배치 스튜디오 (2026-09-05)
- `L677` 캐릭터·얼굴 메타데이터 (2026-09-06)
- `L685` Character appearance catalog v1 (2026-09-06)
- `L729` Concept navigation integration (2026-09-06)
- `L743` Opening still media, sequence music and AI generation (2026-09-14)
  - `L745` 새 프로젝트 기본 오프닝 (2026-09-21)
- `L770` Opening and game-over authoring (2026-09-06)
- `L826` Cinematic media preparation boundary (2026-09-06)
- `L845` System settings workspace (2026-09-06)
- `L906` Graphic 칩 사용자 교정 29건 (2026-09-05)
- `L922` Custom equipment slot authoring (2026-09-05)
- `L930` 통합 아이템·장비 카탈로그 (2026-09-05)
- `L938` 아이템·장비 저작 신뢰성 (2026-09-05)
- `L949` 전투 몬스터와 포획·성장 종족 (Phase 1)
  - `L959` 종족 검색과 관련 레코드 노출 (Phase 2)
- `L969` 몬스터 작업실 — 미리보기 · 행동 · 속성 (2026-09-05)
  - `L994` Monster action input trust (Phase 1, 2026-09-05)
  - `L1003` Monster numeric caption activation (Phase 2, 2026-09-05)
  - `L1010` Monster nested dialog focus (Phase 2, 2026-09-05)
- `L1016` 몬스터 그룹 저작 신뢰성 (2026-09-05)
- `L1031` Database Studio chrome (2026-08-24)
  - `L1047` Actor data-table slice (2026-08-25)
- `L1057` 프로젝트 위키 출처와 수동 편집 (2026-09-07)
- `L1069` 세계관 그룹 — 세계 개요 · 설정집 (2026-09-18)
  - `L1091` 세계관 입력 보존·설정집 저장 계약 (2026-09-05)
- `L1103` '생성 규칙' 탭 — AI 마을 생성의 물·숲·길 (2026-08-30)
- `L1111` P2 낚시·채집·박물관 저작 표면 (2026-08-25)
- `L1116` 생활 저작 경계와 자동 화자 (task14, 2026-09-06)
- `L1125` 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)
- `L1138` 생활 기술·제작 저작 표면 (2026-08-24)
- `L1157` Database Editor
- `L1255` Beginner-centric adversarial review (2026-08)
- `L1259` DB UI modernization (2026-08)
- `L1296` P2 spatial authoring (2026-08-25)
- `L1308` 맵 그룹 — 개념 우선 탐색 Phase 1 (2026-09-05)
- `L1330` 오브젝트·공간 수정 복구 (2026-09-13)
- `L1352` 오브젝트 브라우저와 공간 배치 작업대 (2026-09-13)
- `L1373` 맵 그룹 — 공간 저작 셸 UX 계약 (2026-09-12)
- `L1417` 타일 작업대 — 공간 셸 안 레이아웃 계약 (2026-09-13)
- `L1448` 오토타일 설정 — 9칸/11칸/커스텀 카드 (2026-09-01)
- `L1469` 공간 종류와 구조물은 다른 면이다 (2026-09-01)
- `L1488` 맵 → 개념 꾸러미 (2026-09-02 시작, 2026-09-05 개념 우선 Phase 1)
- `L1519` '구조물' 탭 — 두 출처 앨범 + 방 종류 문법 (2026-08-28)
- `L1532` '구조물' 편집기와 파일 입출력 (2026-08-29)
- `L1551` 삭제 가드는 묶음 조건(all/any/not) 안까지 본다 (2026-08-29 실측 결함 수정)
- `L1571` '진영' 탭과 몬스터 소속 진영 (2026-08-29)
  - `L1586` 몬스터 폼의 소속 진영 (`databaseEnemyRecordView.ts`)
  - `L1594` 다 만들어 놓고 못 쓰던 이유 — `[편집]` 이 화면 밖 67px 에 있었다 (2026-08-29 실측)
  - `L1606` 구조물 어휘 — 역할·레이어·테마·증분 축·칸 힌트 (2026-08-30)
  - `L1657` 편집기를 맵 타일 편집기 수준으로 (2026-08-30 실측)
- `L1679` Battle-animation editor autoplay (2026-09-05)
- `L1686` 스킬 탭 `연출` 카드 = 살아 있는 애니메이션 스테이지 (2026-08-30)
  - `L1697` retro2003 도트 전투 미리보기 (2026-09-28)
  - `L1714` 적 탭 도트 미리보기 카드 (2026-09-28 mx-ed)
  - `L1722` 몬스터 스킬 미리보기 (2026-09-28 med)
- `L1731` 데이터베이스 30탭 UI/UX 계약 (2026-08-30 실측)
  - `L1746` 헤더는 설명문이 아니라 아이콘 칩 한 줄이다
  - `L1824` 숫자 입력은 스테퍼를 먼저 붙이고 그다음 스피너를 지운다
  - `L1838` 줄상자 바닥은 1.35 다 (1.25 는 큰 한글 제목에서 깎인다)
  - `L1881` 이미지 실패는 빈 상자가 아니라 라벨 붙은 자리표시자다
- `L1890` '마을' 탭 — 마을 하네스 값을 사람이 저작한다 (2026-08-30)
  - `L1914` 붓을 고르면 화면이 흔들렸다 — 재부모가 스크롤·포커스를 지운다 (2026-08-30 실측)
- `L1957` 날개마다 층수를 정한다 — 계단식 2층 (2026-09-11)
  - `L1968` 지붕 가장자리 판정은 "다른 지붕면인가"다 (2026-09-11 실측 결함)
- `L1976` '마을' 탭 — 숫자칸을 그림으로 바꾼다 (2026-08-31)
  - `L1992` AI로 몬스터·아이템 생성 (2026-08-30)
  - `L2018` AI 검토 오버레이 — 레코드 카드로 before → after 를 보고 적용한다 (2026-09-15)
  - `L2112` AI로 몬스터·아이템 생성 — 대화상자 재작성 (2026-09-03)
- `L2128` Database Studio v2 — 30탭 셸·폼 문법 통일 (2026-09-03)
- `L2206` 직업 승급 트리 · 스킬 트리 (2026-09-05)
- `L2212` 미회수 편집 후속 통합 (2026-09-05)
- `L2216` 마을 설계서 (2026-09-05)
- `L2221` 구조물 증분 메타 정정 (2026-09-05)
- `L2229` 개념 회수 UI 직접 렌더 QA (2026-09-05)
- `L2233` Battle-animation preview-first graphic controls (Phase 2, 2026-09-05)
- `L2240` 검토한 실내 기본값의 원격 반영 (2026-09-05)
- `L2244` 특정 꾸러미의 명시적 교체 (2026-09-06)
- `L2248` 생성 아이템 아트에 dry-run 가짜가 섞여 들어갔다 (2026-09-16)
- `L2266` 배·항구 공통 기본 장소 (2026-09-17)
- `L2279` Game menu design options (2026-09-18)
- `L2308` 캐릭터·얼굴 연결 검토 개선 (2026-09-18)
- `L2318` 얼굴 대응표 실물 대조와 추천 제외 (2026-09-18 후속)
  - `L2326` 캐릭터·얼굴 화면 레이아웃 보정 (2026-09-18)
- `L2334` 캐릭터·얼굴은 프로젝트 밖 공용 자료 (2026-09-18 저장 범위 수정)
  - `L2345` 공용 기본 매핑 재저작 (2026-09-18)
- `L2353` Feature16 climate and action forms (2026-09-21)
- `L2372` Combat authoring studio (feature16, 2026-09-21)
- `L2379` Troop intent and weakness authoring (2026-09-21)
- `L2383` 인게임 HUD 구성 편집기 (2026-09-21)
  - `L2393` 장르별 HUD와 글꼴 (2026-09-21 후속)
- `L2404` 숲·마을·동굴 공통 기본 장소 13종 (2026-09-21)
- `L2429` 타일셋 참고문서 (2026-09-21)
  - `L2433` 숲마을 공용 소품 및 장소 (2026-09-21)
  - `L2456` 세계 개요 스프레드 뷰 (2026-09-22)
  - `L2465` 세계 개요 탭 구조 — 문서 / 조수 전달 (2026-09-22 v2)
  - `L2474` 세계 개요 본문 우선 — 도화지 첫 화면 (2026-09-22 v3)
  - `L2483` 세계 개요 헤드 압축 + 세계 설정 평문 폼 (2026-09-22 v4)
  - `L2492` 세계 개요 헤드 v5 + 법칙 대화상자 토큰 스코프 수정 (2026-09-22)
  - `L2500` 세계 설정 = AI 문답 인터뷰 (2026-09-22 v6)
  - `L2511` 세계 개요 스프레드 헤드 삭제 (2026-09-22 v6)
  - `L2520` 세계관 본문 AI 도움 — 초안·이어쓰기 (2026-09-22 v7)
- `L2531` 공용 아이템 1,000종과 통일 도트 작업 (2026-10-01)
  - `L2559` 도트 연출의 이동·가속도·배우 경로 (2026-10-02)
- `L2564` 저장 결과를 구분하는 적용 피드백 (2026-10-02)
- `L2568` 생활 컬렉션 검색과 선택된 상세 폼 (UX round 2, 2026-10-04)
- `L2587` 연결 칸의 참조 데이터 캐시 (UX round 2, 2026-10-04)
  - `L2625` 감독자 네이티브 재검증 절차
- `L2649` 세계관 노션식 통합 1단계 — 문서 용어·AI 공개 범위·「AI가 읽는 것」 (2026-10-16)
  - `L2660` 세계관 화면 컴팩트화 2차 (2026-10-16) — 속성 레일 폐지, 칩 줄
- `L2671` 스킬 → 「연계기」 하위 보기 · 약점 공략 칸 · 결과 연출 카드 (2026-10-24, fs-battle-2)

### `openwiki/editor-event-authoring.md` — 185KB · 1136줄 · ~54,218 토큰 · 통째읽기 잘림 · 깨진 줄 16

- `L3` 이벤트 UX 2차 감사 후속: 선택·검색·목록·복제 (2026-10-04)
- `L69` 이벤트 보기의 지연 생성 (2026-10-04)
- `L82` 명령 드래그 소유권과 레거시 페이지 붙여넣기 (2026-10-02)
- `L89` 감사 후속: 조건 순서와 생활 경로 보존 (2026-09-20)
- `L97` AI 이벤트 작업함 — 여러 칸을 동시에 (2026-09-28)
- `L113` 이벤트 레이어에 겹쳐 넣지 않는다 (2026-10-25, 드래그 2026-10-26)
- `L137` 조수에서도 이벤트 명령 생성기 사용 (2026-09-20)
- `L146` 적대적 리뷰 고위험 항목 보정 (2026-09-19)
- `L155` 등장 조건은 조건 그룹을 기본으로 펼친다 (2026-09-19)
- `L162` 명령 중심 배치와 AI 작성 모달 (2026-09-18)
- `L198` 배우·파티·시점·회차·요일·문자열 조건 (명작 공백 G1, 2026-09-27)
- `L227` 구역(로케이션) 조건분기 (OPRN-OUT-020, 2026-09-10)
- `L249` 구역 드나듦 트리거 (2026-09-10)
- `L276` Native battle confirmation admission (2026-09-08)
- `L295` Character graphic no-match recovery (OUT-007, 2026-09-08)
- `L318` Page preview state follows the current script (2026-09-08)
- `L339` Event editor window controls (2026-09-06)
- `L386` 이벤트 편집기 가독성 — 읽는 글자와 꾸미는 글자 (2026-09-03 후속)
- `L399` 이벤트 편집기 문법 고정 — P0 (2026-09-03)
- `L413` 2026-09-17 적대적 리뷰 P0 다섯 가지 수정 (2026-09-18)
- `L427` NPC 일정 구조화 편집 (2026-08-24)
- `L439` AI 가 이벤트 페이지를 이해하지 못했다 (2026-08-30 실측 · 수정)
  - `L461` 우선순위는 1페이지가 아니다 (바꾸지 않았다)
  - `L469` 랜덤 대사는 페이지가 아니다
  - `L476` 새 린트가 출하 콘텐츠에서 실제로 잡은 것 (skyStair autoEvent)
  - `L486` 조건만 걸고 켜지 않으면 그것도 죽은 페이지다 (가려짐의 거울상)
- `L503` 복잡한 NPC 는 조회 후 상태별 다중 페이지로 저작한다 (2026-09-01)
- `L533` Roguelike run authoring (2026-08-24)
- `L540` Event Authoring
- `L763` Condition / Loop / Variable command trust fixes (2026-08-07)
- `L773` Event draft trust loop (2026-07-30)
- `L781` 회상 오프닝 저작 — beat 컴파일러다 (2026-09-03)
- `L790` Guided story arc facade
- `L794` 지도·화면 효과 탭 초보자 UX (2026-08-27)
- `L803` 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)
- `L811` Companion roster in the command picker (2026-08-27)
- `L817` Presentation and system M2 command bodies
- `L824` 좌측 설정 레일 그룹 소속 (2026-08-27)
- `L842` 설정 레일 한 열 정돈 (2026-09-27, 적대적 시각 QA 후속)
  - `L867` 등장 조건 창 (`openConditionsModal`)
- `L887` 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)
- `L897` 「움직임과 속도」 부피 정리 (2026-08-29)
- `L932` 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)
  - `L967` 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다
  - `L980` 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)
  - `L988` 참조를 비워도 조건을 삭제하지 않는다
  - `L995` 조건 미리보기는 모르면 모른다고 말한다
  - `L1010` 조건 문구에 내부 토큰을 넣지 마라
- `L1025` 공포 게임 제작 기능 (2026-09-05)
  - `L1030` NPC 발견·추격 저작 (2026-09-06)
- `L1039` 명령 툴바는 한 줄이다 — wrap 금지와 폭 흡수 순서 (2026-09-21)
- `L1081` 공통 이벤트 호출 그래프 경고 (2026-10-02)
- `L1087` Independent opening timelines
- `L1091` Safe ambient patrol authoring (2026-10-04)
- `L1117` 일기·사물 이벤트의 그래픽 미리보기 (2026-10-04)

### `openwiki/editor-event-command-fixes.md` — 25KB · 99줄 · ~6,388 토큰 · 깨진 줄 11

- `L25` Sound and system audio handoffs (U14)
- `L34` Named text record insertion (2026-09-06, G1-F18)
- `L44` Nested command drafts and branch identity (2026-09-06, U02)
- `L53` Page 3 canonical fields and staged commits (2026-07-30)
- `L58` Show Picture preview opacity unit (2026-08-29)
- `L63` 조명 백분율 입력 복구 (2026-09-05)
- `L67` Native media flags and picture completion (2026-09-06, U04)
- `L77` Actor targets and operand drafts (2026-09-06, U05)
- `L85` Follower removal and graphic intent (2026-09-06, U06)
- `L92` Stable resource selections and field labels (2026-09-06, U07)

### `openwiki/editor-event-commands.md` — 78KB · 327줄 · ~21,831 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L3` 인물 연출 — 다가가기·쪽으로 돌기·대사 자동 돌아보기 (2026-10-22)
- `L23` 장면 · 그림 갤러리 표시 · 줄 음성 (2026-09-25)
- `L33` 게임 오버 선택 (2026-09-23)
- `L45` Move-route target repair (PR716, 2026-09-09)
- `L64` 좌표로 이동 — 고정/변수 좌표와 실패 정책 (OPRN-OUT-013, 2026-09-10)
- `L108` 장소 이동의 목적지 원복과 설정 보존 (2026-09-06)
- `L114` 확률로 결과 뽑기 / 가중 분기 (2026-09-06)
- `L127` 상점: 진열 상품과 상품 상세 중심 편집 (2026-09-05)
- `L139` Roguelike run control (2026-08-24)
- `L179` 런타임 규격 무대 — 대사·선택지 미리보기는 게임 창을 축소해 그린다 (2026-09-17)
- `L220` 얼굴 상자(faceset-crop-box) 페인트 계약 (2026-08-28)
- `L287` Staged edit, history, and nested drag invariants (2026-07-30)
- `L294` Command picker, validation, and preview trust (2026-07-30)
- `L303` 회상 스틸과 AI 그림 (2026-09-03)
- `L314` Recovered native emote command (2026-09-05)
- `L318` 패배·엔딩 저작 (2026-09-22)

### `openwiki/editor-genre-packs.md` — 54KB · 358줄 · ~14,186 토큰 · 통째읽기 잘림

- `L5` Ownership
- `L16` Concept feed is the only new-game surface (2026-10-07)
- `L36` Safe blank-project system-preset flow
- `L64` Preset AI connection gate and first team build (2026-09-27)
- `L72` Playable first segment — code builds it, code judges it (2026-09-28)
- `L93` Cinematic interview in the actual app (2026-10-03, launcher/welcome entry superseded 2026-10-07)
  - `L110` Internal execution handoff (2026-10-03)
  - `L126` Confirmed brief automatic execution (2026-10-03)
  - `L134` Detailed authoring manuals (2026-10-03)
- `L148` Vocabulary and readiness
- `L159` Dialog layering and receipt fixtures (2026-09-08)
- `L173` Validation
- `L175` Two new-project surfaces, one choice model (2026-09-11, superseded 2026-10-07 by the concept feed)
- `L236` 새 몬스터 프로젝트의 참고 프로필 (2026-10-04)
  - `L245` Executable first romance scene (2026-10-03)
  - `L249` Click-first interview and fresh art (2026-10-04)
  - `L290` Launcher planning before project creation (2026-10-04, superseded 2026-10-07 by the concept feed)
- `L344` JRPG 남은 결함: 필드 HUD · 전투 균형 완료 게이트 (2026-10-17 fix-leftovers, jrpg-real-1 J09/J06/J04)

### `openwiki/editor-interior-room-harness.md` — 98KB · 469줄 · ~28,406 토큰 · 통째읽기 잘림

- `L7` 던전 천장과 단차의 구분 — 사용자 정정 (2026-09-13)
- `L26` 대형 광산 저작 접합 교정 (2026-09-13)
- `L34` 사용자 광산 참고 이미지와 확장판 (2026-09-13)
- `L42` 광산 참고 문법의 얼음·용암 적용 (2026-09-13)
- `L50` 얼음·용암 절벽 굴곡과 소품 보강 (2026-09-14)
- `L58` 서로 합류하는 복합 절벽 — 실제 반영 (2026-09-14)
- `L71` 기존 칩셋 던전 네 종류 (2026-09-14)
- `L82` 네 던전의 연결 구조 우선 재저작 (2026-09-14)
- `L90` 설산 빙벽 조립 정정 (2026-09-13)
- `L102` Interior authoring/load consistency (2026-09-07)
- `L143` Closed expandable long tables (2026-09-07)
- `L184` 사용자 타일 정정: 항아리·돌계단·석조 화로
- `L195` 여관 검수표와 숙박 검증
- `L203` 여관 꾸러미 전면 재구성 (2026-09-06)
- `L222` 실내 의미·형태 검토 반영 (2026-09-05)
- `L235` 모든 AI 실내의 개념 꾸러미 계약 (2026-09-05)
- `L246` Tileset-specific map generation contract
- `L258` Interior Room Session Harness (villager-room-v1)
- `L271` Safe detached draft and approval harness
- `L279` Interior object catalog is the shape source of truth (2026-08-28)
- `L290` 소품 표면 어휘가 `PlacementZone` 으로 통일됐다 (2026-08-30, PR #316)
- `L303` 개념 시설 시공 — place_concept 경로가 파이프라인에서 다른 점 (2026-09-02)
- `L317` 도면 호환성과 외장 스탬프 후속 (2026-09-05)
- `L323` 입구 예약·멀티타일 통행 복원 (2026-09-05)
- `L331` 공포 게임 제작 기능 (2026-09-05)
- `L335` 여관 외 시설의 공간 구성 (2026-09-05)
- `L345` PR618 통합: 큰 탁자와 기존 시설 구성 (2026-09-06)
- `L353` 비직사각 실내 정본 재설계 (2026-09-13)
- `L363` 생활 구역 조합으로 실내 저작 (2026-09-14)
- `L372` 여관·잡화점의 시설별 실내 기준 (2026-09-14)
- `L379` 연결 던전의 에디터 통합 (2026-09-14)
- `L383` Compact interiors and automatic furnishing budgets (2026-09-14)
- `L394` Open domestic interiors: activity areas are not enclosed rooms (2026-09-14)
  - `L406` Follow-up: excess floor and furniture depth (2026-09-14)
  - `L416` Small props require supports; short bathroom steps (2026-09-14)
  - `L426` Reference-house correction: no shrub pots, cooking supports, inset cabinets (2026-09-14)
  - `L436` All-interior review (2026-09-15)

### `openwiki/editor-observability.md` — 64KB · 725줄 · ~18,890 토큰 · 통째읽기 잘림

- `L5` 여러 단계 되돌리기와 초안 보관 비용 (2026-10-04)
- `L21` 지형 조수의 실제 UI 검증 (2026-10-04)
- `L25` 작은 타일 편집의 undo/redo 경로 (2026-10-04)
- `L41` 되돌리기 복원의 공용 자산 복제 (2026-10-03)
- `L73` 높이 붓·높이 조수 도구의 기록 (2026-09-26)
- `L78` 조수 오류 자세히 보기 (2026-09-25)
- `L85` 조수 실행 기록과 표시 수준 (2026-09-21)
- `L100` Opt-in local diagnostics (issue 693 OUT-009 / OUT-010)
- `L153` 계측 초크포인트는 `store.markLocalMutation` 하나다
- `L196` 새 편집 기능을 추가할 때 — 라벨을 넣어라
- `L215` AI 적용 경로 — 이쪽이 주 경로다
  - `L246` 요청 중 사람 칸 의도 (2026-10-04)
- `L250` P3 owner-bound publication (2026-09-07)
- `L319` P2 outcome publication (2026-09-06)
- `L382` 되돌리기 스택과 감사 로그는 다르다
- `L403` Toolbar history confirmation lifetime (PR716, 2026-09-09)
- `L422` 디버깅 레시피
  - `L464` 저장된 것 — DB 커밋에 실린 행위 (`npm run commit:log`)
- `L499` 로거
- `L518` 알려진 남은 공백 (여기 손대는 사람이 이어서 하라)
- `L549` AI 툴·액션 이유 (2026-09-02)
- `L559` 맵 화면이 버벅일 때 (2026-09-24)
- `L567` 검증
- `L574` Feature16 저작 보조 관측 경계 (2026-09-21)
- `L586` 연속 AI 적용의 구독자 비용 (2026-09-28)
  - `L615` 텍스처 완료 redraw 합치기 (2026-09-28)
- `L635` 조수 적용·체크리스트 경로의 전체 문서 비용 (2026-09-28)
- `L675` store.update copy-on-write 와 자동저장 요약 (2026-09-30)
  - `L701` 미디어 분리의 저장용 교체와 AI 턴 (2026-10-04)
- `L714` 편집기 UX 지연 조사 (2026-10-04)
  - `L722` 2026-10-04: 제출 중 추가 지형 편집과 초안 목록

### `openwiki/editor-pre-edit-routing.md` — 189KB · 1176줄 · ~55,736 토큰 · 통째읽기 잘림 · 깨진 줄 3

- `L5` 태양과 그림자 (2026-10-04)
- `L11` 공식 맵 상한 1024×1024 (2026-10-01)
- `L28` 지형 설치 막대 확장 (2026-10-03)
- `L36` 「지형」 도구 — 절벽 높이 지형 (2026-09-26, UI 명칭 2026-10-11)
- `L67` 맵별 16/32/48px 좌표
- `L75` 맵 칸 층은 `mapLayers.ts` 로만 읽고 쓴다 (MZ식 4층, 2026-09-24)
- `L117` 맵 목록 클릭은 즉시 선택한다 (2026-09-18 후속)
- `L170` 자동저장이 프로젝트 문서를 여섯 번 지나가지 않는다 (2026-09-25)
  - `L182` 계약
- `L207` 안 바뀐 타일셋은 복제하지 않는다 — 타일셋 구조 공유 (2026-09-27)
- `L231` DB 레코드 편집은 컬렉션만 복제한다 (2026-09-25)
- `L246` 참고문서가 많은 프로젝트의 DB 되돌리기 스냅샷 (2026-09-25)
- `L257` database 표면 CSS 지연 로드와 공용 다이얼로그 (2026-09-21)
- `L270` 맵 전환과 물 타일 애니메이션 공유 (2026-09-18)
- `L288` 편집기 CSS·목록 비용 (2026-09-25)
- `L323` 편집기 재렌더 비용 — 줌은 카메라 경로다 (2026-09-16)
  - `L431` 커스텀 칩 팔레트의 빈틈 없는 표시 (2026-09-21)
- `L483` Exterior door backing
- `L493` Tile brush reliability (2026-09-06)
- `L537` Combo Brush (2026-09-10, OPRN-OUT-022)
  - `L542` 용어 (코드와 UI 가 같은 말을 쓴다)
  - `L554` 소유 경계
  - `L566` 근거 규칙 — 번호 인접으로 추론하지 않는다
  - `L577` 검토 책임
  - `L589` 경계와 진단
  - `L599` 회귀 이음줌
- `L611` Pre-edit routing
  - `L613` 명명 로케이션 레이어 (2026-09-10)
  - `L695` 로케이션 역할과 겹침 클릭 (2026-09-12)
  - `L754` 설계 영역 이관 도구 (LOC-ADOPT, 2026-09-10)
  - `L756` 로케이션 앵커 — 좌표 대신 이름으로 가리키기 (2026-09-12)
  - `L809` Standard / Expert focus modes (2026-09-07; supersedes sidebar density notes below)
  - `L869` Automatic usage guides disabled (2026-09-06)
  - `L879` Sidebar mode workflow (2026-09-06; supersedes older 72px/tile-flyout notes below)
- `L992` Agent cautions
- `L1006` 헤더 용어 정본과 중복 감사 (2026-08-30)
  - `L1042` 톱바 영역 진입점 감사표 (`renderTopbar` 실측)
  - `L1074` 사이드바 ↔ 톱바 소유권 (2026-08-30 중복 정리)
  - `L1103` 스튜디오 바 — 톱바 한 줄 (2026-09-03, 표준·전문가 대격변)
- `L1143` 타일 칠하기 중 UI 구독자 (2026-09-30, 렉 수정 D)
- `L1159` 맵·레이어 전환 UI 비용 (2026-09-30, 렉 수정 I)

### `openwiki/editor-preview-performance.md` — 10KB · 146줄 · ~2,678 토큰

- `L6` Native shared catalog validators (O5)
- `L26` Parked, cached and hidden DB previews (O4/N1/N2)
- `L76` Resource galleries and audio manager (O1/O2/O3/N3)

### `openwiki/editor-storage-chest.md` — 2KB · 17줄 · ~641 토큰

- `L5` Storage chest authoring

### `openwiki/editor-validation.md` — 61KB · 406줄 · ~17,278 토큰 · 통째읽기 잘림

- `L5` 계단 입구 검사 `stair-*` (2026-10-22)
- `L9` 장면 다듬기 경고 `scene-*` (2026-10-21)
- `L59` 규칙 감사 배지는 UI 선택만으로 재검사하지 않는다 (2026-09-18)
- `L67` Event validation location and UNSENT handoff (issue 693, 2026-09-08)
- `L104` AI blocked-event relocation recovery (2026-09-06)
- `L198` AI 타일 후검증 (2026-09-05)
- `L203` 이벤트 초안 검증 표면 (2026-08-28)
- `L208` event-unreachable lint rule (2026-08-27)
- `L215` P2 생활 시스템 무결성 (2026-08-25)
- `L220` 생활 저작 표면 집중 검증 (2026-08-24)
- `L236` AI editor-wide tool validation (2026-08-25)
- `L242` Roguelike run validation (2026-08-24)
- `L249` Validation Expectations
- `L273` Desktop UI integration matrix (2026-08-11)
- `L283` Event editor aggregate gate (2026-07-30)
- `L292` P2 spatial integrity (2026-08-25)
- `L299` 손붓이 hard 클러스터에 막혔을 때의 복구 경로 (2026-09-10, OPRN-OUT-017)
  - `L345` `bAlt`/`aAlt` 패리티 — 별도 리뷰 결과: **실제 결함이었고 고쳤다** (2026-09-10)

### `openwiki/editor-workflows-misc.md` — 91KB · 636줄 · ~25,541 토큰 · 통째읽기 잘림

- `L9` Other Editor Workflows
  - `L11` 왼쪽 「기물」 — 바로 고르기 (2026-10-07)
  - `L24` 세계 지도 만들기 (2026-10-05)
  - `L30` 팔레트·맵 목록·진행의 표시 비용 (2026-10-04, UX 감사 2차)
  - `L81` 새 게임 인터뷰의 선택 배경 (2026-10-04)
  - `L89` 첫 사용자 시작과 저장 안내 (2026-10-03)
  - `L106` New-project name and player title (2026-09-07)
  - `L116` 걸을 때 적 만나기 — rectangle authoring (2026-09-06)
  - `L182` Game export delivery (2026-09-06)
  - `L294` Audio descriptions and live resource ownership
  - `L387` Genre-neutral authoring launcher and journey (2026-08-24)
- `L445` 편집기 z 층 밴드와 토스트 (2026-08-30, PR #308)
- `L474` 초보 맵 사이드바 «목록 | 상세» 2단 탐색기 (2026-08-30, PR #311)
- `L502` 커스텀 셀렉트는 열릴 때 modalStack 층이 된다 (2026-08-30)
- `L516` 맵 설정 가독성·편집 연속성 (2026-09-05)
- `L526` 왼쪽 사이드바 3모드 적대적 리뷰 (2026-09-05)
- `L539` Authoring viewport navigation (issue 693, 2026-09-08)
  - `L581` Common expression recovery (2026-09-17)
  - `L601` 제작자 페이지에서 타일셋 받기 (2026-09-24)
- `L614` 필드 키트 — 미니게임·필드 능력·순간이동·걸음 상태·클릭 이동 (명작 공백 G3, 2026-09-27)
- `L631` 현대 연애 칩 짝 흉상·전신 (2026-10-16 · 24종 완료 2026-10-17)

### `openwiki/editor-workflows.md` — 2KB · 28줄 · ~586 토큰

- `L5` Topic pages
- `L17` Quick routing
- `L25` For AI agents

### `openwiki/editor-workshop.md` — 76KB · 337줄 · ~22,898 토큰 · 통째읽기 잘림

- `L50` 한 번에 만들기 — 「딸깍」 공방 (2026-10-23)
  - `L72` 캐릭터 = 호스트가 고정판 char-gen 을 띄운다
  - `L83` 캐릭터 · 사진으로 만들기 (2026-10-23)
  - `L106` 지형 = 빠르게(기본) 또는 새로 그리기(「자세히」)
  - `L121` 물건 — 첫 결과 시간 줄이기
  - `L129` 실화면 시험
  - `L142` 2차 (2026-10-23): 3/4 관문 배선 · 물건 속도 · 작은 것
- `L166` 공방 실행기(물건·가구 카드 안)
- `L180` 칩셋에 굽기 (2단계, 2026-10-07)
- `L192` 새 기물은 object-gen 흐름 그대로 그린다 (2026-10-21)
- `L207` 자연물은 도형 금지 — 버들항 나무 견본 (2026-10-22)
- `L273` 자연물은 칩셋 기물에서 출발 — base-from-chipset (2026-10-23)
- `L284` 새 기물 그리기 품질 — 참고 그림 단계 · 크기·윗면 · 1배 읽힘 · 3/4 관문 조언 (2026-10-21)
- `L307` 작업 줄 — 여러 개를 함께 그리기 (2026-10-21)
- `L325` 생성기 저장소 고정 — `npm run gen-kits:sync` (2026-10-21)

### `openwiki/emerald-fields.md` — 23KB · 208줄 · ~7,314 토큰

- `L17` 95% 이상 유사도 요청에 따른 계곡 개정
- `L37` 저장·재현 보호
- `L55` 실제 표면·유사도·이동 검증
- `L77` 실제 플레이어에서 발견한 업로드 팔레트 결함
- `L99` 최종 회귀 검사
- `L106` 넓은 후속 맵 — 비취 대계곡 (2026-09-14)
- `L121` 두 이미지 기반 재저작 — 폭포·물길·건널목·혼합 식생
  - `L135` 계단 높이와 맵 경계 길 수정
  - `L143` 대각 절벽 적극 활용
  - `L151` 16분할 검토 후 절벽 형태 재수정
  - `L164` 두 번째 16분할 재검토 — 길 연결과 주변 구성
- `L179` 비취 대계곡 지역 등록 (2026-09-14)
- `L194` 프로젝트 공통 기본 장소 (2026-09-15 정정)

### `openwiki/emerald-monster-art-v2.md` — 8KB · 130줄 · ~2,000 토큰

- `L6` Shared NPC pack
- `L43` Monster candidates
  - `L53` Candidate revision requested by the user
- `L97` Opening and victory
- `L110` 2026-10-04 delivery evidence

### `openwiki/emerald-monster-production.md` — 10KB · 147줄 · ~2,596 토큰

- `L76` Original title key art
- `L95` Field cast
- `L110` Existing authored animation compatibility
- `L127` 2026-10-04 canonical adoption and publication

### `openwiki/emerald-runtime-surfaces.md` — 17KB · 145줄 · ~4,515 토큰

- `L5` Owners
- `L14` Geometry and reference
- `L20` Focused browser evidence
  - `L33` 2026-10-04 evidence receipt
- `L39` Shipping icon dependencies
- `L78` Genuine predecessor Continue evidence (2026-10-04)
- `L94` Approved field-kit surfaces (2026-10-05)
- `L103` 전투 개편 (2026-10-07, 사용자 「전투는 형편없다」)
- `L118` 전투 2단계 (2026-10-15, 안 A: 원작 3세대 문법 완성, 새 그림 0)
- `L129` 픽셀 격자 계약 (2026-10-16, 시각 QA D12)

### `openwiki/feature16-battle-ui.md` — 7KB · 52줄 · ~1,705 토큰

- `L3` UI entry points
- `L9` Data and rules
- `L13` Report turn count (2026-10-23)
- `L23` Parent combat integration hooks
- `L33` Parent-owned verification (not run by this worker)
  - `L43` Fresh-project editor capture boot isolation

### `openwiki/field-enemy.md` — 18KB · 163줄 · ~5,578 토큰

- `L12` 다른 수단과의 구분
- `L25` 필드 그림 = 전투 그림 (2026-10-14)
- `L36` 걷기 칩이 없는 종: 전투 그림에서 필드 칩을 뽑는다 (2026-10-24)
- `L55` 이벤트 모양 (한 마리 = 이벤트 하나, 페이지 셋)
- `L70` 이미 놓인 적을 「보면 달려드는」 적으로 — `makeFieldEnemyChase` (2026-10-24)
- `L82` 추격 박자와 전술 (2026-10-29 「2배 이상 빠르고 스마트하게」)
- `L113` 추격 성격·소리·닿으면 전투 (2026-10-30 「추격을 졸라 스마트하게」)
- `L149` 안전 장치 (도구가 거절하는 것)
- `L157` 알려진 한계

### `openwiki/getting-started.ko.md` — 23KB · 305줄 · ~7,032 토큰

- `L5` 처음 시작하기
  - `L23` AI와 함께 만들기
  - `L28` AI 없이 시작하기
  - `L36` 저장과 백업 복구
  - `L51` 막혔을 때
- `L62` 개발자용 명령
- `L80` 주요 기능
- `L93` 지원 맵 타일
- `L111` 사용법
  - `L113` EDIT 모드
  - `L120` PLAY 모드
  - `L127` 이벤트 명령
- `L139` 설치 가이드
- `L270` 아키텍처
- `L278` 데이터 스키마
- `L284` 테스트

### `openwiki/gothic-manor.md` — 10KB · 77줄 · ~3,072 토큰

- `L6` 파일 지도
- `L20` 다시 굽기 한 줄씩
- `L32` 관문에서 배운 것 (판정자 gemini-3.8-flash ×4 과반)
- `L37` 구성기·도구
- `L47` 적대적 시각 QA (1회, 2026-10-14)
- `L56` 버들항 화풍 맞추기 quality-b (2026-10-14)
- `L61` 조수 실시험 (gemini-3.8-flash high, 실제 입력창, 새 기본 프로젝트 → SQLite 저장 → 재로드, 2026-10-14)
- `L74` 남은 일

### `openwiki/growth-trees.md` — 23KB · 258줄 · ~7,090 토큰

- `L5` 소유권과 데이터
- `L33` 성장 트리 그림 (Phase 1, 2026-09-05)
- `L58` 명시적 프리셋 추가 (Phase 2, 2026-09-06)
- `L84` 런타임과 저장
- `L107` 통합 성장 런타임 (2026-09-06)
  - `L151` Runtime review corrections (2026-09-06)
  - `L168` 통합 API
- `L192` 연결 프리셋과 그래프 (2026-09-06)
- `L226` 검증

### `openwiki/harnesses/README.md` — 6KB · 70줄 · ~1,874 토큰

- `L6` 위치 (저장소 루트 기준)
- `L27` 규칙
- `L37` 기존 것과의 관계 (2026-10-01 실측)
- `L43` 하네스 목록
- `L61` 다른 실행기와 공유하는 하네스 목록

### `openwiki/harnesses/assistant-capability.md` — 59KB · 380줄 · ~18,190 토큰 · 통째읽기 잘림

- `L7` 실행 경로
  - `L9` 여덟 장르 제작 실측 (2026-10-08)
  - `L44` 집 문·마을 출구 수행 (2026-10-07)
- `L70` 단계
- `L91` 판정
- `L108` 작은 명령 50개 실행 매트릭스 (2026-10-11)
- `L131` 명령 가족 500개 (가족 100 × 변형 5)
  - `L146` InferHub DeepSeek V4.1 Flash 고정
  - `L173` 500 실측 재채점 (2026-10-23)
- `L196` 시각 검수
- `L211` 산출물과 확장
- `L217` 최초 실측 — 2026-10-05
- `L225` 제품 회귀와 오류 표시 controls (2026-10-05)
- `L231` 수정 확인 — 2026-10-05
- `L235` 월드맵 생성 MP4 증거
  - `L255` 대사창 읽기 보조 실조수 시험 — Argon 5문장 (2026-10-17, `set_dialogue_system`)
  - `L269` 미연시 추가 화면 실조수 시험 — Argon 5문장 (2026-10-17, `set_vn_extras`)
- `L285` 장면 교훈 묶음 (2026-10-22)
  - `L323` 첫 판 결과 (r2 기준선 → r3 수정 후)
  - `L370` 루프 1 숫자 (Sonnet 5.5 high 조수 대용, 2026-10-22)

### `openwiki/harnesses/battle-backdrop.md` — 10KB · 81줄 · ~3,016 토큰

- `L7` 무엇을 하나
- `L35` 규격 근거 (2026-10-29~30 실측)
- `L45` 시간·빛
- `L51` 조수 도구 `generate_battle_backdrop`
- `L59` 판정자
- `L64` 알려진 한계
- `L70` 시범 판 (마왕 편의점, 2026-10-30)

### `openwiki/harnesses/battle-trainer-sprites.md` — 7KB · 65줄 · ~2,108 토큰

- `L6` 결정 이력 (2026-10-15, 전부 사용자 지적으로 폐기·교체)
- `L17` 방법
- `L31` 역할
- `L35` 명령
- `L45` 계약
- `L49` 데이터 계약 (전투 화면 쪽)
- `L53` 출처·라이선스
- `L56` 파일
- `L60` 선택 기록과 위임 (2026-10-15)

### `openwiki/harnesses/beodeul-architecture.md` — 7KB · 45줄 · ~2,206 토큰

- `L3` 2026-10-05 사용자 반려와 새 후보 경로
- `L7` 여섯 건축 구조 추가 (2026-10-05)
- `L28` 일광 바닥 보정 (2026-10-04)
- `L33` 소규모 마을 구도 (2026-10-04)
- `L38` 나무/풀 깊이·연결 울타리·돌벽 통일 (2026-10-04)
- `L42` 박공 벽 정리와 기와 복원 (2026-10-04 사용자 정정)

### `openwiki/harnesses/beodeul-building-review.md` — 46KB · 211줄 · ~14,431 토큰

- `L5` 실행
- `L31` 원본 도트와 초안
- `L39` 공개 전 검증 관문
- `L53` 저장과 사람의 결정
- `L63` 근거와 제한
  - `L69` 긴 실행과 세션 종료
  - `L73` 서명한 실제 판정 이어가기
  - `L77` 검사용 그림과 출력 식별값
  - `L83` 제분소 지붕 재검수
  - `L91` 원형 제분소와 상태별 탭
  - `L97` 다양성 후보 round 6
  - `L121` JRPG 주택 형태 연구 · round 7
  - `L141` round 7 철회와 round 8 (2026-10-07)
  - `L153` round 9 — 창문 파사드 재저작 (2026-10-07)
  - `L161` round 10 — 통나무집 · 탑 접지 · 바닥 그림자 (2026-10-07)
  - `L173` 저장 · 설치 · 서비스 (2026-10-07)
  - `L186` 여러 타일셋 · 스토어 올리기 (2026-10-07)
  - `L205` 소품·울타리 프로필 `beodeul-props` (2026-10-07)

### `openwiki/harnesses/building-kit-city-plan.md` — 8KB · 86줄 · ~2,421 토큰

- `L8` 0. 전제 (이미 정한 것)
- `L15` 1. 건물 100종 → 부품 문법으로 옮기기
- `L39` 2. 성 — 내부가 복잡한 성을 만드는 규칙 (조사 종합)
- `L55` 3. 도시 — 생성 순서 (Watabou 소스 + 레벨 디자인 북)
- `L74` 4. 편집기로 가는 길
- `L81` 5. 비용·순서 판단

### `openwiki/harnesses/building-kit.md` — 99KB · 984줄 · ~29,868 토큰 · 통째읽기 잘림

- `L3` 왜
- `L11` 선례와 차이
- `L22` 범위 (이 PR)
- `L27` 폴더
- `L37` 공통 규칙 (seed `rules`, 모든 테마)
- `L46` 팔레트
- `L59` 부품 문법 (seed `items` — 세트 항목)
- `L73` 조립 (assemble.py)
- `L102` 관문 (gate.py) — 깨짐만 거른다
- `L108` 그리기 (drawer.py) — 그리는 쪽
  - `L137` 자체 점검 (dry.py)
  - `L152` 실제 판에서 나온 결함과 고침 (2026-10-22, fantasy-kingdom style-r1, Opus 9명)
- `L161` 사용자 반려와 문법 개정 (2026-10-22, style-r3)
  - `L183` 개정된 문법
  - `L199` 관문 변경
  - `L215` style-r3 시드
  - `L232` 그리기·미리보기
- `L238` 사용자 반려와 문법 개정 2 (2026-10-22, style-r3 반려 → style-r4)
  - `L240` 사용자 피드백 (style-r3, 2026-10-22)
  - `L251` 지붕 비율은 손으로 적지 않고 잰다 (`roofband.py`)
  - `L265` style-r4 관문 (A6 조임 · A9 · A10 · A11)
  - `L277` `roof.spire` — 첨탑
  - `L284` style-r4 시드
- `L294` 마을 합성 (`village`)
- `L309` 독립 검수 (review.py) — 판정하는 쪽
- `L319` 시트·고르기 (사람)
- `L337` 3/4 관문 (object-gate)
- `L342` 판 순서 (테마마다)
- `L352` 구현된 것 (2026-10-22, 이 PR)
  - `L354` 파일
  - `L361` 명령
  - `L382` 관문
  - `L396` 팔레트 (실측)
  - `L410` 시험
- `L433` 이 PR 의 완료 조건
- `L441` 2026-10-22 두 번째 반려 회차의 완료 조건
- `L450` 사용자 반려와 투영 개정 (2026-10-22, r1~r4 투영 반려 → style-r5 박공 정면)
  - `L452` 사용자 판정
  - `L465` 투영 기하 (조립 문법이 따르는 것)
  - `L472` 질량 종류 `kind`
  - `L491` 새 조립 관문 (어떤 옛 관문도 넓히지 않았다)
  - `L507` style-r5 시드 (줄 A·B·C 그대로)
  - `L519` 투영 안내도 (`projection.py`) — 우리 그림, 사용자 그림 아님
  - `L527` 그리기 모델
  - `L533` 검수 (review) 추가
- `L541` 북방 팔레트 확장과 style-r6 (2026-10-22, 버들항 설원 마을 비교)
  - `L550` 새 테마 램프 (출처 = `tiledata/beodeul-variants/snowfield/parts/*.png`, 모두 공용 시트에 있는 색)
  - `L568` refs 의 file 기준 그림
  - `L574` style-r6 시드
  - `L587` 시험 (`tests/test_projection.py`, 37개)
- `L596` 사용자 반려와 깊이 땅 개정 (2026-10-22, ㅜ자 집 → style-r7)
  - `L598` 사용자 판정
  - `L606` 깊이 땅 문법 (`grammar: "r7"`, A10 대체)
  - `L628` 짧은 박공 지붕 (A3·A6, 깊이 땅 판만)
  - `L636` ㅜ자 집 날개 깊이 — 왜 depth 1 이 아니라 4(북방 5)인가 — **반려됨(2026-10-22), 아래 「날개 이음」 절이 대신한다**
  - `L649` `reuseParts` — 옛 판 그림으로 새 레시피 조립
  - `L658` style-r7 시드 (세 테마, `grammar: r7`, `requireGableFront`)
  - `L673` 검수 (review) 추가
  - `L681` 투영 안내도 `projection-wing-depth`
  - `L688` 시험 (`tests/test_depth.py`)
- `L697` 사용자 판정: ㅜ자 집 날개 이음 (2026-10-22, style-r7 골 이음)
  - `L699` 판정
  - `L706` 문법 (`grammar: r7` 이상 — `AS.is_depth_grammar`, r8… 도 같다)
  - `L717` 골 조각 `roof.gf.valley` (세 테마 시드 항목)
  - `L728` A16 — 날개 이음 (깊이 땅 판, 날개 있는 레시피만)
  - `L742` 아직 안 그린 골 — 「needs drawing」 대체
  - `L755` 검수 — ONE HOUSE RULE · `detached_wing`
  - `L764` 시험 (`tests/test_wing_join.py`, 고친 `test_depth.py`·`test_projection.py`)
- `L774` 사용자 판정과 마감 단계 (2026-10-22, style-r7 → `finish`)
  - `L776` 사용자 판정
  - `L791` 마감 단계 (`finish.py`, `finish_kit/`)
  - `L814` `check.py` (a)~(g)
  - `L828` 하네스 재검사 — 에이전트 말을 믿지 않는다
  - `L838` `--finished` — 마감 그림으로 같은 길을 다시 간다
  - `L851` 시연 (2026-10-22, 실제 Opus 5.5 high 1회)
  - `L860` 시험 (`tests/test_finish.py`)
- `L870` style-r8 — 날개 골 `roof.gf.valley` 그리기 (2026-10-22)
  - `L872` 판
  - `L878` drawer — reuseParts 판은 빠진 항목만 그린다 (고침)
  - `L886` 결과 (실측)
  - `L906` 마감 시연 2 (2026-10-22, 실제 Opus 5.5 high 각 1회)
- `L920` 북방 마을 r2 — 버들항 설원 원본 조각으로 깔기 (2026-10-22)
- `L932` 덩어리 모형 → 실제 건물 `massing` (2026-10-25)
  - `L936` 한 건물 = 데이터 두 파일
  - `L944` 명령 (`python3 src/harnesses/building-kit/massing.py …`)
  - `L959` 판정 규칙(감독은 판정하지 않는다)
  - `L966` 조수 배치
  - `L970` 결과 (2026-10-25, 묶음 p1~p21)
  - `L974` 적대 VQA 뒤 다시 그림 (2026-10-25, 묶음 p22~p27)

### `openwiki/harnesses/cast-portrait.md` — 14KB · 155줄 · ~4,326 토큰

- `L24` 프로젝트별 캐스트 규격
- `L48` 아스트라 규격 (측정값, 2026-10-25)
- `L68` 검사가 실제로 잡는 것 (r3 실측)
- `L91` 반복 눈가림 검수 (`review`, 관문)와 보정 (`calibrate-review`)
- `L133` 기록 위치
- `L144` 아스트라 박사 이력

### `openwiki/harnesses/charset-actor.md` — 39KB · 217줄 · ~11,759 토큰

- `L69` 검증된 걷기 인물의 행동 포즈 (2026-10-06)
- `L91` CT·FF6풍 직업 인물 칩 Heroes1 — pick-6 채택 8종의 공용 번들 설치 (2026-10-16)
- `L111` 현대 연애물 인물 칩 Modern1~3 — 24종의 공용 번들 설치 (2026-10-16)
- `L128` 몬스터 세계 사람 칩 ScarloxyPeople1~4 — 기존 Scarloxy People 칩 변형 25종 (2026-10-16)
- `L149` 몬스터 세계 사람 칩 2차 — ScarloxyPeople5~10, Argon 부분 편집 확대 43종 (2026-10-16)
- `L172` 몬스터 세계 사람 칩 3차 — 1차 스크립트 칩 12종 재제작 (2026-10-16)
- `L190` 몬스터 세계 사람 칩 4차 — char-gen 갤러리 4 합성 22종, ScarloxyPeople11~13 (2026-10-17)
- `L201` REFMAP 변형 인물 칩 RefmapDoll1~ — char-gen `refmap` 종이 인형 2,567종 (2026-10-28)

### `openwiki/harnesses/dungeon-chipset.md` — 46KB · 333줄 · ~13,850 토큰

- `L3` 왜
- `L13` 흐름
- `L22` 줄(line) — 컨셉마다 따로 고른다 (2026-10-08 사용자 결정)
- `L46` 명령 (`npm run harness -- dungeon-chipset …` 또는 `python3 src/harnesses/dungeon-chipset/harness.py …`)
- `L58` 파일
- `L72` 잠금 팔레트 — 어떻게 뽑았나
- `L80` 동굴 문법 (dot.py)
- `L90` 기계 관문 (gate.py) — 깨짐만 거른다
- `L103` 시트
- `L108` 외곽선 규칙 (확정 2026-10-08)
- `L144` 판 style-r1 (2026-10-08)
- `L156` 판 cave-r1 (2026-10-08) — 줄마다 후보 2개
  - `L184` cave-r1 2차 수정 (2026-10-08, 사용자 「그래 그럼 수정하고」)
- `L198` 판 edges-r1 (2026-10-08) — 줄마다 후보 2개
  - `L218` edges-r1 2차 수정 (2026-10-08, 감독 지적 4건)
- `L234` 판 props-r1 (2026-10-08) — 던전 기물 27(일반 25 + 대형 2)
- `L252` 다음 판
- `L256` gap bake handoff (2026-10-23)
- `L311` 2026-10-27 판: 얼음굴 벽 gap-ice-r5 · 마계 바닥 theme-floors-r12 · 동굴 종유석
  - `L324` 보류(parked) — 다음 판이 이어받을 것

### `openwiki/harnesses/dungeon-concepts-research.md` — 30KB · 180줄 · ~9,078 토큰

- `L12` 0. 요약
- `L20` 1. 던전 원형 24
  - `L22` 1a. 사례·공간 문법·분위기
  - `L51` 1b. 고유 부품·기믹 → 필요한 타일 상태
- `L82` 2. 줄 A·B·C에 붙이기와 새 줄
  - `L84` 2a. 원형마다 맡을 줄
  - `L101` 2b. 새 줄 후보
- `L113` 3. 16px 3/4 칩셋으로 옮길 때의 함정
  - `L115` 3a. 벽·천장·층차
  - `L125` 3b. 기믹 타일의 상태·장면 수
  - `L139` 3c. 런타임이 맡는 것 (근거 경로)
- `L152` 4. 제안 웨이브 순서
- `L173` 출처

### `openwiki/harnesses/game-concepts.md` — 6KB · 65줄 · ~1,647 토큰

- `L6` 규칙
- `L14` 단계
- `L34` 라인업 — 지금 칩셋으로 지을 수 있는 것만 내보낸다
- `L48` 데이터 폴더
- `L62` 시드

### `openwiki/harnesses/interior-prop-derivations-operations.md` — 22KB · 289줄 · ~6,794 토큰

- `L6` 1. 실제 대상을 먼저 확인한다
- `L43` 2. API와 쓰기 영향
- `L71` 3. 설정을 바꿀 때
- `L99` 4. 읽기 전용으로 선택·공용 판본 확인
- `L126` 5. 증상별 복구
  - `L150` 전용 테마 검사와 오래된 보고서 (2026-10-06)
- `L162` 6. 백업·이관
- `L188` 7. 검증과 PR 완료 보고
- `L203` 2026-10-05 화면에서 저장 상태 확인
  - `L217` 그림 우선 UI 후속 배포 (2026-10-05)
  - `L230` 2026-10-05 제작 풀의 콘텐츠 경로 누락 복구
  - `L270` 2026-10-05 마을 300종과 크기 변경 선택의 게시 복구

### `openwiki/harnesses/interior-prop-derivations.md` — 36KB · 428줄 · ~11,119 토큰

- `L9` 1. 사용자가 결정한 제품 흐름
- `L32` 2. 세 계층과 현재 완료 범위
- `L45` 3. 수정할 때 찾을 파일
- `L65` 4. 정본 데이터와 파일 관계
- `L86` 5. ID·원본·묶음·자식의 계약
- `L111` 6. 자동 제안 규칙
- `L131` 7. 묶음 형식과 방향 기하
- `L151` 8. seed·부분 재그림·검수
- `L170` 9. 크기 파생과 기존 크기 변경은 다르다
- `L181` 10. 확정·자식 저장의 실제 순서
- `L199` 11. 모션 저장·재로드·패킹
- `L225` 12. 공용 등록과 안정적인 칸 번호
- `L251` 13. 다음 작업의 한계·우선순위
- `L274` 14. 이어받는 에이전트의 시작·완료 기준
- `L286` 15. 기존 근거와 세션 연혁
- `L303` 2026-10-05 기물 선택 화면과 공용 반영 확인
  - `L332` 실제 DB와 픽셀 확인
  - `L348` 2026-10-05 후속 개편: 이름·그림 먼저, 더블클릭으로 다음
  - `L376` 2026-10-05 크기 변경 후 다시 뽑기
- `L408` 신규 제작 묶음의 원본 검사 (2026-10-06)
  - `L417` 검수 수치의 적용 범위

### `openwiki/harnesses/interior-props.md` — 9KB · 99줄 · ~2,822 토큰

- `L9` 에디터 공방 (아래 서버 하네스와 저장 경로가 다름)
- `L20` 서버 하네스의 파생 (2026-10-04)
- `L34` 서버 확정 → 공용 SQLite 자동 등록 (2026-10-04)
- `L65` 자동 파생 제안 화면 (2026-10-04)
  - `L85` 공간 감독의 공급자 오류 복구 (2026-10-05)
  - `L91` 부착 소품의 실제 받침 대기 (2026-10-06)

### `openwiki/harnesses/interview-scene-bank.md` — 56KB · 197줄 · ~17,387 토큰 · 통째읽기 잘림

- `L19` 제작과 검수
- `L53` 앱 연결
- `L78` 현재 제작 결과

### `openwiki/harnesses/joseon-baram.md` — 15KB · 105줄 · ~4,358 토큰

- `L8` 이럴 때 쓴다 / 쓰지 않는다
- `L13` 단계 (`npm run harness -- joseon-baram <단계>`)
- `L28` 실내·궁 내부 키트 (조각 접두 `in_` · `pal_`)
- `L33` 시드와 기록
- `L43` 작업 순서 (조각을 고쳤을 때)
- `L59` 지도 id 15장 (시드 `maps`, 시트순번 = 합치는 순서)
- `L73` 지도 빌드 주의 (`map`)
- `L78` 16구역 적대 검수 (`review zones`)
- `L83` 함정
- `L96` 파일

### `openwiki/harnesses/jp-city.md` — 45KB · 242줄 · ~13,553 토큰

- `L8` 흐름
- `L19` 명령 (`python3 src/harnesses/jp-city/harness.py …` 또는 `npm run harness -- jp-city …`)
- `L32` 파일
- `L44` 시드 항목 (kind: `building-part` 건물 외형 · `prop` 소품 · `tilesheet` 바닥 타일 · `kit` 여러 칸 부품 + 조립 예)
- `L55` 기계 검사 (check.py) — 깨짐만 거른다
- `L61` 함정
- `L70` pick 절차 (사람)
- `L76` 복제에서 바꾼 점 (modern-chipset 대비)
- `L79` 거리 구성기 조화 검수 — 적대 시각 QA 한 판 (2026-10-13)
- `L99` 일본 시골(jp-inaka) 쇼케이스 적대 VQA R4 (2026-10-20)
- `L119` 일본 시골(jp-inaka) R5 — 버들항 수준 재작화 (2026-10-20)
  - `L134` R6 — 세로(남북) 깊이 (2026-10-20)
  - `L145` R7 — 지붕 높이 상한·투영 밑그림 (2026-10-20)
  - `L155` R14 — 손 도트 유지·Opus 독립 VQA 관문·굽기 (2026-10-21)
- `L163` 대나무(대숲) 재작화 — R4 적대 VQA (2026-10-20)
- `L174` 3/4 깊이 지붕·탈것 윗면 (2026-10-20, 사용자 「가로 공간감만 있다」)
- `L186` 나무 composer 숲 `jp_forest_r4` (2026-10-20, PR #3058 — 활엽만, 굽기 보류)
- `L207` 붓으로 칠하는 숲 오토타일 `jp_forest_r3` (2026-10-20, PR #3058 — 그림 머지 보류)
- `L218` 이어지는 숲 팩 `jp_forest_pack` (2026-10-20, PR #3058 — 그림 머지 보류)
- `L232` 대나무(대숲) 재작화 — R4 적대 VQA (2026-10-20)

### `openwiki/harnesses/map-objects.md` — 5KB · 31줄 · ~1,440 토큰

- `L7` 흐름
- `L19` 번호 이주
- `L27` 시험

### `openwiki/harnesses/modern-chipset.md` — 12KB · 128줄 · ~3,568 토큰

- `L8` 왜 만들었나 (2026-10-01)
- `L14` 흐름
- `L24` 파일
- `L34` 함정
- `L39` 도시 조립 (2026-10-03)
- `L47` 굽기 `bake` → 번들 타일셋 modern_city (2026-10-03)
- `L54` 승인 주차장 두 면 공용 등록 (2026-10-05)
- `L76` 기존 칩 확장 실험 (2026-10-05)
  - `L90` 미완성 판정의 후속 처리
  - `L102` 공급자 오류 재개 (2026-10-05)
  - `L113` 전체 시설 Allow 이후 공용 등록 (2026-10-05)

### `openwiki/harnesses/monster-collect-species.md` — 63KB · 353줄 · ~19,132 토큰 · 통째읽기 잘림

- `L28` 빠른 시작
  - `L49` Alpha/고정 격자 집중 확인 (2026-10-04)
- `L62` 캠페인·전투 배선 (2026-10-15) — 「번들에 종이 있으면 그 그림」
- `L83` 파일
- `L106` 디자인 규칙 (2026-10-16 — 외부 시험자 지적 이후)
  - `L129` 눈 규칙 (판본 3, 2026-10-16 — 사용자 지적 「몬스터에 문제가 많다, 눈이라던가」)
  - `L147` 판본 4 — 귀여움 우선·흰 하이라이트 필수 (2026-10-16, 사용자 「눈이 안 비치니까 징그럽다, 귀여운 거 위주로」)
  - `L156` 판본 5 — 종별 눈 표와 눈 자리 검사 (2026-10-20, 사용자 「몬스터 눈알 교정」)
  - `L199` 격자 계약 (2026-10-16 — 외부 시험자 「픽셀 그리드부터 맞게」)
- `L208` 왜 이렇게 만드는가 (2026-10-01 실험, `qa-runs/hand-monster/` 시안)
- `L217` 애니메이션 — 대기는 움직이고, 큰 동작은 한 줄로 생성한다 (2026-10-01 비교 시험)
  - `L233` 공격 방향 계약 (`animation.direction`)
  - `L244` 엔진 비트 → 프레임 (`actions.*.keys`)
  - `L251` 입·손 자리 (`anim.json` 의 `emit`)
  - `L258` 스킬별 공격 = 자세 몇 가지 × 스킬 매핑 (`anim/poses.ts`)
- `L271` 검사 (`build` · `check`)
- `L290` 전투 배치 (`src/harnesses/monster-collect-species/qa/battle-layout.css`, 엔진 미반영)
- `L296` 시험
- `L305` 아직 없는 것
- `L312` 따라다니기 걷기 칩 (2026-10-15)
- `L323` 종 다섯 면 단일 정본 계약 (2026-10-18 — 사용자 「몬스터 하나에 서로 다른 이미지들이 혼재되어 있다. 몬스터 장르 전용 하네싱」)
- `L333` 아스트라 스타터 다시 그리기 (2026-10-23 — 사용자 「오프닝에서 뜨는 3개의 몬스터 하나도 안 귀여움」)
- `L345` 아스트라 스타터 세 계통 전면 교체 (2026-10-24 — 사용자 「좀 더 포켓몬 느낌으로」 → 「이제 괜찮네.. 이거로해」)

### `openwiki/harnesses/murim-chipset.md` — 34KB · 285줄 · ~10,326 토큰

- `L8` 줄 (line) — 컨셉 계열
- `L27` 흐름
- `L45` 명령 (`npm run harness -- murim-chipset …` 또는 `python3 src/harnesses/murim-chipset/harness.py …`)
- `L61` 파일
- `L76` 팔레트 (잠금)
- `L98` 관문 (gate.py) — 깨짐만 거른다
- `L123` 시트 (`~/claude-viz/murim-<판>.html`, 자체완결)
- `L131` 시드 (`harness-data/murim-chipset/seed.json`)
- `L159` 그리는 법 (후보 코드)
- `L168` frame-r1 (골조 판) 실측
- `L184` inn-r1 (객잔 살림 판) 실측
- `L218` props-r1 (기물 판) 실측
- `L244` 외곽선 규칙 (확정 2026-10-08)
- `L278` 함정

### `openwiki/harnesses/native-space-installation.md` — 17KB · 237줄 · ~4,297 토큰

- `L10` Pure project packet authoring
- `L59` Frozen POTIONS runtime draft preparation
- `L108` Preconditions and ownership
- `L124` Save and reload
- `L144` Caller and limitations
- `L164` Isolated wand shelf vacancy request
  - `L172` Reviewed shelf pickup in playable drafts (2026-10-06)
  - `L178` Unchanged occupied shelf re-review
  - `L199` Public draft deployment
  - `L215` Wand scene panels and trial timing

### `openwiki/harnesses/object-gate.md` — 89KB · 642줄 · ~26,964 토큰 · 통째읽기 잘림

- `L5` 던전 기물 화풍 묶음 beodeul_dungeon · 사용자 합격 기둥 · column 규칙 실측 (2026-10-29)
- `L32` 화풍 기준은 후보 칩셋의 묶음으로 (2026-10-23)
- `L48` 공방 「한 번에 만들기」 단계 `workshop` (2026-10-23)
- `L58` Opus 최종 판정 (사용자 결정 2026-10-21)
- `L119` jp_city 굽기: 이미 출하된 그림 동결 (2026-10-21, 감독 결정·사용자 위임)
- `L141` (대체됨) 사람 허용이 최종 (사용자 결정 2026-10-20, 옵션 A) — 2026-10-21 Opus 최종 판정으로 대체
- `L186` 왜
- `L198` 구성
  - `L210` 저장소 위치 — 개별 저장소 `MovieHolic-Plex/object-gate` (2026-10-20 분리)
- `L232` 판정
- `L244` 보정
- `L257` 시트 칸 관문
- `L264` 쓰는 법
- `L281` 부품은 조립 건물로 (2026-10-13)
- `L288` 2026-10-14 개편 — 한 번에 3/4 + 버들항 화풍
  - `L301` 보정 결과(프로필 `473db36f963972c9`, rejected, 기록 `calibration/run-473db36f963972c9.json`)
- `L314` Sonnet 5.5 high 로 판정자 교체 (2026-10-14~15) — 보정 결과 rejected
- `L335` 우회 길 제거 (2026-10-15)
- `L349` 2026-10-15 규칙 v6·v7 (작업자 G, 전권 위임) — 3/4 반쪽 통과, 프로필은 아직 rejected
  - `L351` 판정 구조 (실험으로 정함)
  - `L366` 보정 표본 등급 (`calibration/tiers.json`)
  - `L369` 보정 결과 (프로필 `03c2e291e607b97c`)
  - `L381` 현재 배선 (2026-10-15 실측, `grep refusal|require_pass|require_all`)
  - `L391` 비-기물(이펙트·초상·캐릭터 칩·트레이너·월드맵 아이콘)이 지나는 길 — 현재 해석
- `L397` 후속 2·1 — 얇은 소품 기준 그림 보강 + 새 정상 35장 (2026-10-16, 프로필 `e48906a2b68b219a`, 여전히 rejected)
- `L411` 정면형 소품 종류 `front_prop` (규칙 v8, 2026-10-16) — 보류로만 간다, 프로필은 여전히 rejected
- `L426` front_prop 사람 승인 기록 (2026-10-16, 사용자 결정 옵션 2) — 승인 입구만 열었고 프로필은 여전히 rejected
- `L437` 2026-10-20 1차(철회됨) — 프로필 `ee216f0de5822996` calibrated 로 머지했다가 정정 (규칙·지시문 변경 없음)
- `L474` 2026-10-20 정정 — 선택 편향 철회, 블라인드 화소 규칙으로 다시 재니 rejected
- `L504` 2026-10-20 규칙 v9 — 판정자 답 근거로 고침 + 얼린 새 숨김 fresh4 로 최종 측정 (프로필 `1db03a95223e5b0b`, rejected)
- `L549` 보류(사람 확인) 승인 길 — 검토 화면 `serve-holds` (2026-10-20 낮, 같은 날 저녁 「사람 허용이 최종」 으로 넓어짐 — 위 절이 현행)
- `L598` 규칙 v10 — 좌석 등받이·팔걸이 면제 (사용자 결정 2026-10-20, 프로필 `4d8774b517f41638`, rejected)

### `openwiki/harnesses/pokemon-character-casting.md` — 25KB · 205줄 · ~6,489 토큰

- `L3` Campaign NPC adoption and natural entrances (2026-10-06)
- `L63` Portable harness (2026-10-05)
- `L84` Legacy editor adapter: start and reuse
- `L99` Current distinct-body wave (supersedes first wave)
- `L115` Human review
- `L126` Freshness and shipping gate
- `L134` Focused verification
- `L144` Newly authored candidate workflow (2026-10-05)
- `L159` Template edits (current strategy, user-directed 2026-10-05)
- `L175` Complete sixteen-role template collection (2026-10-05)
- `L187` Theme townsfolk and trainers (theme-cast-v1, 2026-10-07)

### `openwiki/harnesses/pokemon-character-motion.md` — 35KB · 247줄 · ~9,580 토큰

- `L5` 원본 규격과 엔진 컨테이너를 구분한다
- `L23` 실행과 저장 경계
- `L50` 트레이너 정적 그림64×64
- `L97` 생성 원본 가져오기
- `L105` 구조와 시각 관문
- `L113` 오프닝 generated clip
- `L128` 해시와 집중 실행 증거
  - `L141` Generated-source defaults and shipping registration (2026-10-04)
  - `L145` Actual shipping evidence
- `L149` Direct native Python authoring (2026-10-04, supersedes sampled cast)
- `L167` Hostile hero quality gate — one-character refinement
- `L206` Actual chipset comparison before art approval
- `L216` Further hero craft revision
- `L222` User rejection of v14 and full native pose rewrite
- `L232` Explicit original-reference fidelity mode
- `L244` User-controlled NPC casting

### `openwiki/harnesses/romance-scene.md` — 42KB · 228줄 · ~12,087 토큰

- `L5` Entry and contract
- `L13` Authoring and rejection
- `L25` Art direction and compact dialogue (2026-10-04)
- `L35` Maker-owned repair loop (2026-10-04)
- `L45` Modern start stage and stage designation (2026-10-16 romance audit I2/I3/O1)
- `L54` Reproduction
- `L69` 하루 루프 뼈대 `system.socialLoop` (2026-10-16, 현대 연애 병목 감사 2번)
- `L80` 연애 인터뷰 기본값 (2026-10-16, 5번)
- `L84` 다인 루프 뼈대 · 2차 수리 (2026-10-16)
- `L97` 소재 키아트 검사의 입력 (기획서 없는 판)
- `L102` 엔딩 분기 · 호감 통일 (2026-10-16 romance-fix-4, R01/R02)
- `L114` 제목 · 완료 게이트 · 엔딩 화면 작은 줄 (2026-10-16 romance-fix-4, R03/R05/R08)
- `L123` HUD 가림 · 짧은 이름 (2026-10-16 romance-fix-4, R06/R09)
- `L128` 남은 결함 수리 (2026-10-17 fix-leftovers, romance-real-2 R04/R07/R10/R12/R14/R15)
- `L139` 사물 이름 NPC 에 사람 흉상이 붙는 것 차단 (2026-10-17 romance-loop-4, R3 rom-a)
- `L144` 기한 엔딩의 기본 결말은 조건이 없어야 한다 (2026-10-17 romance-loop-1, R1 「아무도 안 만남」)
- `L155` 동사 없는 한 줄 요청도 완료 검사를 받는다 (2026-10-17 romance-loop-1, R1 rom-c — R03 재발)
- `L161` 소재별 연애 타이틀 키아트 (2026-10-17 romance-loop-2, R1-06)
- `L176` 자동 엔딩 뒤에 남은 뼈대 엔딩 (autoPlay 목표)
- `L183` 엔딩이 겨눈 인물의 호감이 오를 곳 (2026-10-17 romance-loop-2, `romance-ending-npc-unreachable`)
- `L193` 인물 엔딩이 들어서면 일반 해피는 지운다 (romance-loop-3)
- `L200` 인물 엔딩 자동 생성 (2026-10-17 romance-loop-2, rom-c)
  - `L207` 인물 엔딩은 인물을 놓는 순간 얹는다 (romance-loop-3)
- `L219` 오프닝·대사 좌표·물가 맵 검사 (2026-10-17 romance-loop-1)

### `openwiki/harnesses/space-craft.md` — 7KB · 69줄 · ~2,079 토큰

- `L6` 단계
- `L21` 판정 층 (1~5 구현, 2026-10-07)
  - `L40` 1회차에서 나온 것 (2026-10-07, 과제당 1회)
- `L47` 무림
- `L52` 폴른 스타 세 방 과제 (2026-10-22)
- `L63` 던전 9요청 (`dg-*`, 2026-10-22~23)

### `openwiki/harnesses/super-harness-integration.md` — 18KB · 210줄 · ~5,630 토큰

- `L6` 운영 계약
- `L19` 실행과 경로
- `L56` API
- `L70` 공간 제작에서의 공용 재료 사용
- `L78` 이관·복구와 확인
- `L98` 공간의 실시간 진행 표시 (2026-10-05)
- `L115` 부품 선택의 판단 순서 (2026-10-05)
- `L129` 공간 예시 평가 (2026-10-05, 부품 선택 화면 개선)
- `L151` 검수 응답 형식 오류의 복구 (2026-10-05)
- `L176` 전체 제작 통합 방향 (2026-10-05)
- `L197` 버들항 건물 검수 탭 (2026-10-07)

### `openwiki/harnesses/super-harness.md` — 102KB · 1063줄 · ~32,225 토큰 · 통째읽기 잘림

- `L9` 왜 (2026-10-03 실측)
- `L16` 조수 쪽 연결 (제품 코드)
- `L29` 제작 전 공간 기획·텍스트 도면 관문 (2026-10-04)
- `L52` 제작 전 재료 관문 (2026-10-04)
- `L74` 공간과 시각 관문
- `L87` 한 바퀴
- `L115` 화면
- `L126` 운영
  - `L140` 기획 두 건 실운영 표본 (2026-10-04)
  - `L149` 큰 공간의 세부 도면·기획 이미지
  - `L160` 실제 후보 표시와 참고자료 연결
  - `L174` 그림 실행은 감독이 직접 한다
  - `L190` 칩 선택 화면과 조립 예시 (2026-10-04)
  - `L214` 주차장 조립 검수 반려와 선택 관문 (2026-10-04)
  - `L235` 칩 검수 피드백 → 자동 재생성 루프 (2026-10-04)
  - `L271` 표본 도면과 공간 전체의 품질 관문 v2
  - `L300` 반복 실패 재설계·시점 표본·전후 비교 v3 (2026-10-04)
  - `L333` 시점 표본 합격 후 저장 오류 복구 (2026-10-04)
  - `L342` 고정 합격 기준·권고 분리·판정 충돌 재검수 (2026-10-05)
  - `L361` 선택 구역의 설치 완료 근거
  - `L369` 확장판 미완성 → 실제 수정 큐 (2026-10-05)
  - `L391` 그림 중심의 Allow / Deny (2026-10-05)
  - `L418` 운영 오류의 책임과 지정 공간 실행기 (2026-10-05)
  - `L452` open 공간도 면적 축소를 검토한다 (2026-10-05)
  - `L469` 대기 원인과 실제 그림 실행 구분 (2026-10-05)
  - `L488` 요청 공간 병렬 운영과 축소 검수 보정 (2026-10-05)
  - `L518` 첫 화면의 실제 진행·산출물 카드 (2026-10-05)
  - `L551` 완성 그림 뒤의 기술 실패와 복구 (2026-10-05)
  - `L582` 사용자에게는 실제 타일 공간 데모를 제공한다 (2026-10-05)
  - `L610` Native 작업 문맥 격리 (2026-10-05)
- `L620` 키워드에서 계속 만드는 공간 흐름 (2026-10-05)
- `L654` 공급자 오류 자동 복구 (2026-10-05)
  - `L696` 마무리 우선 배정·실제 저장 상태 (2026-10-05)
  - `L723` 동시 공간 6개와 원본 이미지 확대 보기 (2026-10-05)
- `L741` 고유 테마 전용 세트 관문 (2026-10-05)
  - `L763` 누적 coverage·보존 원본·재검수 영수증 (2026-10-06)
- `L797` 제작 범위 분기·우선 세계관·컨셉아트 (2026-10-05)
- `L829` 승인 대기와 초안 제작 분리 (2026-10-06)
- `L846` 전용 세트의 독립 재료 묶음 실행 (2026-10-06)
  - `L859` 전용 세트의 여러 제작 묶음 누적 (2026-10-06)
  - `L882` 제작 전 바닥 종류 검사 (2026-10-06)
  - `L928` 전체 데모 수정 중 재료 진행 표시 (2026-10-06)
  - `L961` 실제 조립 장면을 첫 화면에 표시 (2026-10-06)
  - `L970` 부품 검수의 후속 장면 선행 요구 방지 (2026-10-06)
  - `L979` 부분 교체 후 보존할 원본 (2026-10-06)
  - `L991` 전용 인물 런타임 포장 (2026-10-06)
  - `L1009` 전체 데모 수정은 전체 데모로 재검수 (2026-10-06)
  - `L1019` 선택 DB를 제작 명세에 결합하지 않는다 (2026-10-06)
  - `L1026` 실행 가능한 초안 노출 (2026-10-06)
  - `L1039` 보존 원본 영수증 사전 확인 (2026-10-06)
  - `L1047` 검수 부가 지적과 응답 복구 (2026-10-06)
  - `L1056` 테마 전용 팩을 공용 번들이 채운 경우 — 해리포터 → wizarding_world (2026-10-07)

### `openwiki/harnesses/town-props-300.md` — 29KB · 532줄 · ~8,453 토큰

- `L8` 구성과 참고 범위
- `L22` 실행과 재개
- `L44` 429 전송 실패 재시도
- `L59` 그림 계약
- `L66` 공용 DB와 조수의 사용
- `L80` 목록 (발밑 칸 × 캔버스 높이)
  - `L83` 현대 거리
  - `L98` 현대 식료품점
  - `L113` 현대 카페·식당
  - `L128` 현대 보건·안전
  - `L143` 현대 공공시설
  - `L158` 현대 정비 공방
  - `L173` 현대 취미·문화
  - `L188` 현대 생활 세부
  - `L203` 현대 물류·서비스
  - `L218` 중세 통·목공
  - `L233` 중세 가죽·직물
  - `L248` 중세 식품 공방
  - `L263` 중세 시장·측량
  - `L278` 중세 항구·어업
  - `L293` 중세 농가·마을
  - `L308` 중세 길드·서기
  - `L323` 중세 수도원·구호
  - `L338` 중세 경비·마구
  - `L353` 시간여행풍 축제
  - `L368` 시간여행풍 발명 공방
  - `L383` 시간여행풍 변경 마을
  - `L398` 시간여행풍 미래 거주지
  - `L413` 시간여행풍 고대 마법 도시
  - `L428` 시간여행풍 선사 교역
  - `L443` 증기마도풍 공업 마을
  - `L458` 증기마도풍 설산 광산
  - `L473` 증기마도풍 항구·철도
  - `L488` 증기마도풍 오페라 뒷무대
  - `L503` 증기마도풍 도시 야간
  - `L518` 증기마도풍 생활 마도기술

### `openwiki/harnesses/wand-runtime-preparation.md` — 3KB · 53줄 · ~826 토큰

- `L38` Unresolved native dependency

### `openwiki/harnesses/worldmap-icons.md` — 5KB · 65줄 · ~1,644 토큰

- `L6` 입구
- `L21` 호스트 공용 DB 등록 (2026-10-04)
- `L38` 사람 선택만 굽기
- `L52` 에디터·조수
- `L60` 2026-10-04 근거

### `openwiki/horror-authoring.md` — 20KB · 194줄 · ~6,195 토큰

- `L8` 저작 표면
- `L32` 데이터와 런타임
- `L49` 연결 방 추격 연속성 (2026-09-06)
- `L75` NPC 발견 이벤트와 공통 전투 소유권 (2026-09-06)
- `L135` 가구 밀기 애니메이션 (2026-09-05 후속 체험 수정)
- `L158` 실내 제작과 검증
- `L169` 검증 경로
- `L183` 전체 게이트 후속 수정 (2026-09-05)

### `openwiki/i18n.md` — 7KB · 89줄 · ~2,196 토큰

- `L7` 언어가 정해지는 순서
- `L24` 구조
- `L43` 왜 DOM 계층 번역인가
- `L52` 코드가 화면 글자를 다시 읽을 때 (지켜야 할 계약)
- `L58` 문장을 조각으로 이어 붙이지 마라
- `L68` 새 문구를 추가하면
- `L83` 알려진 한계

### `openwiki/joseon-baram.md` — 35KB · 186줄 · ~10,491 토큰

- `L16` 재실행 한 줄 (국내성 맵이 다시 바뀌면)
- `L32` 변환기와 시트 합치기
  - `L38` 두 시트를 한 시트로 (칸 번호 불변 규칙)
  - `L48` 동결 장부 (`tiledata/joseon-village/frozen-layout.json`) — 새 시트를 더하는 법
- `L60` 통행 (X/C/F)
- `L82` 등록 배선 (한 곳이라도 빠지면 어느 프로젝트에선가 빈 화면)
- `L92` 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항목)
- `L98` 검증 (실측, 임시 폴더 프로젝트, 14맵 합친 판)
- `L117` 사냥터·동굴·실내·궁 내부 (2026-10-04, 새 11장)
- `L143` 새 판이 오면 손볼 곳
- `L149` 새 장소 12장 (2026-10-04, 사냥터·동굴·실내 방 6·궁 내부 4)
- `L176` 조수 v2 가 짓는 길 (2026-10-28)
- `L180` 한계

### `openwiki/jp-city.md` — 108KB · 511줄 · ~32,141 토큰 · 통째읽기 잘림

- `L6` 식별자
- `L17` 파일
- `L24` 굽기 규약 (TS 가 기대하는 것)
- `L39` 기존 프로젝트 갱신 규칙
- `L49` 행인·팔레트
- `L58` 조수 정책
- `L62` M3 건물 조립 도구 (`build_jp_city_building`)
  - `L67` 파일
  - `L78` 부품 사전 생성법
  - `L90` 조립 규칙 (`Kit` 의 TS 이식)
  - `L99` 입력 스키마 (`build_jp_city_building`)
  - `L117` 오류 코드
  - `L132` 차이 증명·변조 시험 실행
  - `L142` 알려진 한계
  - `L150` 조수 정책 (M3 변경)
  - `L155` 조수 연결 (2026-10-04 조사·수정) — 조수가 이 칩셋과 건물 도구를 «고르는» 길
- `L192` 손 도트 건물 69종 + 상점가 줄 8종 (`jp-bldg-*`, 블록 `buildings`) — 2026-10-06
  - `L197` 그림 원본 (`scripts/content/jp-city/houses/`)
  - `L204` 굽기 (`blocks/buildings.py`, `BLOCK_ORDER` 넷째)
  - `L214` 조사 반영 (2026-10-06 둘째 판)
  - `L219` 한계
- `L222` 손 도트 거리 시설 60종 (블록 `street_hand`, `BLOCK_ORDER` 다섯째) — 2026-10-06
- `L233` 동네 한 장 예제 (`scripts/content/jp-city/maps/town.mjs`) — 2026-10-06
- `L242` 小学校 블록·예제 맵 (블록 `school`, `BLOCK_ORDER` 여섯째) — 2026-10-07
- `L249` 적대적 검증 관문 (`scripts/content/jp-city/gate/adversarial_gate.py`) — 2026-10-07
- `L255` kitmap 공용 검사기 (`scripts/content/jp-city/maps/kitmap.mjs`)
- `L262` 탈것 — 차·버스·노면전차·전철·지하철 (2026-10-07)
- `L280` 노면전차 거리·지하철역 블록 + さくら町駅 예제 (2026-10-07)
- `L291` 일본 집 실내 (블록 `interior_*` 7개, `BLOCK_ORDER` 끝) — 2026-10-07
- `L332` 일본 실내 2묶음 — 가게·공공·집 보강 + 거리 문 잇기 (2026-10-07)
- `L344` 지면 오토타일은 맵 밖을 같은 재료로 센다 (2026-10-20)
- `L353` 실제 거리 조사 (2026-10-06)
- `L357` AI 참고문서 (10용도 · 61쪽 · 그림 167장)
  - `L374` 굽는 법 (한 줄)
- `L389` 거리 구성기 `compose_jp_city_street` (2026-10-12)
- `L401` 하천 거리 (2026-10-12)
- `L407` 일체형 1층 정면 (2026-10-12)
- `L414` 고층·거리 소품 (2026-10-13)
- `L419` 조수 지침: compose 우선 (2026-10-13)
- `L423` 상가 띠 3/4 관문 = 조립 건물 영수증 (2026-10-13)
- `L430` 빈터 쓰임 단계 `fillLotUses` (2026-10-14)
- `L441` 일본 집 보강 8종 `interior_house3` — object-gen, 3/4 관문 보류 (2026-10-21)
- `L455` 시설 실내 6묶음 — 병원·학교 별관·IT 사옥 + 방 구성(program)·길 고르기 (2026-10-14)
- `L473` 숲 — 조수 도구 `paint_jp_forest`·지역/거리 숲·참고문서 `jp-forest` (2026-10-21, PR #3058)
- `L497` 거리 계단 — 육교·옆 계단·단상·벽 사다리 (블록 `street_stairs`, `BLOCK_ORDER` 끝, 2026-10-22)

### `openwiki/licensing.md` — 7KB · 62줄 · ~2,064 토큰

- `L15` 코드 경계 (에이전트가 지킬 것)
- `L39` 남의 앱 OAuth 클라이언트 값
- `L49` 공개 저장소 내보내기 (OpenRPGMaker)

### `openwiki/location-layer-affordance-audit.md` — 13KB · 130줄 · ~3,930 토큰

- `L10` 결론
- `L17` 분류 — «구역이 존재하는 화면» 은 로케이션 레이어다 (2026-09-11 확인)
- `L32` 실측 (2026-09-11, A 적용 **전** 기준선)
- `L45` 막혀 있는 채널 (설계 결정이므로 우회하지 마라)
- `L52` 검증 공백 (실측)
- `L71` 후보 수정 (A 만 적용, B/C/D 미적용)
- `L84` A 구현 (2026-09-11)
- `L105` 남은 일 (B/D)
- `L119` 검증 좌표

### `openwiki/modern-campus-interior.md` — 9KB · 66줄 · ~2,708 토큰

- `L7` 만든 것
- `L20` 방 12종과 가구 (재사용 59 · 새 조각 43 = 102)
  - `L25` 관문 결과 (gemini-3.8-flash ×4 과반, 투명 PNG, 정직한 종류)
- `L30` 평면 5장 (학교 3 + 기숙사 2) — 참고문서 `mci-ex-*`
- `L37` 조수 길 (`campusPolicy.ts`)
- `L44` 방 구성(layout) · 실내 길 (2026-10-14)
- `L56` 활성화(2026-10-14 완료 — 아래는 한 일의 기록)
- `L64` 관련

### `openwiki/modern-campus.md` — 21KB · 195줄 · ~6,229 토큰

- `L6` 목적
- `L12` 3/4 계약 (AGENTS.md 「새 도트 그림은 3/4 탑뷰 관문」)
- `L20` 내용 목록 (전체 윤곽)
  - `L33` 실내 대응 (새로 그리지 않는다)
- `L44` 팔레트 잠금
- `L51` 재사용 vs 신규
- `L56` 참고문서 계획 (`tiledata/AI-REFERENCE-CONTRACT.md`)
- `L60` 번들 계획 (AGENTS.md 「새 타일은 공용에 추가」)
- `L68` 첫 조각 10종 (`campus_props.py`)
- `L73` 관문 결과
- `L87` 야외 1차 확장 (2026-10-13, 같은 브랜치)
- `L105` 다시 그리기 (2026-10-14) — 지금 정본
- `L162` quality-b 화풍 보정 (2026-10-14) — 버들항 수준 맞추기
- `L172` 첫 판 기록 — 굽기·번들·조수 길 (2026-10-14, PR bake-themes, 반려된 그림)
- `L185` 죽은 문 강제 (2026-10-14, known-bugs-fix)

### `openwiki/modern-city.md` — 36KB · 173줄 · ~10,709 토큰

- `L5` 식별자
- `L15` 파일
- `L22` 기존 프로젝트 갱신 규칙
- `L31` 조수 정책 (2026-10-14, `src/ai/modernCityPolicy.ts`)
- `L40` 거리 구성기 `compose_modern_city_street` (2026-10-14)
- `L52` 거리 녹지 — 버들항 화풍 맞추기 (2026-10-14 quality-b, `scripts/content/modern-city-street/`)
- `L61` 실내 (2026-10-14, `scripts/content/modern-city-int/`)
- `L92` 공간 규모 규격 · 학생/직장인 하루 18곳 (2026-10-18, `src/editor/handInterior/venueScale.ts`·`dailyVenues.ts`)
- `L102` 막힌 이웃 `variation.sealed` · 남녀 센토 · 옥상 (2026-10-25, 시타마치 VQA)
- `L113` 실조수 시험에서 나온 결함 (2026-10-14, gpt-6.1-sol — gemini-3.8-flash 는 할당량 429)
- `L122` 예제 도시 맵 (60×60, 시드 1)
- `L129` 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항)
- `L138` 자동 검사 (구조·통행만)
- `L143` 번들 장소
- `L147` 승인된 작은 지하 주차장 (2026-10-05)
  - `L160` 12면 확장 실험
- `L166` 실시간 주행·교차로 90° 회전 차량 및 AI 조수 자동 배선 (2026-10-17)

### `openwiki/monster-assistant-preview.md` — 1KB · 15줄 · ~418 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/monster-badge-progression.md` — 5KB · 27줄 · ~1,360 토큰

- `L5` 배지 스위치 규칙 (정본)
- `L10` 1. 이벤트 조건 `badgeCount`
- `L16` 2. 도구 `place_badge_gate`
- `L20` 3. 원작식 복종 레벨 상한 `obedienceLevelCaps`
- `L25` QA

### `openwiki/monster-campaign-menu.md` — 21KB · 184줄 · ~6,105 토큰

- `L10` Ownership and receipts
- `L35` UI data and map
- `L53` Browser evidence and limitations
- `L66` Authored field menu and assistant tools (2026-10-04)
- `L95` Emerald authored presentation
- `L99` 파티 화면: 자리 바꾸기·요약 쪽 (2026-10-16, poke-sys-collect)
- `L110` 도감 화면 (수집·관리 UI ② — 2026-10-16)
- `L120` 배지 획득 연출과 배지 스위치 규칙 (2026-10-16)
- `L144` 보관함(PC) 상자 화면 (2026-10-16, poke-sys-collect)
- `L153` 스타팅 고르기 확인 · 저장 칸 요약 (2026-10-16, poke-sys-collect)
- `L161` 개체 정체성: 별명·성별·색이 다른 개체 (2026-10-16, poke-sys-collect)
- `L173` 성격·노력치 (옵트인, 2026-10-16)

### `openwiki/monster-expedition.md` — 39KB · 333줄 · ~11,219 토큰

- `L6` Source and regeneration
- `L41` Campaign metadata contract
- `L58` Storage and evidence
- `L106` Normal-play dogfood and authoring policy (2026-10-03)
- `L130` 실제 Pi 조수 제작 오프닝 · revision11 (2026-10-03)
- `L159` Native creature refinement · 2026-10-04
- `L200` 빈터 쓰임 채우기 · 타이틀/주민 테마 배선 (2026-10-14)
- `L220` 자유 경로 · 대회형/탐험형 · 계통 일괄 도구 (monster-free-b, 2026-10-14)
- `L253` 규모 인자 — 체육관 0~8관 (2026-10-14, monster-free-a)
- `L267` 체육관 공백·화산 캠페인·0관·줄이기/늘리기 (2026-10-14, monster-gym-fix)
- `L284` 던전 어댑터 — 몬스터 키트로 자유 던전 (2026-10-15, dungeon-genres)
- `L293` 필드 기술 게이트(HM) (2026-10-15, poke-fix-p Phase 2)
- `L299` 필드·진행 규칙 1차 (2026-10-15, poke-fix-p — 감사 S 항목)
- `L311` 야생 조우 보호·필드 도구·낚시 (2026-10-16, poke-sys ②)
- `L321` 길 맵 키큰 풀숲 모양 (2026-10-28, 장부 125)
- `L328` 시작 마을 빈 초원에 용도 (2026-10-28, 장부)

### `openwiki/monster-kit-origin.md` — 45KB · 307줄 · ~13,457 토큰

- `L6` 위치
- `L17` 단계
- `L21` 오토타일 규약 (이 하네스가 지키는 것)
- `L29` 검사가 보증하는 것 / 못 하는 것
- `L34` 첫 테마 — `pokemon-overworld`
- `L40` 기준 팩을 닮게 만들기 (`study` → `draw` → `compare`, 2026-10-02)
- `L53` 관문 (gates) — 「검사 통과」가 합격이 아니던 문제의 해결 (2026-10-02)
- `L66` 건물 관문 — 처마·그림자·벽·창·문 (2026-10-02)
  - `L83` 적대 검수 루프 (2026-10-02, 2차)
  - `L91` 문 (2026-10-02, 3차)
- `L101` 건물 변주 키트 (4차)
- `L110` 굽기(bake)와 엔진 통행 검증 (5차, 2026-10-02)
- `L121` 동굴 한 벌 (6차, 2026-10-02)
- `L130` 동굴 7차 — 원작 실측으로 문법 교체 (2026-10-02)
  - `L141` 동굴 8차 (소품·모래·외곽·입구)
- `L146` 실내·체육관·퍼즐 (9차, 2026-10-02) — 10~12차에서 전부 교체됨
- `L153` 10~12차 — 「맵 퀄리티가 너무 낮다」 재작업 (2026-10-02)
- `L173` 13차 — 한계 손질 + 엔진 미끄럼 바닥 (2026-10-02)
- `L185` 14차 — 지역 시트 (2026-10-02)
- `L204` 15차 — 공용 번들 배선·참고문서·풀숲 만남 (2026-10-02)
- `L224` 16차 — 일곱 시트 전부 배선 + 검수 회차 (2026-10-02)
- `L237` 통합 I6 이어 작업 (2026-10-03)
- `L251` Emerald native variants 7종 (2026-10-04)
- `L260` GBA 2세대 결로 다시 그리기 (2026-10-07)
- `L277` 실내 GBA 다시 그리기 · 걸어 오르는 계단 · 2층 (2026-10-07)
- `L291` 체육관 풀관·실내 지역 방 GBA 다시 그리기 · 타이틀 테마 변형 (2026-10-14)

### `openwiki/monster-resource-editor.md` — 4KB · 75줄 · ~1,199 토큰

- `L3` Entry and ownership
- `L19` State and mutation contract
- `L49` Resource Manager monster tab (2026-09-12)
- `L64` Verification

### `openwiki/monster-sfx.md` — 7KB · 87줄 · ~1,790 토큰

- `L7` How a sound is made
- `L29` Automatic gate (a failing sound is never bundled)
- `L39` Wiring (minimum)
- `L54` Second batch wiring (2026-10-16)
- `L74` Comparison references
- `L82` Not done / next

### `openwiki/music-score-authoring.md` — 2KB · 31줄 · ~500 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/native-enemy-retirement.md` — 8KB · 68줄 · ~2,407 토큰

- `L22` 공용 자산과 표시 계약
- `L31` 폐기와 호환성
- `L39` 기존 RM2003 스킬과 새 시안의 비교
- `L52` 원본·근거·재생성
- `L61` 히드라 재저작 (2026-10-03)

### `openwiki/night-monster.md` — 9KB · 122줄 · ~2,882 토큰

- `L9` 현재 개정본 (2026-09-05)
- `L39` 초기판 정본과 제작 경로 (역사 기록)
- `L53` 초기판 게임 구성과 공략 (현재 개정본에는 적용하지 않음)
- `L71` 초기판 검증과 발견한 함정
  - `L90` 2026-09-05 실측
  - `L105` 사용자 플레이 후 체험 QA 정정 (2026-09-05)

### `openwiki/object-spec.md` — 3KB · 36줄 · ~973 토큰

- `L8` 어디에 있나
- `L18` 규칙
- `L27` 공방 태그 이주
- `L33` 시험

### `openwiki/opening-animatic-authoring.md` — 43KB · 415줄 · ~11,120 토큰

- `L3` Ownership and format
- `L9` Assistant surface
- `L19` Renderer and human editor
- `L27` Pixel-grid stage and alive-viewport primitives (2026-10-15)
- `L48` New Game handoff to the start map (verified 2026-10-15)
- `L58` Assistant authoring of a pixel opening (2026-10-15, phase 2)
  - `L72` Root causes fixed after Iteration 2 (2026-10-16)
  - `L92` Root causes fixed after Iteration 3 (2026-10-16)
  - `L109` Provider availability during Iterations 2–4 (2026-10-16)
  - `L120` Argon availability (2026-10-16)
  - `L129` OAuth client drift (2026-10-16)
  - `L138` Pixel-mode text sizing (defect fixed here)
  - `L147` Assistant completion checks added
  - `L157` Executable probes for this class
- `L186` Game map as the opening background (2026-10-25, Shitamachi)
- `L192` Entry timing
- `L198` Functional verification
- `L202` Older host storage compatibility
- `L208` Narrative storybook recipe (2026-10-04)
- `L233` Drawn professor poses inside confirm pages (2026-10-04)
  - `L285` Actual standalone export motion probe
- `L332` Review includes authored layers
- `L341` 2026-10-16 ultrabrain 반려 후 수정
- `L349` 2026-10-16 iteration 1: dedicated pixel opening contract
- `L374` 2026-10-16 iteration 2: save-path and completion gates
- `L396` Fallen Star cinematic cold open (2026-10-24)
- `L409` Title-intro track, silhouettes, meteors (2026-10-25)

### `openwiki/opening-reference-study.md` — 10KB · 57줄 · ~2,901 토큰

- `L5` 자료의 범위
- `L11` 사례 → 표현 → 필요한 도구
- `L35` 공통 강화 순서
- `L43` 프레임과 저작권·검증 한계
- `L52` 산출물

### `openwiki/opening-still-pack.md` — 11KB · 179줄 · ~2,925 토큰

- `L3` Reviewed descriptions and production queue (2026-09-22)
- `L31` Quota-aware production job
- `L72` Initial pack
- `L99` Installation and integrity
- `L114` Runtime and authoring contracts
  - `L133` Only installed stills are offered (2026-10-26)
- `L151` Verification and examples

### `openwiki/pirate-isles.md` — 7KB · 82줄 · ~2,170 토큰

- `L7` 구조
- `L24` 배치 = 구성기
- `L46` 조수 경로
- `L55` 적대 검수 한 바퀴 (2026-10-14)
- `L68` 화풍 정렬 2026-10-14 (버들항 수준으로)
- `L77` 남은 일

### `openwiki/pixel-art-world-bath-gym.md` — 3KB · 31줄 · ~841 토큰

- `L19` 로컬 공용 게시·정본 재로드 (2026-09-24)

### `openwiki/pixel-art-world-civic.md` — 4KB · 38줄 · ~1,105 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/pixel-art-world-doors.md` — 5KB · 53줄 · ~1,525 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/pixel-art-world-eventprops.md` — 5KB · 60줄 · ~1,555 토큰

- `L21` 로컬 공용 설치 (2026-09-24)
- `L44` 물 연출 공용 설치 (2026-09-25)

### `openwiki/pixel-art-world-facility-complements.md` — 7KB · 101줄 · ~2,194 토큰

- `L45` 재현 가능한 로컬 공용 publisher

### `openwiki/pixel-art-world-food.md` — 6KB · 37줄 · ~1,740 토큰

- `L15` 실제 오브젝트 등록
- `L21` 공용·정본 설치 (2026-09-24)

### `openwiki/pixel-art-world-home.md` — 4KB · 43줄 · ~1,111 토큰

- `L10` 도시의 서로 다른 두 주택 (2026-09-24 후속)

### `openwiki/pixel-art-world-hospitality-complements.md` — 3KB · 24줄 · ~786 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/pixel-art-world-japanese-interiors.md` — 11KB · 130줄 · ~3,482 토큰

- `L3` 현대 실내 추가 8맵 (2026-09-25)
- `L39` 이자카야
- `L84` 로컬 공용 게시와 정본 확인 (2026-09-24)
- `L110` 직접 배치와 완성 맵 복사를 구분 (2026-09-25)

### `openwiki/pixel-art-world-loose-supplements.md` — 7KB · 93줄 · ~2,123 토큰

- `L11` 별도 로컬 공용 라이브러리 준비·게시
- `L80` 감독자 통합 관찰 (2026-09-25)

### `openwiki/pixel-art-world-loose.md` — 6KB · 46줄 · ~1,933 토큰

- `L15` 통합·실제 UI 관찰 (2026-09-24)
- `L25` 검토 판본의 사용자 로컬 공용 게시 준비
- `L37` 공용·기존 정본·새 SQLite 확인 (2026-09-24)

### `openwiki/pixel-art-world-mansion-exteriors.md` — 3KB · 38줄 · ~948 토큰

- `L17` 로컬 공용 저장과 실제 관찰 (2026-09-25)

### `openwiki/pixel-art-world-mansion-interiors.md` — 3KB · 36줄 · ~919 토큰

- `L17` 공용 게시·정본 재로드 (2026-09-25)

### `openwiki/pixel-art-world-maps-51.md` — 4KB · 45줄 · ~1,314 토큰

- `L6` 만들고 확인하기
- `L13` 공용 DB 등록 — 에디터 기본 모델 (2026-09-27)

### `openwiki/pixel-art-world-native-complements.md` — 4KB · 37줄 · ~1,196 토큰

- `L22` 사용자 로컬 공용 등록 경로

### `openwiki/pixel-art-world-retrotown-exteriors.md` — 2KB · 22줄 · ~635 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/pixel-art-world-school-sewer.md` — 2KB · 28줄 · ~681 토큰

- `L19` 별도 로컬 게시 경계 (2026-09-25)

### `openwiki/pixel-art-world-school.md` — 14KB · 165줄 · ~4,349 토큰

- `L3` 계단실 공용 문서와 실제 조수 확인 (2026-09-25)
- `L67` 4층 학교 / 실제 방 구조 (2026-09-24)
  - `L94` 반려 후 축소·벽 연속성 수정
  - `L104` 2차 반려 후 밀도 재설계
  - `L114` 380원본 범위 고정 후 학교 축소 (2026-09-25)
  - `L128` 현재: 독립 계단실과 교실 뒤 사물함

### `openwiki/pixel-art-world-static-expansion.md` — 3KB · 31줄 · ~969 토큰

- `L23` 정본·공용 설치 도구

### `openwiki/pixel-dot-authoring.md` — 8KB · 91줄 · ~2,408 토큰

- `L7` 스킬 원본과 설치
- `L18` 핵심 계약
- `L30` 사용자 재반려 후 수정 · 현재 공용 5종
- `L46` FF6 조사 후 재저작 · 직전 반려 판의 기록
- `L60` 이전 판 실행 확인 기록
- `L86` 설정의 도트 저작 모델 (2026-10-16)

### `openwiki/placed-place-edits.md` — 5KB · 79줄 · ~1,282 토큰

- `L3` Scope and ownership
- `L13` Mutation contract
- `L47` Actual read models and lifecycle data
- `L64` Verification

### `openwiki/pokemon-like-field-kit.md` — 5KB · 88줄 · ~1,328 토큰

- `L11` Current candidate
- `L23` Ownership and validation
- `L38` Canonical boundary
- `L48` Approved integration (2026-10-05)

### `openwiki/prehistoric.md` — 10KB · 82줄 · ~3,018 토큰

- `L8` 한 줄 지도
- `L22` 꼭짓점(Wang) 바닥
- `L29` 칸 통행 (bake_ph.py)
- `L34` 3/4 관문 (object-gate)
  - `L39` 관문 결과 (2026-10-14)
- `L51` 적대적 시각 QA (한 번, 2026-10-14)
- `L59` 조수 실제 실행 (gemini-3.8-flash high, 2026-10-14)

### `openwiki/project-wiki.md` — 13KB · 203줄 · ~3,269 토큰

- `L8` Data and evidence
  - `L16` Work history is not a codex document (2026-09-20)
- `L45` Ownership and retrieval
- `L72` Editor lifecycle
- `L133` Combat acceptance slice
- `L145` Verification
- `L200` AI 비공개 카드 (2026-10-16)

### `openwiki/quest-preset-research.md` — 8KB · 85줄 · ~2,369 토큰

- `L6` 조사 근거와 설계 해석
- `L21` 제공 범위
- `L38` AI 저작 계약
- `L56` 한계와 완료 근거의 구분
- `L73` 재현

### `openwiki/quickstart.md` — 20KB · 199줄 · ~5,908 토큰

- `L8` 0. 여기서 에이전트가 실제로 헤매는 이유
- `L21` 1. 환경 — 여기가 틀리면 이후 전부 헛수고
- `L56` 팀 SQLite 호스트 (2026-09-18)
- `L64` 1a. Mac / 개인 로컬 실행 (2026-09-21)
- `L81` 1b. 전체 BGM은 Release 팩으로 설치
- `L98` 1c. 오프닝 이미지 팩
- `L105` 2. 검증 — 무엇이 진짜 게이트인가
- `L132` 3. 어디를 고치나 — 기능 → 진입 파일
- `L181` 4. 위키를 읽는 법
- `L193` 5. 끝났다고 말할 수 있는 조건

### `openwiki/release-and-version.md` — 18KB · 248줄 · ~5,388 토큰

- `L7` 네 축을 구분한다
  - `L18` 스토어 「바로 플레이」 게임 판본 (2026-10-23)
- `L27` 릴리스 버전은 왜 매 머지가 아닌가
- `L40` 빌드 식별자
- `L61` 릴리스 절차
- `L87` 데스크톱 산출물을 릴리스에 붙인다 (2026-09-16)
  - `L121` 윈도우 zip·단일 exe 는 리눅스에서 만든다 (2026-09-22, 갱신 2026-10-10)
  - `L161` 데스크톱 AI 워커는 네이티브 애드온을 옆에 둔다 (2026-09-27 실측)
- `L189` 커밋 메시지가 릴리스 노트의 원고다
- `L203` 아직 안 한 것
- `L211` 검증
- `L222` 자동화 — 제안 PR 과 발행 타이머

### `openwiki/relief-terrain.md` — 43KB · 327줄 · ~13,354 토큰

- `L14` 파일 지도
- `L33` depth 규칙(런타임, `playSceneRelief.ts` 머리말)
- `L48` 편집기 성능 계약 (2026-10-03 부분 굽기)
- `L65` UX2 지형·컬링 수정 (2026-10-04, UI 명칭 2026-10-11)
  - `L122` 통합 후 브라우저 QA 레시피 (실행 담당자용)
- `L152` 페이지 굽기 회귀 수정 (2026-10-07)
- `L174` 맵 위 여백 채움 · 매끈한 경사로 테두리 없음 (2026-10-11)
- `L213` 지형 설치 확장 (2026-10-03)
- `L219` 러프 붓·지형지물 막대 (2026-10-03)
- `L229` 기본 계단의 돌 디딤판 (2026-10-03 수정)
- `L241` 연속 경사로 — 계단과 구분 (2026-10-03 사용자 정정)
- `L260` 발 접지·클릭·바닥 접합 수정 (2026-10-04)
- `L281` 편집기 높이 지형 위 타일 칠하기·선택·호버 좌표 일치 (2026-10-20)
- `L290` 알려진 한계 · 결정이 필요한 것
- `L300` 검증 도구 (이 브랜치에 들어온 것)
- `L322` 가져오지 않은 것 (브랜치 `agent/r3-relief-stairs` 에 남아 있다)

### `openwiki/rpg-opening-research.md` — 5KB · 27줄 · ~1,404 토큰

- `L17` 이번 적용

### `openwiki/runtime-action-combat.md` — 31KB · 360줄 · ~7,947 토큰

- `L14` Activation contract
- `L35` Architecture and pure rule modules
  - `L55` Rule module responsibilities
- `L84` Scene integration layer
- `L101` Schema definitions and clamps
  - `L105` `SystemActionCombat` (`project.system.actionCombat`)
  - `L117` `EnemyActionProfile` (`EnemyRecord.actionProfile`)
  - `L131` `ActionWeaponProfile` (`EquipmentRecord.actionWeapon`)
  - `L136` `ActionSkillProfile` (`SkillRecord.actionSkill`)
- `L143` HUD presentation
- `L149` Design decision: Tile-grid movement vs pixel movement
- `L159` Factions and NPC-vs-NPC combat
  - `L163` Data flow
  - `L167` Runtime stance overlay and its save rule
  - `L173` Pure rule module
  - `L181` Scene behaviour
  - `L193` Bounding the simulation
- `L197` Out of scope / deliberately unsupported
- `L203` Verification and test coverage
  - `L205` Runtime-owned AI action proof (2026-09-07)
  - `L271` Pure rule unit tests
  - `L298` E2E browser specifications
- `L303` Feature16 field skill profiles (2026-09-21)
- `L340` 옆보기 중력 · 액션 동료 AI · 전술 격자 전투 (명작 공백 #13 #30 #31, 2026-09-27)
- `L352` 지형 높이 게임 규칙 (2026-10-03)

### `openwiki/runtime-and-data.md` — 3KB · 27줄 · ~733 토큰

- `L5` Topic pages
- `L15` Quick routing
- `L24` For AI agents

### `openwiki/runtime-battle.md` — 440KB · 2417줄 · ~129,307 토큰 · 통째읽기 잘림

- `L1` 기술 목록에 기본 공격(skill_attack)을 싣지 않는다 (2026-10-29)
- `L6` 레트로 파티 창 수치 칸은 글자만큼 늘어난다 (2026-10-29)
- `L15` 피해 계열 받는 피해 %(물리·마법) · 상태가 바꿔 쓰는 값 · 「적이 상태에 걸렸다」 전투 조건 (2026-10-24)
- `L29` 장비 「주는 피해 ±%」·「받는 피해 ±%」 (2026-10-24)
- `L36` 광역기 한 번에 맞기 · 숫자 꼬리표 · 무기 보너스 · 상태 상한 · 장비 드롭 (2026-10-24, fs-battle)
- `L68` 전투 진입 그림 준비 관문 battle readiness gate (2026-10-24)
- `L83` 전투 체감 battle-feel r1 (#3063 머지) · r2 (2026-10-20)
- `L113` 포획 연출 · 도감 등록 문장 (2026-10-16, poke-sys ⑦)
- `L124` 조건부 볼 · 포획 볼 기록 — 포켓몬식 그물·퀵·타이머·리피트 볼 (2026-10-16, poke-depth PR6)
- `L136` 야생 조우 보호 — 도망 무적 걸음·벌레퇴치·탈출 로프 (2026-10-16, poke-sys ②)
- `L142` 지닌 도구(held item) — 아이템 선언 + 몬스터 개체가 하나 지님 (2026-10-16, poke-depth PR4)
- `L155` 특성(ability) — 종마다 선언형 효과 하나 (2026-10-16, poke-depth PR3)
- `L167` 맹독·혼란 — gen1 전투의 상태이상 보강 (2026-10-16, poke-depth PR2)
- `L179` 날씨 — 기술이 켜고 전투 한 번 동안 유지 (2026-10-16, poke-depth PR5)
- `L191` 사람 적 = 걷기 칩 전투 시트 (2026-10-20)
- `L201` 필드 적 접촉 전투 진형 (2026-10-14)
- `L206` 주인공 연출 5종 · 사용자 재반려 후 수정 (2026-10-05)
- `L228` FF6 조사 후 주인공 연출 5종 재저작 · 직전 반려 판 기록 (2026-10-05)
- `L255` 주인공 마법 첫 판 및 공용 24종 철회 기록 (2026-10-05)
- `L280` 전체 몬스터 후속 재저작 · 140종 9포즈 (2026-10-03)
- `L306` 갓파·늑대·박쥐·해골 전투 9포즈 (2026-10-03)
- `L319` 첫 일괄 손 도트 리프레시 · 반려 기록 (2026-10-03)
- `L337` 히드라 새 디자인 9포즈 (2026-10-03)
- `L348` 은발 여검사 손 도트 (2026-10-03)
- `L358` Starter 그림 제거 (2026-10-03)
- `L381` 히드라 첫 도트 재저작 기록 (2026-10-03)
- `L399` 옛 전투 그림은 deprecated/ — 지금 전투에는 도트·포켓몬 그림만 (2026-10-03)
- `L415` 캐릭터별 전투 동작 (2026-10-03)
- `L423` 전투 스킨은 둘뿐 — retro2003(RM2003식) / pokemon (2026-10-02, 사용자 결정 「RM2003 식만 남기고 정리」)
- `L440` 전투는 전부 도트 측면 — 정면 스킨 다섯·몬스터 그림 생성 삭제 (2026-10-02)
- `L460` SNES 식 전투 연출 — 쓰러짐·배경 겹·상태 몸 표시·이펙트 겹치기·화면 필터 (2026-10-02)
- `L490` 포켓몬 참고 스킨과 실제 뒷모습 (2026-09-20)
- `L500` 전투 적대 리뷰 후속 수정 (2026-09-30)
- `L516` 레트로 기믹 편집 가능화 (2026-09-30)
- `L520` 로스터 전 묶음 기믹 (2026-10-01)
- `L527` 힘 모으기 · 게이지 밀기 · 변신 · 소환 (2026-10-01, B)
- `L541` 반응·표적 상태 7종 — 반격·도발·감싸기·회피·리플렉·리레이즈·선고 (2026-10-01)
- `L559` 스킬이 계약 도트 연출을 빌린다 — retroChoreographyId (2026-09-30)
- `L563` 프로젝트 연출 레코드 — skillChoreographies (2026-09-30, A1)
- `L572` 연출 손잡이 · 자동 추천 · 상태 오라 (2026-09-30, B)
- `L579` 도트 결과 화면 단순화 · 적 그룹 「전투 뒤」 이벤트 (2026-09-28)
- `L594` 도트 측면 전투 스킨 retro2003 (2026-09-28)
  - `L655` 스킬별 도트 연출 (2026-09-28)
  - `L691` 직업 스킬 48종 (2026-09-28, sk-rt)
  - `L719` 확장: 새 주인공 6명·스킬 48개·몬스터 30종 (2026-09-28, mx-rt)
  - `L759` 몬스터 스킬 42종 (2026-09-28, mrt)
  - `L774` 2차 로스터 통합 — 걷기 칩 전부 직업·스킬, 몬스터도 파티원 (2026-09-29)
- `L843` 타격감 층 (2026-09-25)
- `L1013` 진입 · 결판 · 복귀 연출 (2026-09-25)
- `L1047` 전투 리뷰 후속: 상태 안내와 무대 채움 (2026-09-20)
- `L1076` 전투 적대적 리뷰의 무결성 수정 (2026-09-20)
- `L1101` 공격 효과음 지연 — 샘플 SE 디코드 캐시 (2026-09-15)
- `L1123` 전투 UI/UX·모션 적대적 리뷰 5축 후속 (2026-09-14)
- `L1201` 몬스터 파티의 전투 회복약 자격 (2026-09-24)
- `L1212` 회복 자원·인트로 배너·타이머 write-back 계약 (2026-09-15)
- `L1261` Native event battle admission (2026-09-08)
- `L1307` Supported action authoring (2026-09-07)
- `L1319` 적별 전투 표시 크기 (2026-09-06)
- `L1329` Capture-only victory (2026-09-08)
- `L1340` Event friendship and live level changes (2026-09-06)
- `L1359` Sequential battle event completion (2026-09-08)
- `L1394` Battle-event continuation and cancellation (2026-09-06)
- `L1437` 전투 명령 custom CSS (2026-09-05)
- `L1441` 빈 페이지와 실행 빈도 계약 (2026-09-05)
  - `L1458` 체공 배율 채널과 착지 눌림 (2026-08-30, PR #297)
- `L1476` 지원 전투 시스템은 둘뿐이다 (2026-08-28, 스킨 부분은 2026-09-25 개정)
- `L1547` Roguelike run boundary (2026-08-24)
- `L1552` 연계기 · 위치 범위기 · 기술 포인트 (Chrono Trigger 계열, 2026-09-26)
- `L1571` CT 감사 후속 — 연계기 해금·합체 능력치·Active/Wait 설정·필드 위 배치 (2026-10-15)
- `L1582` 전투 자원 · 감정 · 장비 부여 (JRPG 레인 L3, 2026-09-27)
- `L1605` FF6 마석 성장 — AP 영구 습득 · 레벨업 보너스 · 전투당 1회 (2026-10-15, 작업자 A)
- `L1622` 팀 교대 전투 (2026-10-15, FF6 수정 A)
- `L1639` FF6 전투 특수 효과 — 스케치 · 폭주 · 대열 섞기 · 강제 교대 · 좀비 · 트랜스 (2026-10-15, 작업자 A)
- `L1662` Chrono Trigger 전투 엔진: Active ATB · 상태 · 반격 · 자동 부활 · 적 이동 · 승리 포즈 · 필드 배경 (2026-09-26)
- `L1705` Battle rules & runtime
  - `L1720` 전투 화면 표현 · 전환 · 타임라인 · 연출 타이밍
  - `L1745` 커맨드/대상 메뉴 기하와 글자 가시성 계약
  - `L1761` 스킨 CSS 캐스케이드와 저작 가능 스킨
  - `L1765` Gen 1(포켓몬식) 규칙 모델
  - `L1773` 능력치 단계 −6~+6 (포켓몬식, 2026-10-16, poke-depth PR1)
  - `L1784` 플레이 모드 런타임 (이 절에 섞여 있는 비전투 항목)
  - `L1806` 전투 흐름 · 몬스터 수집 · 트룹 이벤트 · 보상
- `L1853` Starter hero battle sheets (2026-08-29)
- `L1874` Per-actor back battlers (2026-08-29)
- `L1892` Battle input and visibility P0 contract (2026-07-30)
- `L1903` 배틀러 idle 애니메이션 (2026-08-30)
- `L2031` 필드 아이템 상태 부여 복구 (2026-09-05)
- `L2035` Authored combat rules (feature16, 2026-09-21)
- `L2049` Battle reports and physical formation (2026-09-21)
- `L2053` Combat correctness hardening (2026-09-21)
- `L2061` Gen1 교체 후 이전 적 HUD 잔류 (2026-09-24)
- `L2071` 트레이너 전투의 도입 문구 (2026-09-24)
  - `L2078` 야생 도입 문구의 이름 출처와 「야생」 접두 (2026-10-23)
  - `L2093` Emerald trainer portraits (2026-10-04)
- `L2158` 포획 불가 전투의 가방 목록 (2026-09-25)
- `L2169` 특수 명령 · 입력 기술 · 다부위 적 (명작 공백 #4 #8 #10, 2026-09-27)
- `L2183` 롤링 HP · 움직이는 배경 · 화면 색 필터 (명작 공백 #15 #37, 2026-09-27)
- `L2193` 전투 개시 형태 · 동료 작전 · 패배 규칙 · 피해 전가 · 도주 가산 (명작 공백 #3 #11 #20 #33 #34 #36, 2026-09-27)
- `L2210` 리미트 · 기력 · 파티 게이지 · 감정 상성 · 장비 부여 (명작 공백 #7 #9 #16 #21 #23, 2026-09-27)
- `L2223` 공용 몬스터 옛 그림 폐기 (2026-10-02)
  - `L2227` 공용 이동 설계·32종 전투 기믹 (2026-10-02)
- `L2232` Emerald authored monster profile
- `L2236` Monster result EXP gauge (2026-10-04)
  - `L2254` Emerald trainer source dimensions correction (2026-10-04)
  - `L2260` 경험치 바닥 — 시작 레벨 > 1·중간 합류 (2026-10-21)
  - `L2268` 도망 불가 안내와 경험치 분배 expSplitAlive (2026-10-16)
  - `L2280` 못 움직인 차례·얼음 녹음·명령 대사의 결과 찾기 (2026-10-07)
  - `L2295` 레벨업 기술 배우기·잊기 장면 (2026-10-16)
  - `L2308` 기술 규칙 어휘: 고정 피해·연속 타수·반동·풀죽음 (2026-10-16)
  - `L2326` 더블 배틀(2대2) 설계 메모 — 구현하지 않았다 (2026-10-16)
- `L2348` 기술 목록 폭 — 룩 프리셋(actor·keys·fan)
- `L2352` 스냅샷 소유권·전술 전투 수명 (#2586, 2026-10-22)
- `L2366` 전투 깊이 — 기술 도움말 · 「연계」 명령 · 연계 대기 · 약점 공략 · 결과 팡파레 (fs-battle-2, 2026-10-24)
- `L2391` 전투 연출 설정 — 달려드는 속도 · 얼굴 교차 컷인 · 화려한 연계 착탄 · 한 줄 도움말 · 성장 곡선 (fs-battle-3, 2026-10-25)
- `L2408` 적 약점은 알아 가는 것 — 처음 맞힌 타격에서 발견 · 세이브 기록 · 공개 설정 (2026-10-25)

### `openwiki/runtime-m2-flow-controls.md` — 58KB · 352줄 · ~15,674 토큰 · 통째읽기 잘림

- `L5` Quest companion presence query (2026-10-01)
- `L15` Map-effect repair boundary (2026-09-06)
- `L22` Sound Layer audio controls (2026-09-06)
- `L30` M2 Runtime Flow Controls
- `L98` Storage chest authoring
- `L104` Page 3 location/vehicle compatibility (2026-07-30)
- `L108` 저장된 M2 명령 실행 연결 복구 (2026-09-05)
- `L121` 좌표 목적지 이동의 실패 계약 (OPRN-OUT-013, 2026-09-10)
  - `L180` 이동 중 경로 재지정 — 2026-09-05 브라우저 적대적 QA
  - `L187` 맵 위를 흐르는 구름 그림자 (2026-09-14)
  - `L261` Weather sound (2026-09-21)
  - `L275` Map-wide atmosphere presets (2026-09-21)
  - `L296` Genre ambience presets and sound pairing (2026-09-21)
  - `L320` Thirty audiovisual presets — evidence (2026-09-21)
  - `L335` 그림 컷 준비와 direction (2026-10-04)
- `L343` 글자·장면 오프닝 연출 (2026-10-04)

### `openwiki/runtime-pre-edit-routing.md` — 205KB · 1233줄 · ~60,998 토큰 · 통째읽기 잘림

- `L1` 이식 아틀라스 워커 굽기(#3963)는 되돌렸다 — 텍스처 등록만 `addImage` (2026-10-30)
- `L13` 목표 안내창 자리·한국어 줄바꿈·숫자 입력 (2026-10-28, 장부 hud.json)
- `L62` 카메라 스크롤은 캔버스 픽셀 격자에 맞춘다 (2026-10-23)
- `L69` 지상 격자 위로 돌출한 원본 구조 (2026-10-06)
- `L78` 태양 지형 그림자 (2026-10-04)
- `L84` ★ 기물 뒤에 가려진 주인공 실루엣 (2026-10-29)
- `L95` 도트 게임은 정수 배율로 보인다 (2026-10-30)
- `L109` 작은 방은 화면을 채운다 · 어둠 막은 맵 안에만 (2026-10-28)
- `L140` 내보낸 게임의 화면 배율 (2026-10-04 → 2026-10-20 개정)
- `L157` 그림 아이콘을 조사 물체로 쓴다 (2026-10-04)
- `L738` 게임 화면의 2층·그림자·4층 (MZ식 4층, 2026-09-24)
- `L765` 맵별 16/32/48px 좌표
- `L769` ESC skill thumbnails (2026-09-06)
- `L780` Recovered head emotes (2026-09-05)
- `L786` 메뉴 입력·불러오기 배율 (2026-09-05)
- `L794` 가구 밀기 애니메이션 (2026-09-05)
- `L803` Recovered head emotes (2026-09-05)
- `L809` Saved uploaded tilesets in the actual player (2026-09-14)
- `L830` 맵 배경(패럴랙스) 렌더 (2026-09-14)
- `L859` 맵 배경 다중 레이어 (2026-09-21)
- `L911` 맵 배경 깊이(카메라 따라가기)·흐름 배율 — 회상 파노라마 (2026-09-27)
- `L959` 맵 배경 사용성 — OPRN 자체 파노라마 견본·움직임 프리셋·게임 화면 미리보기 (2026-10-21)
- `L1004` 맵 배경 조수 경로 — 견본 고르기 정확도·새 배경 생성 generate_map_background (2026-10-22)
- `L1031` 맵 배경 「다른 맵 보기」 층 `fromMap` (2026-10-24)
- `L1039` 8차 맵 진입 (2026-09-28)
- `L1072` 화면 주변 타일 유지 (2026-10-01)
- `L1101` 자유 크기 인물 프레임의 발 기준점 (2026-10-06)
- `L1113` Independent opening timelines
- `L1117` Monster authoring dogfood (2026-10-03)
- `L1128` 위쪽 대사창의 흉상·전신 초상 (2026-10-17 romance-loop-1)
  - `L1135` 흉상·전신이 있는 대사는 대사창이 항상 아래 (2026-10-17, vn-bust-bottom-1)
- `L1152` 대사창은 고정 틀 (2026-10-22, dialogue-stable-frame)
- `L1183` 엔딩 카드 글자는 게임 언어 (2026-10-22)
- `L1191` 대사창 읽기 보조 — 백로그·오토·스킵·숨기기 (2026-10-17, 미연시 시스템 UI 1단계)
  - `L1202` 대사창 읽기 보조 수리 1 (2026-10-17, 적대 리뷰 D1~D12)
- `L1214` 미연시 추가 화면 — 갤러리 잠금·엔딩 목록·세이브 카드 (2026-10-17, 미연시 시스템 UI 2단계)
- `L1227` 인물 연출 런타임 — approach·turnToward·대사 자동 돌아보기 (2026-10-22)

### `openwiki/runtime-project-schema.md` — 264KB · 1825줄 · ~74,678 토큰 · 통째읽기 잘림

- `L3` 대사 책상 — 선택 필드 `project.dialogueDesk` (2026-10-24)
- `L14` 세계 지도 연결 정의 — 선택 필드 `project.worldAtlases` (2026-10-05)
- `L22` 맵 캐릭터 크기 — 선택 필드 `map.characterScale` (2026-10-03)
- `L30` 세계 지도 원본 — 선택 필드 `map.worldmapSource` (2026-10-03)
- `L43` 캐릭터별 전투 동작 (2026-10-03)
- `L52` 퀘스트 프리셋 메타 (2026-10-01)
- `L67` 공식 맵 크기와 저장 형태 (2026-10-01)
- `L75` 번들·공용 참고문서 소유 분리 — 저장 문서에서 빼고 로드에서 되돌림 (2026-09-30, 편집기 렉 F)
- `L92` 편집기 시작 시간 — 부팅 정규화 표식·요약 지연·첫 화면 신호 (2026-10-14, 「앱 켜는 게 느려졌다」 조사)
- `L111` 스킬 도트 연출 빌리기 — 선택 필드 retroChoreographyId (2026-09-30)
- `L115` 프로젝트 연출 레코드 — database.skillChoreographies (2026-09-30)
- `L119` ensureRetroRosterRecords — 기존 프로젝트에 레트로 로스터 심기 (2026-09-30)
- `L130` 장비 능력치 보너스 (2026-10-27)
- `L134` FF6 마석 성장 — 선택 필드 (2026-10-15)
- `L139` FF6 전투 특수 효과 — 선택 필드 (2026-10-15)
- `L145` 스킬 HP 대가·흡수 — 선택 필드 (2026-09-29)
- `L151` 데스크톱 시작 화면 — 라이브러리 홈 (2026-10-20, 2026-10-17 플레이·만들기 두 갈래를 대체 · 2026-10-21 칸 나누기)
- `L258` 강하게 다시 하기·장 표시 선택 필드 (2026-09-26)
- `L268` 지형지물 군집 `map.doodadGroups?` (2026-10-03)
- `L280` 높이 지형 `map.relief` — 선택 필드 (2026-09-26)
- `L305` 맵 칸 2층·4층·그림자 — 선택 필드 (MZ식 4층 PR ①, 2026-09-24)
- `L338` 이름별 게임 오버 (2026-09-23)
- `L355` 확정된 게임 기획 (2026-09-22)
- `L377` LegacyDb 잔여 의존 정리 (2026-09-21)
- `L384` 종족 전투 뒷모습 리소스 (2026-09-20)
- `L388` 웹 프로젝트 생성과 선택 (2026-09-18)
- `L394` 팀 프로젝트 서비스 (2026-09-18)
- `L401` 로컬 SQLite 정본과 저장소 포트 (2026-09-16)
  - `L484` 데스크톱 앱이 실제로 뜬다 (2026-09-16)
- `L517` 지역 하위 장소의 단일 계약 (2026-09-14)
- `L527` 직접 그린 방을 포함하는 다층 장소 (2026-09-14)
- `L536` 장소 재료의 포함 관계 (2026-09-14)
- `L545` 혼합 하위 재료 구성 (2026-09-13)
- `L564` Truthful migrated-load state (2026-09-07)
- `L597` Explicit publication identity and Save6 (2026-09-06)
- `L655` Spatial canonical routing (task6 backend increment, 2026-09-07)
- `L697` P1 accepted-save receipts and read-only proof (2026-09-06)
- `L747` 패배 흐름과 엔딩 프레젠테이션 (2026-09-22)
- `L761` Opening and game-over cinematic settings (2026-09-06)
- `L778` 적 전투 이미지 크기 (2026-09-06)
- `L782` Project monster metadata overrides (foundation, 2026-09-07)
- `L824` Project audio description overrides
  - `L853` Concurrent persistence
  - `L878` Editor preservation and playable export
- `L892` Character/face authoring metadata (2026-09-06)
- `L901` Character appearance sets v1 (2026-09-06)
- `L938` New-project save/reload verification (2026-09-05)
- `L946` Task15 nonvisual economy command contract (2026-09-08)
- `L957` Independent game Save5 boundary (2026-09-06)
- `L963` Life ownership in Save5 (2026-09-06)
- `L979` Placement safety core (task12, 2026-09-06)
- `L991` Project-authored equipment slots (2026-09-05)
- `L999` 전투 명령 CSS (2026-09-05)
- `L1003` 기본 카탈로그 삭제 보존 (2026-09-05)
- `L1007` 전투 페이지 중복 ID 복구와 슬롯 참조 (2026-09-05)
- `L1020` 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)
- `L1028` 세계 법칙의 명시적 부재 (2026-09-05)
- `L1032` Showcase media save-copy durability (issue #693, 2026-09-08)
- `L1072` 공용 첫 방문 데모 — 읽기 전용 저장 계약 (2026-09-14)
- `L1106` Project schema & persistence
- `L1381` Optional medicine PP recovery (2026-10-03)
- `L1391` Variable arithmetic & loop runtime (2026-08-07)
- `L1396` Canonical event-draft projection (2026-07-30)
- `L1403` P2 general buildings and home decorations (2026-08-25)
- `L1410` 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)
- `L1428` Boot normalizers must not create dangling references (2026-08-30)
- `L1454` `.oprn` 은 단일 파일 게임 컨테이너다 — 편집기와 플레이어 양쪽이 읽는다 (2026-08-30)
- `L1488` 성장 트리 선택 확장 (2026-09-05)
- `L1494` 마을 설계서 (2026-09-05)
- `L1500` 공포 게임 제작 기능 (2026-09-05)
  - `L1504` 저장된 대사 별칭과 맵 오버레이 (2026-09-05)
- `L1508` NPC 표시 이름 (2026-09-05)
- `L1521` 연결 실내 도면의 영속성 (2026-09-05)
- `L1525` 개념 장소 형상 (2026-09-05)
- `L1529` Optional village decoration attachments (2026-09-13)
- `L1540` Optional map climate (Feature16, 2026-09-21)
- `L1557` Optional authored combat rules (feature16, 2026-09-21)
- `L1560` AI 저작 보조 설정의 프로젝트 지속성 (Feature16, 2026-09-21)
- `L1573` 구름량 optional 필드 (2026-09-21)
  - `L1585` Map atmosphere layers (2026-09-21)
- `L1606` 필드 HUD 설정 (2026-09-21)
  - `L1616` HUD 장르·서체 확장 (2026-09-21)
- `L1628` 타일셋 참고문서 데이터 (2026-09-21)
- `L1632` 몬스터 보유 조건 연결 작업 (2026-09-25, 진행 중)
- `L1686` Optional authored slide tables (2026-10-04)
- `L1696` Uploaded charset pose cadence (2026-10-05)
- `L1705` 재편집 지형과 게임 높이 규칙 (2026-10-03)
- `L1714` Optional internal authoring contract
  - `L1718` Desktop fullscreen and mouse controls (2026-10-04)
  - `L1733` Cinematic image direction (2026-10-04)
- `L1742` 글자·장면 오프닝 연출 (2026-10-04)
- `L1752` 자유 크기 인물 프레임의 발 기준점 (2026-10-06)
  - `L1769` 공용 native 프레임 정의 보존 (2026-10-06)
- `L1777` 필드 기술(HM) 선택 필드 (2026-10-15)
- `L1783` 포켓몬풍 필드·진행 규칙 선택 필드 (2026-10-15, poke-fix-p)
- `L1790` ItemRecord.heldEffect · MonsterInstance.heldItemId (2026-10-16, poke-depth PR4)
- `L1795` MonsterSpeciesRecord.ability (2026-10-16, poke-depth PR3)
- `L1800` StateRecord.volatileStatus·gen1MajorStatus "toxic" (2026-10-16, poke-depth PR2)
- `L1805` SkillRecord.statStageEffects (2026-10-16, poke-depth PR1)
- `L1810` SkillRecord.weather (2026-10-16, poke-depth PR5)
- `L1818` ItemCaptureProfile.condition · MonsterInstance.caughtBallId (2026-10-16, poke-depth PR6)
- `L1822` 상태의 부위 손실·전투 오라 (2026-10-27)

### `openwiki/runtime-sessions.md` — 166KB · 922줄 · ~45,466 토큰 · 통째읽기 잘림

- `L3` 여러 게임 오버의 실행과 미리보기 (2026-09-23)
- `L21` 장르별 패배와 엔딩 흐름 (2026-09-22)
- `L54` Opening and game-over cinematics (2026-09-06)
- `L133` Recovery ledger and scheduled failure ownership (2026-09-09)
- `L141` Task10 field input and exact forage dates (2026-09-06)
- `L155` QA-only life observation (2026-09-06)
  - `L161` Audio QA capability and shell lifetime (2026-09-06)
- `L167` Save5 session boundary (2026-09-06)
- `L175` Life recovery primitives and maker evidence (2026-09-06)
- `L187` Lossless life snapshot reconciliation (2026-09-06)
- `L201` Esc 메뉴 작업 프레임 (2026-09-05)
- `L231` 아이템 종류 전환과 실행 효과 (2026-09-05)
- `L242` 저장 칸은 현재 목표 줄을 같이 남긴다 (2026-10-29)
- `L252` Roguelike run kernel and field rooms (Phase 0–3, 2026-08-24)
- `L262` P1 daily-weather transition authority (2026-08-25)
- `L271` Event audio state (U14)
- `L279` Session state & life-sim
- `L374` Editorial title screen (2026-08-26)
- `L381` playerTouch trigger contract (2026-08-20)
- `L385` Selected-event runtime sandbox (2026-07-30)
- `L391` P2 spatial runtime and saves (2026-08-25)
- `L405` 공포 게임 제작 기능 (2026-09-05)
  - `L409` 메뉴 PR 통합 검증 (2026-09-05)
- `L416` Game menu designs and information ownership (2026-09-18)
  - `L446` Four era-inspired menu windows (2026-09-18 follow-up)
- `L470` Player options, inventory views and honest shop services (feature16, 2026-09-21)
- `L499` 도트 비교 상점 — 상점 UI 기본값 (2026-09-27)
- `L528` 도트 창 통일 — ESC 메뉴·장비·아이템·여관·전투 결과 (2026-09-28)
- `L562` Persistent battle reports and formation (2026-09-21)
- `L570` 퀘스트 일지의 긴 문장과 키보드 읽기 (2026-09-24)
- `L580` 갤러리와 줄 음성 (2026-09-25)
- `L592` 강하게 다시 하기(New Game+)와 장 표시 (2026-09-26)
- `L613` 탈것 — 소형선·대형선·비행선 (2026-09-26) + 초코보·광산 수레·뗏목 (2026-10-15)
- `L639` 명작 공백 G3 — 난이도·타이틀 변형·파티 묶음·스킬 장착·조합·몬스터 교환 (2026-09-27)
- `L660` 오프닝 fade 표시 시간과 장면 유지 시간 (2026-10-03)
- `L674` Original monster campaign journal and field menus (2026-10-03)
- `L683` Monster party common UI dogfood follow-up (2026-10-03)
- `L712` Collector supply shop (2026-10-04)
- `L737` Emerald reference shop stages (2026-10-04)
- `L779` Default camera zoom during new game and Continue (2026-10-04)
- `L791` Authored sliding floors restored in the current engine (2026-10-04)
  - `L835` Emerald shop confirmation backdrop and pending row (2026-10-04)
- `L866` 몬스터 센터 회복 연출 (2026-10-16)
- `L870` 몬스터 필드 아이템 사용과 가방 포켓 (2026-10-16, poke-sys-items)
- `L876` 체감 속도 — 대사 흘림·엔딩 크레딧·엔딩 뒤 「이어하기」 (2026-10-29)

### `openwiki/se-catalog.md` — 15KB · 257줄 · ~3,910 토큰

- `L6` Why this exists
- `L22` Facts an agent needs
- `L37` Files and ownership
- `L57` Regenerating
  - `L69` Why these are python, not `.mjs`
  - `L76` Kenney download URLs rotate
- `L82` Categories
- `L103` Triple cross-check: which sounds actually need human ears
  - `L130` What it measured (2026-08-23, original 456 only, both reviewers covering all 16 sheets)
  - `L154` The output
  - `L166` Traps
- `L175` The labels are provisional — and why
- `L198` How authors reach the sounds
- `L215` Project sound descriptions
- `L242` Traps

### `openwiki/sengoku-edo.md` — 11KB · 107줄 · ~3,268 토큰

- `L8` 파일 지도
- `L30` 3/4 관문 (object-gate)
- `L41` 구성기 규칙 (요약 — 정본은 참고문서 se-howto)
- `L50` 적대 시각 QA 한 번 + 개선 한 번 (2026-10-14)
- `L73` 화풍 2판 — 버들항 결 맞추기 (quality-b, 2026-10-14)
- `L85` 조수 실측

### `openwiki/service-boundaries.md` — 2KB · 31줄 · ~545 토큰

- `L11` 에디터와 스토어
- `L20` 에디터와 커뮤니티

### `openwiki/sf-station.md` — 9KB · 128줄 · ~2,659 토큰

- `L8` 식별자
- `L19` 현재 굽기 (2026-10-14)
- `L48` 맵 구성기 — `compose_sf_station_map`
- `L78` 조수 연결 — `src/ai/sfStationPolicy.ts`
- `L92` 참고문서 — `scripts/content/sf-station/sf_refs.py`
- `L109` 다시 굽기
- `L122` 알려진 한계

### `openwiki/shared-item-balance.md` — 6KB · 58줄 · ~2,016 토큰

- `L5` 소유 경로
- `L12` 효과 역할
- `L30` 가격 기준
- `L40` 확인 근거
- `L53` 큰 JSON의 타입 경계

### `openwiki/sky-island.md` — 7KB · 46줄 · ~2,010 토큰

- `L6` 파일
- `L22` 수치 (2026-10-14)
- `L28` 구성기 계약
- `L35` QA (한 번의 개선 판, 2026-10-14)
- `L41` 함정

### `openwiki/snow-north.md` — 12KB · 124줄 · ~3,648 토큰

- `L13` 한 줄 지도
- `L27` 버들항 눈 기후와의 경계 (결정)
- `L38` 오토타일
- `L44` 칸 통행 (bake_sn.py)
- `L52` 3/4 관문 (object-gate)
- `L63` 적대적 시각 QA (한 번, 2026-10-14)
- `L94` 조수 실제 실행
- `L115` 버들항 화풍 맞추기 (quality-b, 2026-10-14)

### `openwiki/spatial-ai-tools.md` — 28KB · 343줄 · ~7,871 토큰

- `L3` 장소 단일 계약 (2026-09-14)
- `L19` Ownership
- `L50` 저장된 건물 외형 찾기 (2026-09-14 갱신)
- `L78` Preview versus publication
- `L108` 프로세스 경계를 넘는 증거 (2026-09-16)
- `L142` Legacy adapters and context
- `L184` Evidence and integration boundary
- `L201` Completed region references (2026-09-13)
- `L217` 2026-09-24 — 장소·지역·오브젝트의 자체 AI 참고문서
  - `L258` PAW 시설 재배치와 저장 (2026-09-24)
  - `L269` Shared places and objects without activation (2026-09-25)
  - `L322` Importing a reference (`import_region_reference`, 2026-09-25)

### `openwiki/spatial-authoring-controller.md` — 18KB · 294줄 · ~4,590 토큰

- `L6` Status and ownership
- `L18` Panel contract
- `L81` Compiled geography member motion (2026-09-09)
- `L111` Selective standalone-object graphic replacement
- `L140` Editable preview continuation
- `L162` Atomicity and stale checks
- `L179` Exact connection cleanup
- `L248` Verification and remaining integration

### `openwiki/spatial-catalog-ui.md` — 26KB · 262줄 · ~7,563 토큰

- `L5` 목록은 축소 그림만 그린다 (2026-09-24)
- `L14` 카드 미리보기 컴파일: 격리 경계와 카드 캐시 (2026-09-30)
- `L29` Concept and selection contract (2026-09-12)
- `L52` Building exterior selection
- `L69` Facility levels
- `L79` Verification
- `L96` Shared objects (2026-09-17)
- `L101` 2026-09-18 — rejected interior catalog reset and style-first mockup
- `L116` 2026-09-18 — production place classification browser
- `L124` 2026-09-21 — 강변 숲마을 기본 장소
- `L151` 2026-09-22 — 기본 방 종류 카드 7종을 갤러리에서 제거
- `L170` 2026-09-22 — 장소 이미지 누락 복구
  - `L191` 2026-09-24 — bundled fallback for all 31 interiors
- `L195` 공용 장소 웹 배포 계약 (2026-09-24)
  - `L199` 부팅 범위와 미리보기 주소 (2026-09-26)
- `L228` 호스트 전용 장소의 목록 썸네일 (2026-09-24)
- `L232` 2026-09-24 — 공간 소유자의 참고문서 표시
- `L245` RPG 판타지 장소 70곳 공용 DB 등록 (2026-09-25)
- `L256` 공용 DB 게시 도우미 `scripts/content/lib/shared-library.mjs` (2026-09-25)

### `openwiki/spatial-geography-compiler.md` — 10KB · 163줄 · ~2,520 토큰

- `L8` Public path
- `L31` Terrain and structures
- `L66` Settlement regions (2026-09-12)
- `L88` Ownership and regeneration
- `L111` Contract fixtures and proof

### `openwiki/spatial-geography-ui.md` — 32KB · 445줄 · ~9,146 토큰

- `L9` Public modules
- `L27` Regions gallery contract (2026-09-22)
- `L49` Settlement regions (2026-09-12)
- `L84` Catalog read-only rendering (2026-09-12)
- `L106` Authoring rules
- `L146` Fixtures
- `L152` Proof
- `L171` Completed map references (2026-09-13)
  - `L200` Castle town reference (2026-09-13)
  - `L214` Lake village and extracted places (2026-09-13)
  - `L237` 석교 공간 저작 자료 (2026-09-15)
- `L246` 기존 완성 맵을 지역에 연결
- `L262` Shared forest regions and village trails (2026-09-21)
- `L297` 승인된 강변 숲마을 공용 지역 (2026-09-21)
- `L315` 서로 다른 새 마을 3종 공용 지역 (2026-09-23)
  - `L335` 절벽 조립 교정 (2026-09-23)
  - `L345` 잔디 경계 개정3 (2026-09-23)
  - `L355` 굽은 지형·입구 개정4 (2026-09-23)
  - `L365` 생활 마당 개정5 (2026-09-23)
  - `L374` 사용 목적 개정6 (2026-09-23)
  - `L384` 공동 공간·정원 개정7 (2026-09-23)
  - `L395` 계단 대지 개정8 (2026-09-23)
  - `L410` 강과 폭포 개정9 (2026-09-23)
  - `L422` 컨셉 마을 3종 · 창문 개정10 (2026-09-23)
  - `L438` 마을 채우기 개정14 · 항구 · 큰 항구 마을 (2026-09-24)

### `openwiki/spatial-manual-build.md` — 11KB · 177줄 · ~2,738 토큰

- `L11` Public entry points
- `L28` Inputs and display obligations
- `L56` Preview and Apply
- `L105` Compile owner for placed adapters
- `L128` Source Build UI controls
- `L158` Verification

### `openwiki/spatial-overview-associations.md` — 6KB · 107줄 · ~1,557 토큰

- `L6` Persisted identities
- `L33` Validation and compiler boundaries
- `L58` Lifecycle and compatibility
- `L89` Reproduction

### `openwiki/spatial-place-compiler.md` — 16KB · 227줄 · ~4,076 토큰

- `L31` Shared interior shell and activity zones (2026-09-14)
- `L39` Houses with a yard and four floors (2026-09-12)
- `L68` Compact one-floor household (2026-09-13)
  - `L102` Structural partitions (2026-09-13 correction)
  - `L123` Compact furniture arrangement
  - `L138` Furniture overlapping the north wall
- `L157` Reviewed interior space catalog (2026-09-13)
  - `L184` Frozen placement vocabulary
- `L214` Reviewed default places (2026-09-15)

### `openwiki/spatial-placed-space-edits.md` — 5KB · 75줄 · ~1,209 토큰

- `L7` Controller API
- `L41` Frozen authority and atomicity
- `L61` UI integration boundary

### `openwiki/spatial-space-member-ui.md` — 1KB · 31줄 · ~360 토큰

- `L8` Binding
- `L26` Geometry

### `openwiki/stair-entrance-contract.md` — 17KB · 103줄 · ~5,171 토큰

- `L7` 계약 — 정본 `src/assets/stairContracts.json`
- `L16` 검사 — `src/project/lint/stairEntranceLint.ts` (전부 warning, `lintScenePolish` → validate·쓰기 뒤 장면 검사)
- `L22` 배치에 쓰는 곳
- `L30` 참고문서 — 번들 소유
- `L35` 일괄 점검 스크립트
- `L50` 칩셋별 — atlas_biome_interior(손 도트 실내 v5) 계단 다시 그림 (2026-10-22)
- `L61` jp_city 실내 계단 다시 그리기 (2026-10-22)
- `L84` 마법 학교(wizarding_world) 계단 다시 그림 (2026-10-22)

### `openwiki/stardew-core-elements-research.md` — 9KB · 139줄 · ~2,230 토큰

- `L9` Primary finding
- `L21` Evidence-backed pillars
  - `L23` 1. Day, energy, and overnight settlement
  - `L29` 2. Calendar, seasons, and weather
  - `L35` 3. Farming, animals, and processing economy
  - `L41` 4. Town life and relationships
  - `L47` 5. Parallel activity loops
  - `L54` 6. Long-term goals and completion surfaces
  - `L62` 7. Personal ownership
- `L67` Editor information architecture implication
- `L86` Delivery priority
  - `L88` P1: make the world feel alive
  - `L97` P2: make daily choices converge on goals
- `L108` Implementation invariants
- `L119` Sources

### `openwiki/state-system.md` — 14KB · 141줄 · ~3,878 토큰

- `L7` TL;DR (use this when explaining to a user)
- `L15` Layers and ownership
- `L27` StateRecord fields (authored)
- `L61` StateOntology (engine default template)
- `L86` Default seed (new projects)
- `L90` Editor surface
- `L100` Runtime application
- `L111` Common confusion points
- `L123` Files to inspect before editing
- `L135` Related pages

### `openwiki/steampunk-city.md` — 8KB · 57줄 · ~2,389 토큰

- `L7` 한 줄 지도
- `L21` 수량 (굽기 보고서)
- `L26` 3/4 관문 (object-gate)
- `L34` 칸 통행 (bake_sp.py)
- `L39` 구성기 계약 (사용자는 옛 시안의 배치를 싫어했다 — 배치가 그림만큼 중요)
- `L46` 적대적 시각 QA (한 번, 2026-10-14)

### `openwiki/storage-retirement.md` — 4KB · 55줄 · ~1,203 토큰

- `L3` 현재 저장 경로
- `L18` 제거와 대체
- `L30` 실제 데이터 보존
- `L43` 역사 자료와 검증

### `openwiki/store-agent-contribution.md` — 9KB · 80줄 · ~2,837 토큰

- `L8` 한 줄 요약
- `L19` 명령 (`scripts/store/agentStore.mts`)
- `L35` 검사 (보내기 전에 로컬에서, 하나라도 걸리면 아무것도 보내지 않는다)
- `L51` 승인 흐름
- `L62` 토큰과 보안
- `L74` 2026-10-20 현황

### `openwiki/sunlight-shadows.md` — 7KB · 73줄 · ~2,036 토큰

- `L3` 저작과 저장
- `L14` 공통 계산과 그리기
  - `L51` 높이 붓과 도로의 수신 면 (2026-10-04)
- `L62` 조수와 검수

### `openwiki/teaching-assistant-tilesets.md` — 45KB · 371줄 · ~13,480 토큰

- `L8` 한 줄 요약
- `L14` 조수가 실제로 받는 것
  - `L44` 참고문서 읽기 게이트
- `L54` 타일셋 종류별로 조수가 아는 정도
- `L69` 가르치는 수단 — 효과 큰 순
- `L90` 새 타일셋을 넣을 때 점검표
- `L99` 재배포 금지 서드파티 팩 (예: Rasak Modern)
- `L114` 네 층 타일셋 가르치기
  - `L120` 조수가 지금 받는 것
  - `L134` 네 층 팩을 가르치는 순서
  - `L154` Rasak Fantasy 파이프라인 (저장소 밖 그림)
  - `L166` MV/MZ 팩 프리셋 — 구현 (2026-09-24, Rasak Modern 도시 야외)
  - `L213` 건물 문법과 마을 짜임 (2026-09-25)
- `L296` 알려진 함정
- `L306` 강제 장치 (이 문서를 안 읽어도 걸리는 것)
- `L320` 칩셋 계열 규칙 (2026-09-25 사용자 결정)
- `L355` 문서의 번호가 새 프로젝트에 있어야 한다 (2026-09-25)

### `openwiki/team-project-host.md` — 51KB · 536줄 · ~15,628 토큰 · 통째읽기 잘림

- `L5` 사람 팀 협업은 접었다 — 저장 호스트는 그대로 (2026-10-21)
- `L33` 소유와 실행 위치
- `L58` 실행
  - `L68` 앱끼리 참여 (2026-09-28)
  - `L115` HTTP 참여의 지연 원인과 개선 (2026-09-28, Tailscale 실측)
  - `L143` 동료 저장 반영·부팅·첫 참여 전송량 (2026-09-28 2차)
- `L199` 기존 mdc-server 시작 명령의 SQLite 연결 (2026-09-18)
- `L217` 저장·협업 계약
- `L249` 큰 프로젝트의 HTTP 저장 전송 (2026-09-24)
  - `L269` 큰 문서 저장 봉투 (2026-09-28)
  - `L313` 헤드리스 대용량 콘텐츠 설치 (2026-09-25)
- `L326` 백업과 이전
- `L344` 검증 근거
- `L353` 호스트 페이지 CSP (2026-09-22)
- `L362` 적대적 리뷰 수정 (2026-09-18)
- `L375` 웹 새 프로젝트 생성 (2026-09-18)
  - `L393` 새 프로젝트의 공용 기본 자료 보장 (2026-09-24)
- `L412` 운영 systemd가 Vite preview에 고정된 경우 (2026-09-18)
- `L432` 맵 편집 권한 가져오기 (2026-09-18)
- `L447` 운영 AI와 로그인 유지 (2026-09-18)
  - `L460` 서버 재시작 뒤 열린 페이지의 옛 토큰 (2026-10-21)
- `L471` 내부 웹 기본 접속 (2026-09-18)
- `L482` Large bridge save requests (2026-09-24)
- `L488` 웹 편집기 저장 경로 경량화 (2026-09-25)
  - `L503` 저장 경로의 전체 복제·직렬화 제거 (2026-09-26~27)
  - `L523` Headless bridge readiness (2026-10-04)
  - `L529` 공용 라이브러리 게시 후 재로드 (2026-10-04)

### `openwiki/terrain-design-suite.md` — 23KB · 221줄 · ~7,261 토큰

- `L11` 도구 계약
- `L34` 대칭과 도장
- `L42` 소유와 저장
- `L58` 확인
- `L68` 적용한 지형 재편집
- `L80` 지형 다듬기와 물 표현
- `L90` 게임 상태 검사
- `L101` 공용 도장
- `L111` 게임 시야와 높이
- `L138` 확장 확인
- `L150` 빠른 집과 도로
- `L178` 시야·빠른 배치 확인
- `L193` 지붕과 부드러운 시야 확인 (2026-10-04)
- `L203` AI 조수의 동일 도구 사용 (2026-10-04)

### `openwiki/terrain-placement-tools.md` — 8KB · 89줄 · ~2,630 토큰

- `L9` 아이콘 도구와 도움말 (2026-10-04)
- `L30` 소유 경로
- `L42` 동작
- `L70` 저장·크기 변경
- `L79` 확인

### `openwiki/testing.md` — 265KB · 2403줄 · ~74,707 토큰 · 통째읽기 잘림

- `L3` AI 세션 테스트의 모델 id 는 임의로 짓지 않는다 (2026-09-14)
- `L19` 전체 스위트가 워커 힙에서 죽던 문제 (2026-09-11)
- `L53` PR 판정 = ci-fast(pull_request), 머지 = scripts/merge-pr.mjs, ci-full = 4시간 cron (2026-10-25)
- `L61` 그림 블라인드 검수의 Argon 은 `scripts/qa/argon-vqa.py` 로 (2026-10-25)
- `L69` main 의 ci-fast 는 다음 머지가 진행 중 잡을 끊지 않는다 (2026-09-26)
- `L76` parity 스위트 CI OOM (2026-09-19)
- `L88` ci-full vitest 는 힙 합을 75% 안에 둔다 (2026-10-04)
- `L112` 게이트 반복은 `--changed` 로 좁힌다 (2026-09-13)
  - `L139` vitest 는 왜 28분이고, 무엇을 만져도 안 줄어드는가 (2026-09-14 실측)
  - `L168` AI 조수 가족이 왜 이렇게 잘 뒤집히나 (실측)
- `L177` 격리 원장 `test/QUARANTINE.md` (2026-09-13)
- `L195` 브라우저 테스트는 별도 스테이지다 (2026-09-13)
- `L209` P5 delivery gates and the P4 regressions they caught (2026-09-09)
  - `L211` Open: checkpoint writes still slow the authoring loop
- `L263` P4 checkpoint storage and boot admission (2026-09-09)
- `L317` P3 request-bound fixture alignment (2026-09-08)
- `L342` Issue 693 verification contracts (2026-09-08)
- `L366` Request-coverage gate follow-up (2026-09-08)
- `L409` Native event battle reliability QA (2026-09-08)
- `L445` Real large-world player QA (2026-09-07)
- `L454` CSS budget: file count is informational
- `L466` Selection and composer surface contracts (2026-09-06)
- `L485` P3/current-main composition fixtures (2026-09-08)
  - `L512` Cooperative Node scheduling in long session fixtures (2026-09-08)
- `L528` AI turn observation contracts (2026-09-06)
  - `L549` P2 R1 retained-draft Ask (2026-09-07)
  - `L587` P2 R3 wiki delivery (2026-09-07)
- `L616` P3 ownership and stale-base verification (2026-09-07)
  - `L691` Autosave status fixture ownership (2026-09-08)
  - `L705` Project history transport isolation
- `L737` Canonical project storage versus AI history (2026-09-06)
  - `L739` 데스크톱(Electron) 스모크는 이렇게 돈다 (2026-09-16)
- `L762` Action RPG authoring and runtime proof (2026-09-07)
- `L783` Database CSS ownership contracts (2026-09-06)
- `L804` Audio description verification
  - `L828` Real editor surfaces
  - `L855` Exported-player playback and dependency evidence
- `L904` Mac onboarding Phase 1 contracts (2026-09-06)
- `L932` Task10 field-input verification and limits (2026-09-06)
- `L948` Life QA observation and action receipts (2026-09-06)
  - `L956` Task5 validation correction (2026-09-06)
  - `L964` Task5 Q1 audio boundary correction (2026-09-06)
- `L972` 기존 실패 비교는 진단 내용까지 확인한다 (2026-09-05)
- `L989` Esc 메뉴 동작·시각 검증 (2026-09-05)
- `L1007` Completed-house Phase 2 verification (2026-09-06)
- `L1038` P2 낚시·채집·도감·박물관 focused gate (2026-08-25)
- `L1045` Map-owned overlays: actual AI-turn browser regression (2026-09-05)
- `L1054` Editor e2e boot-overlay determinism (2026-08-31)
- `L1059` 영역 다듬기 focused gate (2026-08-31)
- `L1066` AI 이벤트 배치 통행성 focused gate (2026-08-30)
- `L1074` 체공(점프·낙하) focused gate (2026-08-29)
  - `L1083` 좌표 목적지 이동 QA — `node scripts/qa-coordinate-move.mjs` (OPRN-OUT-013, 2026-09-10)
  - `L1100` 좌표 이동 저작 폼 QA — `node scripts/capture-coordinate-move-form.mjs`
  - `L1109` 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`
  - `L1139` 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)
- `L1202` Roguelike run Phase 0–3 coverage (2026-08-24)
  - `L1213` 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)
- `L1222` 데이터베이스 UI/UX 계측 하네스 (2026-08-30)
  - `L1246` 가상 요소 텍스트를 안 재면 `tinyFont 0` 은 "안 봤다" 는 뜻이다 (실측)
  - `L1267` 0px 이미지는 "깨진 것" 과 "접힌 것" 을 갈라야 한다 (실측)
  - `L1273` 타이밍에 취약한 e2e 가 빨간불이면 그 스펙이 단정하는 속성을 직접 재라 (실측 2026-08-30)
  - `L1296` 소스를 grep 하는 테스트는 이름만 봐서는 회귀를 못 가른다 (실측)
- `L1304` Agent validation rule
- `L1415` Event-editor trust-loop validation (2026-07-30)
- `L1420` 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)
- `L1439` Tile-to-world persistence concurrency (task20)
- `L1445` P2 spatial focused gate (2026-08-25)
- `L1454` 대화창 연출 focused gate (2026-08-30)
- `L1529` 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)
  - `L1548` `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)
  - `L1560` 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)
  - `L1568` 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)
  - `L1575` `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)
- `L1597` 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)
  - `L1599` 메뉴 적대적 플레이 회귀 (2026-09-05)
  - `L1611` 바라보는 방향 기록 — `recordUntilJs` (2026-10-21)
  - `L1626` 런타임 QA 체크포인트 — 늦은 단계는 타이틀부터 다시 하지 않는다 (2026-10-21, hard rule)
- `L1814` sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)
- `L1821` NPC 배회 런타임 QA — `npm run qa:runtime -- --scenario npc-movement` (2026-09-17)
- `L1835` fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)
  - `L1856` Shared fake DOM enhancement contracts (2026-09-08)
- `L1888` bugfix-sweep 실제 표면 하네스 (2026-08-29)
- `L1901` 마을 설계서 (2026-09-05)
- `L1906` 공포 제작 개정 QA와 개발 서버 전송 (2026-09-05)
- `L1916` 상점 진열 중심 편집 검증 (2026-09-05)
- `L1924` 실제 DB로 나가는 전체 검사 요청 (2026-09-05 실측)
- `L1930` Request-bound functional acceptance verification (2026-09-07)
- `L1998` 조수 보상 저작과 출하 플레이어 검증 (2026-09-06)
- `L2008` 실내 조립·형상 검증 (2026-09-05)
- `L2012` Feature16 player preferences / inventory / shop (2026-09-21)
- `L2024` Feature16 통합 검증 (2026-09-21)
  - `L2032` 필드 HUD 브라우저 증거 (2026-09-21)
  - `L2038` 장르 HUD 시각 확인 (2026-09-21)
- `L2046` 실제 첫 생성 → 정본 재로드 → 출하 ZIP 플레이 (2026-10-03)
- `L2071` 맵 크기 성능 실측 (2026-10-01)
  - `L2092` 화면 주변 타일 유지 검증
  - `L2115` 공식 512×512 저작 상한 검증
  - `L2143` 공식 1024×1024 저작 상한과 성능 검증
- `L2161` 첫 자동 게임의 실제 대사 대기 (2026-10-04)
  - `L2177` Maker repair and click-first startup (2026-10-04)
- `L2202` 조수 기능별 실제 수행 점검 (2026-10-05)
- `L2206` FF6 수정 A 헤드리스 프로브 (2026-10-15)
- `L2212` 몬스터 여정 영상 (2026-10-07)
- `L2219` 세계 변형·입구·지형 조우 · ct-vehicle 픽스처 (2026-10-15, worker B)
- `L2229` 필드 스킬 게이트 시험 (2026-10-15, FF6 수정 C)
- `L2248` CT 회귀 시나리오 복구 (2026-10-15)
- `L2259` 팀 교대 전투 프로브 (2026-10-15, FF6 수정 A)
- `L2267` `qa:game check` 자동 플레이가 연애물을 거짓으로 막던 네 원인 (2026-10-16)
- `L2279` 연애 조수 한 편의 완성도 측정 — 조수 대용 3판 (2026-10-16, 2차 수리 C)
- `L2285` 몬스터 마을 시스템 시각 QA (2026-10-16)
- `L2289` 연애 3차 수리 검증 — 조수 대용 + 출하 플레이어 (2026-10-16, romance-fix-3)
- `L2296` 대사창 읽기 보조 검증 (2026-10-17)
- `L2303` 미연시 추가 화면 검증 (2026-10-17)
- `L2310` 에이전트 플레이 세션 · 재현 · 게임 카탈로그 (2026-10-22)
  - `L2355` 실물 게임(SQLite) 전투 런타임 QA — `qa:runtime --whole-game` (2026-10-29)

### `openwiki/tile-geometry.md` — 12KB · 145줄 · ~3,629 토큰

- `L5` 좌표 계약
- `L24` 캐릭터 자동 배율 (2026-09-21)
- `L48` 타일 크기가 섞인 프로젝트 (2026-09-24)
- `L74` 원본 아틀라스와 표시 크기의 구분
- `L91` 48px 일반 칩셋 가져오기 (2026-09-21)
- `L109` 브라우저 근거
- `L122` Slates 참고 맵 3종

### `openwiki/tile-layer-policy.md` — 31KB · 377줄 · ~9,460 토큰

- `L13` 다섯 부류
- `L26` 층 번호 ↔ 맵 칸 ↔ 도구 인자 (MZ 네 층, 2026-09-25)
- `L45` 받침(backing) 메타
- `L59` 커스텀 칩셋 준비 — 검토 신호, 자동 변형 금지
- `L69` 나무 밑동 290~293 을 상위로 옮기면 안 되는 이유
- `L77` OPRN-OUT-017 과의 관계 (원인 공유는 미증명)
- `L88` 테스트
- `L98` 브라우저 증거 (2026-09-10)
- `L118` 커스텀 칩셋 픽셀 자동 감지 — 출하된 계약
  - `L141` 임계값 — 실제 시트를 재서 얻은 수치다 (2026-09-10)
  - `L156` 브라우저 실측 (Modern Exteriors 아틀라스 480칸)
- `L164` 아직 결정이 필요한 것 (제품 소유자)
- `L169` 캔버스 렌더러도 받침 계약을 진다 (2026-09-12 실측 결함)
- `L192` 숲마을 공통 기본 칩셋 (2026-09-18)
- `L220` 성채 공통 기본 제공 타일셋 (2026-09-19)
  - `L246` 참고 이미지 보드와 성채 공간 카탈로그 (2026-09-19)
- `L277` LPC 나무 가구 공통 기본 제공 타일셋 (2026-09-21)
  - `L303` 공용 오브젝트 (2026-09-22)
  - `L328` 16px 병행판 (2026-09-22)
  - `L347` 픽셀 크기 기록 계약 (2026-09-22)
- `L369` AI 하위 페인트의 상위 가구 보존 (2026-09-25)

### `openwiki/tileset-reference-documents.md` — 60KB · 603줄 · ~18,386 토큰 · 통째읽기 잘림

- `L5` 공용 타일셋 참고 이미지는 호스트 주소다 (2026-09-26)
- `L20` 공용 SQLite 지역 참고문서 조회 (2026-09-24)
- `L31` 사용자 다운로드형 타일셋 지원 (2026-09-24)
  - `L72` 공간 설계·실제 발판 검사
- `L89` 사용자 경로와 정본
- `L106` 타일 화면 구성 (2026-09-21)
- `L127` 저장 계약
- `L140` AI 선행 읽기 계약
- `L174` Slates 이관
- `L187` 확인 자료와 범위
- `L193` Castle2 성채 학습 이관
- `L205` 숲마을 공용 자료 (2026-09-21)
- `L221` 공용 forest_harmony 참고문서 보충 (2026-09-22)
  - `L236` Castle2 공용 기본 제공 수정
- `L245` 실행형 부품·조립·검증 자료
- `L263` 공용 숲 실행 조립법 (2026-09-22)
  - `L280` 상세 공용 조립 계약 (public-assembly-v2)
- `L292` 이슬여울 마을 장식 표본 (2026-09-22)
- `L316` 다양한 마을의 번들 소유 참고문서 (2026-09-23)
  - `L332` 절벽 조립 교정 (2026-09-23)
  - `L342` 잔디 경계 개정3 (2026-09-23)
  - `L352` 굽은 지형·입구 개정4 (2026-09-23)
  - `L362` 생활 마당 개정5 (2026-09-23)
  - `L371` 사용 목적 개정6 (2026-09-23)
  - `L381` 공동 공간·정원 개정7 (2026-09-23)
  - `L392` 계단 대지 개정8 (2026-09-23)
  - `L407` 강과 폭포 개정9 (2026-09-23)
  - `L419` 컨셉 마을 3종 · 창문 개정10 (2026-09-23)
  - `L435` 판타지 장소 11곳 · 상점·성 내부·마왕성 (2026-09-23)
  - `L451` 기후 마을 · 설원·화산 (2026-09-23)
  - `L464` 사막·가을 기후 + 마을 사이 필드 (2026-09-23)
  - `L477` 나무 몸통 개정 — 잘린 줄기 없애기 (2026-09-23)
  - `L496` 공용 PAW 장면 실행 경로 (2026-09-25)
- `L517` PAW 천장 아래 벽과 실제 가게2종 (2026-09-25)
  - `L539` 수관 잎 채움 (2026-09-24)
- `L550` 번들 참고 이미지는 정적 경로다 (2026-09-25)
  - `L567` Emerald 몬스터 원본 도트 변형 (2026-10-04)
- `L571` 버들항 밝은 잔디 접지·꾸밈 공용 용도 (2026-10-04)
- `L600` 버들항 공동마당 배치 참고문서 (2026-10-04)

### `openwiki/title-opening-effects.md` — 49KB · 441줄 · ~14,682 토큰

- `L6` 데이터
- `L18` 프리셋
- `L27` 런타임
- `L36` 저작 경로
- `L75` 표본과 검증
- `L94` 입장 시퀀스 · 로고 반짝임 · 「새 게임」 전환 (2026-09-26)
- `L120` 깊이 시차 `parallax` (2026-09-26)
- `L138` 범위 밖 (이번에 안 한 것)
- `L145` 소프트웨어 WebGL 입자 계산 분리 (2026-09-28)
- `L179` Independent opening timelines
- `L183` Emerald monster opening atmosphere (2026-10-04)
  - `L224` Emerald professor native poses (2026-10-04)
- `L227` 타이틀 키보드 이동·크레딧 닫기 (2026-10-04)
- `L267` 시네마틱 장면 연출과 백그라운드 준비 (2026-10-04)
- `L300` 글자·장면 오프닝 연출 (2026-10-04)
- `L337` 스토리보드·독립 그림 모션·원곡 BGM (2026-10-04 후속)
  - `L388` 참고한 연출 계약
- `L398` 실제 첫 맵을 오프닝 뒤에서 준비 (2026-10-05)
- `L410` 타이틀 앞 인트로 트랙·별·달리기·PRESS START·이름 쇼케이스 (2026-10-25, 아스트라 호라이즌 1.18)

### `openwiki/ui-discovery-pilot.md` — 6KB · 108줄 · ~1,430 토큰

- `L7` Contract
- `L27` Run
- `L54` Score and decide
- `L69` Image capability trap
- `L81` 2026-09-08 pilot result

### `openwiki/unified-place-authoring.md` — 5KB · 54줄 · ~1,413 토큰

- `L7` 저작 계약
- `L28` 검증 근거
- `L46` 최종 판정

### `openwiki/village-design.md` — 20KB · 217줄 · ~6,206 토큰

- `L7` 데이터와 호환성
- `L15` 단일 시공 계약
- `L32` 편집 화면과 미리보기
- `L40` 현재 경계
- `L46` 기존 맵 재시공의 새 집 터 (2026-09-06)
- `L61` 검증
- `L67` 집 외형 연구 — 연결된 지붕 (2026-09-12)
  - `L94` 3·4층 확장 (2026-09-12)
  - `L115` 오브젝트·공간·장소 등록 (2026-09-12 후속)
  - `L144` 새 집 외형 30종 — 독립 제작과 통합 (2026-09-12)
  - `L175` 저장된 집에서 실제 마을로 (2026-09-12)
  - `L191` 조밀한 소형 주택 마을로 수정 (2026-09-13)
- `L210` 저장된 소규모 집 구성 (2026-09-13)

### `openwiki/wasteland-ruins.md` — 24KB · 175줄 · ~7,425 토큰

- `L6` 파일
- `L23` 조각
- `L48` 구성 규칙 (검수 r1~r3 에서 배운 것)
  - `L67` r5~r7 에서 더한 규칙
  - `L96` r9 에서 더한 규칙
  - `L107` r10~r11 에서 더한 규칙
  - `L118` r61~r62 에서 더한 것 (바닥 덧그림)
  - `L130` r63 에서 더한 것 (주인공 크기·고요한 바닥)
  - `L145` r64 에서 더한 것 (버들항에서 잰 키로 다시 키움)
  - `L153` r65 에서 더한 것 (지붕선·husk-b·고요한 길)
- `L159` 검수 기록
- `L171` 마을 종류 표 연결

### `openwiki/wizarding-world.md` — 18KB · 151줄 · ~5,336 토큰

- `L7` 식별자
- `L19` 현재 굽기 (2026-10-07)
- `L27` 공간 (wzlib.SPACES)
- `L32` 파일
- `L53` 굽기 순서 (한 번에)
- `L64` 검수 흐름
- `L73` 조수 공간 빌더
  - `L120` 조수 v2 경로 (2026-10-28)
- `L124` 통행 관문 WZ-ISLAND
- `L129` 조수 실경로 시험 (qa:game, 기획 `scripts/qa-game/briefs/wizarding-school.json`)
- `L141` 스토어 공개본
- `L146` 한계

### `openwiki/world-generation-rules.md` — 9KB · 116줄 · ~2,645 토큰

- `L7` 마을 기본형 변경 (2026-09-21)
- `L14` 소유 경계
- `L27` 절대 하지 말 것 — 미리보기 전용 계산식
- `L38` 낱말 규칙 (자연어, 정규식 금지)
- `L49` 수치가 통과하는 경로
- `L68` 새 규칙 항목을 추가할 때
- `L80` 필수 랜드마크 하드 게이트 (2026-09-04)
- `L96` 검증
- `L104` 마을 설계서 (2026-09-05)
- `L107` 저장·편집 검토 수정 복구 (2026-09-05)

### `openwiki/world-structure-authoring.md` — 6KB · 106줄 · ~1,895 토큰

- `L5` 정본과 진입점
- `L17` 다리
- `L40` 다층 산
- `L72` 다른 맵과 사용자 설정 보호
- `L91` 검증

### `openwiki/worldmap-game-research.md` — 10KB · 127줄 · ~3,225 토큰

- `L7` 조사 범위와 근거
- `L18` 먼저 구분할 것: 전도와 실제 이동 공간
- `L29` 포켓몬식: 지역 전도 + 마을·도로 필드
- `L54` 실제 그림에서 보이는 차이
- `L68` 대표 6가지 비교
- `L93` 조사 당시 월드맵 키트와 대조 (2026-10-04)
- `L107` 조사 당시 다음 구현 제안

### `openwiki/worldmap-navigation-structures.md` — 13KB · 146줄 · ~4,128 토큰

- `L7` 지원 범위
- `L25` 편집기와 조수
- `L53` 플레이어
- `L68` 데이터와 소유 파일
- `L85` 공용 배포
- `L105` 정본과 화면 근거
- `L123` 시각 수정판 (2026-10-05)
- `L138` 실제 조수 경로의 칩셋 계열 검사 (2026-10-05)

### `openwiki/worldmap-terrain-editing.md` — 36KB · 330줄 · ~10,939 토큰

- `L3` 키트 정본 = 공개 저장소 oprn-worldmap-kit (2026-10-20)
- `L26` 빈 지도부터 팔레트로 저작 (2026-10-05)
- `L56` 자동 붓과 조수 UX (2026-10-05)
- `L75` 적대적 시각 검수로 수정한 연결부 (2026-10-05)
- `L113` 흐름
  - `L115` 세계관별 준비 상태와 우주 조수 (2026-10-04)
  - `L133` 호스트 공용 DB와 조수 (2026-10-04)
- `L184` 재사용 팔레트 전환 (2026-10-05)
- `L198` 계약
- `L224` 새 구조 만들기 — `base: "generate"` (2026-10-03)
- `L270` 후속 조수 실행·SQLite 재로드 (2026-10-04)
- `L278` 지형 경계 v9 (2026-10-03)
- `L284` 글자 지도
- `L290` 조수 역할 적대 시험 (2026-10-03)
- `L297` 변형 세계(파멸 전/후) · 지형 태그 · 장소 입구 (2026-10-15, FF6급 감사 #26·#29·#35)
- `L321` 함정
