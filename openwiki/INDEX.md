<!-- 생성 파일 — 직접 고치지 말고 `npm run openwiki:index` 를 돌려라. -->
# OpenWiki 항해 색인

이 저장소의 위키는 **85쪽 / 3282KB / 약 934,690 토큰** 이다. 통째로 읽을 수 있는 크기가 아니므로, 필요한 절만 좌표로 잘라 읽어라.

```
read("openwiki/editor-database.md", offset=<절 시작줄>, limit=120)
grep -n "찾는말" openwiki/*.md          # 어느 페이지 몇 줄인지부터 찾는다
```

## 통째 읽기가 잘리는 페이지 (도구 상한 50KB)

이 페이지를 `read` 로 한 번에 열면 **조용히 잘린 채** 전달된다. 아래 절 목록의 줄 번호로 잘라 읽어라.
「가장 큰 절」이 상한 아래면 절 단위 읽기로 페이지 전부에 닿을 수 있다.

| 페이지 | 통짜 크기 | 가장 큰 절 | 줄 | 토큰 추정 |
|---|---|---|---|---|
| `openwiki/editor-ai-panel.md` | 502KB | 101KB ⚠상한 초과 — 절을 더 쪼개라 | 2974 | ~144,866 |
| `openwiki/editor-ai-tools.md` | 234KB | 86KB ⚠상한 초과 — 절을 더 쪼개라 | 1948 | ~66,351 |
| `openwiki/editor-database.md` | 351KB | 61KB ⚠상한 초과 — 절을 더 쪼개라 | 2118 | ~102,293 |
| `openwiki/editor-event-authoring.md` | 155KB | 78KB ⚠상한 초과 — 절을 더 쪼개라 | 872 | ~45,047 |
| `openwiki/editor-event-commands.md` | 61KB | 32KB | 242 | ~16,671 |
| `openwiki/editor-interior-room-harness.md` | 93KB | 6KB | 447 | ~26,831 |
| `openwiki/editor-pre-edit-routing.md` | 131KB | 69KB ⚠상한 초과 — 절을 더 쪼개라 | 761 | ~37,853 |
| `openwiki/editor-workflows-misc.md` | 67KB | 30KB | 474 | ~18,271 |
| `openwiki/runtime-battle.md` | 163KB | 31KB | 765 | ~46,677 |
| `openwiki/runtime-pre-edit-routing.md` | 51KB | 33KB | 341 | ~14,863 |
| `openwiki/runtime-project-schema.md` | 161KB | 65KB ⚠상한 초과 — 절을 더 쪼개라 | 1156 | ~44,175 |
| `openwiki/runtime-sessions.md` | 98KB | 48KB | 412 | ~25,880 |
| `openwiki/testing.md` | 205KB | 48KB | 1916 | ~56,826 |

## 한국어 산문이 깨진 페이지

EUC-KR→UTF-8 모지바케가 남은 줄이다. **그 줄의 한국어는 믿지 말고** 같은 줄의 파일 경로·식별자만 쓰고, 의미는 해당 소스 파일에서 직접 확인하라. 복원은 불가능하다(원본 바이트가 소실).

| 페이지 | 깨진 줄 수 | 예시 줄 번호 |
|---|---|---|
| `openwiki/editor-ai-panel.md` | 25 | 2298, 2299, 2300, 2301, 2302, 2303, 2317, 2327 |
| `openwiki/editor-ai-tools.md` | 6 | 1443, 1444, 1448, 1450, 1452, 1640 |
| `openwiki/editor-database.md` | 7 | 852, 856, 857, 858, 867, 893, 896 |
| `openwiki/editor-event-authoring.md` | 16 | 386, 387, 390, 395, 396, 397, 398, 399 |
| `openwiki/editor-event-command-fixes.md` | 11 | 11, 12, 14, 15, 16, 17, 18, 19 |
| `openwiki/editor-event-commands.md` | 6 | 109, 122, 123, 125, 128, 129 |
| `openwiki/editor-observability.md` | 1 | 335 |
| `openwiki/editor-pre-edit-routing.md` | 5 | 565, 574, 582, 586, 610 |
| `openwiki/state-system.md` | 2 | 5, 86 |

## 없는 파일을 가리키는 참조

문서가 이름을 부르는데 저장소에 없는 파일이다. 대부분은 **의도적으로 삭제된 모듈** 을 기록으로 남긴 것이지만(그 경우 문단이 삭제 사실을 말한다), 살아 있는 안내처럼 읽히면 에이전트가 없는 파일을 찾아 헤맨다. 문서를 고칠 때 이 목록이 줄어드는지 보라.

| 페이지 | 건수 | 참조 |
|---|---|---|
| `openwiki/PROJECT_WIKI.md` | 2 | `.part-N.css`, `src/styles/editor/core.part-1.css` |
| `openwiki/ai-workflow.md` | 5 | `20260709000000_ai_activity_logs.sql`, `src/ai/plannerSkip.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/tilesetAiClient.test.ts`, `test/volumeContractSession.test.ts` |
| `openwiki/bgm-catalog.md` | 4 | `artifacts/bgm-release/bgm-release-v1.json`, `catalog.raw.json`, `output/evidence/agy-interface-smoke-transcript.json`, `output/evidence/audio-ai-final/ingestion-report.json` |
| `openwiki/castle-map.md` | 12 | `.oprn.json`, `output/castle-reference-revision/runtime/SUMMARY.md`, `output/castle-study/runtime/SUMMARY.md`, `output/grand-castle/composite-recipes.json`, `output/grand-castle/runtime/SUMMARY.md`, `output/grand-castle/save-proof.json`, `save-proof.json`, `scripts/build-castle-2.mts`, `scripts/build-castle-map.mts`, `scripts/build-second-castle.mts`, `scripts/observe-castle-keep.mts`, `scripts/remove-castle-reference-bridge.mjs` |
| `openwiki/connected-dungeon-generation.md` | 1 | `verify-shots/runtime-qa/connected-dungeon-editor/SUMMARY.md` |
| `openwiki/delayed-tooltip.md` | 1 | `src/styles/editor/delayed-tooltip.css` |
| `openwiki/editor-ai-panel.md` | 74 | `.omo/evidence/assistant-glass-fold/measure.json`, `.omo/evidence/autonomous-ai-rpg/task-8-autonomous-ai-rpg.md`, `06-page-modern-forms.css`, `07-wide-compact.png`, `15-assistant-readable.css`, `17-assistant-modern-shell.css`, `DRAFT_20260706_auth_rls.sql`, `after/measure.json`, `aiCommandBar.ts`, `aiGlassPanelWidth.test.ts`, `aiSkillDrawer.ts`, `aiTeamDeck.ts`, `aiVolatileController.ts`, `assistant-skills.css`, `assistantP2ReviewIntegration.test.ts`, `chat-dock-switch.spec.ts`, `chatDock.ts`, `functionalCompositeClarification.test.ts`, `intentClarify.ts`, `newmain-after-measure.json`, `output/evidence/acceptance-live/README.md`, `output/evidence/ai-activity-levels/06-wide.png`, `output/evidence/ai-team-budget/SUMMARY.json`, `output/evidence/ai-team-menu/SUMMARY.json`, `output/evidence/ai-team-sidebar/SUMMARY.md`, `output/evidence/assistant-clean-glass/phase-2/implementation.md`, `output/evidence/assistant-ui-modern/newmain-before-measure.json`, `output/evidence/studio-drawer/qa/capture-report.json`, `output/evidence/ultrabrain/settings.png`, `plan-wire.json`, `regionIntentRouter.ts`, `review-input.png`, `roles-wire.json`, `scripts/qa/ai-team-budget.mjs`, `scripts/qa/assistant-side-seam-hittest.mjs`, `specialists.png`, `src/ai/intentClarify.ts`, `src/ai/plannerSkip.ts`, `src/ai/skills.ts`, `src/editor/chatDock.ts`, `src/styles/editor/ghost-phase-chip.css`, `test/agentBlueprintTurnEnd.test.ts`, `test/aiChatObservability.test.ts`, `test/aiChatPanelUxRepairs.test.ts`, `test/aiChatSessionScope.test.ts`, `test/aiComposerEffortPanel.test.ts`, `test/aiConversationRemoteHistory.test.ts`, `test/aiGlassFold.test.ts`, `test/aiGlassPanelWidth.test.ts`, `test/aiNewGoalDraftRetirement.test.ts`, `test/aiNewGoalEarlyOwnership.test.ts`, `test/aiPanelContextSurfaces.test.ts`, `test/aiStickyChecklist.test.ts`, `test/aiToolCallSessionProtocol.test.ts`, `test/aiWorkItemStall.test.ts`, `test/assistantAcceptance.test.ts`, `test/assistantAcceptanceSession.test.ts`, `test/assistantImageTransport.test.ts`, `test/assistantSpatialObligations.test.ts`, `test/chatDock.test.ts`, `test/e2e/_assistant-glass-shots.spec.ts`, `test/e2e/_glass-dock-report.spec.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/editSceneCameraFocus.test.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/plannerSkip.test.ts`, `test/regionIntentExposure.test.ts`, `test/regionTaskRun.test.ts`, `test/tilesetAiClient.test.ts`, `test/turnGuideSharedRules.test.ts`, `test/volumeContractSession.test.ts`, `test/workspaceBarAssistantDock.test.ts`, `verify-shots/feature16-ai/01-library.png`, `writer-wire.json` |
| `openwiki/editor-ai-tools.md` | 20 | `aiCommandBar.ts`, `aiProposalModal.ts`, `projectWikiSession.test.ts`, `tabs-b-assistant-panel.css`, `test/aiEventPlacementSurfaceGate.test.ts`, `test/aiStaleProposal.test.ts`, `test/aiToolCallSessionProtocol.test.ts`, `test/applyProposedProjectHouseProtection.test.ts`, `test/assistantMapPreservationGuard.test.ts`, `test/clusterAiModalHouseProtection.test.ts`, `test/elementRatesPartialAccept.test.ts`, `test/intentClarify.test.ts`, `test/npcCastSession.test.ts`, `test/projectLint.test.ts`, `test/propRejectionDiagnostics.test.ts`, `test/questGraph.test.ts`, `test/refactorTools.test.ts`, `test/regionTaskRun.test.ts`, `test/volumeContractSession.test.ts`, `test/worldAiExclusion.test.ts` |
| `openwiki/editor-database.md` | 42 | `.oprn-kit.json`, `builtinHouseStructureKits.ts`, `databaseCinematics.test.ts`, `desktop-record-shell.css`, `desktop-record-shell/13-actor-studio.css`, `editor-actor2.png`, `editor-conflict.png`, `editor-no-match.png`, `enemy-art-NNN.png`, `form-hierarchy-modern.css`, `houseKitTools.ts`, `output/evidence/battle-animation-ux/p1-implementation.md`, `output/evidence/battle-animation-ux/p2-implementation.md`, `output/evidence/battle-rules-ux/st_01a07318-manual-qa.md`, `output/evidence/battle-rules-ux/verification.md`, `output/evidence/character-face-correction/actor2-before-after.png`, `output/evidence/concept-expansion/legacy-db-proof.json`, `output/evidence/concept-v2/legacy-db-proof.json`, `output/evidence/monster-concepts/b1/fix.md`, `output/evidence/monster-concepts/p2/verification.md`, `output/evidence/monster-concepts/r1/fix.md`, `output/evidence/places-ux-audit/after/card-outline.png`, `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`, `output/spatial-ux-verify.mjs`, `publish-forest-place-library.mjs`, `reports/generated-effect-showcase-2026-08-24.html`, `reveal-fix.md`, `scripts/generate-default-item-icons.mts`, `scripts/lib/effectSheet/paintersMonster.mjs`, `scripts/lib/effectSheet/paintersUtility.mjs`, `scripts/repair-capture-rate-residue.mts`, `scripts/tmp-phase3-probe.mjs`, `src/styles/editor/harness-suggestion.css`, `test/databaseModalAiConnection.test.ts`, `test/databaseStudioV2.test.ts`, `test/databaseSystemView.test.ts`, `test/databaseTilesetFolder.test.ts`, `test/p0ProjectSchema.test.ts`, `test/spatialLegacyImport.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `troops.part-1.css`, `verify-shots/runtime-qa/menu-eras/EDITOR.md` |
| `openwiki/editor-event-authoring.md` | 14 | `03-legend-toolbar.css`, `05-force-modern-actor-page3.css`, `audit-before.md`, `event-editor-ai.css`, `event-editor.balanced.css`, `event-editor.part-3/08-inline-validation-badges.css`, `new-editor/REPORT.html`, `output/evidence/event-ai-assist-ux/960x900-compact.png`, `scripts/generated/toolCatalog.json`, `src/styles/editor/event-editor.balanced.css`, `src/styles/editor/event-editor.modernize.css`, `test/eventEditorTrustLoop.test.ts`, `verify-shots/page-preview-probe/02-preview-open.png`, `verify-shots/runtime-qa/cheolsu-keyboard-fixed/SUMMARY.md` |
| `openwiki/editor-event-command-fixes.md` | 16 | `.omo/evidence/event-command-remediation/U04/api-ownership.md`, `event-editor-rich-forms.css`, `scripts/qa/runtime/event-command-remediation-u02.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u04.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u05.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u06.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u14.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u28-text.scenario.mjs`, `test/e2e/event-command-remediation-U02.spec.ts`, `test/e2e/event-command-remediation-U04.spec.ts`, `test/e2e/event-command-remediation-U05.spec.ts`, `test/e2e/event-command-remediation-U06.spec.ts`, `test/eventCommandRemediation/U02.test.ts`, `test/eventCommandRemediation/U04.test.ts`, `test/eventCommandRemediation/U05.test.ts`, `test/eventCommandRemediation/U06.test.ts` |
| `openwiki/editor-event-commands.md` | 16 | `02-changeface-play-mock-larger.css`, `07-identifiable-previews.css`, `choicesDialog.ts`, `event-editor.command-preview.css`, `event-editor.command-preview/01-event-editor-modern-import.css`, `event-editor.commerce.css`, `event-editor.part-1.css`, `event-editor.part-2/3.css`, `event-editor.shop.css`, `eventCommandSupportRepairs.test.ts`, `messageCommandDialogs.ts`, `messageDialogControls.ts`, `src/styles/editor/event-editor.part-2.css`, `test/dialoguePreviewPresentationCss.test.ts`, `test/eventEditorTrustLoop.test.ts`, `textCommandDialog.ts` |
| `openwiki/editor-genre-packs.md` | 3 | `src/editor/panels/newProjectDialog.ts`, `test/modalEscapeLayerGate.test.ts`, `test/transactionalNewRemoteProject.test.ts` |
| `openwiki/editor-interior-room-harness.md` | 38 | `hearth-lit.json`, `hearth-unlit.json`, `output/audit-element-cliff-seams.py`, `output/audit-element-complex-seams.py`, `output/audit-four-context-dungeons-v3.py`, `output/audit-four-context-dungeons.py`, `output/build-element-complex-caves.mts`, `output/build-element-confluence-caves.mts`, `output/build-element-contour-caves.mts`, `output/build-four-context-dungeons-v2.mts`, `output/build-four-context-dungeons-v3.mts`, `output/build-four-context-dungeons.mts`, `output/context-element-caves.mts`, `output/decorate-element-caves.mts`, `output/element-complex-qa.mjs`, `output/element-confluence-qa.mjs`, `output/element-contour-qa.mjs`, `output/evidence/concept-v2/index.html`, `output/evidence/inn-exploration-v4/index.html`, `output/evidence/inn-inspection-v5/index.html`, `output/evidence/pr618-fixtures/inn.json`, `output/four-context-dungeons-qa.mjs`, `output/four-context-dungeons-v3-qa.mjs`, `output/save-element-complex-caves.mts`, `output/save-element-confluence-caves.mts`, `output/save-four-context-dungeons-v3.mts`, `output/save-four-context-dungeons.mts`, `reports.json`, `scripts/demo-assistant-interior-build.mts`, `seam-audit.json`, `test/innConceptRebuild.test.ts`, `test/innExploration.test.ts`, `test/interiorConceptAssemblies.test.ts`, `test/interiorLoadConsistency.test.ts`, `test/interiorLongTable.test.ts`, `test/stoneHearth.test.ts`, `test/storeDeferredLineage.test.ts`, `test/storeSaveOrdering.test.ts` |
| `openwiki/editor-observability.md` | 2 | `scripts/qa/issue693-boot-diagnostics.mjs`, `scripts/qa/issue693-diagnostics.mjs` |
| `openwiki/editor-pre-edit-routing.md` | 20 | `@/styles/database/index.css`, `authoringTestGate.ts`, `dbConnectionAdvancedSettings.ts`, `event-editor.part-4.css`, `figma-editor.css`, `figma-editor/10-map-tree.css`, `legacyDb-root-cache.spec.ts`, `rm2k3.part-1.css`, `shell/editor-responsive-expert.css`, `src/editor/tools/worldTools.ts`, `src/project/legacyDbProjectSync.ts`, `src/styles/editor/event-editor.balanced.css`, `src/styles/editor/left-sidebar.modern.css`, `src/styles/editor/map-location-layer.css`, `src/styles/editor/map-props.css`, `src/styles/editor/region-task.css`, `test/modalEscapeLayerGate.test.ts`, `test/regionTaskHouseProtection.test.ts`, `test/worldAiExclusion.test.ts`, `worldTools.ts` |
| `openwiki/editor-validation.md` | 8 | `final-layout.json`, `test/aiBlockedEventRelocation.test.ts`, `test/aiToolDiscoveryEscalation.test.ts`, `test/databaseSystemView.test.ts`, `test/interiorLongTable.test.ts`, `test/p0ProjectSchema.test.ts`, `test/projectLint.test.ts`, `viewport-matrix.json` |
| `openwiki/editor-workflows-misc.md` | 22 | `.qa.json`, `default.json`, `game.html`, `loadNewRemoteProject.test.ts`, `release.json`, `runtime.json`, `scripts/build-dungeon-themed-maps.mts`, `scripts/build-grand-ice-cave.mts`, `scripts/build-ice-pass-map.mts`, `scripts/extend-home-8pyeong-with-dungeons.mts`, `src/editor/authoringTestGate.ts`, `src/styles/editor/audio-test-dialog.css`, `src/styles/editor/event-editor-help.css`, `src/styles/editor/help-modal.css`, `src/styles/editor/map-event-search.css`, `src/styles/editor/map-props.css`, `test/audioDescriptionCommandSurfaces.test.ts`, `test/audioDescriptionLifecycle.test.ts`, `test/devRuntimeArchive.test.ts`, `test/mapSurfaceFocus.test.ts`, `test/runtimePictureStacking.test.ts`, `transactionalNewRemoteProject.test.ts` |
| `openwiki/emerald-fields.md` | 27 | `ANALYSIS.md`, `VISUAL-SUMMARY.md`, `author-emerald-wide.mts`, `cliff-contours.json`, `editor-saved-proof.json`, `emerald-wide-v2/reloaded-project.json`, `exit-seam-proof.json`, `fidelity/fidelity-proof.json`, `fidelity/reference-vs-editor.png`, `fidelity/runtime-visual/SUMMARY.md`, `inspection-16-fixed/manifest.json`, `inspection-16/REVIEW.md`, `map-open-saved.png`, `output/evidence/emerald-fields/fidelity/VALIDATION.md`, `output/evidence/emerald-region/legacy-db-proof.json`, `output/evidence/emerald-wide/reloaded-project.json`, `refine-emerald-reference.mts`, `region-saved.png`, `road-graph.json`, `scripts/author-emerald-fields.mts`, `scripts/author-emerald-wide.mts`, `scripts/refine-emerald-reference.mts`, `scripts/refine-emerald-wide.mts`, `scripts/register-emerald-region.mts`, `verify-shots/runtime-qa/emerald-fields/SUMMARY.md`, `verify-shots/runtime-qa/emerald-wide-v2/SUMMARY.md`, `verify-shots/runtime-qa/emerald-wide/SUMMARY.md` |
| `openwiki/feature16-battle-ui.md` | 1 | `verify-shots/runtime-qa/feature16-battle-ui/SUMMARY.md` |
| `openwiki/growth-trees.md` | 3 | `.omo/evidence/growth-integrated/browser-presets/report.json`, `applied-bundle.json`, `verify-shots/runtime-qa/growth-tree/SUMMARY.md` |
| `openwiki/horror-authoring.md` | 2 | `motion-sheet.png`, `projectLint.test.ts` |
| `openwiki/large-village-generation.md` | 6 | `-standalone.html`, `HANDOFF.json`, `output/evidence/town-reference/town-reference.html`, `scripts/force-save-large-village.mts`, `scripts/force-save-village-50.mts`, `src/project/defaults/largeRiverMarketVillageBuild.ts` |
| `openwiki/location-layer-affordance-audit.md` | 1 | `src/styles/editor/map-location-layer.css` |
| `openwiki/night-monster.md` | 2 | `build-night-monster.mts`, `verify-shots/runtime-qa/night-monster/SUMMARY.md` |
| `openwiki/project-wiki.md` | 2 | `projectWikiSession.test.ts`, `projectWikiTimeout.test.ts` |
| `openwiki/quickstart.md` | 1 | `.oprn-local.json` |
| `openwiki/runtime-action-combat.md` | 1 | `export-player/player.html` |
| `openwiki/runtime-battle.md` | 7 | `battle.css`, `hero-03-battle-idle.png`, `output/evidence/event-command-completion/battle/VERIFICATION.md`, `raw.png`, `scripts/legacy-db-resource-root/catalog.mjs`, `src/styles/runtime/battle/18-pokemon-layout-redesign.css`, `starter/hires/hero-0N-battle.png` |
| `openwiki/runtime-m2-flow-controls.md` | 3 | `test/runtimePictureStacking.test.ts`, `verify-shots/runtime-qa/cloud-shadows/SUMMARY.md`, `verify-shots/runtime-qa/coordinate-move/SUMMARY.md` |
| `openwiki/runtime-pre-edit-routing.md` | 4 | `editor/core.part-1.css`, `test/playerInputCss.test.ts`, `test/runtimeQaInstrumentationBoundary.test.ts`, `verify-shots/runtime-qa/emote/SUMMARY.md` |
| `openwiki/runtime-project-schema.md` | 27 | `.json`, `.png`, `20260827000000_ai_log_anon_delete_revoke.sql`, `DRAFT_20260706_auth_rls.sql`, `devMediaPromotion.test.ts`, `dist-electron/main.cjs`, `interiorLoadConsistency.test.ts`, `mediaImportDurability.test.ts`, `output/evidence/event-command-completion/legacy-persistence/ledger.json`, `scripts/lib/legacyDb-database-ops.mjs`, `scripts/publish-first-visit-demo.mts`, `scripts/qa/issue693-media.mjs`, `src/project/legacyDbProjectSync.ts`, `storeLifecycleReentrancy.test.ts`, `storePersistenceLineage.test.ts`, `test/aiBlockedEventRelocation.test.ts`, `test/audioDescriptionConcurrentPersistence.test.ts`, `test/io.test.ts`, `test/legacyDbCanonicalRoundtrip.live.test.ts`, `test/legacyDbDatabaseOps.node.test.mjs`, `test/legacyDbMapPatchRecovery.test.ts`, `test/legacyDbProjectSync.test.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/mapPlanningReuse.test.ts`, `test/sharedDemoStore.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `transactionalRemoteSourceLineage.test.ts` |
| `openwiki/runtime-sessions.md` | 4 | `output/evidence/stardew/stardew-legacyDb.json`, `verify-shots/runtime-qa/feature16-player/SUMMARY.md`, `verify-shots/runtime-qa/menu-design/SUMMARY.md`, `verify-shots/runtime-qa/weather-after/SUMMARY.md` |
| `openwiki/se-catalog.md` | 8 | `.mjs`, `audio-features.json`, `audition.html`, `cross-check.json`, `dist/se-staging/audition.html`, `labels.json`, `placed.json`, `test/audioDescriptionCommandSurfaces.test.ts` |
| `openwiki/slates-assembly-playbook.md` | 1 | `ville_0.png` |
| `openwiki/slates-structure-learning.md` | 1 | `read-slates-project.mjs` |
| `openwiki/slates-study.md` | 3 | `output/slates-study/source-project.json`, `scripts/content/save-slates-study.mjs`, `source-row.json` |
| `openwiki/slates-village-authoring.md` | 1 | `save-slates-village-50.mjs` |
| `openwiki/spatial-authoring-controller.md` | 1 | `storeMutationInstrumentation.test.ts` |
| `openwiki/spatial-catalog-ui.md` | 1 | `output/evidence/interior-removal-executed/host-proof.json` |
| `openwiki/spatial-geography-compiler.md` | 1 | `.omo/ulw-execute/tile-to-world/execution-policy.md` |
| `openwiki/spatial-geography-ui.md` | 3 | `.oprn.json`, `lake-persistence.json`, `lake-regions-desktop.png` |
| `openwiki/spatial-place-compiler.md` | 2 | `interior-catalog-editor.mjs`, `scripts/register-house-spatial-catalog.mts` |
| `openwiki/stardew-core-elements-research.md` | 1 | `scripts/save-stardew-demo.mts` |
| `openwiki/storage-retirement.md` | 1 | `.oprn-local.json` |
| `openwiki/testing.md` | 37 | `../dialogue.css`, `.omo/gates-vitest-report.json`, `X.quarantine.test.ts`, `X.test.ts`, `acceptance-live-check.mjs`, `aiChatObservability.test.ts`, `aiChatPanelTransportError.test.ts`, `aiSelectionChipScope.test.ts`, `browser-play-start.png`, `browser-title.png`, `event-editor.command-preview/07-identifiable-previews.css`, `legacyDb-proof-first-save.json`, `output/evidence/acceptance-live/README.md`, `output/evidence/concept-expansion/README.md`, `output/evidence/concept-v2/validation.json`, `output/evidence/functional-acceptance/public-smoke.json`, `output/evidence/horror-mystery-prototype/browser-qa.json`, `scripts/author-natural-village-harness.mts`, `scripts/author-natural-village-reference.mts`, `scripts/build-horror-mystery-prototype.mts`, `scripts/qa/acceptance-live.mjs`, `test/actionRpgAuthoringAcceptance.test.ts`, `test/aiEventPlacementSurfaceGate.test.ts`, `test/autosaveStatus.test.ts`, `test/databaseKoreanRtpDefaults.test.ts`, `test/dialoguePreviewPresentationCss.test.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/dialogue-nameplate-clears-body.spec.ts`, `test/interiorConceptAssemblies.test.ts`, `test/loadNewRemoteProject.test.ts`, `test/regionTaskRun.test.ts`, `test/storePersistenceProof.test.ts`, `test/tilesetAiClient.test.ts`, `verify-shots/runtime-qa/action-rpg/SUMMARY.md`, `verify-shots/runtime-qa/coordinate-move/SUMMARY.md`, `verify-shots/runtime-qa/esc-menu/SUMMARY.md`, `verify-shots/runtime-qa/status-menu-adversarial/SUMMARY.md` |
| `openwiki/tile-geometry.md` | 2 | `output/slates-reference/source-row.json`, `scripts/content/save-slates-reference.mjs` |
| `openwiki/tile-layer-policy.md` | 2 | `Castle2_5.png`, `clean_furniture.png` |
| `openwiki/tileset-reference-documents.md` | 3 | `scripts/content/save-tileset-references.mjs`, `tilesetAiQuestionEditor.ts`, `tilesetCheckerSummary.ts` |
| `openwiki/town-tile-benchmark.md` | 1 | `combined-town-chipset-report.html` |
| `openwiki/ui-discovery-pilot.md` | 3 | `direct/RESULTS.json`, `output/evidence/ui-discovery-v2/report.html`, `trace.json` |
| `openwiki/village-design.md` | 7 | `20260907000000_spatial_authoring_cas.sql`, `depth-review.json`, `output/evidence/house-heights/REVIEW.md`, `output/village-direction/index.html`, `scripts/build-house-study-gallery.mts`, `scripts/publish-compact-village.mts`, `scripts/publish-object-village.mts` |
| `openwiki/village-layout-research.md` | 1 | `scripts/qa/capture-restored-river-village.mjs` |
| `openwiki/world-structure-authoring.md` | 1 | `verify-shots/runtime-qa/world-structure-tools/SUMMARY.md` |

## 페이지별 절 좌표

### `openwiki/PROJECT_WIKI.md` — 13KB · 155줄 · ~3,536 토큰

- `L5` Purpose
- `L16` Required pre-edit read order
- `L62` Project identity
- `L71` Main ownership boundaries
- `L103` Authored tile placement references
- `L109` How an AI should use this wiki
- `L120` 프로젝트 정본 저장 (see root `AGENTS.md`)
- `L128` Desktop UI integration truth (2026-08-11)
- `L136` Per-project wiki structure
- `L152` Staleness rule

### `openwiki/agent-tile-benchmark.md` — 11KB · 195줄 · ~3,365 토큰

- `L6` town 트랙과 무엇이 다른가
- `L19` 지시서는 생짜다
- `L39` 채점은 픽스처에서 독립한다
  - `L50` 채점 — 결함 밀도
  - `L79` scale
- `L85` 실행
- `L99` 실측 (2026-08-21)
  - `L130` 턴을 더 줘도 haiku 는 나아지지 않았다
  - `L142` 구성 지표는 quality 와 분리한다
  - `L143` quality 는 천장이 있다 — 상위는 구성 지표와 효율로 가른다
  - `L177` 턴 예산이 결과를 지배한다
- `L191` 비용 주의

### `openwiki/agent-worktrees.md` — 18KB · 256줄 · ~5,635 토큰

- `L8` hard rule — gates / vitest / stash 금지 (2026-09-17)
- `L16` 적용 범위
- `L26` 명령
- `L38` `git stash` 를 쓰지 마라 (실측 2026-09-10, 남의 작업을 꺼내 버렸다)
- `L65` 회수 규칙 (커밋이 유일한 안전망)
  - `L77` 에이전트에게 줄 지시
  - `L123` 동시 생성 (에이전트 수십 개)
  - `L143` e2e 는 `DEV_SERVER_PORT` 없이 돌리면 **남의 코드를 검증한다** (실측 2026-08-29)
- `L163` 검증 게이트
  - `L165` 통합 작업의 검증 대상 고정 (2026-09-06)
  - `L184` 왜 기준선 방식인가
  - `L195` 왜 별도 스크립트인가
- `L204` 감독 절차
- `L215` 알려진 함정

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

### `openwiki/ai-workflow.md` — 38KB · 269줄 · ~10,298 토큰

- `L7` Before changing files
- `L15` While changing files
  - `L163` Request-bound NPC prerequisite proof (CR-NPC-PREREQ-01, 2026-09-07)
- `L219` After changing files
- `L226` Tool-calling architecture (human review map)
- `L236` Headless Tool and MCP Access
- `L245` Live editor AI assistant MCP (same UI session)
- `L264` Refreshing the wiki

### `openwiki/architecture.md` — 10KB · 70줄 · ~2,684 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/autotiles.md` — 20KB · 179줄 · ~5,606 토큰

- `L5` World 지형과 공통 구조물
- `L25` 1. RM2K식 3×4 템플릿 블록 문법
- `L41` 2. 지형 앵커 카탈로그 — 4행 밴드 × 열 0/3/6/9 격자
- `L60` 3. 물 계열 — 오토타일 그룹이 아닌 별도 시스템
- `L78` 3-1. 던전 칩셋 절벽(빙암) — 벽은 두 행이다
- `L112` 4. 오토타일 등록 경로 3가지
- `L120` Integrated World snapshot (2026-09-06)
- `L134` Terrain placement regression contracts (2026-09-08)
- `L151` 5. 검증
- `L159` Tibo recovery (2026-09-17)
- `L172` 실내 천장 기본 등록과 쿼터 합성 (2026-09-18)

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

### `openwiki/bgm-catalog.md` — 23KB · 338줄 · ~5,974 토큰

- `L8` Why this exists
- `L19` Facts an agent needs
- `L36` Files and ownership
- `L57` Release pack installation (2026-09-07)
- `L89` In-editor installation and live inventory (2026-09-09)
- `L125` Producing and publishing the pinned pack
- `L152` Regenerating
  - `L162` sha256 caveat
- `L170` CDN wiring
- `L200` How authors reach the tracks
- `L232` Project audio descriptions
  - `L264` Shared AI analysis drafts (2026-09-08)
- `L305` Traps

### `openwiki/castle-map.md` — 21KB · 348줄 · ~5,401 토큰

- `L7` Goal
- `L11` Modules (Combined Town)
- `L23` Observed layout recipe (`map_castle_keep` 48×40)
- `L40` Do / don’t
- `L48` Build tool
- `L56` Code owners
- `L66` Validation
- `L72` Screenshot reference is not tile-assembly evidence (2026-09-19)
- `L86` Second castle: assembled courtyard map (2026-09-19 correction)
  - `L100` Harbor and nature follow-up (2026-09-20)
  - `L122` NPC and activity pass
  - `L147` Measured Castle2 assembly rules
- `L175` GPL reference bridge removal (2026-09-21)
- `L193` Reusable original-atlas study (2026-09-21)
- `L240` Grand river fortress city (2026-09-21)
- `L292` Visual-style rejection and reference study (2026-09-21)
- `L305` Reference revision and durable tile study (2026-09-21)
- `L320` Density improvement 01 (2026-09-21)
- `L333` Exterior scene improvement 02 (2026-09-21)
- `L342` Shared place: river fortress (2026-09-21)

### `openwiki/castle-reference-art-direction.md` — 1KB · 11줄 · ~192 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/community-site.md` — 20KB · 178줄 · ~5,235 토큰

- `L5` Data
- `L13` Interop contract (do not break)
- `L20` Immutable publication and playback (2026-09-06)
  - `L34` Frozen dependency authority (P2, 2026-09-07)
  - `L75` Release QA and migration commands
- `L144` Feature map (v2, 2026-07-21)
- `L152` Historical in-browser play (v3, 2026-07-21; superseded)
- `L168` Ops notes
- `L172` Gotchas learned

### `openwiki/connected-dungeon-generation.md` — 6KB · 38줄 · ~1,781 토큰

- `L5` 진입과 호환성
- `L13` 소유 모듈
- `L21` 설계 입력
- `L33` 검증 및 증거

### `openwiki/delayed-tooltip.md` — 5KB · 76줄 · ~1,496 토큰

- `L11` 동작 계약
- `L28` 문구 규칙
- `L36` 맵 도구바·접이식 왼쪽 레일 (2026-09-18)
- `L45` 1차 롤아웃 대상
- `L55` 설치 지점
- `L61` 테스트

### `openwiki/editor-ai-panel.md` — 502KB · 2974줄 · ~144,866 토큰 · 통째읽기 잘림 · 깨진 줄 25

- `L4` 제작 전 그래픽 선택과 자동 큰 창 (2026-09-21)
- `L28` 이미지 중심 작업 피드 (2026-09-21)
- `L59` 조수와 팀 크게 보기 (2026-09-21)
- `L84` 작업 표시 네 단계와 별도 실행 기록 (2026-09-21)
- `L118` 첫 페인트 스타일 소유권 (2026-09-19)
- `L132` 채팅 입력창 작업 설정 묶음 (2026-09-18)
- `L148` 검토 대기 액션은 작업 과정 밖에 둔다 (2026-09-18)
- `L168` 팀 분업 유즈케이스와 맵 밖 작업 배정 (2026-09-18)
- `L196` 팀 내 A2A 메시징 (2026-09-18)
- `L227` 왼쪽 AI 대화 + 오른쪽 팀원 아바타 (2026-09-18)
- `L268` 빈 대화의 읽기 전용 프로젝트 제안 (2026-09-18)
- `L278` 사이드바 AI 추천이 거의 작동하지 않던 세 원인 (2026-09-20)
- `L312` 진단 카드를 캔버스 오른쪽 아래 느낌표 버튼으로 옮긴다 (2026-09-21)
- `L346` 팀 설정 목록과 편집 화면 (2026-09-18)
- `L355` 팀 초안 격리와 최종 보정 (2026-09-18)
- `L363` 밑그림이 Pi 경로로 돌아왔다 — 워커가 툴마다 `map_delta` 를 흘린다 (2026-09-17)
- `L396` 턴 슬롯은 의도 분류 전에 잡는다 + Pi 턴 감사 누적 (2026-09-16)
- `L420` 결과 보고서 모달 — 변경 지점마다 before/after 한 쌍 (2026-09-15, P2)
- `L441` 조수 데크 「대화|작업」 탭 + 스튜디오 상세 — 팀원이 어디서 일하는지 한 곳 (2026-09-14, A안)
- `L475` 조수 채팅은 Pi 하나다 — 세션 경로를 걷어냈다 (2026-09-11)
- `L560` 단독 작업은 결과 중심으로 표시한다 (2026-09-14)
- `L580` 단순 생성·수정은 계획 필요 여부로 실행한다 (2026-09-18 갱신)
- `L608` Five model roles and whole-map harmony review (2026-09-14)
  - `L656` 검수 응답 재시도와 정직한 보고 (2026-09-16)
- `L706` Retained map planning items and explicit reuse (2026-09-10, OPRN-019)
- `L747` Run outcome line: four independent axes (2026-09-09)
- `L798` P3 run retirement and stale drafts (2026-09-07)
- `L878` Map-scoped conversation archive (2026-09-08)
  - `L938` Editor history surface
- `L980` Independent result review and repair (2026-09-06)
- `L1083` Combined P2 and independent-review ownership (2026-09-07)
- `L1117` P2 run outcomes and user scope actions (2026-09-06)
  - `L1173` Canonical requirements and genuine user actions
- `L1245` User-confirmed interaction approach correction (CR-P7-1, 2026-09-08)
- `L1282` Live large-world QA: plan repair and final audit (2026-09-07)
- `L1371` Assistant control audit fixes (2026-09-07)
- `L1382` World structure activity labels (2026-09-06)
- `L1391` Multi-map construction specifications (2026-09-06)
- `L1458` Plan authoring has no small-plan quota (2026-09-06)
- `L1477` Acceptance sticky note (2026-09-07)
  - `L1527` Session-owned acceptance contract
- `L1865` 자동 프로젝트 위키 (2026-09-07)
- `L1897` Independent image generation settings (2026-09-07)
- `L1898` Independent image generation settings (2026-09-08)
- `L1936` 브라우저 포커스와 도구 실행 대기 (2026-09-05)
- `L1943` Map-targeted work outcomes (2026-09-06)
- `L1958` 계획 항목의 연속 실행 증거 (2026-09-05)
- `L1964` 계획 규모와 선언 자세 (2026-09-09)
- `L1974` 조회 선행·계획 완료와 실행 종료 (2026-09-05)
- `L1983` 조수 카메라 이동 수명·부드러운 줌 (2026-09-05)
- `L1993` 조수의 맵 전환은 크로스페이드다 — 하드컷 금지 (2026-09-15)
- `L2079` 패널 셸 · 도크 · 접기 · 컴포저
- `L2227` 세션 수명 · 대화 컨텍스트
- `L2244` 제안 적용 · 복구 · 완성도 린트
- `L2331` 고스트 미리보기 · 활동 표시 · 청사진 · 카메라
- `L2392` 영역 작업 · 시공 · 실내/집 파이프라인
- `L2416` 툴 노출 · 프롬프트 · 의도 판정 · NPC
- `L2430` 타일셋 이해 · 검토 위저드 (T1a/T1b)
- `L2456` 저장 · 내보내기 · 프로젝트 생성
- `L2464` 제공자 · OAuth · 동반 서비스
- `L2496` Autonomous run mode (autonomous-ai-rpg, todos 1-6)
- `L2539` 분리 브랜치 마일스톤 회계 복구 (2026-09-05)
- `L2572` 배치 의존성과 완료 멱등성 (2026-09-06)
- `L2580` 모험 완료와 실제 적용 횟수 (2026-09-05)
- `L2585` Assistant clean conversation — Phase 1 (2026-09-06)
- `L2622` Assistant deck width resize (2026-09-07)
  - `L2634` Legacy AI contract verification (2026-09-08)
- `L2656` 의도 선언과 커버리지 감사는 각자 예산을 쓴다 (2026-09-16)
- `L2673` 동반 서비스 자격: OMP 로그인 재사용과 명시적 해제 (2026-09-19)
- `L2692` 에이전트 레인 — 묶음별 병렬 실행과 레인별 적용 (2026-09-15)
- `L2721` 스튜디오 3분할 — 가운데는 맵, 왼쪽은 실시간 조수·채팅, 오른쪽은 지금 보는 채팅 (2026-09-16)
- `L2737` 하단 덱 → 오버레이 드로워 (2026-09-16)
- `L2751` 수용 기준: DB 레코드 값과 지연 적용의 런 수명 (2026-09-16)
- `L2769` 조수 턴 예산 확대 (2026-09-18)
- `L2777` 결과 본문과 접힌 작업 과정 (2026-09-18)
- `L2787` 팀원 작업 예산 버튼 (2026-09-18)
- `L2799` 왼쪽 팀 운영 메뉴 (2026-09-18)
- `L2821` 다섯 적용 모드와 실제 맵 증분 반영 (2026-09-18)
- `L2860` Feature16 — 프롬프트 라이브러리·대사 검토·실제 요청 검사기 (2026-09-21)
- `L2902` Pi 단일 마을 요청 계약 (2026-09-21)
- `L2932` Pi 시공 연출과 공간 밑그림 복구 (2026-09-21)
- `L2963` 실시간 맵 연출 헤드리스 (2026-09-22)
- `L2971` 조수 적용은 바뀐 칸만 다시 그린다 (2026-09-22)

### `openwiki/editor-ai-tools.md` — 234KB · 1948줄 · ~66,351 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L3` 충격 연출 (2026-09-22)
- `L9` 단독 조수의 병렬 도구 실행 (2026-09-21)
  - `L32` 검색 중 사용자에게 보이는 것 (2026-09-21 실측)
- `L33` AI 새 야외·마을의 기본 칩셋 (2026-09-21)
- `L57` 마을 군락 — 굽이숲 절벽마을 조립 (2026-09-21)
- `L98` 참조 작품 비유 → 자율 웹 검색 (2026-09-21)
  - `L111` 죽은 Codex 자격이 검색·완성을 영구히 막던 문제
  - `L119` 검증
- `L127` 조수 웹 검색 도구 (2026-09-21)
- `L151` 감사 후속: 부분 갱신과 미사용 삭제 (2026-09-20)
- `L159` 전투 저작 입력 수정 (2026-09-20)
- `L161` 이벤트 명령 AI 공용 도구 (2026-09-20)
- `L211` 전투 저작 입력 수정 (2026-09-20)
- `L222` NPC 공용 얼굴 매핑 연결 (2026-09-18)
- `L235` 이식 타일 최초 검수 준비 대기 (2026-09-18)
- `L247` paint_tiles 타일 인덱스 검증 — 유일하게 빠져 있던 가드 (2026-09-16)
- `L266` 오프닝 미디어 배선 — 스틸 카탈로그·배경음악·부분 편집 (2026-09-14)
- `L303` 오프닝 시네마틱 AI 저작 — system.opening (2026-09-14)
- `L331` 도면 문법에 wing(세로 복도) 추가 — 실루엣 변주와 물건 대체군 (2026-09-11)
  - `L356` 후속: 석조 화로는 복도 끝 알코브에 (2026-09-11)
  - `L373` 팔레트 확장 — 안 쓰던 칩셋 그림 16종을 물건으로 (2026-09-11)
- `L393` 실내는 찍어내지 않는다 — place_concept 은 설계를 요구하고, author_house 는 interiorPlan 을 받는다 (2026-09-11)
- `L425` 초안은 씨앗이고 저작본만 도면 정본이다 — 절차 도면 되살리기 + 실내 다양성 리포트 (2026-09-12)
- `L452` 맵 생성 테두리 옵션은 모델에게 주지 않는다 (2026-09-11)
- `L472` 맵 전체 청소 `clear_map` — 파괴적 한 콜 + 사용자 허가 모달 (2026-09-11)
- `L537` 명명 로케이션 툴 7종 (OPRN-OUT-020 + LOC-ADOPT, 2026-09-10)
- `L576` Exact project values and sourced declarations (2026-09-08)
- `L604` Measured zero-prop rejection diagnostics (2026-09-07)
- `L701` Logical walkthrough versus real player traversal (2026-09-07)
- `L709` Tile-query selector and filter boundaries (2026-09-07)
- `L718` Action enemy profile edits (2026-09-07)
- `L736` Explicit field-spawn mutations (2026-09-07)
- `L762` Monster resource discovery and AI appearance evidence (2026-09-07)
- `L839` House-site tree clearance before ownership (2026-09-07)
- `L850` Flower-yard material in house lots (2026-09-07)
- `L863` Pre-write original grounding (2026-09-06)
- `L938` Hybrid native tool exposure (2026-09-19)
- `L977` Review approval lifetime (R3, 2026-09-06)
- `L995` Audio description tools and event candidates
  - `L1015` Search pages and full detail
  - `L1029` Event prompt projection is not ID authority
- `L1063` P3 captured proposal base (2026-09-07)
- `L1135` Project wiki application ownership (2026-09-07)
- `L1148` Character appearance image candidates v1 (2026-09-06)
- `L1206` Completed-house transaction protection - Phase 1 (2026-09-05)
- `L1280` Completed-house construction protection - Phase 2 (2026-09-06)
- `L1319` 퀘스트 입력과 완주 증거 계약 (2026-09-05)
- `L1329` DB 조회 페이지와 마을 전체 범위 (2026-09-05)
- `L1470` P2 requirement and exact-verdict inputs (2026-09-06)
- `L1545` Project-wide quality evaluation
- `L1559` prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)
- `L1595` Action controls guide (2026-09-07)
- `L1638` NPC 대사는 코드가 지어내지 않는다 — 캐스트 라이터 계약 (2026-09-03)
- `L1669` 「이 세계」 캐논은 문장 3채널에 강제된다 (2026-09-04)
- `L1684` 마을 설계서 (2026-09-05)
- `L1688` 저수준 이벤트 입력은 명령 위치를 검증한다 (2026-09-05)
- `L1723` 보물상자는 노출된 수면을 거부한다 (2026-09-05)
- `L1730` 모험 저작 완료와 재시도 (2026-09-05)
- `L1760` 실제 이미지 입력 보존 (2026-09-07)
- `L1774` Physical tile passage exposure (2026-09-08)
- `L1798` NPC 자율 이동 아키타입 추론 (2026-09-17)
- `L1828` Full RPG first-turn foundation (2026-09-19)
- `L1846` Party, actor appearance, and event-linked inventory tools (2026-09-19)
- `L1866` Opening, game-over, and audio discovery tools (2026-09-19)
- `L1899` 범용 이미지 에셋 생성 (2026-09-19)
- `L1911` Feature16 combat and climate authoring tools (2026-09-21)
- `L1921` 마을 시공 후 완료 계약 (2026-09-21)
- `L1943` 타일 참고문서 선행 조회 (2026-09-21)

### `openwiki/editor-database.md` — 351KB · 2118줄 · ~102,293 토큰 · 통째읽기 잘림 · 깨진 줄 7

- `L3` 장소 탭 재설계 — 라이브러리 우선 배치 (2026-09-21)
- `L42` 몬스터 종족의 전투 뒷모습 (2026-09-20)
- `L53` 감사 후속: 참조를 보존하는 삭제 경로 (2026-09-20)
- `L61` 장소 편집 1차 UX 수리 — 이름·툴바·속성·카드 (2026-09-15)
  - `L103` 2차 (같은 날) — 갤러리 복귀와 속성 패널 통합
  - `L118` 3차 (같은 날) — 이 탭이 뭔지 말하게 한다: 목적·쓰임·배치 감사
- `L183` 장소 통합 진행: 방·층과 재료 (2026-09-14)
- `L196` 새 장소 생성 흐름 (2026-09-14, 2단계)
- `L213` 장소 목록 통합 1단계 (2026-09-14)
- `L228` 복합 공간 편집기 (2026-09-13)
- `L252` Placed-place child proposal adapter (2026-09-08)
- `L257` Monster resource metadata worksheet (2026-09-07)
- `L263` Shared database CSS ownership (2026-09-06)
- `L304` 전투 몬스터 표시 크기 (2026-09-06)
- `L311` 전투 명령 배치 스튜디오 (2026-09-05)
- `L328` 캐릭터·얼굴 메타데이터 (2026-09-06)
- `L335` Character appearance catalog v1 (2026-09-06)
- `L379` Concept navigation integration (2026-09-06)
- `L393` Opening still media, sequence music and AI generation (2026-09-14)
  - `L395` 새 프로젝트 기본 오프닝 (2026-09-21)
- `L420` Opening and game-over authoring (2026-09-06)
- `L476` Cinematic media preparation boundary (2026-09-06)
- `L495` System settings workspace (2026-09-06)
- `L556` Graphic 칩 사용자 교정 29건 (2026-09-05)
- `L572` Custom equipment slot authoring (2026-09-05)
- `L580` 통합 아이템·장비 카탈로그 (2026-09-05)
- `L588` 아이템·장비 저작 신뢰성 (2026-09-05)
- `L599` 전투 몬스터와 포획·성장 종족 (Phase 1)
  - `L609` 종족 검색과 관련 레코드 노출 (Phase 2)
- `L619` 몬스터 작업실 — 미리보기 · 행동 · 속성 (2026-09-05)
  - `L644` Monster action input trust (Phase 1, 2026-09-05)
  - `L653` Monster numeric caption activation (Phase 2, 2026-09-05)
  - `L660` Monster nested dialog focus (Phase 2, 2026-09-05)
- `L666` 몬스터 그룹 저작 신뢰성 (2026-09-05)
- `L681` Database Studio chrome (2026-08-24)
  - `L696` Actor data-table slice (2026-08-25)
- `L706` 프로젝트 위키 출처와 수동 편집 (2026-09-07)
- `L718` 세계관 그룹 — 세계 개요 · 설정집 (2026-09-18)
  - `L740` 세계관 입력 보존·설정집 저장 계약 (2026-09-05)
- `L752` '생성 규칙' 탭 — AI 마을 생성의 물·숲·길 (2026-08-30)
- `L760` P2 낚시·채집·박물관 저작 표면 (2026-08-25)
- `L765` 생활 저작 경계와 자동 화자 (task14, 2026-09-06)
- `L774` 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)
- `L787` 생활 기술·제작 저작 표면 (2026-08-24)
- `L806` Database Editor
- `L901` Beginner-centric adversarial review (2026-08)
- `L905` DB UI modernization (2026-08)
- `L941` P2 spatial authoring (2026-08-25)
- `L953` 맵 그룹 — 개념 우선 탐색 Phase 1 (2026-09-05)
- `L975` 오브젝트·공간 수정 복구 (2026-09-13)
- `L997` 오브젝트 브라우저와 공간 배치 작업대 (2026-09-13)
- `L1018` 맵 그룹 — 공간 저작 셸 UX 계약 (2026-09-12)
- `L1062` 타일 작업대 — 공간 셸 안 레이아웃 계약 (2026-09-13)
- `L1093` 오토타일 설정 — 9칸/11칸/커스텀 카드 (2026-09-01)
- `L1114` 공간 종류와 구조물은 다른 면이다 (2026-09-01)
- `L1133` 맵 → 개념 꾸러미 (2026-09-02 시작, 2026-09-05 개념 우선 Phase 1)
- `L1164` '구조물' 탭 — 두 출처 앨범 + 방 종류 문법 (2026-08-28)
- `L1177` '구조물' 편집기와 파일 입출력 (2026-08-29)
- `L1196` 삭제 가드는 묶음 조건(all/any/not) 안까지 본다 (2026-08-29 실측 결함 수정)
- `L1216` '진영' 탭과 몬스터 소속 진영 (2026-08-29)
  - `L1231` 몬스터 폼의 소속 진영 (`databaseEnemyRecordView.ts`)
  - `L1239` 다 만들어 놓고 못 쓰던 이유 — `[편집]` 이 화면 밖 67px 에 있었다 (2026-08-29 실측)
  - `L1251` 구조물 어휘 — 역할·레이어·테마·증분 축·칸 힌트 (2026-08-30)
  - `L1302` 편집기를 맵 타일 편집기 수준으로 (2026-08-30 실측)
- `L1324` Battle-animation editor autoplay (2026-09-05)
- `L1331` 스킬 탭 `연출` 카드 = 살아 있는 애니메이션 스테이지 (2026-08-30)
- `L1342` 데이터베이스 30탭 UI/UX 계약 (2026-08-30 실측)
  - `L1357` 헤더는 설명문이 아니라 아이콘 칩 한 줄이다
  - `L1435` 숫자 입력은 스테퍼를 먼저 붙이고 그다음 스피너를 지운다
  - `L1449` 줄상자 바닥은 1.35 다 (1.25 는 큰 한글 제목에서 깎인다)
  - `L1492` 이미지 실패는 빈 상자가 아니라 라벨 붙은 자리표시자다
- `L1501` '마을' 탭 — 마을 하네스 값을 사람이 저작한다 (2026-08-30)
  - `L1525` 붓을 고르면 화면이 흔들렸다 — 재부모가 스크롤·포커스를 지운다 (2026-08-30 실측)
- `L1568` 날개마다 층수를 정한다 — 계단식 2층 (2026-09-11)
  - `L1579` 지붕 가장자리 판정은 "다른 지붕면인가"다 (2026-09-11 실측 결함)
- `L1587` '마을' 탭 — 숫자칸을 그림으로 바꾼다 (2026-08-31)
  - `L1603` AI로 몬스터·아이템 생성 (2026-08-30)
  - `L1624` AI 검토 오버레이 — 레코드 카드로 before → after 를 보고 적용한다 (2026-09-15)
  - `L1718` AI로 몬스터·아이템 생성 — 대화상자 재작성 (2026-09-03)
- `L1734` Database Studio v2 — 30탭 셸·폼 문법 통일 (2026-09-03)
- `L1811` 직업 승급 트리 · 스킬 트리 (2026-09-05)
- `L1817` 미회수 편집 후속 통합 (2026-09-05)
- `L1821` 마을 설계서 (2026-09-05)
- `L1826` 구조물 증분 메타 정정 (2026-09-05)
- `L1834` 개념 회수 UI 직접 렌더 QA (2026-09-05)
- `L1838` Battle-animation preview-first graphic controls (Phase 2, 2026-09-05)
- `L1845` 검토한 실내 기본값의 원격 반영 (2026-09-05)
- `L1849` 특정 꾸러미의 명시적 교체 (2026-09-06)
- `L1853` 생성 아이템 아트에 dry-run 가짜가 섞여 들어갔다 (2026-09-16)
- `L1871` 배·항구 공통 기본 장소 (2026-09-17)
- `L1884` Game menu design options (2026-09-18)
- `L1913` 캐릭터·얼굴 연결 검토 개선 (2026-09-18)
- `L1923` 얼굴 대응표 실물 대조와 추천 제외 (2026-09-18 후속)
  - `L1931` 캐릭터·얼굴 화면 레이아웃 보정 (2026-09-18)
- `L1939` 캐릭터·얼굴은 프로젝트 밖 공용 자료 (2026-09-18 저장 범위 수정)
  - `L1950` 공용 기본 매핑 재저작 (2026-09-18)
- `L1954` Feature16 climate and action forms (2026-09-21)
- `L1973` Combat authoring studio (feature16, 2026-09-21)
- `L1980` Troop intent and weakness authoring (2026-09-21)
- `L1984` 인게임 HUD 구성 편집기 (2026-09-21)
  - `L1994` 장르별 HUD와 글꼴 (2026-09-21 후속)
- `L2005` 숲·마을·동굴 공통 기본 장소 13종 (2026-09-21)
- `L2030` 타일셋 참고문서 (2026-09-21)
  - `L2034` 숲마을 공용 소품 및 장소 (2026-09-21)
  - `L2044` 세계 개요 스프레드 뷰 (2026-09-22)
  - `L2053` 세계 개요 탭 구조 — 문서 / 조수 전달 (2026-09-22 v2)
  - `L2062` 세계 개요 본문 우선 — 도화지 첫 화면 (2026-09-22 v3)
  - `L2071` 세계 개요 헤드 압축 + 세계 설정 평문 폼 (2026-09-22 v4)
  - `L2080` 세계 개요 헤드 v5 + 법칙 대화상자 토큰 스코프 수정 (2026-09-22)
  - `L2088` 세계 설정 = AI 문답 인터뷰 (2026-09-22 v6)
  - `L2099` 세계 개요 스프레드 헤드 삭제 (2026-09-22 v6)
  - `L2108` 세계관 본문 AI 도움 — 초안·이어쓰기 (2026-09-22 v7)

### `openwiki/editor-event-authoring.md` — 155KB · 872줄 · ~45,047 토큰 · 통째읽기 잘림 · 깨진 줄 16

- `L3` 감사 후속: 조건 순서와 생활 경로 보존 (2026-09-20)
- `L11` 조수에서도 이벤트 명령 생성기 사용 (2026-09-20)
- `L20` 적대적 리뷰 고위험 항목 보정 (2026-09-19)
- `L29` 등장 조건은 조건 그룹을 기본으로 펼친다 (2026-09-19)
- `L36` 명령 중심 배치와 AI 작성 모달 (2026-09-18)
- `L64` 구역(로케이션) 조건분기 (OPRN-OUT-020, 2026-09-10)
- `L86` 구역 드나듦 트리거 (2026-09-10)
- `L113` Native battle confirmation admission (2026-09-08)
- `L132` Character graphic no-match recovery (OUT-007, 2026-09-08)
- `L155` Page preview state follows the current script (2026-09-08)
- `L176` Event editor window controls (2026-09-06)
- `L223` 이벤트 편집기 가독성 — 읽는 글자와 꾸미는 글자 (2026-09-03 후속)
- `L236` 이벤트 편집기 문법 고정 — P0 (2026-09-03)
- `L250` 2026-09-17 적대적 리뷰 P0 다섯 가지 수정 (2026-09-18)
- `L264` NPC 일정 구조화 편집 (2026-08-24)
- `L276` AI 가 이벤트 페이지를 이해하지 못했다 (2026-08-30 실측 · 수정)
  - `L298` 우선순위는 1페이지가 아니다 (바꾸지 않았다)
  - `L306` 랜덤 대사는 페이지가 아니다
  - `L313` 새 린트가 출하 콘텐츠에서 실제로 잡은 것 (skyStair autoEvent)
  - `L323` 조건만 걸고 켜지 않으면 그것도 죽은 페이지다 (가려짐의 거울상)
- `L340` 복잡한 NPC 는 조회 후 상태별 다중 페이지로 저작한다 (2026-09-01)
- `L370` Roguelike run authoring (2026-08-24)
- `L377` Event Authoring
- `L600` Condition / Loop / Variable command trust fixes (2026-08-07)
- `L610` Event draft trust loop (2026-07-30)
- `L618` 회상 오프닝 저작 — beat 컴파일러다 (2026-09-03)
- `L627` Guided story arc facade
- `L631` 지도·화면 효과 탭 초보자 UX (2026-08-27)
- `L640` 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)
- `L648` Companion roster in the command picker (2026-08-27)
- `L654` Presentation and system M2 command bodies
- `L661` 좌측 설정 레일 그룹 소속 (2026-08-27)
- `L679` 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)
- `L689` 「움직임과 속도」 부피 정리 (2026-08-29)
- `L724` 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)
  - `L759` 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다
  - `L772` 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)
  - `L780` 참조를 비워도 조건을 삭제하지 않는다
  - `L787` 조건 미리보기는 모르면 모른다고 말한다
  - `L802` 조건 문구에 내부 토큰을 넣지 마라
- `L817` 공포 게임 제작 기능 (2026-09-05)
  - `L822` NPC 발견·추격 저작 (2026-09-06)
- `L831` 명령 툴바는 한 줄이다 — wrap 금지와 폭 흡수 순서 (2026-09-21)

### `openwiki/editor-event-command-fixes.md` — 24KB · 99줄 · ~6,295 토큰 · 깨진 줄 11

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

### `openwiki/editor-event-commands.md` — 61KB · 242줄 · ~16,671 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L7` Move-route target repair (PR716, 2026-09-09)
- `L26` 좌표로 이동 — 고정/변수 좌표와 실패 정책 (OPRN-OUT-013, 2026-09-10)
- `L70` 장소 이동의 목적지 원복과 설정 보존 (2026-09-06)
- `L76` 확률로 결과 뽑기 / 가중 분기 (2026-09-06)
- `L89` 상점: 진열 상품과 상품 상세 중심 편집 (2026-09-05)
- `L101` Roguelike run control (2026-08-24)
- `L141` 런타임 규격 무대 — 대사·선택지 미리보기는 게임 창을 축소해 그린다 (2026-09-17)
- `L178` 얼굴 상자(faceset-crop-box) 페인트 계약 (2026-08-28)
- `L212` Staged edit, history, and nested drag invariants (2026-07-30)
- `L219` Command picker, validation, and preview trust (2026-07-30)
- `L228` 회상 스틸과 AI 그림 (2026-09-03)
- `L239` Recovered native emote command (2026-09-05)

### `openwiki/editor-genre-packs.md` — 11KB · 101줄 · ~2,939 토큰

- `L5` Ownership
- `L16` Safe blank-project system-preset flow
- `L35` Vocabulary and readiness
- `L46` Dialog layering and receipt fixtures (2026-09-08)
- `L59` Validation
- `L61` Two new-project surfaces, one choice model (2026-09-11)

### `openwiki/editor-interior-room-harness.md` — 93KB · 447줄 · ~26,831 토큰 · 통째읽기 잘림

- `L7` 던전 천장과 단차의 구분 — 사용자 정정 (2026-09-13)
- `L21` 대형 광산 저작 접합 교정 (2026-09-13)
- `L29` 사용자 광산 참고 이미지와 확장판 (2026-09-13)
- `L37` 광산 참고 문법의 얼음·용암 적용 (2026-09-13)
- `L45` 얼음·용암 절벽 굴곡과 소품 보강 (2026-09-14)
- `L53` 서로 합류하는 복합 절벽 — 실제 반영 (2026-09-14)
- `L66` 기존 칩셋 던전 네 종류 (2026-09-14)
- `L77` 네 던전의 연결 구조 우선 재저작 (2026-09-14)
- `L85` 설산 빙벽 조립 정정 (2026-09-13)
- `L97` Interior authoring/load consistency (2026-09-07)
- `L138` Closed expandable long tables (2026-09-07)
- `L179` 사용자 타일 정정: 항아리·돌계단·석조 화로
- `L190` 여관 검수표와 숙박 검증
- `L198` 여관 꾸러미 전면 재구성 (2026-09-06)
- `L217` 실내 의미·형태 검토 반영 (2026-09-05)
- `L230` 모든 AI 실내의 개념 꾸러미 계약 (2026-09-05)
- `L241` Tileset-specific map generation contract
- `L253` Interior Room Session Harness (villager-room-v1)
- `L266` Safe detached draft and approval harness
- `L274` Interior object catalog is the shape source of truth (2026-08-28)
- `L285` 소품 표면 어휘가 `PlacementZone` 으로 통일됐다 (2026-08-30, PR #316)
- `L298` 개념 시설 시공 — place_concept 경로가 파이프라인에서 다른 점 (2026-09-02)
- `L312` 도면 호환성과 외장 스탬프 후속 (2026-09-05)
- `L318` 입구 예약·멀티타일 통행 복원 (2026-09-05)
- `L326` 공포 게임 제작 기능 (2026-09-05)
- `L330` 여관 외 시설의 공간 구성 (2026-09-05)
- `L340` PR618 통합: 큰 탁자와 기존 시설 구성 (2026-09-06)
- `L348` 비직사각 실내 정본 재설계 (2026-09-13)
- `L357` 생활 구역 조합으로 실내 저작 (2026-09-14)
- `L366` 여관·잡화점의 시설별 실내 기준 (2026-09-14)
- `L373` 연결 던전의 에디터 통합 (2026-09-14)
- `L377` Compact interiors and automatic furnishing budgets (2026-09-14)
- `L388` Open domestic interiors: activity areas are not enclosed rooms (2026-09-14)
  - `L400` Follow-up: excess floor and furniture depth (2026-09-14)
  - `L410` Small props require supports; short bathroom steps (2026-09-14)
  - `L420` Reference-house correction: no shrub pots, cooking supports, inset cabinets (2026-09-14)
  - `L430` All-interior review (2026-09-15)

### `openwiki/editor-observability.md` — 41KB · 506줄 · ~11,851 토큰 · 깨진 줄 1

- `L23` 조수 실행 기록과 표시 수준 (2026-09-21)
- `L38` Opt-in local diagnostics (issue 693 OUT-009 / OUT-010)
- `L91` 계측 초크포인트는 `store.markLocalMutation` 하나다
- `L134` 새 편집 기능을 추가할 때 — 라벨을 넣어라
- `L153` AI 적용 경로 — 이쪽이 주 경로다
- `L184` P3 owner-bound publication (2026-09-07)
- `L253` P2 outcome publication (2026-09-06)
- `L316` 되돌리기 스택과 감사 로그는 다르다
- `L337` Toolbar history confirmation lifetime (PR716, 2026-09-09)
- `L356` 디버깅 레시피
  - `L398` 저장된 것 — DB 커밋에 실린 행위 (`npm run commit:log`)
- `L433` 로거
- `L447` 알려진 남은 공백 (여기 손대는 사람이 이어서 하라)
- `L478` AI 툴·액션 이유 (2026-09-02)
- `L488` 검증
- `L495` Feature16 저작 보조 관측 경계 (2026-09-21)

### `openwiki/editor-pre-edit-routing.md` — 131KB · 761줄 · ~37,853 토큰 · 통째읽기 잘림 · 깨진 줄 5

- `L5` 맵별 16/32/48px 좌표
- `L13` 맵 목록 클릭은 즉시 선택한다 (2026-09-18 후속)
- `L66` database 표면 CSS 지연 로드와 공용 다이얼로그 (2026-09-21)
- `L79` 맵 전환과 물 타일 애니메이션 공유 (2026-09-18)
- `L97` 편집기 재렌더 비용 — 줌은 카메라 경로다 (2026-09-16)
  - `L138` 커스텀 칩 팔레트의 빈틈 없는 표시 (2026-09-21)
- `L153` Exterior door backing
- `L163` Tile brush reliability (2026-09-06)
- `L201` Combo Brush (2026-09-10, OPRN-OUT-022)
  - `L206` 용어 (코드와 UI 가 같은 말을 쓴다)
  - `L218` 소유 경계
  - `L230` 근거 규칙 — 번호 인접으로 추론하지 않는다
  - `L241` 검토 책임
  - `L253` 경계와 진단
  - `L263` 회귀 이음줌
- `L275` Pre-edit routing
  - `L277` 명명 로케이션 레이어 (2026-09-10)
  - `L359` 로케이션 역할과 겹침 클릭 (2026-09-12)
  - `L397` 설계 영역 이관 도구 (LOC-ADOPT, 2026-09-10)
  - `L399` 로케이션 앵커 — 좌표 대신 이름으로 가리키기 (2026-09-12)
  - `L452` Standard / Expert focus modes (2026-09-07; supersedes sidebar density notes below)
  - `L512` Automatic usage guides disabled (2026-09-06)
  - `L522` Sidebar mode workflow (2026-09-06; supersedes older 72px/tile-flyout notes below)
- `L629` Agent cautions
- `L639` 헤더 용어 정본과 중복 감사 (2026-08-30)
  - `L675` 톱바 영역 진입점 감사표 (`renderTopbar` 실측)
  - `L707` 사이드바 ↔ 톱바 소유권 (2026-08-30 중복 정리)
  - `L736` 스튜디오 바 — 톱바 한 줄 (2026-09-03, 표준·전문가 대격변)

### `openwiki/editor-storage-chest.md` — 2KB · 17줄 · ~571 토큰

- `L5` Storage chest authoring

### `openwiki/editor-validation.md` — 45KB · 352줄 · ~12,404 토큰

- `L5` 규칙 감사 배지는 UI 선택만으로 재검사하지 않는다 (2026-09-18)
- `L13` Event validation location and UNSENT handoff (issue 693, 2026-09-08)
- `L50` AI blocked-event relocation recovery (2026-09-06)
- `L144` AI 타일 후검증 (2026-09-05)
- `L149` 이벤트 초안 검증 표면 (2026-08-28)
- `L154` event-unreachable lint rule (2026-08-27)
- `L161` P2 생활 시스템 무결성 (2026-08-25)
- `L166` 생활 저작 표면 집중 검증 (2026-08-24)
- `L182` AI editor-wide tool validation (2026-08-25)
- `L188` Roguelike run validation (2026-08-24)
- `L195` Validation Expectations
- `L219` Desktop UI integration matrix (2026-08-11)
- `L229` Event editor aggregate gate (2026-07-30)
- `L238` P2 spatial integrity (2026-08-25)
- `L245` 손붓이 hard 클러스터에 막혔을 때의 복구 경로 (2026-09-10, OPRN-OUT-017)
  - `L291` `bAlt`/`aAlt` 패리티 — 별도 리뷰 결과: **실제 결함이었고 고쳤다** (2026-09-10)

### `openwiki/editor-workflows-misc.md` — 67KB · 474줄 · ~18,271 토큰 · 통째읽기 잘림

- `L9` Other Editor Workflows
  - `L11` New-project name and player title (2026-09-07)
  - `L21` 걸을 때 적 만나기 — rectangle authoring (2026-09-06)
  - `L87` Game export delivery (2026-09-06)
  - `L198` Audio descriptions and live resource ownership
  - `L281` Genre-neutral authoring launcher and journey (2026-08-24)
- `L333` 편집기 z 층 밴드와 토스트 (2026-08-30, PR #308)
- `L362` 초보 맵 사이드바 «목록 | 상세» 2단 탐색기 (2026-08-30, PR #311)
- `L384` 커스텀 셀렉트는 열릴 때 modalStack 층이 된다 (2026-08-30)
- `L398` 맵 설정 가독성·편집 연속성 (2026-09-05)
- `L408` 왼쪽 사이드바 3모드 적대적 리뷰 (2026-09-05)
- `L419` Authoring viewport navigation (issue 693, 2026-09-08)
  - `L461` Common expression recovery (2026-09-17)

### `openwiki/editor-workflows.md` — 2KB · 28줄 · ~586 토큰

- `L5` Topic pages
- `L17` Quick routing
- `L25` For AI agents

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

### `openwiki/feature16-battle-ui.md` — 6KB · 48줄 · ~1,534 토큰

- `L3` UI entry points
- `L9` Data and rules
- `L19` Parent combat integration hooks
- `L29` Parent-owned verification (not run by this worker)
  - `L39` Fresh-project editor capture boot isolation

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

### `openwiki/horror-authoring.md` — 17KB · 185줄 · ~5,487 토큰

- `L8` 저작 표면
- `L23` 데이터와 런타임
- `L40` 연결 방 추격 연속성 (2026-09-06)
- `L66` NPC 발견 이벤트와 공통 전투 소유권 (2026-09-06)
- `L126` 가구 밀기 애니메이션 (2026-09-05 후속 체험 수정)
- `L149` 실내 제작과 검증
- `L160` 검증 경로
- `L174` 전체 게이트 후속 수정 (2026-09-05)

### `openwiki/interior-tile-benchmark.md` — 9KB · 158줄 · ~2,814 토큰

- `L11` Floor contract correction (2026-09-08)
- `L20` 왜 interior 를 정답지로 쓰는가
- `L36` 재현성 설계 — 3층
- `L53` 채점 방안 6종
- `L77` 헤드라인 지표 — wallAny vs houseShellWall
- `L89` 태스크 12종
- `L96` 정답 카테고리 파생 (`groundTruth.ts`)
  - `L106` 함정 두 개 (실측으로 발견, 재발 방지용 기록)
- `L124` 실행
- `L144` 안티-게이밍 규칙
- `L154` 이 페이지를 갱신해야 하는 변경

### `openwiki/large-village-generation.md` — 35KB · 594줄 · ~10,229 토큰

- `L15` 내장 AI 시공 순서 (2026-09-12, 아래 과거 하네스 순서보다 우선)
- `L41` 저장된 건물 오브젝트로 마을 만들기 (2026-09-12)
- `L58` 참고 사례 집 형태(정주지·왕궁 도시) — 2026-09-17
- `L102` 작은 집 중심의 조밀한 마을 (2026-09-13)
- `L133` 과거 대형 하네스 순서
- `L150` AI tree placement and completed houses (2026-09-05)
- `L185` Phase 2 construction boundary (2026-09-06)
- `L215` 참조 그림 같은 마을을 한 번에 (2026-09-12)
- `L245` 관련 파일
- `L264` 전체 그림
- `L282` 단계별 설명
  - `L284` 0단계 — 자리 잡기 (`planLargeVillageBboxes`)
  - `L314` 1단계 — 맵 생성
  - `L322` 2단계 — 물
  - `L333` 3단계 — 집 (다양화)
  - `L348` 4단계 — 구불구불 길
  - `L364` 5단계 — 광장 + 시장 하네스
  - `L375` 6단계 — 울타리 + 마당 (집과 별 개념)
  - `L398` 7단계 — 나무·마을 소품
  - `L410` 8단계 — NPC
  - `L420` 9단계 — QA (품질 게이트)
  - `L443` 10단계 — 저장
- `L454` 데이터 개념 3개만 기억하기
- `L473` 예전에 자주 깨지던 이유 (로직 이슈)
- `L486` 로그 읽는 법
- `L506` 다시 만들 때
- `L522` 고칠 때 어디를 만지나
- `L536` 아직 약한 부분 (솔직히)
- `L553` 관련 위키
- `L561` author_village 스코프 계약 (2026-09-04 적대 리뷰 반영)
- `L571` 대로 병합 검증 (2026-09-05)
- `L575` 십자 탈출 — 집 먼저, 길은 나중 (2026-09-17)

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

### `openwiki/monster-resource-editor.md` — 4KB · 75줄 · ~1,199 토큰

- `L3` Entry and ownership
- `L19` State and mutation contract
- `L49` Resource Manager monster tab (2026-09-12)
- `L64` Verification

### `openwiki/night-monster.md` — 9KB · 122줄 · ~2,882 토큰

- `L9` 현재 개정본 (2026-09-05)
- `L39` 초기판 정본과 제작 경로 (역사 기록)
- `L53` 초기판 게임 구성과 공략 (현재 개정본에는 적용하지 않음)
- `L71` 초기판 검증과 발견한 함정
  - `L90` 2026-09-05 실측
  - `L105` 사용자 플레이 후 체험 QA 정정 (2026-09-05)

### `openwiki/opening-still-pack.md` — 5KB · 86줄 · ~1,328 토큰

- `L3` Source and delivery
- `L30` Installation and integrity
- `L45` Runtime and authoring contracts
- `L60` Verification and examples

### `openwiki/placed-place-edits.md` — 5KB · 79줄 · ~1,282 토큰

- `L3` Scope and ownership
- `L13` Mutation contract
- `L47` Actual read models and lifecycle data
- `L64` Verification

### `openwiki/project-wiki.md` — 12KB · 199줄 · ~3,096 토큰

- `L8` Data and evidence
  - `L16` Work history is not a codex document (2026-09-20)
- `L45` Ownership and retrieval
- `L72` Editor lifecycle
- `L133` Combat acceptance slice
- `L145` Verification

### `openwiki/quickstart.md` — 18KB · 187줄 · ~5,327 토큰

- `L6` 0. 여기서 에이전트가 실제로 헤매는 이유 (실측 2026-08-30)
- `L17` 1. 환경 — 여기가 틀리면 이후 전부 헛수고
- `L46` 팀 SQLite 호스트 (2026-09-18)
- `L54` 1a. Mac / 개인 로컬 실행 (2026-09-21)
- `L71` 1b. 전체 BGM은 Release 팩으로 설치
- `L87` 1c. 오프닝 이미지 팩
- `L94` 2. 검증 — 무엇이 진짜 게이트인가
- `L121` 3. 어디를 고치나 — 기능 → 진입 파일
- `L169` 4. 위키를 읽는 법
- `L181` 5. 끝났다고 말할 수 있는 조건

### `openwiki/release-and-version.md` — 11KB · 192줄 · ~3,377 토큰

- `L7` 네 축을 구분한다
- `L18` 릴리스 버전은 왜 매 머지가 아닌가
- `L31` 빌드 식별자
- `L52` 릴리스 절차
- `L78` 데스크톱 산출물을 릴리스에 붙인다 (2026-09-16)
  - `L99` 윈도우 zip 은 리눅스에서 만든다 (2026-09-22 실측)
- `L133` 커밋 메시지가 릴리스 노트의 원고다
- `L147` 아직 안 한 것
- `L155` 검증
- `L166` 자동화 — 제안 PR 과 발행 타이머

### `openwiki/runtime-action-combat.md` — 28KB · 338줄 · ~7,304 토큰

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

### `openwiki/runtime-and-data.md` — 3KB · 27줄 · ~733 토큰

- `L5` Topic pages
- `L15` Quick routing
- `L24` For AI agents

### `openwiki/runtime-battle.md` — 163KB · 765줄 · ~46,677 토큰 · 통째읽기 잘림

- `L3` 포켓몬 참고 스킨과 실제 뒷모습 (2026-09-20)
- `L13` 전투 리뷰 후속: 상태 안내와 무대 채움 (2026-09-20)
- `L39` 전투 적대적 리뷰의 무결성 수정 (2026-09-20)
- `L64` 공격 효과음 지연 — 샘플 SE 디코드 캐시 (2026-09-15)
- `L86` 전투 UI/UX·모션 적대적 리뷰 5축 후속 (2026-09-14)
- `L157` 회복 자원·인트로 배너·타이머 write-back 계약 (2026-09-15)
- `L202` Native event battle admission (2026-09-08)
- `L248` Supported action authoring (2026-09-07)
- `L260` 적별 전투 표시 크기 (2026-09-06)
- `L270` Capture-only victory (2026-09-08)
- `L281` Event friendship and live level changes (2026-09-06)
- `L300` Sequential battle event completion (2026-09-08)
- `L335` Battle-event continuation and cancellation (2026-09-06)
- `L378` 전투 명령 custom CSS (2026-09-05)
- `L382` 빈 페이지와 실행 빈도 계약 (2026-09-05)
  - `L399` 체공 배율 채널과 착지 눌림 (2026-08-30, PR #297)
- `L417` 지원 전투 시스템은 둘뿐이다 (2026-08-28)
- `L430` Roguelike run boundary (2026-08-24)
- `L435` Battle rules & runtime
  - `L450` 전투 화면 표현 · 전환 · 타임라인 · 연출 타이밍
  - `L475` 커맨드/대상 메뉴 기하와 글자 가시성 계약
  - `L491` 스킨 CSS 캐스케이드와 저작 가능 스킨
  - `L495` Gen 1(포켓몬식) 규칙 모델
  - `L503` 플레이 모드 런타임 (이 절에 섞여 있는 비전투 항목)
  - `L522` 전투 흐름 · 몬스터 수집 · 트룹 이벤트 · 보상
- `L560` Starter hero battle sheets (2026-08-29)
- `L581` Per-actor back battlers (2026-08-29)
- `L599` Battle input and visibility P0 contract (2026-07-30)
- `L610` 배틀러 idle 애니메이션 (2026-08-30)
- `L736` 필드 아이템 상태 부여 복구 (2026-09-05)
- `L740` Authored combat rules (feature16, 2026-09-21)
- `L754` Battle reports and physical formation (2026-09-21)
- `L758` Combat correctness hardening (2026-09-21)

### `openwiki/runtime-m2-flow-controls.md` — 38KB · 285줄 · ~10,597 토큰

- `L5` Map-effect repair boundary (2026-09-06)
- `L12` Sound Layer audio controls (2026-09-06)
- `L19` M2 Runtime Flow Controls
- `L49` Storage chest authoring
- `L55` Page 3 location/vehicle compatibility (2026-07-30)
- `L59` 저장된 M2 명령 실행 연결 복구 (2026-09-05)
- `L72` 좌표 목적지 이동의 실패 계약 (OPRN-OUT-013, 2026-09-10)
  - `L131` 이동 중 경로 재지정 — 2026-09-05 브라우저 적대적 QA
  - `L138` 맵 위를 흐르는 구름 그림자 (2026-09-14)
  - `L212` Weather sound (2026-09-21)
  - `L226` Map-wide atmosphere presets (2026-09-21)
  - `L247` Genre ambience presets and sound pairing (2026-09-21)
  - `L271` Thirty audiovisual presets — evidence (2026-09-21)

### `openwiki/runtime-pre-edit-routing.md` — 51KB · 341줄 · ~14,863 토큰 · 통째읽기 잘림

- `L13` 맵별 16/32/48px 좌표
- `L207` ESC skill thumbnails (2026-09-06)
- `L218` Recovered head emotes (2026-09-05)
- `L224` 메뉴 입력·불러오기 배율 (2026-09-05)
- `L232` 가구 밀기 애니메이션 (2026-09-05)
- `L241` Recovered head emotes (2026-09-05)
- `L247` Saved uploaded tilesets in the actual player (2026-09-14)
- `L268` 맵 배경(패럴랙스) 렌더 (2026-09-14)
- `L295` 맵 배경 다중 레이어 (2026-09-21)

### `openwiki/runtime-project-schema.md` — 161KB · 1156줄 · ~44,175 토큰 · 통째읽기 잘림

- `L3` LegacyDb 잔여 의존 정리 (2026-09-21)
- `L10` 종족 전투 뒷모습 리소스 (2026-09-20)
- `L14` 웹 프로젝트 생성과 선택 (2026-09-18)
- `L20` 팀 프로젝트 서비스 (2026-09-18)
- `L27` 로컬 SQLite 정본과 저장소 포트 (2026-09-16)
  - `L73` 데스크톱 앱이 실제로 뜬다 (2026-09-16)
- `L106` 지역 하위 장소의 단일 계약 (2026-09-14)
- `L116` 직접 그린 방을 포함하는 다층 장소 (2026-09-14)
- `L125` 장소 재료의 포함 관계 (2026-09-14)
- `L134` 혼합 하위 재료 구성 (2026-09-13)
- `L153` Truthful migrated-load state (2026-09-07)
- `L186` Explicit publication identity and Save6 (2026-09-06)
- `L244` Spatial canonical routing (task6 backend increment, 2026-09-07)
- `L286` P1 accepted-save receipts and read-only proof (2026-09-06)
- `L336` Opening and game-over cinematic settings (2026-09-06)
- `L353` 적 전투 이미지 크기 (2026-09-06)
- `L357` Project monster metadata overrides (foundation, 2026-09-07)
- `L399` Project audio description overrides
  - `L428` Concurrent persistence
  - `L453` Editor preservation and playable export
- `L467` Character/face authoring metadata (2026-09-06)
- `L476` Character appearance sets v1 (2026-09-06)
- `L513` New-project save/reload verification (2026-09-05)
- `L521` Task15 nonvisual economy command contract (2026-09-08)
- `L532` Independent game Save5 boundary (2026-09-06)
- `L538` Life ownership in Save5 (2026-09-06)
- `L554` Placement safety core (task12, 2026-09-06)
- `L566` Project-authored equipment slots (2026-09-05)
- `L574` 전투 명령 CSS (2026-09-05)
- `L578` 기본 카탈로그 삭제 보존 (2026-09-05)
- `L582` 전투 페이지 중복 ID 복구와 슬롯 참조 (2026-09-05)
- `L595` 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)
- `L603` 세계 법칙의 명시적 부재 (2026-09-05)
- `L607` Showcase media save-copy durability (issue #693, 2026-09-08)
- `L647` 공용 첫 방문 데모 — 읽기 전용 저장 계약 (2026-09-14)
- `L681` Project schema & persistence
- `L917` Variable arithmetic & loop runtime (2026-08-07)
- `L921` Canonical event-draft projection (2026-07-30)
- `L928` P2 general buildings and home decorations (2026-08-25)
- `L935` 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)
- `L953` Boot normalizers must not create dangling references (2026-08-30)
- `L979` `.oprn` 은 단일 파일 게임 컨테이너다 — 편집기와 플레이어 양쪽이 읽는다 (2026-08-30)
- `L1013` 성장 트리 선택 확장 (2026-09-05)
- `L1019` 마을 설계서 (2026-09-05)
- `L1025` 공포 게임 제작 기능 (2026-09-05)
  - `L1029` 저장된 대사 별칭과 맵 오버레이 (2026-09-05)
- `L1033` NPC 표시 이름 (2026-09-05)
- `L1046` 연결 실내 도면의 영속성 (2026-09-05)
- `L1050` 개념 장소 형상 (2026-09-05)
- `L1054` Optional village decoration attachments (2026-09-13)
- `L1065` Optional map climate (Feature16, 2026-09-21)
- `L1082` Optional authored combat rules (feature16, 2026-09-21)
- `L1085` AI 저작 보조 설정의 프로젝트 지속성 (Feature16, 2026-09-21)
- `L1098` 구름량 optional 필드 (2026-09-21)
  - `L1110` Map atmosphere layers (2026-09-21)
- `L1131` 필드 HUD 설정 (2026-09-21)
  - `L1141` HUD 장르·서체 확장 (2026-09-21)
- `L1153` 타일셋 참고문서 데이터 (2026-09-21)

### `openwiki/runtime-sessions.md` — 98KB · 412줄 · ~25,880 토큰 · 통째읽기 잘림

- `L3` Opening and game-over cinematics (2026-09-06)
- `L69` Recovery ledger and scheduled failure ownership (2026-09-09)
- `L77` Task10 field input and exact forage dates (2026-09-06)
- `L91` QA-only life observation (2026-09-06)
  - `L97` Audio QA capability and shell lifetime (2026-09-06)
- `L103` Save5 session boundary (2026-09-06)
- `L111` Life recovery primitives and maker evidence (2026-09-06)
- `L123` Lossless life snapshot reconciliation (2026-09-06)
- `L137` Esc 메뉴 작업 프레임 (2026-09-05)
- `L167` 아이템 종류 전환과 실행 효과 (2026-09-05)
- `L178` Roguelike run kernel and field rooms (Phase 0–3, 2026-08-24)
- `L188` P1 daily-weather transition authority (2026-08-25)
- `L197` Event audio state (U14)
- `L205` Session state & life-sim
- `L282` Editorial title screen (2026-08-26)
- `L288` playerTouch trigger contract (2026-08-20)
- `L292` Selected-event runtime sandbox (2026-07-30)
- `L298` P2 spatial runtime and saves (2026-08-25)
- `L312` 공포 게임 제작 기능 (2026-09-05)
  - `L316` 메뉴 PR 통합 검증 (2026-09-05)
- `L323` Game menu designs and information ownership (2026-09-18)
  - `L353` Four era-inspired menu windows (2026-09-18 follow-up)
- `L377` Player options, inventory views and honest shop services (feature16, 2026-09-21)
- `L405` Persistent battle reports and formation (2026-09-21)

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

### `openwiki/slates-agent-entry.md` — 4KB · 40줄 · ~1,099 토큰

- `L7` 필수 읽기 순서
- `L19` 파일과 의미
- `L33` 새 맵의 완료 조건
- `L37` 문서만 전달하는 독립 실험

### `openwiki/slates-assembly-playbook.md` — 11KB · 108줄 · ~3,328 토큰

- `L11` 1. 이번에 폐기하는 일반화
- `L19` 2. 필수 입력과 정확한 합성 해독
- `L42` 3. 조립 카드의 형식 — 그림과 좌표를 함께
- `L59` 4. 접합별 올바른 상태와 반례
- `L77` 5. 밀도와 골목 — 실측과 설계 제안을 구분
- `L88` 6. 필수 단계 — 앞 단계의 결함을 마을로 복제하지 않는다
- `L98` 7. 네 가지 판정을 분리

### `openwiki/slates-atlas-review.md` — 20KB · 465줄 · ~5,777 토큰

- `L5` 기본 잔디 (grass)
- `L15` 모래 바닥 (sand)
- `L25` 흙 바닥 (earth)
- `L35` 석재 포장 (paving)
- `L45` 무성한 잔디 (wild-grass)
- `L55` 석축 띠 (stone-border)
- `L65` 잔디 경계 / 빈 받침 (grass-edge)
- `L75` 수련과 선인장 (lily)
- `L85` 바위 세 변종 (rocks)
- `L95` 검은 반투명 그림자 (shadow)
- `L105` 포장 연결 조각 (paving-alt)
- `L115` 꽃 장식 (flowers)
- `L125` 침엽수 군락 (pine-cluster)
- `L135` 활엽수 군락 (leaf-cluster)
- `L145` 수관·묘목·그루터기 (tree-parts)
- `L155` 독립 나무 / 덤불 (single-trees)
- `L165` 잔디 절벽 (cliff)
- `L175` 모래 물결 / 해안 (water)
- `L185` 폭포와 낙수 (falls)
- `L195` 수변 석축 (water-wall)
- `L205` 도개교 / 사슬 (drawbridge)
- `L215` 목재 다리 / 부두 (dock)
- `L225` 방향 표지판 (signpost)
- `L235` 계단 / 사면 (stairs)
- `L245` 마른 우물 / 물 우물 (well)
- `L255` 목조 골조 / 창 (timber)
- `L265` 성탑 변형 (towers)
- `L275` 화단 창 / 돌출층 (balcony)
- `L285` 지붕 / 박공 (roof)
- `L295` 횃불 / 작은 장식 (torch)
- `L305` 성벽 면 / 아치 (castle-face)
- `L315` 성벽 보행로 / 흉벽 (battlement)
- `L325` 배 / 돛대 / 묘비 (ships)
- `L335` 붉은 차양 (red-awning)
- `L345` 마당 포장 테두리 (court-border)
- `L355` 문자 간판 (shop-sign)
- `L365` 성의 긴 창 (gothic-window)
- `L375` 기둥 / 아케이드 (columns)
- `L385` 철문 / 도르래 (gate)
- `L395` 물레방아 (waterwheel)
- `L405` 풍차 날개 (windmill)
- `L415` 사다리 (ladders)
- `L425` 푸른 차양 / 깃발 (blue-awning)
- `L435` 그림 간판 (pictogram)
- `L445` 상자·문·벤치·깃발 (small-props)
- `L455` 물 / 난간 / 작은 파편 (water-top)

### `openwiki/slates-dense-town.md` — 6KB · 50줄 · ~1,902 토큰

- `L7` 실패를 반복하지 않는 기준
- `L13` 이번 50×50 맵의 필수 완료 기준
- `L24` 이미 배운 건물을 재사용하는 정확한 방법
- `L41` 작업 순서와 제출

### `openwiki/slates-structure-learning.md` — 11KB · 139줄 · ~3,439 토큰

- `L9` 학습 자료와 범위
- `L23` 1. 좌표와 조각의 단위
- `L34` 2. 건물은 박공 삼각형 하나가 아니다
- `L52` 3. 성벽·성문·탑의 단면
- `L70` 4. 기단·계단·그림자는 높이를 설명한다
- `L83` 5. 자연·수면·부두·소품의 경계
- `L97` 6. 성곽 마을 배치에 적용할 순서
- `L108` 7. 저장된 관찰 자료와 다음 작업의 계약
- `L128` 숫자 비교를 재현할 때

### `openwiki/slates-structure-samples.md` — 30KB · 473줄 · ~9,241 토큰

- `L5` 성문과 쌍탑 (gate)
- `L17` 직선 성벽의 단면 (wall)
- `L29` 높이가 꺾이는 성벽 (wall-step)
- `L41` 울타리와 묘역 (cemetery)
- `L53` 둥근 탑과 긴 첨탑 (tower)
- `L65` 높은 석조 건물의 전면 (church)
- `L77` 돌출층과 박공이 있는 집 (projecting-house)
- `L89` 연결 상점가와 지붕 접합 (joined-shops)
- `L101` 기단으로 둘러싼 숲 정원 (raised-garden)
- `L113` 우물과 골목의 결절 (well-court)
- `L125` 시장 판매대와 성벽 안뜰 (market)
- `L137` 앞동과 옆동이 연결된 여관 (inn)
- `L149` 깊은 지붕과 지붕창의 접합 (roof-junction)
- `L161` 절벽 사이의 긴 계단 (stairs)
- `L173` 암벽과 동굴 입구 (cave)
- `L185` 좁은 강과 낙수 (falls)
- `L197` 가로 목교와 양쪽 강둑 (bridge)
- `L209` 곡선 해안과 풀밭 접점 (shore)
- `L221` 대각 부두와 가로 부두 연결 (pier-junction)
- `L233` 큰 배의 선체와 돛대 (ship-large)
- `L245` 작은 배와 부두 접안 (ship-small)
- `L257` 계단으로 둘러싼 입체 중정 (terraced-court)
- `L269` 수로 아치와 배수 격자 (water-arches)
- `L281` 성벽 보행로의 모서리 (parapet-corner)
- `L293` 깃발과 긴 창이 있는 성 전면 (castle-facade)
- `L305` 긴 창과 깃발의 수직 조합 (gothic)
- `L317` 앞마당과 긴 흉벽 (forecourt)
- `L329` 석재 화단과 나무 (planter)
- `L341` 성벽 중앙 두 칸 늘리기 (wall-long)
- `L352` 지붕 깊이 한 칸 늘리기 (roof-deep)
- `L363` 계단 디딤판 두 행 늘리기 (stairs-long)
- `L374` 긴 창 중간 한 행 늘리기 (window-tall)
- `L385` 물레방아 자세 1 (waterwheel-0)
- `L396` 물레방아 자세 2 (waterwheel-1)
- `L407` 물레방아 자세 3 (waterwheel-2)
- `L418` 물레방아 자세 4 (waterwheel-3)
- `L429` 풍차 날개 자세 1 (windmill-0)
- `L440` 풍차 날개 자세 2 (windmill-1)
- `L451` 풍차 날개 자세 3 (windmill-2)
- `L462` 풍차 날개 자세 4 (windmill-3)

### `openwiki/slates-study.md` — 5KB · 69줄 · ~1,490 토큰

- `L7` 산출물과 근거
- `L23` 확인한 조립 규칙
- `L36` 받침과 AI 메타의 함정
- `L47` 저장된 연구실
- `L57` 재현 순서

### `openwiki/slates-village-authoring.md` — 10KB · 144줄 · ~2,969 토큰

- `L11` 1. 근거를 찾는 순서
- `L22` 2. 땅·길·물
- `L39` 3. 집 — 지붕과 벽을 분리
- `L59` 4. 나무 — 한 그루의 범위를 지킨다
- `L73` 5. 마을 소품 — 의미에 맞는 자리
- `L84` 6. 레이어·저장·완료 조건
- `L99` 7. 50×50 적용 사례
  - `L112` 50×50에서 추가로 확인한 조립
  - `L132` 다음 작업의 입력과 저장

### `openwiki/small-village-generation.md` — 13KB · 148줄 · ~4,117 토큰

- `L6` 저장과 재사용
- `L26` 이번 사용자 저작 기준
- `L47` 검증과 재현
- `L58` 기존 집 카탈로그 개정
- `L82` 마을 생활 공간 장식 (2026-09-13)
- `L126` 겹치는 숲과 외곽 풀밭 (2026-09-13)

### `openwiki/spatial-ai-tools.md` — 17KB · 216줄 · ~4,714 토큰

- `L3` 장소 단일 계약 (2026-09-14)
- `L19` Ownership
- `L50` 저장된 건물 외형 찾기 (2026-09-14 갱신)
- `L78` Preview versus publication
- `L108` 프로세스 경계를 넘는 증거 (2026-09-16)
- `L142` Legacy adapters and context
- `L184` Evidence and integration boundary
- `L201` Completed region references (2026-09-13)

### `openwiki/spatial-authoring-controller.md` — 18KB · 294줄 · ~4,590 토큰

- `L6` Status and ownership
- `L18` Panel contract
- `L81` Compiled geography member motion (2026-09-09)
- `L111` Selective standalone-object graphic replacement
- `L140` Editable preview continuation
- `L162` Atomicity and stale checks
- `L179` Exact connection cleanup
- `L248` Verification and remaining integration

### `openwiki/spatial-catalog-ui.md` — 13KB · 145줄 · ~3,494 토큰

- `L5` Concept and selection contract (2026-09-12)
- `L28` Building exterior selection
- `L45` Facility levels
- `L55` Verification
- `L72` Shared objects (2026-09-17)
- `L77` 2026-09-18 — rejected interior catalog reset and style-first mockup
- `L92` 2026-09-18 — production place classification browser
- `L100` 2026-09-21 — 강변 숲마을 기본 장소
- `L127` 2026-09-22 — 기본 방 종류 카드 7종을 갤러리에서 제거

### `openwiki/spatial-geography-compiler.md` — 9KB · 158줄 · ~2,420 토큰

- `L8` Public path
- `L31` Terrain and structures
- `L61` Settlement regions (2026-09-12)
- `L83` Ownership and regeneration
- `L106` Contract fixtures and proof

### `openwiki/spatial-geography-ui.md` — 19KB · 314줄 · ~4,952 토큰

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

### `openwiki/state-system.md` — 12KB · 130줄 · ~3,251 토큰 · 깨진 줄 2

- `L7` TL;DR (use this when explaining to a user)
- `L15` Layers and ownership
- `L25` StateRecord fields (authored)
- `L53` StateOntology (engine default template)
- `L78` Default seed (new projects)
- `L82` Editor surface
- `L92` Runtime application
- `L103` Common confusion points
- `L112` Files to inspect before editing
- `L124` Related pages

### `openwiki/storage-retirement.md` — 4KB · 55줄 · ~1,203 토큰

- `L3` 현재 저장 경로
- `L18` 제거와 대체
- `L30` 실제 데이터 보존
- `L43` 역사 자료와 검증

### `openwiki/team-project-host.md` — 16KB · 199줄 · ~4,964 토큰

- `L5` 소유와 실행 위치
- `L22` 실행
- `L46` 기존 mdc-server 시작 명령의 SQLite 연결 (2026-09-18)
- `L64` 저장·협업 계약
- `L91` 백업과 이전
- `L101` 검증 근거
- `L110` 호스트 페이지 CSP (2026-09-22)
- `L119` 적대적 리뷰 수정 (2026-09-18)
- `L132` 웹 새 프로젝트 생성 (2026-09-18)
- `L149` 운영 systemd가 Vite preview에 고정된 경우 (2026-09-18)
- `L169` 맵 편집 권한 가져오기 (2026-09-18)
- `L177` 운영 AI와 로그인 유지 (2026-09-18)
- `L190` 내부 웹 기본 접속 (2026-09-18)

### `openwiki/testing.md` — 205KB · 1916줄 · ~56,826 토큰 · 통째읽기 잘림

- `L3` AI 세션 테스트의 모델 id 는 임의로 짓지 않는다 (2026-09-14)
- `L19` 전체 스위트가 워커 힙에서 죽던 문제 (2026-09-11)
- `L53` parity 스위트 CI OOM (2026-09-19)
- `L61` 게이트 반복은 `--changed` 로 좁힌다 (2026-09-13)
  - `L88` vitest 는 왜 28분이고, 무엇을 만져도 안 줄어드는가 (2026-09-14 실측)
  - `L117` AI 조수 가족이 왜 이렇게 잘 뒤집히나 (실측)
- `L126` 격리 원장 `test/QUARANTINE.md` (2026-09-13)
- `L144` 브라우저 테스트는 별도 스테이지다 (2026-09-13)
- `L158` P5 delivery gates and the P4 regressions they caught (2026-09-09)
  - `L160` Open: checkpoint writes still slow the authoring loop
- `L212` P4 checkpoint storage and boot admission (2026-09-09)
- `L266` P3 request-bound fixture alignment (2026-09-08)
- `L291` Issue 693 verification contracts (2026-09-08)
- `L315` Request-coverage gate follow-up (2026-09-08)
- `L358` Native event battle reliability QA (2026-09-08)
- `L394` Real large-world player QA (2026-09-07)
- `L403` CSS budget: file count is informational
- `L415` Selection and composer surface contracts (2026-09-06)
- `L434` P3/current-main composition fixtures (2026-09-08)
  - `L461` Cooperative Node scheduling in long session fixtures (2026-09-08)
- `L477` AI turn observation contracts (2026-09-06)
  - `L498` P2 R1 retained-draft Ask (2026-09-07)
  - `L536` P2 R3 wiki delivery (2026-09-07)
- `L565` P3 ownership and stale-base verification (2026-09-07)
  - `L640` Autosave status fixture ownership (2026-09-08)
  - `L654` Project history transport isolation
- `L686` Canonical project storage versus AI history (2026-09-06)
  - `L688` 데스크톱(Electron) 스모크는 이렇게 돈다 (2026-09-16)
- `L710` Action RPG authoring and runtime proof (2026-09-07)
- `L731` Database CSS ownership contracts (2026-09-06)
- `L752` Audio description verification
  - `L776` Real editor surfaces
  - `L803` Exported-player playback and dependency evidence
- `L852` Mac onboarding Phase 1 contracts (2026-09-06)
- `L880` Task10 field-input verification and limits (2026-09-06)
- `L896` Life QA observation and action receipts (2026-09-06)
  - `L904` Task5 validation correction (2026-09-06)
  - `L912` Task5 Q1 audio boundary correction (2026-09-06)
- `L920` 기존 실패 비교는 진단 내용까지 확인한다 (2026-09-05)
- `L937` Esc 메뉴 동작·시각 검증 (2026-09-05)
- `L953` Completed-house Phase 2 verification (2026-09-06)
- `L984` P2 낚시·채집·도감·박물관 focused gate (2026-08-25)
- `L991` Map-owned overlays: actual AI-turn browser regression (2026-09-05)
- `L1000` Editor e2e boot-overlay determinism (2026-08-31)
- `L1005` 영역 다듬기 focused gate (2026-08-31)
- `L1012` AI 이벤트 배치 통행성 focused gate (2026-08-30)
- `L1020` 체공(점프·낙하) focused gate (2026-08-29)
  - `L1029` 좌표 목적지 이동 QA — `node scripts/qa-coordinate-move.mjs` (OPRN-OUT-013, 2026-09-10)
  - `L1046` 좌표 이동 저작 폼 QA — `node scripts/capture-coordinate-move-form.mjs`
  - `L1055` 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`
  - `L1085` 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)
- `L1148` Roguelike run Phase 0–3 coverage (2026-08-24)
  - `L1159` 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)
- `L1168` 데이터베이스 UI/UX 계측 하네스 (2026-08-30)
  - `L1192` 가상 요소 텍스트를 안 재면 `tinyFont 0` 은 "안 봤다" 는 뜻이다 (실측)
  - `L1213` 0px 이미지는 "깨진 것" 과 "접힌 것" 을 갈라야 한다 (실측)
  - `L1219` 타이밍에 취약한 e2e 가 빨간불이면 그 스펙이 단정하는 속성을 직접 재라 (실측 2026-08-30)
  - `L1242` 소스를 grep 하는 테스트는 이름만 봐서는 회귀를 못 가른다 (실측)
- `L1250` Agent validation rule
- `L1360` Event-editor trust-loop validation (2026-07-30)
- `L1365` 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)
- `L1384` Tile-to-world persistence concurrency (task20)
- `L1390` P2 spatial focused gate (2026-08-25)
- `L1399` 대화창 연출 focused gate (2026-08-30)
- `L1474` 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)
  - `L1493` `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)
  - `L1505` 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)
  - `L1513` 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)
  - `L1520` `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)
- `L1542` 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)
  - `L1544` 메뉴 적대적 플레이 회귀 (2026-09-05)
- `L1685` sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)
- `L1692` NPC 배회 런타임 QA — `npm run qa:runtime -- --scenario npc-movement` (2026-09-17)
- `L1706` fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)
  - `L1727` Shared fake DOM enhancement contracts (2026-09-08)
- `L1759` bugfix-sweep 실제 표면 하네스 (2026-08-29)
- `L1772` 마을 설계서 (2026-09-05)
- `L1777` 공포 제작 개정 QA와 개발 서버 전송 (2026-09-05)
- `L1787` 상점 진열 중심 편집 검증 (2026-09-05)
- `L1795` 실제 DB로 나가는 전체 검사 요청 (2026-09-05 실측)
- `L1801` Request-bound functional acceptance verification (2026-09-07)
- `L1869` 조수 보상 저작과 출하 플레이어 검증 (2026-09-06)
- `L1879` 실내 조립·형상 검증 (2026-09-05)
- `L1883` Feature16 player preferences / inventory / shop (2026-09-21)
- `L1895` Feature16 통합 검증 (2026-09-21)
  - `L1903` 필드 HUD 브라우저 증거 (2026-09-21)
  - `L1909` 장르 HUD 시각 확인 (2026-09-21)

### `openwiki/tile-geometry.md` — 9KB · 118줄 · ~2,740 토큰

- `L5` 좌표 계약
- `L23` 캐릭터 자동 배율 (2026-09-21)
- `L47` 원본 아틀라스와 표시 크기의 구분
- `L64` 48px 일반 칩셋 가져오기 (2026-09-21)
- `L82` 브라우저 근거
- `L95` Slates 참고 맵 3종

### `openwiki/tile-layer-policy.md` — 27KB · 346줄 · ~8,430 토큰

- `L13` 다섯 부류
- `L26` 받침(backing) 메타
- `L36` 커스텀 칩셋 준비 — 검토 신호, 자동 변형 금지
- `L46` 나무 밑동 290~293 을 상위로 옮기면 안 되는 이유
- `L54` OPRN-OUT-017 과의 관계 (원인 공유는 미증명)
- `L65` 테스트
- `L75` 브라우저 증거 (2026-09-10)
- `L95` 커스텀 칩셋 픽셀 자동 감지 — 출하된 계약
  - `L118` 임계값 — 실제 시트를 재서 얻은 수치다 (2026-09-10)
  - `L133` 브라우저 실측 (Modern Exteriors 아틀라스 480칸)
- `L141` 아직 결정이 필요한 것 (제품 소유자)
- `L146` 캔버스 렌더러도 받침 계약을 진다 (2026-09-12 실측 결함)
- `L169` 숲마을 공통 기본 칩셋 (2026-09-18)
- `L197` 성채 공통 기본 제공 타일셋 (2026-09-19)
  - `L224` 참고 이미지 보드와 성채 공간 카탈로그 (2026-09-19)
- `L255` LPC 나무 가구 공통 기본 제공 타일셋 (2026-09-21)
  - `L281` 공용 오브젝트 (2026-09-22)
  - `L306` 16px 병행판 (2026-09-22)
  - `L325` 픽셀 크기 기록 계약 (2026-09-22)

### `openwiki/tileset-reference-documents.md` — 15KB · 195줄 · ~4,638 토큰

- `L5` 사용자 경로와 정본
- `L21` 타일 화면 구성 (2026-09-21)
- `L42` 저장 계약
- `L54` AI 선행 읽기 계약
- `L78` Slates 이관
- `L91` 확인 자료와 범위
- `L97` Castle2 성채 학습 이관
- `L109` 숲마을 공용 자료 (2026-09-21)
- `L125` 공용 forest_harmony 참고문서 보충 (2026-09-22)
  - `L140` Castle2 공용 기본 제공 수정
- `L149` 실행형 부품·조립·검증 자료
- `L167` 공용 숲 실행 조립법 (2026-09-22)
  - `L184` 상세 공용 조립 계약 (public-assembly-v2)

### `openwiki/town-tile-benchmark.md` — 10KB · 153줄 · ~3,024 토큰

- `L15` 9문항 = 9숫자
- `L34` 정답은 손으로 쓰지 않는다
- `L55` 팔레트는 주고 배치를 측정한다
- `L73` 재현성 설계 — 3층
- `L87` 정본 일치를 점수에 넣는 문항 / 넣지 않는 문항
- `L102` 채점기가 지키는 두 가지 불변식
- `L111` 실행
- `L125` 감독용 보고서
- `L140` 증거 시트
- `L147` 비용

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

### `openwiki/village-layout-research.md` — 17KB · 184줄 · ~5,365 토큰

- `L5` 현재 적용한 변경과 범위
- `L36` 울타리와 숲마을 칩셋 기본값 (2026-09-21 후속)
- `L54` 누락된 작업 복원과 연결 숲 통합 (2026-09-21)
- `L64` 굽은 외곽 숲과 생활 소품 기본 꾸밈 (2026-09-21)
- `L80` 연속 경계장과 다중 스케일 제어 (2026-09-21 후속)
- `L105` 연구에서 확인한 원칙과 한계
- `L120` 장기 설계 방향: 강을 따라 자란 마을
- `L141` 구현 경로와 소유권
- `L162` 수용 기준과 다음 검증
- `L177` 장소 라이브러리의 기준 도안

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
