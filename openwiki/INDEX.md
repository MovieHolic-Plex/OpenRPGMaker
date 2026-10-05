<!-- 생성 파일 — 직접 고치지 말고 `npm run openwiki:index` 를 돌려라. -->
# OpenWiki 항해 색인

이 저장소의 위키는 **142쪽 / 4903KB / 약 1,425,373 토큰** 이다. 통째로 읽을 수 있는 크기가 아니므로, 필요한 절만 좌표로 잘라 읽어라.

```
read("openwiki/editor-database.md", offset=<절 시작줄>, limit=120)
grep -n "찾는말" openwiki/*.md          # 어느 페이지 몇 줄인지부터 찾는다
```

## 통째 읽기가 잘리는 페이지 (도구 상한 50KB)

이 페이지를 `read` 로 한 번에 열면 **조용히 잘린 채** 전달된다. 아래 절 목록의 줄 번호로 잘라 읽어라.
「가장 큰 절」이 상한 아래면 절 단위 읽기로 페이지 전부에 닿을 수 있다.

| 페이지 | 통짜 크기 | 가장 큰 절 | 줄 | 토큰 추정 |
|---|---|---|---|---|
| `openwiki/beodeul-city.md` | 51KB | 5KB | 370 | ~15,285 |
| `openwiki/charset-actor-harness.md` | 52KB | 7KB | 419 | ~16,431 |
| `openwiki/editor-ai-panel.md` | 623KB | 100KB ⚠상한 초과 — 절을 더 쪼개라 | 3928 | ~182,013 |
| `openwiki/editor-ai-tools.md` | 326KB | 87KB ⚠상한 초과 — 절을 더 쪼개라 | 2699 | ~94,238 |
| `openwiki/editor-database.md` | 413KB | 63KB ⚠상한 초과 — 절을 더 쪼개라 | 2457 | ~120,993 |
| `openwiki/editor-event-authoring.md` | 178KB | 78KB ⚠상한 초과 — 절을 더 쪼개라 | 1072 | ~52,055 |
| `openwiki/editor-event-commands.md` | 68KB | 32KB | 303 | ~18,704 |
| `openwiki/editor-interior-room-harness.md` | 98KB | 6KB | 469 | ~28,406 |
| `openwiki/editor-observability.md` | 64KB | 6KB | 725 | ~18,890 |
| `openwiki/editor-pre-edit-routing.md` | 184KB | 70KB ⚠상한 초과 — 절을 더 쪼개라 | 1147 | ~54,150 |
| `openwiki/editor-workflows-misc.md` | 84KB | 33KB | 594 | ~23,614 |
| `openwiki/runtime-battle.md` | 321KB | 32KB | 1758 | ~94,038 |
| `openwiki/runtime-pre-edit-routing.md` | 111KB | 78KB ⚠상한 초과 — 절을 더 쪼개라 | 815 | ~33,481 |
| `openwiki/runtime-project-schema.md` | 215KB | 67KB ⚠상한 초과 — 절을 더 쪼개라 | 1547 | ~60,143 |
| `openwiki/runtime-sessions.md` | 123KB | 50KB | 627 | ~33,263 |
| `openwiki/testing.md` | 220KB | 48KB | 2092 | ~61,141 |
| `openwiki/tileset-reference-documents.md` | 55KB | 4KB | 564 | ~16,695 |

## 한국어 산문이 깨진 페이지

EUC-KR→UTF-8 모지바케가 남은 줄이다. **그 줄의 한국어는 믿지 말고** 같은 줄의 파일 경로·식별자만 쓰고, 의미는 해당 소스 파일에서 직접 확인하라. 복원은 불가능하다(원본 바이트가 소실).

| 페이지 | 깨진 줄 수 | 예시 줄 번호 |
|---|---|---|
| `openwiki/editor-ai-panel.md` | 26 | 2755, 2756, 2757, 2758, 2759, 2760, 2774, 2784 |
| `openwiki/editor-ai-tools.md` | 6 | 1877, 1878, 1882, 1884, 1886, 2074 |
| `openwiki/editor-database.md` | 8 | 1015, 1019, 1020, 1022, 1023, 1032, 1058, 1061 |
| `openwiki/editor-event-authoring.md` | 16 | 515, 516, 519, 524, 525, 526, 527, 528 |
| `openwiki/editor-event-command-fixes.md` | 11 | 11, 12, 14, 15, 16, 17, 18, 19 |
| `openwiki/editor-event-commands.md` | 6 | 127, 140, 141, 143, 146, 147 |
| `openwiki/editor-observability.md` | 1 | 401 |
| `openwiki/editor-pre-edit-routing.md` | 5 | 913, 922, 930, 934, 958 |
| `openwiki/runtime-project-schema.md` | 1 | 98 |
| `openwiki/state-system.md` | 2 | 5, 89 |

## 없는 파일을 가리키는 참조

문서가 이름을 부르는데 저장소에 없는 파일이다. 대부분은 **의도적으로 삭제된 모듈** 을 기록으로 남긴 것이지만(그 경우 문단이 삭제 사실을 말한다), 살아 있는 안내처럼 읽히면 에이전트가 없는 파일을 찾아 헤맨다. 문서를 고칠 때 이 목록이 줄어드는지 보라.

| 페이지 | 건수 | 참조 |
|---|---|---|
| `openwiki/PROJECT_WIKI.md` | 2 | `.part-N.css`, `src/styles/editor/core.part-1.css` |
| `openwiki/ai-workflow.md` | 5 | `20260709000000_ai_activity_logs.sql`, `src/ai/plannerSkip.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/tilesetAiClient.test.ts`, `test/volumeContractSession.test.ts` |
| `openwiki/atlas-biome-interior.md` | 3 | `.loop.json`, `.loop.png`, `interior-merged-palette.html` |
| `openwiki/battle-impact-contact.md` | 1 | `verify-shots/battle-impact/README.md` |
| `openwiki/beodeul-city.md` | 1 | `bundle-assistant-skills.mjs` |
| `openwiki/bgm-catalog.md` | 4 | `artifacts/bgm-release/bgm-release-v1.json`, `catalog.raw.json`, `output/evidence/agy-interface-smoke-transcript.json`, `output/evidence/audio-ai-final/ingestion-report.json` |
| `openwiki/castle-map.md` | 12 | `.oprn.json`, `output/castle-reference-revision/runtime/SUMMARY.md`, `output/castle-study/runtime/SUMMARY.md`, `output/grand-castle/composite-recipes.json`, `output/grand-castle/runtime/SUMMARY.md`, `output/grand-castle/save-proof.json`, `save-proof.json`, `scripts/build-castle-2.mts`, `scripts/build-castle-map.mts`, `scripts/build-second-castle.mts`, `scripts/observe-castle-keep.mts`, `scripts/remove-castle-reference-bridge.mjs` |
| `openwiki/charset-actor-harness.md` | 40 | `SOURCE.md`, `alpha-render.json`, `alpha.png`, `alpha/SUMMARY.md`, `alpha_sheet.png`, `archive-readback.json`, `charset-eight-transparent.png`, `charset-eight.json`, `charset-eight.png`, `charset-normal.png`, `charset-strong.png`, `charset-weak.png`, `context.png`, `delivery-readback.json`, `delivery.json`, `desc.json`, `discarded.json`, `driver.json`, `evidence/20261004-continuation/harness-contracts-final.json`, `experiment.json`, `export-readback.json`, `gate.json`, `initial-images-readback.json`, `licenses/easyrpg/AUTHORS.md`, `live-reload.json`, `live-review.png`, `mixed100-002__gpt-r1/views/context.png`, `model-frames.json`, `pack/characters.json`, `pack/editor-assets.json`, `pack/index.html`, `pixel-edits.json`, `pixel-proof.png`, `production-errors.json`, `readback.json`, `shared-library-error.json`, `sheet_rgba.png`, `visual-inputs.json`, `walk-qa.json`, `walk-transfer.json` |
| `openwiki/connected-dungeon-generation.md` | 1 | `verify-shots/runtime-qa/connected-dungeon-editor/SUMMARY.md` |
| `openwiki/delayed-tooltip.md` | 1 | `src/styles/editor/delayed-tooltip.css` |
| `openwiki/editor-ai-panel.md` | 82 | `.omo/evidence/assistant-glass-fold/measure.json`, `.omo/evidence/autonomous-ai-rpg/task-8-autonomous-ai-rpg.md`, `06-page-modern-forms.css`, `07-wide-compact.png`, `15-assistant-readable.css`, `17-assistant-modern-shell.css`, `DRAFT_20260706_auth_rls.sql`, `after/measure.json`, `ai-tool-usage-YYYY-MM-DD.json`, `aiCommandBar.ts`, `aiGlassPanelWidth.test.ts`, `aiSkillDrawer.ts`, `aiTeamDeck.ts`, `aiTemperatureMenu.ts`, `aiVolatileController.ts`, `assistant-skills.css`, `assistantP2ReviewIntegration.test.ts`, `chat-dock-switch.spec.ts`, `chatDock.ts`, `functionalCompositeClarification.test.ts`, `intentClarify.ts`, `newmain-after-measure.json`, `output/evidence/acceptance-live/README.md`, `output/evidence/ai-activity-levels/06-wide.png`, `output/evidence/ai-team-budget/SUMMARY.json`, `output/evidence/ai-team-menu/SUMMARY.json`, `output/evidence/ai-team-sidebar/SUMMARY.md`, `output/evidence/assistant-clean-glass/phase-2/implementation.md`, `output/evidence/assistant-ui-modern/newmain-before-measure.json`, `output/evidence/studio-drawer/qa/capture-report.json`, `output/evidence/ultrabrain/settings.png`, `plan-wire.json`, `regionIntentRouter.ts`, `review-input.png`, `roles-wire.json`, `scripts/qa/ai-team-budget.mjs`, `scripts/qa/assistant-side-seam-hittest.mjs`, `specialists.png`, `src/ai/intentClarify.ts`, `src/ai/plannerSkip.ts`, `src/ai/skills.ts`, `src/editor/chatDock.ts`, `src/styles/editor/ghost-phase-chip.css`, `stampPlace.ts`, `test/agentBlueprintTurnEnd.test.ts`, `test/aiActivityLiveRow.test.ts`, `test/aiChatObservability.test.ts`, `test/aiChatPanelUxRepairs.test.ts`, `test/aiChatSessionScope.test.ts`, `test/aiComposerEffortPanel.test.ts`, `test/aiConversationRemoteHistory.test.ts`, `test/aiGlassFold.test.ts`, `test/aiGlassPanelWidth.test.ts`, `test/aiNewGoalDraftRetirement.test.ts`, `test/aiNewGoalEarlyOwnership.test.ts`, `test/aiPanelContextSurfaces.test.ts`, `test/aiStickyChecklist.test.ts`, `test/aiToolCallSessionProtocol.test.ts`, `test/aiWorkItemStall.test.ts`, `test/assistantAcceptance.test.ts`, `test/assistantAcceptanceSession.test.ts`, `test/assistantImageTransport.test.ts`, `test/assistantSpatialObligations.test.ts`, `test/chatDock.test.ts`, `test/e2e/_assistant-glass-shots.spec.ts`, `test/e2e/_glass-dock-report.spec.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/mode-switch-camera-stability.spec.ts`, `test/editSceneCameraFocus.test.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/plannerSkip.test.ts`, `test/regionIntentExposure.test.ts`, `test/regionTaskRun.test.ts`, `test/tilesetAiClient.test.ts`, `test/turnGuideSharedRules.test.ts`, `test/volumeContractSession.test.ts`, `test/workspaceBarAssistantDock.test.ts`, `verify-shots/ai-parallel-live/timeline.json`, `verify-shots/feature16-ai/01-library.png`, `verify-shots/first-core-opening/SUMMARY.md`, `verify-shots/preset-first-team-e2e/SUMMARY.json`, `writer-wire.json` |
| `openwiki/editor-ai-tools.md` | 22 | `aiCommandBar.ts`, `aiProposalModal.ts`, `output/lpc-shared-organized-20260923/shared-proof.json`, `output/shared-spatial-catalog/probe.mts`, `projectWikiSession.test.ts`, `tabs-b-assistant-panel.css`, `test/aiEventPlacementSurfaceGate.test.ts`, `test/aiStaleProposal.test.ts`, `test/aiToolCallSessionProtocol.test.ts`, `test/applyProposedProjectHouseProtection.test.ts`, `test/assistantMapPreservationGuard.test.ts`, `test/clusterAiModalHouseProtection.test.ts`, `test/elementRatesPartialAccept.test.ts`, `test/intentClarify.test.ts`, `test/npcCastSession.test.ts`, `test/projectLint.test.ts`, `test/propRejectionDiagnostics.test.ts`, `test/questGraph.test.ts`, `test/refactorTools.test.ts`, `test/regionTaskRun.test.ts`, `test/volumeContractSession.test.ts`, `test/worldAiExclusion.test.ts` |
| `openwiki/editor-database.md` | 46 | `.omo/editor-skill-stage/capture.mjs`, `.oprn-kit.json`, `builtinHouseStructureKits.ts`, `databaseCinematics.test.ts`, `desc.json`, `desktop-record-shell.css`, `desktop-record-shell/13-actor-studio.css`, `editor-actor2.png`, `editor-conflict.png`, `editor-no-match.png`, `enemy-art-NNN.png`, `form-hierarchy-modern.css`, `hero-01-charset.png`, `houseKitTools.ts`, `output/evidence/battle-animation-ux/p1-implementation.md`, `output/evidence/battle-animation-ux/p2-implementation.md`, `output/evidence/battle-rules-ux/st_01a07318-manual-qa.md`, `output/evidence/battle-rules-ux/verification.md`, `output/evidence/character-face-correction/actor2-before-after.png`, `output/evidence/concept-expansion/legacy-db-proof.json`, `output/evidence/concept-v2/legacy-db-proof.json`, `output/evidence/monster-concepts/b1/fix.md`, `output/evidence/monster-concepts/p2/verification.md`, `output/evidence/monster-concepts/r1/fix.md`, `output/evidence/places-ux-audit/after/card-outline.png`, `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`, `output/spatial-ux-verify.mjs`, `publish-forest-place-library.mjs`, `qa-db-beginner-mode.spec.ts`, `reports/generated-effect-showcase-2026-08-24.html`, `reveal-fix.md`, `scripts/generate-default-item-icons.mts`, `scripts/lib/effectSheet/paintersMonster.mjs`, `scripts/lib/effectSheet/paintersUtility.mjs`, `scripts/repair-capture-rate-residue.mts`, `scripts/tmp-phase3-probe.mjs`, `src/styles/editor/harness-suggestion.css`, `test/databaseModalAiConnection.test.ts`, `test/databaseStudioV2.test.ts`, `test/databaseSystemView.test.ts`, `test/databaseTilesetFolder.test.ts`, `test/p0ProjectSchema.test.ts`, `test/spatialLegacyImport.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `troops.part-1.css`, `verify-shots/runtime-qa/menu-eras/EDITOR.md` |
| `openwiki/editor-event-authoring.md` | 14 | `03-legend-toolbar.css`, `05-force-modern-actor-page3.css`, `audit-before.md`, `event-editor-ai.css`, `event-editor.balanced.css`, `event-editor.part-3/08-inline-validation-badges.css`, `new-editor/REPORT.html`, `output/evidence/event-ai-assist-ux/960x900-compact.png`, `scripts/generated/toolCatalog.json`, `src/styles/editor/event-editor.balanced.css`, `src/styles/editor/event-editor.modernize.css`, `test/eventEditorTrustLoop.test.ts`, `verify-shots/page-preview-probe/02-preview-open.png`, `verify-shots/runtime-qa/cheolsu-keyboard-fixed/SUMMARY.md` |
| `openwiki/editor-event-command-fixes.md` | 16 | `.omo/evidence/event-command-remediation/U04/api-ownership.md`, `event-editor-rich-forms.css`, `scripts/qa/runtime/event-command-remediation-u02.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u04.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u05.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u06.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u14.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u28-text.scenario.mjs`, `test/e2e/event-command-remediation-U02.spec.ts`, `test/e2e/event-command-remediation-U04.spec.ts`, `test/e2e/event-command-remediation-U05.spec.ts`, `test/e2e/event-command-remediation-U06.spec.ts`, `test/eventCommandRemediation/U02.test.ts`, `test/eventCommandRemediation/U04.test.ts`, `test/eventCommandRemediation/U05.test.ts`, `test/eventCommandRemediation/U06.test.ts` |
| `openwiki/editor-event-commands.md` | 16 | `02-changeface-play-mock-larger.css`, `07-identifiable-previews.css`, `choicesDialog.ts`, `event-editor.command-preview.css`, `event-editor.command-preview/01-event-editor-modern-import.css`, `event-editor.commerce.css`, `event-editor.part-1.css`, `event-editor.part-2/3.css`, `event-editor.shop.css`, `eventCommandSupportRepairs.test.ts`, `messageCommandDialogs.ts`, `messageDialogControls.ts`, `src/styles/editor/event-editor.part-2.css`, `test/dialoguePreviewPresentationCss.test.ts`, `test/eventEditorTrustLoop.test.ts`, `textCommandDialog.ts` |
| `openwiki/editor-genre-packs.md` | 2 | `src/editor/panels/newProjectDialog.ts`, `test/modalEscapeLayerGate.test.ts` |
| `openwiki/editor-interior-room-harness.md` | 38 | `hearth-lit.json`, `hearth-unlit.json`, `output/audit-element-cliff-seams.py`, `output/audit-element-complex-seams.py`, `output/audit-four-context-dungeons-v3.py`, `output/audit-four-context-dungeons.py`, `output/build-element-complex-caves.mts`, `output/build-element-confluence-caves.mts`, `output/build-element-contour-caves.mts`, `output/build-four-context-dungeons-v2.mts`, `output/build-four-context-dungeons-v3.mts`, `output/build-four-context-dungeons.mts`, `output/context-element-caves.mts`, `output/decorate-element-caves.mts`, `output/element-complex-qa.mjs`, `output/element-confluence-qa.mjs`, `output/element-contour-qa.mjs`, `output/evidence/concept-v2/index.html`, `output/evidence/inn-exploration-v4/index.html`, `output/evidence/inn-inspection-v5/index.html`, `output/evidence/pr618-fixtures/inn.json`, `output/four-context-dungeons-qa.mjs`, `output/four-context-dungeons-v3-qa.mjs`, `output/save-element-complex-caves.mts`, `output/save-element-confluence-caves.mts`, `output/save-four-context-dungeons-v3.mts`, `output/save-four-context-dungeons.mts`, `reports.json`, `scripts/demo-assistant-interior-build.mts`, `seam-audit.json`, `test/innConceptRebuild.test.ts`, `test/innExploration.test.ts`, `test/interiorConceptAssemblies.test.ts`, `test/interiorLoadConsistency.test.ts`, `test/interiorLongTable.test.ts`, `test/stoneHearth.test.ts`, `test/storeDeferredLineage.test.ts`, `test/storeSaveOrdering.test.ts` |
| `openwiki/editor-observability.md` | 2 | `scripts/qa/issue693-boot-diagnostics.mjs`, `scripts/qa/issue693-diagnostics.mjs` |
| `openwiki/editor-pre-edit-routing.md` | 30 | `@/styles/database/index.css`, `authoringTestGate.ts`, `dbConnectionAdvancedSettings.ts`, `editor/coachMarks.ts`, `event-editor.part-4.css`, `figma-editor.css`, `figma-editor/10-map-tree.css`, `legacyDb-root-cache.spec.ts`, `output/paw-380-corrections/editor-observations.json`, `panels/basicLeftRail.ts`, `panels/basicTilePalette.ts`, `panels/databaseUxLevel.ts`, `referencePresetSnapshot.ts`, `reliefBake.ts`, `rm2k3.part-1.css`, `shell/editor-responsive-expert.css`, `src/editor/editorUiMode.ts`, `src/editor/tools/worldTools.ts`, `src/project/legacyDbProjectSync.ts`, `src/styles/editor/event-editor.balanced.css`, `src/styles/editor/left-sidebar.modern.css`, `src/styles/editor/map-location-layer.css`, `src/styles/editor/map-props.css`, `src/styles/editor/region-task.css`, `styles/database/modern/monster-ux.css`, `test/basicLeftRail.test.ts`, `test/modalEscapeLayerGate.test.ts`, `test/regionTaskHouseProtection.test.ts`, `test/worldAiExclusion.test.ts`, `worldTools.ts` |
| `openwiki/editor-validation.md` | 8 | `final-layout.json`, `test/aiBlockedEventRelocation.test.ts`, `test/aiToolDiscoveryEscalation.test.ts`, `test/databaseSystemView.test.ts`, `test/interiorLongTable.test.ts`, `test/p0ProjectSchema.test.ts`, `test/projectLint.test.ts`, `viewport-matrix.json` |
| `openwiki/editor-workflows-misc.md` | 24 | `.qa.json`, `basicTilePalette.test.ts`, `basicTilePalette.ts`, `default.json`, `game.html`, `loadNewRemoteProject.test.ts`, `release.json`, `runtime.json`, `scripts/build-dungeon-themed-maps.mts`, `scripts/build-grand-ice-cave.mts`, `scripts/build-ice-pass-map.mts`, `scripts/extend-home-8pyeong-with-dungeons.mts`, `src/editor/authoringTestGate.ts`, `src/styles/editor/audio-test-dialog.css`, `src/styles/editor/event-editor-help.css`, `src/styles/editor/help-modal.css`, `src/styles/editor/map-event-search.css`, `src/styles/editor/map-props.css`, `test/audioDescriptionCommandSurfaces.test.ts`, `test/audioDescriptionLifecycle.test.ts`, `test/devRuntimeArchive.test.ts`, `test/mapSurfaceFocus.test.ts`, `test/runtimePictureStacking.test.ts`, `transactionalNewRemoteProject.test.ts` |
| `openwiki/emerald-fields.md` | 27 | `ANALYSIS.md`, `VISUAL-SUMMARY.md`, `author-emerald-wide.mts`, `cliff-contours.json`, `editor-saved-proof.json`, `emerald-wide-v2/reloaded-project.json`, `exit-seam-proof.json`, `fidelity/fidelity-proof.json`, `fidelity/reference-vs-editor.png`, `fidelity/runtime-visual/SUMMARY.md`, `inspection-16-fixed/manifest.json`, `inspection-16/REVIEW.md`, `map-open-saved.png`, `output/evidence/emerald-fields/fidelity/VALIDATION.md`, `output/evidence/emerald-region/legacy-db-proof.json`, `output/evidence/emerald-wide/reloaded-project.json`, `refine-emerald-reference.mts`, `region-saved.png`, `road-graph.json`, `scripts/author-emerald-fields.mts`, `scripts/author-emerald-wide.mts`, `scripts/refine-emerald-reference.mts`, `scripts/refine-emerald-wide.mts`, `scripts/register-emerald-region.mts`, `verify-shots/runtime-qa/emerald-fields/SUMMARY.md`, `verify-shots/runtime-qa/emerald-wide-v2/SUMMARY.md`, `verify-shots/runtime-qa/emerald-wide/SUMMARY.md` |
| `openwiki/feature16-battle-ui.md` | 1 | `verify-shots/runtime-qa/feature16-battle-ui/SUMMARY.md` |
| `openwiki/growth-trees.md` | 3 | `.omo/evidence/growth-integrated/browser-presets/report.json`, `applied-bundle.json`, `verify-shots/runtime-qa/growth-tree/SUMMARY.md` |
| `openwiki/harnesses/charset-actor.md` | 4 | `delivery.json`, `model-frames.json`, `pixel-edits.json`, `visual-inputs.json` |
| `openwiki/harnesses/interior-prop-derivations-operations.md` | 1 | `library.json` |
| `openwiki/harnesses/interior-prop-derivations.md` | 1 | `.png` |
| `openwiki/harnesses/interior-props.md` | 2 | `.loop.json`, `.loop.png` |
| `openwiki/harnesses/jp-city.md` | 1 | `kit-x3.png` |
| `openwiki/harnesses/modern-chipset.md` | 2 | `.input.json`, `previous-tileset.json` |
| `openwiki/harnesses/monster-collect-species.md` | 1 | `qa-runs/battle-anim3/anim.js` |
| `openwiki/harnesses/super-harness.md` | 15 | `B.json`, `art-context-review.json`, `art-installation.json`, `art-output/acceptance-contract.json`, `art-result.json`, `card.json`, `ctx-cand.png`, `gaps.json`, `material-review.json`, `materials.json`, `parking-repair-brief.json`, `planning-reviews/A.json`, `planning.json`, `supervisor-authorization.json`, `visual-input.json` |
| `openwiki/horror-authoring.md` | 2 | `motion-sheet.png`, `projectLint.test.ts` |
| `openwiki/joseon-baram.md` | 2 | `.oprn.json`, `map-from-sheet.png` |
| `openwiki/jp-city.md` | 1 | `scripts/tmp-jp-gen.mts` |
| `openwiki/large-village-generation.md` | 6 | `-standalone.html`, `HANDOFF.json`, `output/evidence/town-reference/town-reference.html`, `scripts/force-save-large-village.mts`, `scripts/force-save-village-50.mts`, `src/project/defaults/largeRiverMarketVillageBuild.ts` |
| `openwiki/location-layer-affordance-audit.md` | 1 | `src/styles/editor/map-location-layer.css` |
| `openwiki/modern-city.md` | 2 | `-plan.json`, `.oprn.json` |
| `openwiki/native-enemy-retirement.md` | 2 | `scripts/generate-monster-images.mts`, `verify-shots/monster-refresh/SUMMARY.md` |
| `openwiki/night-monster.md` | 2 | `build-night-monster.mts`, `verify-shots/runtime-qa/night-monster/SUMMARY.md` |
| `openwiki/opening-still-pack.md` | 4 | `artifacts/stills-library-plan.json`, `queue-status.json`, `review/index.html`, `run-status.json` |
| `openwiki/pixel-art-world-facility-complements.md` | 4 | `current-portable.json`, `library.json`, `preparation-proof.json`, `preparation-seal.json` |
| `openwiki/pixel-art-world-food.md` | 1 | `output/paw-food-install/ui-import-proof.json` |
| `openwiki/pixel-art-world-home.md` | 2 | `ST-Town-I01.png`, `output/paw-home/report.json` |
| `openwiki/pixel-art-world-loose-supplements.md` | 4 | `current-portable.json`, `library.json`, `preparation-proof.json`, `preparation-seal.json` |
| `openwiki/pixel-art-world-mansion-exteriors.md` | 1 | `output/paw-mansion-exterior-install/automatic-project-proof.json` |
| `openwiki/pixel-art-world-maps-51.md` | 1 | `paw-maps.html` |
| `openwiki/project-wiki.md` | 2 | `projectWikiSession.test.ts`, `projectWikiTimeout.test.ts` |
| `openwiki/quickstart.md` | 1 | `.oprn-local.json` |
| `openwiki/refmap-town-outside.md` | 2 | `D_REFMAP_Interior_Extra.png`, `preset.json` |
| `openwiki/runtime-action-combat.md` | 1 | `export-player/player.html` |
| `openwiki/runtime-battle.md` | 26 | `.omo/mx-rt/timeline-audit.ts`, `.omo/pixel-enemy-review/browser/report.json`, `.omo/r2check/a1-v2/MECHANICS.md`, `.omo/r2check/a1-v3/DISPLAY.md`, `.omo/retro-monsters/all/preview-big.png`, `.omo/retro-skills/big-target/preview.png`, `.omo/retro-skills/new-1/preview.png`, `_dragonquest.css`, `_mv.css`, `_octopath/_chrono/_bravely/_dragonquest/_ff/_mother/_goldensun/_mv/_vxace/_hud-templates.css`, `_retro-themes.css`, `assets/generated/charset-battlers/actorN-k.png`, `audio-score.js`, `battle.css`, `hero-03-battle-idle.png`, `output/evidence/event-command-completion/battle/VERIFICATION.md`, `qa-runs/battle-moves/anim.js`, `qa-runs/battle-sfx/audio-score.js`, `raw.png`, `scripts/asset-gen/charset-battler/art3/actorN.py`, `scripts/legacy-db-resource-root/catalog.mjs`, `src/styles/runtime/battle/18-pokemon-layout-redesign.css`, `starter/hires/hero-0N-battle.png`, `test/battleLookFrontSkin.test.ts`, `verify-shots/monster-refresh/SUMMARY.md`, `verify-shots/monster-refresh/runtime/SUMMARY.md` |
| `openwiki/runtime-m2-flow-controls.md` | 4 | `scripts/capture/capture-parallax-easing.mjs`, `test/runtimePictureStacking.test.ts`, `verify-shots/runtime-qa/cloud-shadows/SUMMARY.md`, `verify-shots/runtime-qa/coordinate-move/SUMMARY.md` |
| `openwiki/runtime-pre-edit-routing.md` | 4 | `editor/core.part-1.css`, `test/playerInputCss.test.ts`, `test/runtimeQaInstrumentationBoundary.test.ts`, `verify-shots/runtime-qa/emote/SUMMARY.md` |
| `openwiki/runtime-project-schema.md` | 29 | `.json`, `.png`, `20260827000000_ai_log_anon_delete_revoke.sql`, `DRAFT_20260706_auth_rls.sql`, `devMediaPromotion.test.ts`, `dist-electron/main.cjs`, `interiorLoadConsistency.test.ts`, `mediaImportDurability.test.ts`, `output/evidence/event-command-completion/legacy-persistence/ledger.json`, `phaser.min.js`, `render-relief-maps.mts`, `scripts/lib/legacyDb-database-ops.mjs`, `scripts/publish-first-visit-demo.mts`, `scripts/qa/issue693-media.mjs`, `src/project/legacyDbProjectSync.ts`, `storeLifecycleReentrancy.test.ts`, `storePersistenceLineage.test.ts`, `test/aiBlockedEventRelocation.test.ts`, `test/audioDescriptionConcurrentPersistence.test.ts`, `test/io.test.ts`, `test/legacyDbCanonicalRoundtrip.live.test.ts`, `test/legacyDbDatabaseOps.node.test.mjs`, `test/legacyDbMapPatchRecovery.test.ts`, `test/legacyDbProjectSync.test.ts`, `test/legacyDbRlsCoverage.node.test.mjs`, `test/mapPlanningReuse.test.ts`, `test/sharedDemoStore.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `transactionalRemoteSourceLineage.test.ts` |
| `openwiki/runtime-sessions.md` | 4 | `output/evidence/stardew/stardew-legacyDb.json`, `verify-shots/runtime-qa/feature16-player/SUMMARY.md`, `verify-shots/runtime-qa/menu-design/SUMMARY.md`, `verify-shots/runtime-qa/weather-after/SUMMARY.md` |
| `openwiki/se-catalog.md` | 8 | `.mjs`, `audio-features.json`, `audition.html`, `cross-check.json`, `dist/se-staging/audition.html`, `labels.json`, `placed.json`, `test/audioDescriptionCommandSurfaces.test.ts` |
| `openwiki/slates-assembly-playbook.md` | 1 | `ville_0.png` |
| `openwiki/slates-structure-learning.md` | 1 | `read-slates-project.mjs` |
| `openwiki/slates-study.md` | 3 | `output/slates-study/source-project.json`, `scripts/content/save-slates-study.mjs`, `source-row.json` |
| `openwiki/slates-village-authoring.md` | 1 | `save-slates-village-50.mjs` |
| `openwiki/spatial-authoring-controller.md` | 1 | `storeMutationInstrumentation.test.ts` |
| `openwiki/spatial-catalog-ui.md` | 2 | `output/evidence/interior-removal-executed/host-proof.json`, `output/evidence/place-previews/proof.json` |
| `openwiki/spatial-geography-compiler.md` | 1 | `.omo/ulw-execute/tile-to-world/execution-policy.md` |
| `openwiki/spatial-geography-ui.md` | 3 | `.oprn.json`, `lake-persistence.json`, `lake-regions-desktop.png` |
| `openwiki/spatial-place-compiler.md` | 2 | `interior-catalog-editor.mjs`, `scripts/register-house-spatial-catalog.mts` |
| `openwiki/stardew-core-elements-research.md` | 1 | `scripts/save-stardew-demo.mts` |
| `openwiki/storage-retirement.md` | 1 | `.oprn-local.json` |
| `openwiki/teaching-assistant-tilesets.md` | 1 | `_specs.py` |
| `openwiki/team-project-host.md` | 3 | `dist-electron/dist-electron/browser-bridge.js`, `dist-electron/main.cjs`, `userData/recent-teams.json` |
| `openwiki/testing.md` | 39 | `../dialogue.css`, `.omo/gates-vitest-report.json`, `X.quarantine.test.ts`, `X.test.ts`, `acceptance-live-check.mjs`, `aiChatObservability.test.ts`, `aiChatPanelTransportError.test.ts`, `aiSelectionChipScope.test.ts`, `boot-failure.json`, `browser-play-start.png`, `browser-title.png`, `event-editor.command-preview/07-identifiable-previews.css`, `legacyDb-proof-first-save.json`, `output/evidence/acceptance-live/README.md`, `output/evidence/concept-expansion/README.md`, `output/evidence/concept-v2/validation.json`, `output/evidence/functional-acceptance/public-smoke.json`, `output/evidence/horror-mystery-prototype/browser-qa.json`, `qa-db-beginner-mode.spec.ts`, `scripts/author-natural-village-harness.mts`, `scripts/author-natural-village-reference.mts`, `scripts/build-horror-mystery-prototype.mts`, `scripts/qa/acceptance-live.mjs`, `test/actionRpgAuthoringAcceptance.test.ts`, `test/aiEventPlacementSurfaceGate.test.ts`, `test/autosaveStatus.test.ts`, `test/databaseKoreanRtpDefaults.test.ts`, `test/dialoguePreviewPresentationCss.test.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/dialogue-nameplate-clears-body.spec.ts`, `test/interiorConceptAssemblies.test.ts`, `test/loadNewRemoteProject.test.ts`, `test/regionTaskRun.test.ts`, `test/storePersistenceProof.test.ts`, `test/tilesetAiClient.test.ts`, `verify-shots/runtime-qa/action-rpg/SUMMARY.md`, `verify-shots/runtime-qa/coordinate-move/SUMMARY.md`, `verify-shots/runtime-qa/esc-menu/SUMMARY.md`, `verify-shots/runtime-qa/status-menu-adversarial/SUMMARY.md` |
| `openwiki/tile-geometry.md` | 2 | `output/slates-reference/source-row.json`, `scripts/content/save-slates-reference.mjs` |
| `openwiki/tile-layer-policy.md` | 2 | `Castle2_5.png`, `clean_furniture.png` |
| `openwiki/tileset-reference-documents.md` | 3 | `scripts/content/save-tileset-references.mjs`, `tilesetAiQuestionEditor.ts`, `tilesetCheckerSummary.ts` |
| `openwiki/title-opening-effects.md` | 2 | `.effects.json`, `verify-shots/runtime-qa/title-effects/SUMMARY.md` |
| `openwiki/town-tile-benchmark.md` | 1 | `combined-town-chipset-report.html` |
| `openwiki/ui-discovery-pilot.md` | 2 | `direct/RESULTS.json`, `output/evidence/ui-discovery-v2/report.html` |
| `openwiki/village-design.md` | 7 | `20260907000000_spatial_authoring_cas.sql`, `depth-review.json`, `output/evidence/house-heights/REVIEW.md`, `output/village-direction/index.html`, `scripts/build-house-study-gallery.mts`, `scripts/publish-compact-village.mts`, `scripts/publish-object-village.mts` |
| `openwiki/village-layout-research.md` | 1 | `scripts/qa/capture-restored-river-village.mjs` |
| `openwiki/world-structure-authoring.md` | 1 | `verify-shots/runtime-qa/world-structure-tools/SUMMARY.md` |

## 페이지별 절 좌표

### `openwiki/PROJECT_WIKI.md` — 16KB · 178줄 · ~4,179 토큰

- `L5` Purpose
- `L16` Required pre-edit read order
- `L67` Project identity
- `L76` Main ownership boundaries
- `L111` Authored tile placement references
- `L117` How an AI should use this wiki
- `L128` 프로젝트 정본 저장 (see root `AGENTS.md`)
- `L136` Desktop UI integration truth (2026-08-11)
- `L149` Per-project wiki structure
- `L165` Staleness rule
- `L171` 지형 설치 도구 (2026-10-03)

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

### `openwiki/architecture.md` — 11KB · 71줄 · ~2,800 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/atlas-biome-interior.md` — 26KB · 162줄 · ~7,732 토큰

- `L8` 원본과 칸
- `L37` 코드
- `L51` 참고문서 「손 도트 실내 (v5)」
- `L56` 가구 메모·방 표 (2026-09-29)
- `L75` 예제 맵·정본
- `L81` 검증
- `L87` 배·던전 — atlas_biome_dungeon
- `L92` 남은 것
- `L99` 편집기 「새 맵 → 실내」 기본 (2026-10-01)
- `L107` 고른 후보 반영 (2026-10-01)
- `L125` 새 기물 길 (2026-10-01)
- `L138` 소품 하네스 — 여러 명이 찍고 사용자가 고른다 (2026-10-01)
  - `L153` 서버 하네스의 자동 공용 등록 (2026-10-04)

### `openwiki/autotiles.md` — 23KB · 217줄 · ~6,795 토큰

- `L5` World 지형과 공통 구조물
- `L25` 1. RM2K식 3×4 템플릿 블록 문법
- `L41` 2. 지형 앵커 카탈로그 — 4행 밴드 × 열 0/3/6/9 격자
- `L61` 3. 물 계열 — 오토타일 그룹이 아닌 별도 시스템
- `L79` 3-1. 던전 칩셋 절벽(빙암) — 벽은 두 행이다
- `L113` 4. 오토타일 등록 경로 3가지
- `L121` Integrated World snapshot (2026-09-06)
- `L135` Terrain placement regression contracts (2026-09-08)
- `L152` 5. 검증
- `L160` Tibo recovery (2026-09-17)
- `L173` 실내 천장 기본 등록과 쿼터 합성 (2026-09-18)
- `L181` Pixel Art World XP 사용자 원본 (2026-09-24)
  - `L207` XP 공용 로컬 설치와 조립 표본

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

### `openwiki/beodeul-city.md` — 51KB · 370줄 · ~15,285 토큰 · 통째읽기 잘림

- `L8` 기본 타일셋 (2026-09-30)
  - `L24` 빠른 집·도로 도구 (2026-10-03)
  - `L39` 팔레트 실측 (2026-09-30, 헤드리스 chromium, dev 서버, 1600×900)
- `L65` 무엇이 어디에 있나
- `L85` 칸 자르기 규칙
- `L97` 정본 저장·재로드 (2026-09-28)
- `L105` 조수 시험 — 「버들항 비슷한 로마풍 항구 도시를 깔아줘」
  - `L116` 결과 (2026-09-28, 두 번)
- `L136` 라운드 2 (2026-09-29, v7) — 원본이 아닌 도시를 가르치기
  - `L140` 무엇을 더했나
  - `L153` 예시 배치 둘과 배치 자
  - `L164` 참고문서 (v7)
  - `L170` 정본 (v7)
  - `L174` 조수 재시험 (klb/claude-opus-5.5, 「원본 좌표에 찍지 말고 새로 설계, 예시도 베끼지 말 것」)
- `L196` 라운드 3 (2026-09-29, v8) — 블록 키트로 빈 풀밭 없애기
  - `L201` 무엇을 더했나
  - `L217` 배우며 찾은 것
  - `L225` 조수 재시험 (klb/claude-opus-5.5, 라운드 2 과제 + 「블록 키트로」, 블록 25종 번들)
  - `L245` 정본 (v8)
- `L249` 다음 방향 (보류 — 이번에는 다시 그리지 않음)
- `L267` 남은 것
- `L278` 조수 마을 경로 (2026-10-01) — 「마을 만들어 줘」가 버들항으로 안 가던 원인과 수리
- `L289` 고른 장소 조각 (2026-10-01) — 변형 20곳에서 사용자가 고른 것을 공용 시트로
  - `L302` 칸·키트
  - `L325` 기존 프로젝트
  - `L331` 참고문서 (조수)
  - `L338` 화면 증거
  - `L342` 남은 것
- `L347` 마을 문법 (2026-10-01 오후) — 「마을 만들어 줘」가 바둑판이 아니라 고른 변형 마을처럼

### `openwiki/bgm-catalog.md` — 24KB · 345줄 · ~6,148 토큰

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
- `L339` 후보가 없는 오프닝의 원곡 (2026-10-04)

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

### `openwiki/character-battle-motion.md` — 4KB · 58줄 · ~1,374 토큰

- `L3` 공용 적용과 우선순위
- `L26` 런타임과 편집기
- `L39` 그림의 접촉점
- `L50` 저장과 증거

### `openwiki/charset-actor-harness.md` — 52KB · 419줄 · ~16,431 토큰 · 통째읽기 잘림

- `L3` GIF 공방: AI 자유 저작과 사람 선택 (2026-10-04)
  - `L22` 남긴 픽셀을 기준으로 한 반복 생산 (2026-10-04)
  - `L47` 기본 제작을 원본 격자 변형으로 복귀 (2026-10-04 사용자 피드백)
  - `L55` 좌표 부분 수정 비교 실험 (2026-10-04)
  - `L77` 픽셀 참고 이미지 첨부 실험 (2026-10-04)
  - `L89` 모델이 걷기까지 전부 저작 (2026-10-04 사용자 변경 지시)
  - `L109` 버튼 반응과 저장 (2026-10-04)
  - `L125` 한 캐릭터 검토 화면 (2026-10-04)
  - `L133` 적대적 alpha QA와 검사 정책 2 (2026-10-04)
  - `L151` 이전 걷기 전파 v2: 새 면의 픽셀 전달 (2026-10-04)
  - `L170` 남김 → 공용 캐릭터와 설명 (2026-10-04)
- `L183` 진입점과 저장 대상
- `L198` 픽셀 결손 폐기 게이트 v2 (2026-10-03 사용자 지적)
- `L222` 묶음 저작과 에디터용 내보내기
  - `L224` 2026-10-04 신뢰성 감사와 v3
- `L277` 이전 걸음 전파 계약 (2026-10-03)
- `L295` 재개 당시 근거
- `L303` GPT high 원샷 비교 (2026-10-03 사용자 요청)
- `L321` 첨부 그림 3명 원샷 비교 (2026-10-03 사용자 요청)
- `L344` 같은 첨부 그림의 조선시대 변형 (2026-10-03 사용자 요청)
- `L372` 몸통 고정과 걷기 검사 정책 1 (2026-10-04)
- `L387` 바람의나라를 떠올리는 고전 RPG 8종 (2026-10-03 사용자 요청)

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

### `openwiki/connected-dungeon-generation.md` — 6KB · 39줄 · ~1,924 토큰

- `L5` 진입과 호환성
- `L13` 소유 모듈
- `L21` 설계 입력
- `L34` 검증 및 증거

### `openwiki/delayed-tooltip.md` — 5KB · 81줄 · ~1,668 토큰

- `L11` 동작 계약
- `L28` 문구 규칙
- `L36` 맵 도구바·접이식 왼쪽 레일 (2026-09-18)
- `L45` 1차 롤아웃 대상
- `L60` 설치 지점
- `L66` 테스트

### `openwiki/editor-ai-panel.md` — 623KB · 3928줄 · ~182,013 토큰 · 통째읽기 잘림 · 깨진 줄 26

- `L5` UX 추가 조사 2 — 공간 체크포인트·사람 칸 비교 (2026-10-04)
- `L24` UX 추가 조사 2 — 활동 그림 캡처·그림판·보관 정리 (2026-10-04)
- `L50` UX 추가 조사 2 — 대화 요약 색인·범위 검색 (2026-10-04)
- `L101` 조수 실행 중 읽기·손편집·승인 보존 (2026-10-04)
- `L111` 사용자가 요청한 위치 안내만 화면을 옮긴다 (2026-10-04)
- `L126` 핵심 플레이를 먼저 작성하는 첫 제작 (2026-10-04)
  - `L141` 첫 장소와 도입을 반드시 구성한다 (2026-10-04)
- `L199` 실제 첫 제작의 워커 준비와 사본 (2026-10-03)
- `L223` 도구 사용량 (2026-09-25)
- `L230` 새 프로젝트 게임 기획 전달 (2026-09-22)
- `L252` 제작 전 그래픽 선택과 자동 큰 창 (2026-09-21) — 2026-10-03 제거
- `L283` 이미지 중심 작업 피드 (2026-09-21)
- `L314` 조수와 팀 크게 보기 (2026-09-21)
- `L344` 작업 표시 네 단계와 별도 실행 기록 (2026-09-21)
- `L378` 첫 페인트 스타일 소유권 (2026-09-19)
- `L392` 채팅 입력창 작업 설정 묶음 (2026-09-18)
- `L408` 검토 대기 액션은 작업 과정 밖에 둔다 (2026-09-18)
- `L428` 팀 초기 생성의 맵 사이 연결 계약 (2026-09-28)
- `L448` 팀 분업 유즈케이스와 맵 밖 작업 배정 (2026-09-18)
- `L484` 팀 내 A2A 메시징 (2026-09-18)
- `L515` 오른쪽 AI 도크 + 왼쪽 활동 막대 (2026-09-26, 아래 2026-09-18 절을 대체)
- `L542` 조수 중심 팀 활동 화면 (2026-10-04)
  - `L571` 팀 실행 명령 간소화 (2026-10-05)
- `L586` 왼쪽 AI 대화 + 오른쪽 팀원 아바타 (2026-09-18, 과거 배치)
- `L627` 빈 대화의 읽기 전용 프로젝트 제안 (2026-09-18)
- `L637` 사이드바 AI 추천이 거의 작동하지 않던 세 원인 (2026-09-20)
- `L671` 진단 카드를 캔버스 오른쪽 아래 느낌표 버튼으로 옮긴다 (2026-09-21)
- `L706` 팀 설정 목록과 편집 화면 (2026-09-18)
- `L715` 팀 초안 격리와 최종 보정 (2026-09-18)
- `L723` 밑그림이 Pi 경로로 돌아왔다 — 워커가 툴마다 `map_delta` 를 흘린다 (2026-09-17)
- `L756` 턴 슬롯은 의도 분류 전에 잡는다 + Pi 턴 감사 누적 (2026-09-16)
- `L780` 결과 보고서 모달 — 변경 지점마다 before/after 한 쌍 (2026-09-15, P2)
- `L801` 조수 데크 「대화|작업」 탭 + 스튜디오 상세 — 팀원이 어디서 일하는지 한 곳 (2026-09-14, A안)
- `L835` 조수 채팅은 Pi 하나다 — 세션 경로를 걷어냈다 (2026-09-11)
- `L934` 단독 작업은 결과 중심으로 표시한다 (2026-09-14)
- `L954` 바로 깔기 (2026-09-25)
  - `L997` 연속 주문 대기열 (2026-09-28)
- `L1036` 단순 생성·수정은 계획 필요 여부로 실행한다 (2026-09-18 갱신)
- `L1064` Five model roles and whole-map harmony review (2026-09-14)
  - `L1112` 검수 응답 재시도와 정직한 보고 (2026-09-16)
- `L1162` Retained map planning items and explicit reuse (2026-09-10, OPRN-019)
- `L1203` Run outcome line: four independent axes (2026-09-09)
- `L1254` P3 run retirement and stale drafts (2026-09-07)
- `L1334` Map-scoped conversation archive (2026-09-08)
  - `L1394` Editor history surface
- `L1436` Independent result review and repair (2026-09-06)
- `L1539` Combined P2 and independent-review ownership (2026-09-07)
- `L1573` P2 run outcomes and user scope actions (2026-09-06)
  - `L1629` Canonical requirements and genuine user actions
- `L1701` User-confirmed interaction approach correction (CR-P7-1, 2026-09-08)
- `L1738` Live large-world QA: plan repair and final audit (2026-09-07)
- `L1827` Assistant control audit fixes (2026-09-07)
- `L1838` World structure activity labels (2026-09-06)
- `L1847` Multi-map construction specifications (2026-09-06)
- `L1914` Plan authoring has no small-plan quota (2026-09-06)
- `L1933` Acceptance sticky note (2026-09-07)
  - `L1983` Session-owned acceptance contract
- `L2321` 자동 프로젝트 위키 (2026-09-07)
- `L2353` Independent image generation settings (2026-09-07)
- `L2354` Independent image generation settings (2026-09-08)
- `L2392` 브라우저 포커스와 도구 실행 대기 (2026-09-05)
- `L2399` Map-targeted work outcomes (2026-09-06)
- `L2414` 계획 항목의 연속 실행 증거 (2026-09-05)
- `L2420` 계획 규모와 선언 자세 (2026-09-09)
- `L2430` 조회 선행·계획 완료와 실행 종료 (2026-09-05)
- `L2439` 조수 카메라 이동 수명·부드러운 줌 (2026-09-05)
- `L2449` 조수의 맵 전환은 크로스페이드다 — 하드컷 금지 (2026-09-15)
- `L2535` 패널 셸 · 도크 · 접기 · 컴포저
- `L2683` 세션 수명 · 대화 컨텍스트
- `L2700` 제안 적용 · 복구 · 완성도 린트
- `L2788` 고스트 미리보기 · 활동 표시 · 청사진 · 카메라
- `L2849` 영역 작업 · 시공 · 실내/집 파이프라인
- `L2873` 툴 노출 · 프롬프트 · 의도 판정 · NPC
- `L2887` 타일셋 이해 · 검토 위저드 (T1a/T1b)
- `L2913` 저장 · 내보내기 · 프로젝트 생성
- `L2921` 제공자 · OAuth · 동반 서비스
  - `L2923` 첫 연결과 실제 작업 계정 (2026-10-01)
- `L2989` Autonomous run mode (autonomous-ai-rpg, todos 1-6)
- `L3032` 분리 브랜치 마일스톤 회계 복구 (2026-09-05)
- `L3065` 배치 의존성과 완료 멱등성 (2026-09-06)
- `L3073` 모험 완료와 실제 적용 횟수 (2026-09-05)
- `L3078` Assistant clean conversation — Phase 1 (2026-09-06)
- `L3115` Assistant deck width resize (2026-09-07)
  - `L3127` Legacy AI contract verification (2026-09-08)
- `L3149` 의도 선언과 커버리지 감사는 각자 예산을 쓴다 (2026-09-16)
- `L3166` 동반 서비스 자격: OMP 로그인 재사용과 명시적 해제 (2026-09-19)
- `L3185` 에이전트 레인 — 묶음별 병렬 실행과 레인별 적용 (2026-09-15)
- `L3214` 스튜디오 3분할 — 가운데는 맵, 왼쪽은 실시간 조수·채팅, 오른쪽은 지금 보는 채팅 (2026-09-16)
- `L3230` 하단 덱 → 오버레이 드로워 (2026-09-16)
- `L3244` 수용 기준: DB 레코드 값과 지연 적용의 런 수명 (2026-09-16)
- `L3262` 조수 턴 예산 확대 (2026-09-18)
- `L3270` 결과 본문과 접힌 작업 과정 (2026-09-18)
- `L3280` 팀원 작업 예산 버튼 (2026-09-18)
- `L3292` 왼쪽 팀 운영 메뉴 (2026-09-18)
- `L3314` 다섯 적용 모드와 실제 맵 증분 반영 (2026-09-18)
- `L3353` Feature16 — 프롬프트 라이브러리·대사 검토·실제 요청 검사기 (2026-09-21)
  - `L3355` 퀘스트 프리셋 (2026-10-01)
- `L3427` Pi 단일 마을 요청 계약 (2026-09-21)
- `L3483` Pi 시공 연출과 공간 밑그림 복구 (2026-09-21)
- `L3514` 실시간 맵 연출 헤드리스 (2026-09-22)
- `L3524` 맵 하나에 조수 한 명 (2026-10-04)
- `L3563` 실시간 작업 상태판 (2026-10-04)
- `L3592` 조수 적용은 바뀐 칸만 다시 그린다 (2026-09-22)
- `L3674` 큰 프로젝트의 Pi 요청 전송 (2026-09-24)
- `L3682` 대형 프로젝트의 AI 적용 기준선 메모리 (2026-09-24)
- `L3693` 체크포인트 적용 권위는 노드 요약으로 비교한다 (2026-09-25)
- `L3715` 우클릭 드래그 바 → 채팅 한 경로 («영역 작업» 창 폐기, 2026-09-25)
- `L3733` 우클릭 영역 드래그 미리보기와 최종 선택 (2026-10-04)
- `L3751` 턴 단계 계측과 실행 추론 강도 (2026-09-26)
  - `L3756` 기록은 어디서 만들고 어디에 쓰이나
  - `L3773` 다이얼이 실행 루프의 사고 강도를 정한다
  - `L3781` 실측 (2026-09-26, 동반 서비스 127.0.0.1:17832 직결 · 실제 OAuth · gemini-3.8-flash)
- `L3794` AI 패널 렌더 비용 (2026-09-28)
  - `L3816` 검증 권한 정정과 브라우저 재실측 (2026-09-28)
- `L3825` 전송 직후 캔버스 피드백과 체크포인트 따라가기 (2026-10-03)
- `L3833` 마을 요청 바로 시공 · 실제 시공 순서 재생 · 조수창 제때 반영 (2026-10-03)
  - `L3846` 실제 시공 순서 재생 (`tools/constructionLog.ts` 기록 + `agentConstructionReveal.ts` 계획 + `agentConstructionRevealRenderer.ts` 그리기)
  - `L3878` 맵별 실행 대기열과 3-way 병합 (`editor/aiMapRunQueue.ts` + `panels/aiMapRunCard.ts` + `project/projectMerge.ts`)
  - `L3903` 조수창
  - `L3912` 재현·증거
- `L3925` 응답 오류와 이미 반영된 변경의 분리 (2026-10-05)

### `openwiki/editor-ai-tools.md` — 326KB · 2699줄 · ~94,238 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L3` 대화 초상 선택과 게임 글꼴 (2026-10-04)
- `L35` 조수 스킬 저작 — 기믹·연출 빌리기 (2026-09-30)
- `L46` 실내 설계는 검토된 실내 프리셋을 함께 본다 (2026-09-28)
- `L64` 마을 시공도 완성 마을 사례를 본다 (2026-09-28)
- `L96` 배치 매칭은 대체하지 않고 거절한다 (2026-09-27 전수 조사)
- `L108` 탈것 배치 도구 — place_vehicle (2026-09-26)
- `L121` 보수·단계 요청 전용 도구 — repair_fence, improve_title_screen (2026-09-26)
- `L136` 절벽 높이 도구 — read_relief · sculpt_relief · check_relief (2026-09-26)
- `L152` 지형 설계·고지 집·실제 통행 조수 연결 (2026-10-04)
- `L186` 조수 쓰기 도구의 네 층 — 1~4층·그림자 (MZ식 4층, 2026-09-25)
  - `L228` 실행기 계약 — 업로드 타일셋 칩셋 바꿔치기 거부 (2026-09-25)
  - `L248` 실행기 계약 — 칩셋 계열 검사 `tileset-family-change` 와 `ask_tileset_change` (2026-09-25)
  - `L270` 남은 일 (네 층)
- `L280` 일본 도시(jp_city) 조수 연결 (2026-10-04)
- `L284` 조수가 보는 네 층 — 읽기 도구·도구 이미지 (MZ식 4층, 2026-09-25)
- `L307` 그림 연출 — script_cutscene_staged · generate_cutscene_art · 대화창 위치 (2026-10-02)
- `L317` 충격 연출 (2026-09-22)
- `L323` 단독 조수의 병렬 도구 실행 (2026-09-21)
  - `L346` 검색 중 사용자에게 보이는 것 (2026-09-21 실측)
- `L347` AI 새 야외·마을의 기본 칩셋 (2026-09-21, 2026-10-01 갱신)
- `L388` 숲 나무 물체 산포 — 수관이 빠지던 문제 (2026-09-27)
- `L405` 나무 밑 그림자 (2026-09-27)
- `L428` 마을 군락 — 굽이숲 절벽마을 조립 (2026-09-21)
- `L470` 참조 작품 비유 → 자율 웹 검색 (2026-09-21)
  - `L483` 죽은 Codex 자격이 검색·완성을 영구히 막던 문제
  - `L491` 검증
- `L499` 조수 웹 검색 도구 (2026-09-21)
- `L523` 감사 후속: 부분 갱신과 미사용 삭제 (2026-09-20)
- `L531` 전투 저작 입력 수정 (2026-09-20)
- `L533` 이벤트 명령 AI 공용 도구 (2026-09-20)
- `L583` 전투 저작 입력 수정 (2026-09-20)
- `L594` NPC 공용 얼굴 매핑 연결 (2026-09-18)
  - `L605` 얼굴 짝 전수 교정 (2026-09-28)
- `L631` 이식 타일 최초 검수 준비 대기 (2026-09-18)
- `L643` paint_tiles 타일 인덱스 검증 — 유일하게 빠져 있던 가드 (2026-09-16)
- `L662` 오프닝 미디어 배선 — 스틸 카탈로그·배경음악·부분 편집 (2026-09-14)
- `L699` 오프닝 시네마틱 AI 저작 — system.opening (2026-09-14)
- `L734` 도면 문법에 wing(세로 복도) 추가 — 실루엣 변주와 물건 대체군 (2026-09-11)
  - `L759` 후속: 석조 화로는 복도 끝 알코브에 (2026-09-11)
  - `L776` 팔레트 확장 — 안 쓰던 칩셋 그림 16종을 물건으로 (2026-09-11)
- `L796` 실내는 찍어내지 않는다 — place_concept 은 설계를 요구하고, author_house 는 interiorPlan 을 받는다 (2026-09-11)
- `L828` 초안은 씨앗이고 저작본만 도면 정본이다 — 절차 도면 되살리기 + 실내 다양성 리포트 (2026-09-12)
- `L855` 맵 생성 테두리 옵션은 모델에게 주지 않는다 (2026-09-11)
- `L875` 맵 전체 청소 `clear_map` — 파괴적 한 콜 + 사용자 허가 모달 (2026-09-11)
- `L940` 명명 로케이션 툴 7종 (OPRN-OUT-020 + LOC-ADOPT, 2026-09-10)
- `L979` Exact project values and sourced declarations (2026-09-08)
- `L1007` Measured zero-prop rejection diagnostics (2026-09-07)
- `L1104` Logical walkthrough versus real player traversal (2026-09-07)
- `L1112` Tile-query selector and filter boundaries (2026-09-07)
- `L1121` Action enemy profile edits (2026-09-07)
- `L1139` Explicit field-spawn mutations (2026-09-07)
- `L1165` Monster resource discovery and AI appearance evidence (2026-09-07)
- `L1242` House-site tree clearance before ownership (2026-09-07)
- `L1253` Flower-yard material in house lots (2026-09-07)
- `L1266` Pre-write original grounding (2026-09-06)
- `L1341` Hybrid native tool exposure (2026-09-19)
- `L1380` Review approval lifetime (R3, 2026-09-06)
- `L1398` Audio description tools and event candidates
  - `L1418` Search pages and full detail
  - `L1432` Event prompt projection is not ID authority
- `L1466` list_resources picture 검색 (2026-09-21)
- `L1478` P3 captured proposal base (2026-09-07)
- `L1550` Project wiki application ownership (2026-09-07)
- `L1563` Character appearance image candidates v1 (2026-09-06)
- `L1621` Completed-house transaction protection - Phase 1 (2026-09-05)
- `L1697` Completed-house construction protection - Phase 2 (2026-09-06)
- `L1736` 퀘스트 입력과 완주 증거 계약 (2026-09-05)
- `L1763` DB 조회 페이지와 마을 전체 범위 (2026-09-05)
- `L1904` P2 requirement and exact-verdict inputs (2026-09-06)
- `L1979` Project-wide quality evaluation
- `L1993` prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)
- `L2029` Action controls guide (2026-09-07)
- `L2072` NPC 대사는 코드가 지어내지 않는다 — 캐스트 라이터 계약 (2026-09-03)
- `L2103` 「이 세계」 캐논은 문장 3채널에 강제된다 (2026-09-04)
- `L2118` 마을 설계서 (2026-09-05)
- `L2122` 저수준 이벤트 입력은 명령 위치를 검증한다 (2026-09-05)
- `L2163` 보물상자는 노출된 수면을 거부한다 (2026-09-05)
- `L2170` 모험 저작 완료와 재시도 (2026-09-05)
- `L2200` 실제 이미지 입력 보존 (2026-09-07)
- `L2214` Physical tile passage exposure (2026-09-08)
- `L2238` NPC 자율 이동 아키타입 추론 (2026-09-17)
- `L2268` Full RPG first-turn foundation (2026-09-19)
- `L2286` Party, actor appearance, and event-linked inventory tools (2026-09-19)
- `L2306` Opening, game-over, and audio discovery tools (2026-09-19)
- `L2344` 범용 이미지 에셋 생성 (2026-09-19)
- `L2356` Feature16 combat and climate authoring tools (2026-09-21)
- `L2366` 마을 시공 후 완료 계약 (2026-09-21)
- `L2388` 타일 참고문서 선행 조회 (2026-09-21)
  - `L2395` 저장된 AI 계획 본문 조회 (2026-09-23)
  - `L2399` 호스트 공용 DB 참고문서 갱신 (2026-09-23)
- `L2421` 실제 타일 규칙 수정 도구 노출 (2026-09-23)
  - `L2426` 타일셋별 맵 의미 조회 (2026-09-23)
- `L2430` Pi 완성 맵 이미지 반환 경로 (2026-09-23)
- `L2464` 공용 LPC 자료 정리와 지역·오브젝트 조회 (2026-09-23)
  - `L2487` 공용 저작 장면 → 명시적인 복사 요청 (2026-09-25)
  - `L2511` 실내 직접 배치와 읽기 전용 검사 (2026-09-25)
  - `L2530` 현대 맵의 PAW 전용 소재 선택 (2026-09-25)
  - `L2559` 실내 요구조건과 같은 실행 안의 재검사 (2026-09-25 후속)
- `L2590` Isaiah 물 태그 판정 보완 (2026-09-24)
- `L2594` 전투 결과 분기의 퀘스트 완료 플래그 (2026-09-24)
- `L2604` Monster follower graphic authoring (2026-09-25)
- `L2620` 기존 서사 플래그의 설명 수정 (2026-09-25)
- `L2633` 타이틀 오프닝 효과 도구 (2026-09-25)
- `L2648` 크로노 트리거식 필드 도구 인자 (2026-09-26)
- `L2658` 세계 지도 지형 도구 (2026-10-03)
- `L2664` Bounded romance authoring tools
  - `L2668` 선택 정수 enum의 Antigravity 전달 (2026-10-04)
- `L2676` 글자·장면 오프닝 연출 (2026-10-04)
- `L2686` 오프닝 스토리보드·그림 배우·원곡 BGM (2026-10-04)
- `L2694` 작은 편집의 래스터 보존과 선택지 취소 (2026-10-05)

### `openwiki/editor-database.md` — 413KB · 2457줄 · ~120,993 토큰 · 통째읽기 잘림 · 깨진 줄 8

- `L3` 아이템·장비 카탈로그의 입력과 가상 스크롤 (2026-10-04)
- `L20` 자료집 전투 정리 — 전투 방식 두 가지·전투 화면 탭·안 쓰는 칸 삭제 (2026-10-02)
- `L39` 전투 배경은 종류로 고른다 — 도트 측면 (2026-10-03)
- `L52` 레트로 전투 기믹 편집 칸 (2026-09-30)
- `L60` 도트 연출 탭 · 애니메이션 갤러리 (2026-09-30, A2)
- `L68` 연출 손잡이 카드 · 상태 「몸에 남는 표시」 (2026-09-30, B)
- `L74` 스킬 탭 「도트 연출」 고르기 (2026-09-30)
- `L78` 적 그룹 「전투 뒤」 구획 (2026-09-28)
- `L84` 자료집 개선안 2단계 — 헤더 저장 상태·얇은 발 줄·연결 칸 (2026-09-27)
- `L92` 자료집 개선안 1단계 — 그룹 띠·쿨 인디고 팔레트·흰 카드 (2026-09-27)
- `L105` 맵 그룹 목록 수리 — 출처·썸네일·레일 (2026-09-27)
- `L113` 자료집 열기 (2026-09-24)
- `L117` 게임 오버 라이브러리 저작 (2026-09-23)
- `L137` 장소 탭 재설계 — 라이브러리 우선 배치 (2026-09-21)
- `L177` 몬스터 종족의 전투 뒷모습 (2026-09-20)
- `L188` 이벤트 초안 원본의 삭제 참조 (2026-10-02)
- `L194` DB 삭제의 스킬·주인공 권한 참조 (2026-10-02)
- `L201` 감사 후속: 참조를 보존하는 삭제 경로 (2026-09-20)
- `L209` 장소 편집 1차 UX 수리 — 이름·툴바·속성·카드 (2026-09-15)
  - `L251` 2차 (같은 날) — 갤러리 복귀와 속성 패널 통합
  - `L266` 3차 (같은 날) — 이 탭이 뭔지 말하게 한다: 목적·쓰임·배치 감사
- `L342` 장소 통합 진행: 방·층과 재료 (2026-09-14)
- `L355` 새 장소 생성 흐름 (2026-09-14, 2단계)
- `L372` 장소 목록 통합 1단계 (2026-09-14)
- `L387` 복합 공간 편집기 (2026-09-13)
- `L411` Placed-place child proposal adapter (2026-09-08)
- `L416` Monster resource metadata worksheet (2026-09-07)
- `L424` Shared database CSS ownership (2026-09-06)
- `L465` 전투 몬스터 표시 크기 (2026-09-06)
- `L472` 전투 명령 배치 스튜디오 (2026-09-05)
- `L489` 캐릭터·얼굴 메타데이터 (2026-09-06)
- `L497` Character appearance catalog v1 (2026-09-06)
- `L541` Concept navigation integration (2026-09-06)
- `L555` Opening still media, sequence music and AI generation (2026-09-14)
  - `L557` 새 프로젝트 기본 오프닝 (2026-09-21)
- `L582` Opening and game-over authoring (2026-09-06)
- `L638` Cinematic media preparation boundary (2026-09-06)
- `L657` System settings workspace (2026-09-06)
- `L718` Graphic 칩 사용자 교정 29건 (2026-09-05)
- `L734` Custom equipment slot authoring (2026-09-05)
- `L742` 통합 아이템·장비 카탈로그 (2026-09-05)
- `L750` 아이템·장비 저작 신뢰성 (2026-09-05)
- `L761` 전투 몬스터와 포획·성장 종족 (Phase 1)
  - `L771` 종족 검색과 관련 레코드 노출 (Phase 2)
- `L781` 몬스터 작업실 — 미리보기 · 행동 · 속성 (2026-09-05)
  - `L806` Monster action input trust (Phase 1, 2026-09-05)
  - `L815` Monster numeric caption activation (Phase 2, 2026-09-05)
  - `L822` Monster nested dialog focus (Phase 2, 2026-09-05)
- `L828` 몬스터 그룹 저작 신뢰성 (2026-09-05)
- `L843` Database Studio chrome (2026-08-24)
  - `L858` Actor data-table slice (2026-08-25)
- `L868` 프로젝트 위키 출처와 수동 편집 (2026-09-07)
- `L880` 세계관 그룹 — 세계 개요 · 설정집 (2026-09-18)
  - `L902` 세계관 입력 보존·설정집 저장 계약 (2026-09-05)
- `L914` '생성 규칙' 탭 — AI 마을 생성의 물·숲·길 (2026-08-30)
- `L922` P2 낚시·채집·박물관 저작 표면 (2026-08-25)
- `L927` 생활 저작 경계와 자동 화자 (task14, 2026-09-06)
- `L936` 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)
- `L949` 생활 기술·제작 저작 표면 (2026-08-24)
- `L968` Database Editor
- `L1066` Beginner-centric adversarial review (2026-08)
- `L1070` DB UI modernization (2026-08)
- `L1106` P2 spatial authoring (2026-08-25)
- `L1118` 맵 그룹 — 개념 우선 탐색 Phase 1 (2026-09-05)
- `L1140` 오브젝트·공간 수정 복구 (2026-09-13)
- `L1162` 오브젝트 브라우저와 공간 배치 작업대 (2026-09-13)
- `L1183` 맵 그룹 — 공간 저작 셸 UX 계약 (2026-09-12)
- `L1227` 타일 작업대 — 공간 셸 안 레이아웃 계약 (2026-09-13)
- `L1258` 오토타일 설정 — 9칸/11칸/커스텀 카드 (2026-09-01)
- `L1279` 공간 종류와 구조물은 다른 면이다 (2026-09-01)
- `L1298` 맵 → 개념 꾸러미 (2026-09-02 시작, 2026-09-05 개념 우선 Phase 1)
- `L1329` '구조물' 탭 — 두 출처 앨범 + 방 종류 문법 (2026-08-28)
- `L1342` '구조물' 편집기와 파일 입출력 (2026-08-29)
- `L1361` 삭제 가드는 묶음 조건(all/any/not) 안까지 본다 (2026-08-29 실측 결함 수정)
- `L1381` '진영' 탭과 몬스터 소속 진영 (2026-08-29)
  - `L1396` 몬스터 폼의 소속 진영 (`databaseEnemyRecordView.ts`)
  - `L1404` 다 만들어 놓고 못 쓰던 이유 — `[편집]` 이 화면 밖 67px 에 있었다 (2026-08-29 실측)
  - `L1416` 구조물 어휘 — 역할·레이어·테마·증분 축·칸 힌트 (2026-08-30)
  - `L1467` 편집기를 맵 타일 편집기 수준으로 (2026-08-30 실측)
- `L1489` Battle-animation editor autoplay (2026-09-05)
- `L1496` 스킬 탭 `연출` 카드 = 살아 있는 애니메이션 스테이지 (2026-08-30)
  - `L1507` retro2003 도트 전투 미리보기 (2026-09-28)
  - `L1524` 적 탭 도트 미리보기 카드 (2026-09-28 mx-ed)
  - `L1532` 몬스터 스킬 미리보기 (2026-09-28 med)
- `L1541` 데이터베이스 30탭 UI/UX 계약 (2026-08-30 실측)
  - `L1556` 헤더는 설명문이 아니라 아이콘 칩 한 줄이다
  - `L1634` 숫자 입력은 스테퍼를 먼저 붙이고 그다음 스피너를 지운다
  - `L1648` 줄상자 바닥은 1.35 다 (1.25 는 큰 한글 제목에서 깎인다)
  - `L1691` 이미지 실패는 빈 상자가 아니라 라벨 붙은 자리표시자다
- `L1700` '마을' 탭 — 마을 하네스 값을 사람이 저작한다 (2026-08-30)
  - `L1724` 붓을 고르면 화면이 흔들렸다 — 재부모가 스크롤·포커스를 지운다 (2026-08-30 실측)
- `L1767` 날개마다 층수를 정한다 — 계단식 2층 (2026-09-11)
  - `L1778` 지붕 가장자리 판정은 "다른 지붕면인가"다 (2026-09-11 실측 결함)
- `L1786` '마을' 탭 — 숫자칸을 그림으로 바꾼다 (2026-08-31)
  - `L1802` AI로 몬스터·아이템 생성 (2026-08-30)
  - `L1828` AI 검토 오버레이 — 레코드 카드로 before → after 를 보고 적용한다 (2026-09-15)
  - `L1922` AI로 몬스터·아이템 생성 — 대화상자 재작성 (2026-09-03)
- `L1938` Database Studio v2 — 30탭 셸·폼 문법 통일 (2026-09-03)
- `L2015` 직업 승급 트리 · 스킬 트리 (2026-09-05)
- `L2021` 미회수 편집 후속 통합 (2026-09-05)
- `L2025` 마을 설계서 (2026-09-05)
- `L2030` 구조물 증분 메타 정정 (2026-09-05)
- `L2038` 개념 회수 UI 직접 렌더 QA (2026-09-05)
- `L2042` Battle-animation preview-first graphic controls (Phase 2, 2026-09-05)
- `L2049` 검토한 실내 기본값의 원격 반영 (2026-09-05)
- `L2053` 특정 꾸러미의 명시적 교체 (2026-09-06)
- `L2057` 생성 아이템 아트에 dry-run 가짜가 섞여 들어갔다 (2026-09-16)
- `L2075` 배·항구 공통 기본 장소 (2026-09-17)
- `L2088` Game menu design options (2026-09-18)
- `L2117` 캐릭터·얼굴 연결 검토 개선 (2026-09-18)
- `L2127` 얼굴 대응표 실물 대조와 추천 제외 (2026-09-18 후속)
  - `L2135` 캐릭터·얼굴 화면 레이아웃 보정 (2026-09-18)
- `L2143` 캐릭터·얼굴은 프로젝트 밖 공용 자료 (2026-09-18 저장 범위 수정)
  - `L2154` 공용 기본 매핑 재저작 (2026-09-18)
- `L2162` Feature16 climate and action forms (2026-09-21)
- `L2181` Combat authoring studio (feature16, 2026-09-21)
- `L2188` Troop intent and weakness authoring (2026-09-21)
- `L2192` 인게임 HUD 구성 편집기 (2026-09-21)
  - `L2202` 장르별 HUD와 글꼴 (2026-09-21 후속)
- `L2213` 숲·마을·동굴 공통 기본 장소 13종 (2026-09-21)
- `L2238` 타일셋 참고문서 (2026-09-21)
  - `L2242` 숲마을 공용 소품 및 장소 (2026-09-21)
  - `L2265` 세계 개요 스프레드 뷰 (2026-09-22)
  - `L2274` 세계 개요 탭 구조 — 문서 / 조수 전달 (2026-09-22 v2)
  - `L2283` 세계 개요 본문 우선 — 도화지 첫 화면 (2026-09-22 v3)
  - `L2292` 세계 개요 헤드 압축 + 세계 설정 평문 폼 (2026-09-22 v4)
  - `L2301` 세계 개요 헤드 v5 + 법칙 대화상자 토큰 스코프 수정 (2026-09-22)
  - `L2309` 세계 설정 = AI 문답 인터뷰 (2026-09-22 v6)
  - `L2320` 세계 개요 스프레드 헤드 삭제 (2026-09-22 v6)
  - `L2329` 세계관 본문 AI 도움 — 초안·이어쓰기 (2026-09-22 v7)
- `L2340` 공용 아이템 1,000종과 통일 도트 작업 (2026-10-01)
  - `L2368` 도트 연출의 이동·가속도·배우 경로 (2026-10-02)
- `L2373` 저장 결과를 구분하는 적용 피드백 (2026-10-02)
- `L2377` 생활 컬렉션 검색과 선택된 상세 폼 (UX round 2, 2026-10-04)
- `L2396` 연결 칸의 참조 데이터 캐시 (UX round 2, 2026-10-04)
  - `L2434` 감독자 네이티브 재검증 절차

### `openwiki/editor-event-authoring.md` — 178KB · 1072줄 · ~52,055 토큰 · 통째읽기 잘림 · 깨진 줄 16

- `L3` 이벤트 UX 2차 감사 후속: 선택·검색·목록·복제 (2026-10-04)
- `L69` 이벤트 보기의 지연 생성 (2026-10-04)
- `L82` 명령 드래그 소유권과 레거시 페이지 붙여넣기 (2026-10-02)
- `L89` 감사 후속: 조건 순서와 생활 경로 보존 (2026-09-20)
- `L97` AI 이벤트 작업함 — 여러 칸을 동시에 (2026-09-28)
- `L113` 조수에서도 이벤트 명령 생성기 사용 (2026-09-20)
- `L122` 적대적 리뷰 고위험 항목 보정 (2026-09-19)
- `L131` 등장 조건은 조건 그룹을 기본으로 펼친다 (2026-09-19)
- `L138` 명령 중심 배치와 AI 작성 모달 (2026-09-18)
- `L167` 배우·파티·시점·회차·요일·문자열 조건 (명작 공백 G1, 2026-09-27)
- `L193` 구역(로케이션) 조건분기 (OPRN-OUT-020, 2026-09-10)
- `L215` 구역 드나듦 트리거 (2026-09-10)
- `L242` Native battle confirmation admission (2026-09-08)
- `L261` Character graphic no-match recovery (OUT-007, 2026-09-08)
- `L284` Page preview state follows the current script (2026-09-08)
- `L305` Event editor window controls (2026-09-06)
- `L352` 이벤트 편집기 가독성 — 읽는 글자와 꾸미는 글자 (2026-09-03 후속)
- `L365` 이벤트 편집기 문법 고정 — P0 (2026-09-03)
- `L379` 2026-09-17 적대적 리뷰 P0 다섯 가지 수정 (2026-09-18)
- `L393` NPC 일정 구조화 편집 (2026-08-24)
- `L405` AI 가 이벤트 페이지를 이해하지 못했다 (2026-08-30 실측 · 수정)
  - `L427` 우선순위는 1페이지가 아니다 (바꾸지 않았다)
  - `L435` 랜덤 대사는 페이지가 아니다
  - `L442` 새 린트가 출하 콘텐츠에서 실제로 잡은 것 (skyStair autoEvent)
  - `L452` 조건만 걸고 켜지 않으면 그것도 죽은 페이지다 (가려짐의 거울상)
- `L469` 복잡한 NPC 는 조회 후 상태별 다중 페이지로 저작한다 (2026-09-01)
- `L499` Roguelike run authoring (2026-08-24)
- `L506` Event Authoring
- `L729` Condition / Loop / Variable command trust fixes (2026-08-07)
- `L739` Event draft trust loop (2026-07-30)
- `L747` 회상 오프닝 저작 — beat 컴파일러다 (2026-09-03)
- `L756` Guided story arc facade
- `L760` 지도·화면 효과 탭 초보자 UX (2026-08-27)
- `L769` 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)
- `L777` Companion roster in the command picker (2026-08-27)
- `L783` Presentation and system M2 command bodies
- `L790` 좌측 설정 레일 그룹 소속 (2026-08-27)
- `L808` 설정 레일 한 열 정돈 (2026-09-27, 적대적 시각 QA 후속)
  - `L833` 등장 조건 창 (`openConditionsModal`)
- `L853` 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)
- `L863` 「움직임과 속도」 부피 정리 (2026-08-29)
- `L898` 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)
  - `L933` 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다
  - `L946` 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)
  - `L954` 참조를 비워도 조건을 삭제하지 않는다
  - `L961` 조건 미리보기는 모르면 모른다고 말한다
  - `L976` 조건 문구에 내부 토큰을 넣지 마라
- `L991` 공포 게임 제작 기능 (2026-09-05)
  - `L996` NPC 발견·추격 저작 (2026-09-06)
- `L1005` 명령 툴바는 한 줄이다 — wrap 금지와 폭 흡수 순서 (2026-09-21)
- `L1047` 공통 이벤트 호출 그래프 경고 (2026-10-02)
- `L1053` 일기·사물 이벤트의 그래픽 미리보기 (2026-10-04)

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

### `openwiki/editor-event-commands.md` — 68KB · 303줄 · ~18,704 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L3` 장면 · 그림 갤러리 표시 · 줄 음성 (2026-09-25)
- `L13` 게임 오버 선택 (2026-09-23)
- `L25` Move-route target repair (PR716, 2026-09-09)
- `L44` 좌표로 이동 — 고정/변수 좌표와 실패 정책 (OPRN-OUT-013, 2026-09-10)
- `L88` 장소 이동의 목적지 원복과 설정 보존 (2026-09-06)
- `L94` 확률로 결과 뽑기 / 가중 분기 (2026-09-06)
- `L107` 상점: 진열 상품과 상품 상세 중심 편집 (2026-09-05)
- `L119` Roguelike run control (2026-08-24)
- `L159` 런타임 규격 무대 — 대사·선택지 미리보기는 게임 창을 축소해 그린다 (2026-09-17)
- `L196` 얼굴 상자(faceset-crop-box) 페인트 계약 (2026-08-28)
- `L263` Staged edit, history, and nested drag invariants (2026-07-30)
- `L270` Command picker, validation, and preview trust (2026-07-30)
- `L279` 회상 스틸과 AI 그림 (2026-09-03)
- `L290` Recovered native emote command (2026-09-05)
- `L294` 패배·엔딩 저작 (2026-09-22)

### `openwiki/editor-genre-packs.md` — 41KB · 308줄 · ~10,496 토큰

- `L5` Ownership
- `L16` Safe blank-project system-preset flow
- `L44` Preset AI connection gate and first team build (2026-09-27)
- `L52` Playable first segment — code builds it, code judges it (2026-09-28)
- `L70` Cinematic interview in the actual app (2026-10-03)
  - `L87` Internal execution handoff (2026-10-03)
  - `L103` Confirmed brief automatic execution (2026-10-03)
  - `L111` Detailed authoring manuals (2026-10-03)
- `L125` Vocabulary and readiness
- `L136` Dialog layering and receipt fixtures (2026-09-08)
- `L149` Validation
- `L151` Two new-project surfaces, one choice model (2026-09-11)
  - `L212` Executable first romance scene (2026-10-03)
  - `L216` Click-first interview and fresh art (2026-10-04)
  - `L257` Launcher planning before project creation (2026-10-04)

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

### `openwiki/editor-observability.md` — 64KB · 725줄 · ~18,890 토큰 · 통째읽기 잘림 · 깨진 줄 1

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

### `openwiki/editor-pre-edit-routing.md` — 184KB · 1147줄 · ~54,150 토큰 · 통째읽기 잘림 · 깨진 줄 5

- `L5` 태양과 그림자 (2026-10-04)
- `L11` 공식 맵 상한 1024×1024 (2026-10-01)
- `L28` 지형 설치 막대 확장 (2026-10-03)
- `L36` 「높이」 붓 — 절벽 높이 지형 (2026-09-26)
- `L67` 맵별 16/32/48px 좌표
- `L75` 맵 칸 층은 `mapLayers.ts` 로만 읽고 쓴다 (MZ식 4층, 2026-09-24)
- `L115` 맵 목록 클릭은 즉시 선택한다 (2026-09-18 후속)
- `L168` 자동저장이 프로젝트 문서를 여섯 번 지나가지 않는다 (2026-09-25)
  - `L180` 계약
- `L205` 안 바뀐 타일셋은 복제하지 않는다 — 타일셋 구조 공유 (2026-09-27)
- `L229` DB 레코드 편집은 컬렉션만 복제한다 (2026-09-25)
- `L244` 참고문서가 많은 프로젝트의 DB 되돌리기 스냅샷 (2026-09-25)
- `L255` database 표면 CSS 지연 로드와 공용 다이얼로그 (2026-09-21)
- `L268` 맵 전환과 물 타일 애니메이션 공유 (2026-09-18)
- `L286` 편집기 CSS·목록 비용 (2026-09-25)
- `L321` 편집기 재렌더 비용 — 줌은 카메라 경로다 (2026-09-16)
  - `L427` 커스텀 칩 팔레트의 빈틈 없는 표시 (2026-09-21)
- `L479` Exterior door backing
- `L489` Tile brush reliability (2026-09-06)
- `L527` Combo Brush (2026-09-10, OPRN-OUT-022)
  - `L532` 용어 (코드와 UI 가 같은 말을 쓴다)
  - `L544` 소유 경계
  - `L556` 근거 규칙 — 번호 인접으로 추론하지 않는다
  - `L567` 검토 책임
  - `L579` 경계와 진단
  - `L589` 회귀 이음줌
- `L601` Pre-edit routing
  - `L603` 명명 로케이션 레이어 (2026-09-10)
  - `L685` 로케이션 역할과 겹침 클릭 (2026-09-12)
  - `L744` 설계 영역 이관 도구 (LOC-ADOPT, 2026-09-10)
  - `L746` 로케이션 앵커 — 좌표 대신 이름으로 가리키기 (2026-09-12)
  - `L799` Standard / Expert focus modes (2026-09-07; supersedes sidebar density notes below)
  - `L859` Automatic usage guides disabled (2026-09-06)
  - `L869` Sidebar mode workflow (2026-09-06; supersedes older 72px/tile-flyout notes below)
- `L977` Agent cautions
- `L991` 헤더 용어 정본과 중복 감사 (2026-08-30)
  - `L1027` 톱바 영역 진입점 감사표 (`renderTopbar` 실측)
  - `L1059` 사이드바 ↔ 톱바 소유권 (2026-08-30 중복 정리)
  - `L1088` 스튜디오 바 — 톱바 한 줄 (2026-09-03, 표준·전문가 대격변)
- `L1114` 타일 칠하기 중 UI 구독자 (2026-09-30, 렉 수정 D)
- `L1130` 맵·레이어 전환 UI 비용 (2026-09-30, 렉 수정 I)

### `openwiki/editor-preview-performance.md` — 10KB · 146줄 · ~2,678 토큰

- `L6` Native shared catalog validators (O5)
- `L26` Parked, cached and hidden DB previews (O4/N1/N2)
- `L76` Resource galleries and audio manager (O1/O2/O3/N3)

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

### `openwiki/editor-workflows-misc.md` — 84KB · 594줄 · ~23,614 토큰 · 통째읽기 잘림

- `L9` Other Editor Workflows
  - `L11` 팔레트·맵 목록·진행의 표시 비용 (2026-10-04, UX 감사 2차)
  - `L62` 첫 사용자 시작과 저장 안내 (2026-10-03)
  - `L76` New-project name and player title (2026-09-07)
  - `L86` 걸을 때 적 만나기 — rectangle authoring (2026-09-06)
  - `L152` Game export delivery (2026-09-06)
  - `L263` Audio descriptions and live resource ownership
  - `L356` Genre-neutral authoring launcher and journey (2026-08-24)
- `L414` 편집기 z 층 밴드와 토스트 (2026-08-30, PR #308)
- `L443` 초보 맵 사이드바 «목록 | 상세» 2단 탐색기 (2026-08-30, PR #311)
- `L467` 커스텀 셀렉트는 열릴 때 modalStack 층이 된다 (2026-08-30)
- `L481` 맵 설정 가독성·편집 연속성 (2026-09-05)
- `L491` 왼쪽 사이드바 3모드 적대적 리뷰 (2026-09-05)
- `L504` Authoring viewport navigation (issue 693, 2026-09-08)
  - `L546` Common expression recovery (2026-09-17)
  - `L566` 제작자 페이지에서 타일셋 받기 (2026-09-24)
- `L579` 필드 키트 — 미니게임·필드 능력·순간이동·걸음 상태·클릭 이동 (명작 공백 G3, 2026-09-27)

### `openwiki/editor-workflows.md` — 2KB · 28줄 · ~586 토큰

- `L5` Topic pages
- `L17` Quick routing
- `L25` For AI agents

### `openwiki/editor-workshop.md` — 2KB · 12줄 · ~699 토큰

절 제목 없음 (평면 목록 페이지).

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

### `openwiki/harnesses/README.md` — 4KB · 49줄 · ~1,206 토큰

- `L6` 위치 (저장소 루트 기준)
- `L26` 규칙
- `L36` 기존 것과의 관계 (2026-10-01 실측)
- `L42` 하네스 목록

### `openwiki/harnesses/assistant-capability.md` — 13KB · 85줄 · ~3,979 토큰

- `L5` 실행 경로
- `L11` 단계
- `L32` 판정
- `L49` 시각 검수
- `L62` 산출물과 확장
- `L68` 최초 실측 — 2026-10-05
- `L76` 제품 회귀와 오류 표시 controls (2026-10-05)
- `L82` 수정 확인 — 2026-10-05

### `openwiki/harnesses/charset-actor.md` — 6KB · 46줄 · ~1,748 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/harnesses/interior-prop-derivations-operations.md` — 14KB · 189줄 · ~4,124 토큰

- `L6` 1. 실제 대상을 먼저 확인한다
- `L43` 2. API와 쓰기 영향
- `L71` 3. 설정을 바꿀 때
- `L99` 4. 읽기 전용으로 선택·공용 판본 확인
- `L126` 5. 증상별 복구
- `L150` 6. 백업·이관
- `L176` 7. 검증과 PR 완료 보고

### `openwiki/harnesses/interior-prop-derivations.md` — 24KB · 301줄 · ~7,526 토큰

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

### `openwiki/harnesses/interior-props.md` — 8KB · 84줄 · ~2,442 토큰

- `L9` 에디터 공방 (아래 서버 하네스와 저장 경로가 다름)
- `L20` 서버 하네스의 파생 (2026-10-04)
- `L34` 서버 확정 → 공용 SQLite 자동 등록 (2026-10-04)
- `L65` 자동 파생 제안 화면 (2026-10-04)

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

### `openwiki/harnesses/jp-city.md` — 9KB · 78줄 · ~2,496 토큰

- `L8` 흐름
- `L19` 명령 (`python3 src/harnesses/jp-city/harness.py …` 또는 `npm run harness -- jp-city …`)
- `L32` 파일
- `L44` 시드 항목 (kind: `building-part` 건물 외형 · `prop` 소품 · `tilesheet` 바닥 타일 · `kit` 여러 칸 부품 + 조립 예)
- `L55` 기계 검사 (check.py) — 깨짐만 거른다
- `L61` 함정
- `L70` pick 절차 (사람)
- `L76` 복제에서 바꾼 점 (modern-chipset 대비)

### `openwiki/harnesses/modern-chipset.md` — 10KB · 101줄 · ~2,941 토큰

- `L8` 왜 만들었나 (2026-10-01)
- `L14` 흐름
- `L24` 파일
- `L34` 함정
- `L39` 도시 조립 (2026-10-03)
- `L47` 굽기 `bake` → 번들 타일셋 modern_city (2026-10-03)
- `L54` 승인 주차장 두 면 공용 등록 (2026-10-05)
- `L76` 기존 칩 확장 실험 (2026-10-05)
  - `L90` 미완성 판정의 후속 처리

### `openwiki/harnesses/monster-collect-species.md` — 17KB · 152줄 · ~5,055 토큰

- `L8` 빠른 시작
- `L29` 파일
- `L51` 왜 이렇게 만드는가 (2026-10-01 실험, `qa-runs/hand-monster/` 시안)
- `L60` 애니메이션 — 대기는 움직이고, 큰 동작은 한 줄로 생성한다 (2026-10-01 비교 시험)
  - `L76` 공격 방향 계약 (`animation.direction`)
  - `L87` 엔진 비트 → 프레임 (`actions.*.keys`)
  - `L94` 입·손 자리 (`anim.json` 의 `emit`)
  - `L101` 스킬별 공격 = 자세 몇 가지 × 스킬 매핑 (`anim/poses.ts`)
- `L114` 검사 (`build` · `check`)
- `L131` 전투 배치 (`src/harnesses/monster-collect-species/qa/battle-layout.css`, 엔진 미반영)
- `L137` 시험
- `L146` 아직 없는 것

### `openwiki/harnesses/romance-scene.md` — 10KB · 59줄 · ~2,599 토큰

- `L5` Entry and contract
- `L13` Authoring and rejection
- `L25` Art direction and compact dialogue (2026-10-04)
- `L35` Maker-owned repair loop (2026-10-04)
- `L45` Reproduction

### `openwiki/harnesses/super-harness-integration.md` — 7KB · 97줄 · ~2,154 토큰

- `L6` 운영 계약
- `L19` 실행과 경로
- `L56` API
- `L70` 공간 제작에서의 공용 재료 사용
- `L78` 이관·복구와 확인

### `openwiki/harnesses/super-harness.md` — 40KB · 382줄 · ~12,510 토큰

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

### `openwiki/harnesses/worldmap-icons.md` — 5KB · 65줄 · ~1,592 토큰

- `L6` 입구
- `L21` 호스트 공용 DB 등록 (2026-10-04)
- `L38` 사람 선택만 굽기
- `L52` 에디터·조수
- `L60` 2026-10-04 근거

### `openwiki/horror-authoring.md` — 18KB · 186줄 · ~5,583 토큰

- `L8` 저작 표면
- `L24` 데이터와 런타임
- `L41` 연결 방 추격 연속성 (2026-09-06)
- `L67` NPC 발견 이벤트와 공통 전투 소유권 (2026-09-06)
- `L127` 가구 밀기 애니메이션 (2026-09-05 후속 체험 수정)
- `L150` 실내 제작과 검증
- `L161` 검증 경로
- `L175` 전체 게이트 후속 수정 (2026-09-05)

### `openwiki/i18n.md` — 6KB · 85줄 · ~1,935 토큰

- `L7` 언어가 정해지는 순서
- `L20` 구조
- `L39` 왜 DOM 계층 번역인가
- `L48` 코드가 화면 글자를 다시 읽을 때 (지켜야 할 계약)
- `L54` 문장을 조각으로 이어 붙이지 마라
- `L64` 새 문구를 추가하면
- `L79` 알려진 한계

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

### `openwiki/joseon-baram.md` — 34KB · 182줄 · ~10,324 토큰

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
- `L176` 한계

### `openwiki/jp-city.md` — 26KB · 206줄 · ~7,732 토큰

- `L6` 식별자
- `L17` 파일
- `L24` 굽기 규약 (TS 가 기대하는 것)
- `L30` 기존 프로젝트 갱신 규칙
- `L40` 행인·팔레트
- `L45` 조수 정책
- `L49` M3 건물 조립 도구 (`build_jp_city_building`)
  - `L54` 파일
  - `L65` 부품 사전 생성법
  - `L77` 조립 규칙 (`Kit` 의 TS 이식)
  - `L86` 입력 스키마 (`build_jp_city_building`)
  - `L104` 오류 코드
  - `L119` 차이 증명·변조 시험 실행
  - `L129` 알려진 한계
  - `L137` 조수 정책 (M3 변경)
  - `L142` 조수 연결 (2026-10-04 조사·수정) — 조수가 이 칩셋과 건물 도구를 «고르는» 길
- `L179` AI 참고문서 (6용도 · 47쪽 · 그림 124장)
  - `L192` 굽는 법 (한 줄)

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

### `openwiki/modern-city.md` — 9KB · 78줄 · ~2,764 토큰

- `L5` 식별자
- `L15` 파일
- `L22` 기존 프로젝트 갱신 규칙
- `L31` 조수 정책
- `L35` 예제 도시 맵 (60×60, 시드 1)
- `L42` 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항)
- `L51` 자동 검사 (구조·통행만)
- `L56` 번들 장소
- `L60` 승인된 작은 지하 주차장 (2026-10-05)
  - `L73` 12면 확장 실험

### `openwiki/monster-resource-editor.md` — 4KB · 75줄 · ~1,199 토큰

- `L3` Entry and ownership
- `L19` State and mutation contract
- `L49` Resource Manager monster tab (2026-09-12)
- `L64` Verification

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

### `openwiki/opening-still-pack.md` — 10KB · 161줄 · ~2,526 토큰

- `L3` Reviewed descriptions and production queue (2026-09-22)
- `L31` Quota-aware production job
- `L72` Initial pack
- `L99` Installation and integrity
- `L114` Runtime and authoring contracts
- `L133` Verification and examples

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

### `openwiki/quest-preset-research.md` — 8KB · 85줄 · ~2,369 토큰

- `L6` 조사 근거와 설계 해석
- `L21` 제공 범위
- `L38` AI 저작 계약
- `L56` 한계와 완료 근거의 구분
- `L73` 재현

### `openwiki/quickstart.md` — 19KB · 195줄 · ~5,655 토큰

- `L6` 0. 여기서 에이전트가 실제로 헤매는 이유 (실측 2026-08-30)
- `L17` 1. 환경 — 여기가 틀리면 이후 전부 헛수고
- `L52` 팀 SQLite 호스트 (2026-09-18)
- `L60` 1a. Mac / 개인 로컬 실행 (2026-09-21)
- `L77` 1b. 전체 BGM은 Release 팩으로 설치
- `L93` 1c. 오프닝 이미지 팩
- `L100` 2. 검증 — 무엇이 진짜 게이트인가
- `L127` 3. 어디를 고치나 — 기능 → 진입 파일
- `L177` 4. 위키를 읽는 법
- `L189` 5. 끝났다고 말할 수 있는 조건

### `openwiki/refmap-town-outside.md` — 19KB · 156줄 · ~5,746 토큰

- `L7` 어디에 무엇이 있나
- `L20` 게시
- `L36` 변환 규칙과 함정
- `L50` 확인 (2026-09-27)
- `L56` 세트 8개 더 (2026-09-27)
  - `L148` 세트 맵 기술 (maps/*.json)

### `openwiki/release-and-version.md` — 15KB · 227줄 · ~4,530 토큰

- `L7` 네 축을 구분한다
- `L18` 릴리스 버전은 왜 매 머지가 아닌가
- `L31` 빌드 식별자
- `L52` 릴리스 절차
- `L78` 데스크톱 산출물을 릴리스에 붙인다 (2026-09-16)
  - `L106` 윈도우 zip 은 리눅스에서 만든다 (2026-09-22 실측)
  - `L140` 데스크톱 AI 워커는 네이티브 애드온을 옆에 둔다 (2026-09-27 실측)
- `L168` 커밋 메시지가 릴리스 노트의 원고다
- `L182` 아직 안 한 것
- `L190` 검증
- `L201` 자동화 — 제안 PR 과 발행 타이머

### `openwiki/relief-terrain.md` — 32KB · 255줄 · ~9,850 토큰

- `L14` 파일 지도
- `L33` depth 규칙(런타임, `playSceneRelief.ts` 머리말)
- `L48` 편집기 성능 계약 (2026-10-03 부분 굽기)
- `L65` UX2 높이·컬링 수정 (2026-10-04, 소스 변경 · 브라우저 QA 대기)
  - `L122` 통합 후 브라우저 QA 레시피 (실행 담당자용)
- `L152` 지형 설치 확장 (2026-10-03)
- `L158` 러프 붓·지형지물 막대 (2026-10-03)
- `L168` 기본 계단의 돌 디딤판 (2026-10-03 수정)
- `L180` 연속 경사로 — 계단과 구분 (2026-10-03 사용자 정정)
- `L199` 발 접지·클릭·바닥 접합 수정 (2026-10-04)
- `L219` 알려진 한계 · 결정이 필요한 것
- `L228` 검증 도구 (이 브랜치에 들어온 것)
- `L250` 가져오지 않은 것 (브랜치 `agent/r3-relief-stairs` 에 남아 있다)

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

### `openwiki/runtime-battle.md` — 321KB · 1758줄 · ~94,038 토큰 · 통째읽기 잘림

- `L3` 전체 몬스터 후속 재저작 · 140종 9포즈 (2026-10-03)
- `L29` 갓파·늑대·박쥐·해골 전투 9포즈 (2026-10-03)
- `L42` 첫 일괄 손 도트 리프레시 · 반려 기록 (2026-10-03)
- `L60` 히드라 새 디자인 9포즈 (2026-10-03)
- `L71` Starter 그림 제거 (2026-10-03)
- `L94` 히드라 첫 도트 재저작 기록 (2026-10-03)
- `L112` 옛 전투 그림은 deprecated/ — 지금 전투에는 도트·포켓몬 그림만 (2026-10-03)
- `L128` 캐릭터별 전투 동작 (2026-10-03)
- `L134` 전투 스킨은 둘뿐 — retro2003(RM2003식) / pokemon (2026-10-02, 사용자 결정 「RM2003 식만 남기고 정리」)
- `L149` 전투는 전부 도트 측면 — 정면 스킨 다섯·몬스터 그림 생성 삭제 (2026-10-02)
- `L169` SNES 식 전투 연출 — 쓰러짐·배경 겹·상태 몸 표시·이펙트 겹치기·화면 필터 (2026-10-02)
- `L199` 포켓몬 참고 스킨과 실제 뒷모습 (2026-09-20)
- `L209` 전투 적대 리뷰 후속 수정 (2026-09-30)
- `L225` 레트로 기믹 편집 가능화 (2026-09-30)
- `L229` 로스터 전 묶음 기믹 (2026-10-01)
- `L236` 힘 모으기 · 게이지 밀기 · 변신 · 소환 (2026-10-01, B)
- `L250` 반응·표적 상태 7종 — 반격·도발·감싸기·회피·리플렉·리레이즈·선고 (2026-10-01)
- `L268` 스킬이 계약 도트 연출을 빌린다 — retroChoreographyId (2026-09-30)
- `L272` 프로젝트 연출 레코드 — skillChoreographies (2026-09-30, A1)
- `L281` 연출 손잡이 · 자동 추천 · 상태 오라 (2026-09-30, B)
- `L288` 도트 결과 화면 단순화 · 적 그룹 「전투 뒤」 이벤트 (2026-09-28)
- `L303` 도트 측면 전투 스킨 retro2003 (2026-09-28)
  - `L364` 스킬별 도트 연출 (2026-09-28)
  - `L400` 직업 스킬 48종 (2026-09-28, sk-rt)
  - `L428` 확장: 새 주인공 6명·스킬 48개·몬스터 30종 (2026-09-28, mx-rt)
  - `L468` 몬스터 스킬 42종 (2026-09-28, mrt)
  - `L483` 2차 로스터 통합 — 걷기 칩 전부 직업·스킬, 몬스터도 파티원 (2026-09-29)
- `L550` 타격감 층 (2026-09-25)
- `L719` 진입 · 결판 · 복귀 연출 (2026-09-25)
- `L753` 전투 리뷰 후속: 상태 안내와 무대 채움 (2026-09-20)
- `L779` 전투 적대적 리뷰의 무결성 수정 (2026-09-20)
- `L804` 공격 효과음 지연 — 샘플 SE 디코드 캐시 (2026-09-15)
- `L826` 전투 UI/UX·모션 적대적 리뷰 5축 후속 (2026-09-14)
- `L897` 몬스터 파티의 전투 회복약 자격 (2026-09-24)
- `L908` 회복 자원·인트로 배너·타이머 write-back 계약 (2026-09-15)
- `L953` Native event battle admission (2026-09-08)
- `L999` Supported action authoring (2026-09-07)
- `L1011` 적별 전투 표시 크기 (2026-09-06)
- `L1021` Capture-only victory (2026-09-08)
- `L1032` Event friendship and live level changes (2026-09-06)
- `L1051` Sequential battle event completion (2026-09-08)
- `L1086` Battle-event continuation and cancellation (2026-09-06)
- `L1129` 전투 명령 custom CSS (2026-09-05)
- `L1133` 빈 페이지와 실행 빈도 계약 (2026-09-05)
  - `L1150` 체공 배율 채널과 착지 눌림 (2026-08-30, PR #297)
- `L1168` 지원 전투 시스템은 둘뿐이다 (2026-08-28, 스킨 부분은 2026-09-25 개정)
- `L1239` Roguelike run boundary (2026-08-24)
- `L1244` 연계기 · 위치 범위기 · 기술 포인트 (Chrono Trigger 계열, 2026-09-26)
- `L1263` 전투 자원 · 감정 · 장비 부여 (JRPG 레인 L3, 2026-09-27)
- `L1286` Chrono Trigger 전투 엔진: Active ATB · 상태 · 반격 · 자동 부활 · 적 이동 · 승리 포즈 · 필드 배경 (2026-09-26)
- `L1329` Battle rules & runtime
  - `L1344` 전투 화면 표현 · 전환 · 타임라인 · 연출 타이밍
  - `L1369` 커맨드/대상 메뉴 기하와 글자 가시성 계약
  - `L1385` 스킨 CSS 캐스케이드와 저작 가능 스킨
  - `L1389` Gen 1(포켓몬식) 규칙 모델
  - `L1397` 플레이 모드 런타임 (이 절에 섞여 있는 비전투 항목)
  - `L1416` 전투 흐름 · 몬스터 수집 · 트룹 이벤트 · 보상
- `L1460` Starter hero battle sheets (2026-08-29)
- `L1481` Per-actor back battlers (2026-08-29)
- `L1499` Battle input and visibility P0 contract (2026-07-30)
- `L1510` 배틀러 idle 애니메이션 (2026-08-30)
- `L1638` 필드 아이템 상태 부여 복구 (2026-09-05)
- `L1642` Authored combat rules (feature16, 2026-09-21)
- `L1656` Battle reports and physical formation (2026-09-21)
- `L1660` Combat correctness hardening (2026-09-21)
- `L1668` Gen1 교체 후 이전 적 HUD 잔류 (2026-09-24)
- `L1678` 트레이너 전투의 도입 문구 (2026-09-24)
- `L1685` 포획 불가 전투의 가방 목록 (2026-09-25)
- `L1696` 특수 명령 · 입력 기술 · 다부위 적 (명작 공백 #4 #8 #10, 2026-09-27)
- `L1710` 롤링 HP · 움직이는 배경 · 화면 색 필터 (명작 공백 #15 #37, 2026-09-27)
- `L1720` 전투 개시 형태 · 동료 작전 · 패배 규칙 · 피해 전가 · 도주 가산 (명작 공백 #3 #11 #20 #33 #34 #36, 2026-09-27)
- `L1737` 리미트 · 기력 · 파티 게이지 · 감정 상성 · 장비 부여 (명작 공백 #7 #9 #16 #21 #23, 2026-09-27)
- `L1750` 공용 몬스터 옛 그림 폐기 (2026-10-02)
  - `L1754` 공용 이동 설계·32종 전투 기믹 (2026-10-02)

### `openwiki/runtime-m2-flow-controls.md` — 47KB · 323줄 · ~12,984 토큰

- `L5` Quest companion presence query (2026-10-01)
- `L15` Map-effect repair boundary (2026-09-06)
- `L22` Sound Layer audio controls (2026-09-06)
- `L29` M2 Runtime Flow Controls
- `L69` Storage chest authoring
- `L75` Page 3 location/vehicle compatibility (2026-07-30)
- `L79` 저장된 M2 명령 실행 연결 복구 (2026-09-05)
- `L92` 좌표 목적지 이동의 실패 계약 (OPRN-OUT-013, 2026-09-10)
  - `L151` 이동 중 경로 재지정 — 2026-09-05 브라우저 적대적 QA
  - `L158` 맵 위를 흐르는 구름 그림자 (2026-09-14)
  - `L232` Weather sound (2026-09-21)
  - `L246` Map-wide atmosphere presets (2026-09-21)
  - `L267` Genre ambience presets and sound pairing (2026-09-21)
  - `L291` Thirty audiovisual presets — evidence (2026-09-21)
  - `L306` 그림 컷 준비와 direction (2026-10-04)
- `L314` 글자·장면 오프닝 연출 (2026-10-04)

### `openwiki/runtime-pre-edit-routing.md` — 111KB · 815줄 · ~33,481 토큰 · 통째읽기 잘림

- `L1` 태양 지형 그림자 (2026-10-04)
- `L7` 내보낸 게임은 창에 맞춘다 (2026-10-04)
- `L20` 그림 아이콘을 조사 물체로 쓴다 (2026-10-04)
- `L545` 게임 화면의 2층·그림자·4층 (MZ식 4층, 2026-09-24)
- `L565` 맵별 16/32/48px 좌표
- `L569` ESC skill thumbnails (2026-09-06)
- `L580` Recovered head emotes (2026-09-05)
- `L586` 메뉴 입력·불러오기 배율 (2026-09-05)
- `L594` 가구 밀기 애니메이션 (2026-09-05)
- `L603` Recovered head emotes (2026-09-05)
- `L609` Saved uploaded tilesets in the actual player (2026-09-14)
- `L630` 맵 배경(패럴랙스) 렌더 (2026-09-14)
- `L657` 맵 배경 다중 레이어 (2026-09-21)
- `L709` 맵 배경 깊이(카메라 따라가기)·흐름 배율 — 회상 파노라마 (2026-09-27)
- `L754` 8차 맵 진입 (2026-09-28)
- `L787` 화면 주변 타일 유지 (2026-10-01)

### `openwiki/runtime-project-schema.md` — 215KB · 1547줄 · ~60,143 토큰 · 통째읽기 잘림 · 깨진 줄 1

- `L3` 맵 캐릭터 크기 — 선택 필드 `map.characterScale` (2026-10-03)
- `L11` 세계 지도 원본 — 선택 필드 `map.worldmapSource` (2026-10-03)
- `L20` 캐릭터별 전투 동작 (2026-10-03)
- `L29` 퀘스트 프리셋 메타 (2026-10-01)
- `L44` 공식 맵 크기와 저장 형태 (2026-10-01)
- `L52` 번들·공용 참고문서 소유 분리 — 저장 문서에서 빼고 로드에서 되돌림 (2026-09-30, 편집기 렉 F)
- `L69` 스킬 도트 연출 빌리기 — 선택 필드 retroChoreographyId (2026-09-30)
- `L73` 프로젝트 연출 레코드 — database.skillChoreographies (2026-09-30)
- `L77` ensureRetroRosterRecords — 기존 프로젝트에 레트로 로스터 심기 (2026-09-30)
- `L88` 스킬 HP 대가·흡수 — 선택 필드 (2026-09-29)
- `L94` 데스크톱 시작 화면 — 시네마틱 로비 (2026-10-03)
- `L148` 강하게 다시 하기·장 표시 선택 필드 (2026-09-26)
- `L158` 지형지물 군집 `map.doodadGroups?` (2026-10-03)
- `L170` 높이 지형 `map.relief` — 선택 필드 (2026-09-26)
- `L195` 맵 칸 2층·4층·그림자 — 선택 필드 (MZ식 4층 PR ①, 2026-09-24)
- `L228` 이름별 게임 오버 (2026-09-23)
- `L245` 확정된 게임 기획 (2026-09-22)
- `L267` LegacyDb 잔여 의존 정리 (2026-09-21)
- `L274` 종족 전투 뒷모습 리소스 (2026-09-20)
- `L278` 웹 프로젝트 생성과 선택 (2026-09-18)
- `L284` 팀 프로젝트 서비스 (2026-09-18)
- `L291` 로컬 SQLite 정본과 저장소 포트 (2026-09-16)
  - `L374` 데스크톱 앱이 실제로 뜬다 (2026-09-16)
- `L407` 지역 하위 장소의 단일 계약 (2026-09-14)
- `L417` 직접 그린 방을 포함하는 다층 장소 (2026-09-14)
- `L426` 장소 재료의 포함 관계 (2026-09-14)
- `L435` 혼합 하위 재료 구성 (2026-09-13)
- `L454` Truthful migrated-load state (2026-09-07)
- `L487` Explicit publication identity and Save6 (2026-09-06)
- `L545` Spatial canonical routing (task6 backend increment, 2026-09-07)
- `L587` P1 accepted-save receipts and read-only proof (2026-09-06)
- `L637` 패배 흐름과 엔딩 프레젠테이션 (2026-09-22)
- `L651` Opening and game-over cinematic settings (2026-09-06)
- `L668` 적 전투 이미지 크기 (2026-09-06)
- `L672` Project monster metadata overrides (foundation, 2026-09-07)
- `L714` Project audio description overrides
  - `L743` Concurrent persistence
  - `L768` Editor preservation and playable export
- `L782` Character/face authoring metadata (2026-09-06)
- `L791` Character appearance sets v1 (2026-09-06)
- `L828` New-project save/reload verification (2026-09-05)
- `L836` Task15 nonvisual economy command contract (2026-09-08)
- `L847` Independent game Save5 boundary (2026-09-06)
- `L853` Life ownership in Save5 (2026-09-06)
- `L869` Placement safety core (task12, 2026-09-06)
- `L881` Project-authored equipment slots (2026-09-05)
- `L889` 전투 명령 CSS (2026-09-05)
- `L893` 기본 카탈로그 삭제 보존 (2026-09-05)
- `L897` 전투 페이지 중복 ID 복구와 슬롯 참조 (2026-09-05)
- `L910` 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)
- `L918` 세계 법칙의 명시적 부재 (2026-09-05)
- `L922` Showcase media save-copy durability (issue #693, 2026-09-08)
- `L962` 공용 첫 방문 데모 — 읽기 전용 저장 계약 (2026-09-14)
- `L996` Project schema & persistence
- `L1235` Variable arithmetic & loop runtime (2026-08-07)
- `L1239` Canonical event-draft projection (2026-07-30)
- `L1246` P2 general buildings and home decorations (2026-08-25)
- `L1253` 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)
- `L1271` Boot normalizers must not create dangling references (2026-08-30)
- `L1297` `.oprn` 은 단일 파일 게임 컨테이너다 — 편집기와 플레이어 양쪽이 읽는다 (2026-08-30)
- `L1331` 성장 트리 선택 확장 (2026-09-05)
- `L1337` 마을 설계서 (2026-09-05)
- `L1343` 공포 게임 제작 기능 (2026-09-05)
  - `L1347` 저장된 대사 별칭과 맵 오버레이 (2026-09-05)
- `L1351` NPC 표시 이름 (2026-09-05)
- `L1364` 연결 실내 도면의 영속성 (2026-09-05)
- `L1368` 개념 장소 형상 (2026-09-05)
- `L1372` Optional village decoration attachments (2026-09-13)
- `L1383` Optional map climate (Feature16, 2026-09-21)
- `L1400` Optional authored combat rules (feature16, 2026-09-21)
- `L1403` AI 저작 보조 설정의 프로젝트 지속성 (Feature16, 2026-09-21)
- `L1416` 구름량 optional 필드 (2026-09-21)
  - `L1428` Map atmosphere layers (2026-09-21)
- `L1449` 필드 HUD 설정 (2026-09-21)
  - `L1459` HUD 장르·서체 확장 (2026-09-21)
- `L1471` 타일셋 참고문서 데이터 (2026-09-21)
- `L1475` 몬스터 보유 조건 연결 작업 (2026-09-25, 진행 중)
- `L1501` 재편집 지형과 게임 높이 규칙 (2026-10-03)
- `L1510` Optional internal authoring contract
  - `L1514` Desktop fullscreen and mouse controls (2026-10-04)
  - `L1529` Cinematic image direction (2026-10-04)
- `L1538` 글자·장면 오프닝 연출 (2026-10-04)

### `openwiki/runtime-sessions.md` — 123KB · 627줄 · ~33,263 토큰 · 통째읽기 잘림

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
- `L242` Roguelike run kernel and field rooms (Phase 0–3, 2026-08-24)
- `L252` P1 daily-weather transition authority (2026-08-25)
- `L261` Event audio state (U14)
- `L269` Session state & life-sim
- `L350` Editorial title screen (2026-08-26)
- `L357` playerTouch trigger contract (2026-08-20)
- `L361` Selected-event runtime sandbox (2026-07-30)
- `L367` P2 spatial runtime and saves (2026-08-25)
- `L381` 공포 게임 제작 기능 (2026-09-05)
  - `L385` 메뉴 PR 통합 검증 (2026-09-05)
- `L392` Game menu designs and information ownership (2026-09-18)
  - `L422` Four era-inspired menu windows (2026-09-18 follow-up)
- `L446` Player options, inventory views and honest shop services (feature16, 2026-09-21)
- `L475` 도트 비교 상점 — 상점 UI 기본값 (2026-09-27)
- `L504` 도트 창 통일 — ESC 메뉴·장비·아이템·여관·전투 결과 (2026-09-28)
- `L535` Persistent battle reports and formation (2026-09-21)
- `L543` 퀘스트 일지의 긴 문장과 키보드 읽기 (2026-09-24)
- `L553` 갤러리와 줄 음성 (2026-09-25)
- `L565` 강하게 다시 하기(New Game+)와 장 표시 (2026-09-26)
- `L586` 탈것 — 소형선·대형선·비행선 (2026-09-26)
- `L610` 명작 공백 G3 — 난이도·타이틀 변형·파티 묶음·스킬 장착·조합·몬스터 교환 (2026-09-27)

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

### `openwiki/shared-item-balance.md` — 6KB · 58줄 · ~2,016 토큰

- `L5` 소유 경로
- `L12` 효과 역할
- `L30` 가격 기준
- `L40` 확인 근거
- `L53` 큰 JSON의 타입 경계

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

### `openwiki/spatial-geography-compiler.md` — 9KB · 158줄 · ~2,420 토큰

- `L8` Public path
- `L31` Terrain and structures
- `L61` Settlement regions (2026-09-12)
- `L83` Ownership and regeneration
- `L106` Contract fixtures and proof

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

### `openwiki/state-system.md` — 13KB · 136줄 · ~3,497 토큰 · 깨진 줄 2

- `L7` TL;DR (use this when explaining to a user)
- `L15` Layers and ownership
- `L25` StateRecord fields (authored)
- `L56` StateOntology (engine default template)
- `L81` Default seed (new projects)
- `L85` Editor surface
- `L95` Runtime application
- `L106` Common confusion points
- `L118` Files to inspect before editing
- `L130` Related pages

### `openwiki/storage-retirement.md` — 4KB · 55줄 · ~1,203 토큰

- `L3` 현재 저장 경로
- `L18` 제거와 대체
- `L30` 실제 데이터 보존
- `L43` 역사 자료와 검증

### `openwiki/sunlight-shadows.md` — 7KB · 73줄 · ~2,036 토큰

- `L3` 저작과 저장
- `L14` 공통 계산과 그리기
  - `L51` 높이 붓과 도로의 수신 면 (2026-10-04)
- `L62` 조수와 검수

### `openwiki/teaching-assistant-tilesets.md` — 44KB · 369줄 · ~13,309 토큰

- `L8` 한 줄 요약
- `L14` 조수가 실제로 받는 것
  - `L44` 참고문서 읽기 게이트
- `L54` 타일셋 종류별로 조수가 아는 정도
- `L68` 가르치는 수단 — 효과 큰 순
- `L89` 새 타일셋을 넣을 때 점검표
- `L98` 재배포 금지 서드파티 팩 (예: Rasak Modern)
- `L113` 네 층 타일셋 가르치기
  - `L119` 조수가 지금 받는 것
  - `L133` 네 층 팩을 가르치는 순서
  - `L153` Rasak Fantasy 파이프라인 (저장소 밖 그림)
  - `L165` MV/MZ 팩 프리셋 — 구현 (2026-09-24, Rasak Modern 도시 야외)
  - `L212` 건물 문법과 마을 짜임 (2026-09-25)
- `L294` 알려진 함정
- `L304` 강제 장치 (이 문서를 안 읽어도 걸리는 것)
- `L318` 칩셋 계열 규칙 (2026-09-25 사용자 결정)
- `L353` 문서의 번호가 새 프로젝트에 있어야 한다 (2026-09-25)

### `openwiki/team-project-host.md` — 44KB · 491줄 · ~13,738 토큰

- `L5` 소유와 실행 위치
- `L30` 실행
  - `L39` 앱끼리 참여 (2026-09-28)
  - `L86` HTTP 참여의 지연 원인과 개선 (2026-09-28, Tailscale 실측)
  - `L114` 동료 저장 반영·부팅·첫 참여 전송량 (2026-09-28 2차)
- `L170` 기존 mdc-server 시작 명령의 SQLite 연결 (2026-09-18)
- `L188` 저장·협업 계약
- `L220` 큰 프로젝트의 HTTP 저장 전송 (2026-09-24)
  - `L240` 큰 문서 저장 봉투 (2026-09-28)
  - `L284` 헤드리스 대용량 콘텐츠 설치 (2026-09-25)
- `L297` 백업과 이전
- `L315` 검증 근거
- `L324` 호스트 페이지 CSP (2026-09-22)
- `L333` 적대적 리뷰 수정 (2026-09-18)
- `L346` 웹 새 프로젝트 생성 (2026-09-18)
  - `L364` 새 프로젝트의 공용 기본 자료 보장 (2026-09-24)
- `L383` 운영 systemd가 Vite preview에 고정된 경우 (2026-09-18)
- `L403` 맵 편집 권한 가져오기 (2026-09-18)
- `L418` 운영 AI와 로그인 유지 (2026-09-18)
- `L431` 내부 웹 기본 접속 (2026-09-18)
- `L442` Large bridge save requests (2026-09-24)
- `L448` 웹 편집기 저장 경로 경량화 (2026-09-25)
  - `L463` 저장 경로의 전체 복제·직렬화 제거 (2026-09-26~27)
  - `L484` 공용 라이브러리 게시 후 재로드 (2026-10-04)

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

### `openwiki/terrain-placement-tools.md` — 8KB · 87줄 · ~2,398 토큰

- `L9` 아이콘 도구와 도움말 (2026-10-04)
- `L30` 소유 경로
- `L42` 동작
- `L68` 저장·크기 변경
- `L77` 확인

### `openwiki/testing.md` — 220KB · 2092줄 · ~61,141 토큰 · 통째읽기 잘림

- `L3` AI 세션 테스트의 모델 id 는 임의로 짓지 않는다 (2026-09-14)
- `L19` 전체 스위트가 워커 힙에서 죽던 문제 (2026-09-11)
- `L53` main 의 ci-fast 는 다음 머지가 진행 중 잡을 끊지 않는다 (2026-09-26)
- `L60` parity 스위트 CI OOM (2026-09-19)
- `L68` ci-full vitest 는 힙 합을 75% 안에 둔다 (2026-10-04)
- `L77` 게이트 반복은 `--changed` 로 좁힌다 (2026-09-13)
  - `L104` vitest 는 왜 28분이고, 무엇을 만져도 안 줄어드는가 (2026-09-14 실측)
  - `L133` AI 조수 가족이 왜 이렇게 잘 뒤집히나 (실측)
- `L142` 격리 원장 `test/QUARANTINE.md` (2026-09-13)
- `L160` 브라우저 테스트는 별도 스테이지다 (2026-09-13)
- `L174` P5 delivery gates and the P4 regressions they caught (2026-09-09)
  - `L176` Open: checkpoint writes still slow the authoring loop
- `L228` P4 checkpoint storage and boot admission (2026-09-09)
- `L282` P3 request-bound fixture alignment (2026-09-08)
- `L307` Issue 693 verification contracts (2026-09-08)
- `L331` Request-coverage gate follow-up (2026-09-08)
- `L374` Native event battle reliability QA (2026-09-08)
- `L410` Real large-world player QA (2026-09-07)
- `L419` CSS budget: file count is informational
- `L431` Selection and composer surface contracts (2026-09-06)
- `L450` P3/current-main composition fixtures (2026-09-08)
  - `L477` Cooperative Node scheduling in long session fixtures (2026-09-08)
- `L493` AI turn observation contracts (2026-09-06)
  - `L514` P2 R1 retained-draft Ask (2026-09-07)
  - `L552` P2 R3 wiki delivery (2026-09-07)
- `L581` P3 ownership and stale-base verification (2026-09-07)
  - `L656` Autosave status fixture ownership (2026-09-08)
  - `L670` Project history transport isolation
- `L702` Canonical project storage versus AI history (2026-09-06)
  - `L704` 데스크톱(Electron) 스모크는 이렇게 돈다 (2026-09-16)
- `L726` Action RPG authoring and runtime proof (2026-09-07)
- `L747` Database CSS ownership contracts (2026-09-06)
- `L768` Audio description verification
  - `L792` Real editor surfaces
  - `L819` Exported-player playback and dependency evidence
- `L868` Mac onboarding Phase 1 contracts (2026-09-06)
- `L896` Task10 field-input verification and limits (2026-09-06)
- `L912` Life QA observation and action receipts (2026-09-06)
  - `L920` Task5 validation correction (2026-09-06)
  - `L928` Task5 Q1 audio boundary correction (2026-09-06)
- `L936` 기존 실패 비교는 진단 내용까지 확인한다 (2026-09-05)
- `L953` Esc 메뉴 동작·시각 검증 (2026-09-05)
- `L969` Completed-house Phase 2 verification (2026-09-06)
- `L1000` P2 낚시·채집·도감·박물관 focused gate (2026-08-25)
- `L1007` Map-owned overlays: actual AI-turn browser regression (2026-09-05)
- `L1016` Editor e2e boot-overlay determinism (2026-08-31)
- `L1021` 영역 다듬기 focused gate (2026-08-31)
- `L1028` AI 이벤트 배치 통행성 focused gate (2026-08-30)
- `L1036` 체공(점프·낙하) focused gate (2026-08-29)
  - `L1045` 좌표 목적지 이동 QA — `node scripts/qa-coordinate-move.mjs` (OPRN-OUT-013, 2026-09-10)
  - `L1062` 좌표 이동 저작 폼 QA — `node scripts/capture-coordinate-move-form.mjs`
  - `L1071` 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`
  - `L1101` 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)
- `L1164` Roguelike run Phase 0–3 coverage (2026-08-24)
  - `L1175` 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)
- `L1184` 데이터베이스 UI/UX 계측 하네스 (2026-08-30)
  - `L1208` 가상 요소 텍스트를 안 재면 `tinyFont 0` 은 "안 봤다" 는 뜻이다 (실측)
  - `L1229` 0px 이미지는 "깨진 것" 과 "접힌 것" 을 갈라야 한다 (실측)
  - `L1235` 타이밍에 취약한 e2e 가 빨간불이면 그 스펙이 단정하는 속성을 직접 재라 (실측 2026-08-30)
  - `L1258` 소스를 grep 하는 테스트는 이름만 봐서는 회귀를 못 가른다 (실측)
- `L1266` Agent validation rule
- `L1376` Event-editor trust-loop validation (2026-07-30)
- `L1381` 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)
- `L1400` Tile-to-world persistence concurrency (task20)
- `L1406` P2 spatial focused gate (2026-08-25)
- `L1415` 대화창 연출 focused gate (2026-08-30)
- `L1490` 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)
  - `L1509` `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)
  - `L1521` 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)
  - `L1529` 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)
  - `L1536` `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)
- `L1558` 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)
  - `L1560` 메뉴 적대적 플레이 회귀 (2026-09-05)
- `L1701` sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)
- `L1708` NPC 배회 런타임 QA — `npm run qa:runtime -- --scenario npc-movement` (2026-09-17)
- `L1722` fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)
  - `L1743` Shared fake DOM enhancement contracts (2026-09-08)
- `L1775` bugfix-sweep 실제 표면 하네스 (2026-08-29)
- `L1788` 마을 설계서 (2026-09-05)
- `L1793` 공포 제작 개정 QA와 개발 서버 전송 (2026-09-05)
- `L1803` 상점 진열 중심 편집 검증 (2026-09-05)
- `L1811` 실제 DB로 나가는 전체 검사 요청 (2026-09-05 실측)
- `L1817` Request-bound functional acceptance verification (2026-09-07)
- `L1885` 조수 보상 저작과 출하 플레이어 검증 (2026-09-06)
- `L1895` 실내 조립·형상 검증 (2026-09-05)
- `L1899` Feature16 player preferences / inventory / shop (2026-09-21)
- `L1911` Feature16 통합 검증 (2026-09-21)
  - `L1919` 필드 HUD 브라우저 증거 (2026-09-21)
  - `L1925` 장르 HUD 시각 확인 (2026-09-21)
- `L1933` 실제 첫 생성 → 정본 재로드 → 출하 ZIP 플레이 (2026-10-03)
- `L1958` 맵 크기 성능 실측 (2026-10-01)
  - `L1979` 화면 주변 타일 유지 검증
  - `L2002` 공식 512×512 저작 상한 검증
  - `L2030` 공식 1024×1024 저작 상한과 성능 검증
- `L2048` 첫 자동 게임의 실제 대사 대기 (2026-10-04)
  - `L2064` Maker repair and click-first startup (2026-10-04)
- `L2089` 조수 기능별 실제 수행 점검 (2026-10-05)

### `openwiki/tile-geometry.md` — 12KB · 145줄 · ~3,629 토큰

- `L5` 좌표 계약
- `L24` 캐릭터 자동 배율 (2026-09-21)
- `L48` 타일 크기가 섞인 프로젝트 (2026-09-24)
- `L74` 원본 아틀라스와 표시 크기의 구분
- `L91` 48px 일반 칩셋 가져오기 (2026-09-21)
- `L109` 브라우저 근거
- `L122` Slates 참고 맵 3종

### `openwiki/tile-layer-policy.md` — 30KB · 373줄 · ~9,301 토큰

- `L13` 다섯 부류
- `L26` 층 번호 ↔ 맵 칸 ↔ 도구 인자 (MZ 네 층, 2026-09-25)
- `L45` 받침(backing) 메타
- `L55` 커스텀 칩셋 준비 — 검토 신호, 자동 변형 금지
- `L65` 나무 밑동 290~293 을 상위로 옮기면 안 되는 이유
- `L73` OPRN-OUT-017 과의 관계 (원인 공유는 미증명)
- `L84` 테스트
- `L94` 브라우저 증거 (2026-09-10)
- `L114` 커스텀 칩셋 픽셀 자동 감지 — 출하된 계약
  - `L137` 임계값 — 실제 시트를 재서 얻은 수치다 (2026-09-10)
  - `L152` 브라우저 실측 (Modern Exteriors 아틀라스 480칸)
- `L160` 아직 결정이 필요한 것 (제품 소유자)
- `L165` 캔버스 렌더러도 받침 계약을 진다 (2026-09-12 실측 결함)
- `L188` 숲마을 공통 기본 칩셋 (2026-09-18)
- `L216` 성채 공통 기본 제공 타일셋 (2026-09-19)
  - `L242` 참고 이미지 보드와 성채 공간 카탈로그 (2026-09-19)
- `L273` LPC 나무 가구 공통 기본 제공 타일셋 (2026-09-21)
  - `L299` 공용 오브젝트 (2026-09-22)
  - `L324` 16px 병행판 (2026-09-22)
  - `L343` 픽셀 크기 기록 계약 (2026-09-22)
- `L365` AI 하위 페인트의 상위 가구 보존 (2026-09-25)

### `openwiki/tileset-reference-documents.md` — 55KB · 564줄 · ~16,695 토큰 · 통째읽기 잘림

- `L5` 공용 타일셋 참고 이미지는 호스트 주소다 (2026-09-26)
- `L20` 공용 SQLite 지역 참고문서 조회 (2026-09-24)
- `L31` 사용자 다운로드형 타일셋 지원 (2026-09-24)
  - `L72` 공간 설계·실제 발판 검사
- `L89` 사용자 경로와 정본
- `L106` 타일 화면 구성 (2026-09-21)
- `L127` 저장 계약
- `L139` AI 선행 읽기 계약
- `L172` Slates 이관
- `L185` 확인 자료와 범위
- `L191` Castle2 성채 학습 이관
- `L203` 숲마을 공용 자료 (2026-09-21)
- `L219` 공용 forest_harmony 참고문서 보충 (2026-09-22)
  - `L234` Castle2 공용 기본 제공 수정
- `L243` 실행형 부품·조립·검증 자료
- `L261` 공용 숲 실행 조립법 (2026-09-22)
  - `L278` 상세 공용 조립 계약 (public-assembly-v2)
- `L290` 이슬여울 마을 장식 표본 (2026-09-22)
- `L314` 다양한 마을의 번들 소유 참고문서 (2026-09-23)
  - `L330` 절벽 조립 교정 (2026-09-23)
  - `L340` 잔디 경계 개정3 (2026-09-23)
  - `L350` 굽은 지형·입구 개정4 (2026-09-23)
  - `L360` 생활 마당 개정5 (2026-09-23)
  - `L369` 사용 목적 개정6 (2026-09-23)
  - `L379` 공동 공간·정원 개정7 (2026-09-23)
  - `L390` 계단 대지 개정8 (2026-09-23)
  - `L405` 강과 폭포 개정9 (2026-09-23)
  - `L417` 컨셉 마을 3종 · 창문 개정10 (2026-09-23)
  - `L433` 판타지 장소 11곳 · 상점·성 내부·마왕성 (2026-09-23)
  - `L449` 기후 마을 · 설원·화산 (2026-09-23)
  - `L462` 사막·가을 기후 + 마을 사이 필드 (2026-09-23)
  - `L475` 나무 몸통 개정 — 잘린 줄기 없애기 (2026-09-23)
  - `L494` 공용 PAW 장면 실행 경로 (2026-09-25)
- `L515` PAW 천장 아래 벽과 실제 가게2종 (2026-09-25)
  - `L537` 수관 잎 채움 (2026-09-24)
- `L548` 번들 참고 이미지는 정적 경로다 (2026-09-25)

### `openwiki/title-opening-effects.md` — 35KB · 347줄 · ~10,837 토큰

- `L6` 데이터
- `L18` 프리셋
- `L27` 런타임
- `L36` 저작 경로
- `L75` 표본과 검증
- `L93` 입장 시퀀스 · 로고 반짝임 · 「새 게임」 전환 (2026-09-26)
- `L119` 깊이 시차 `parallax` (2026-09-26)
- `L137` 범위 밖 (이번에 안 한 것)
- `L144` 소프트웨어 WebGL 입자 계산 분리 (2026-09-28)
- `L177` 타이틀 키보드 이동·크레딧 닫기 (2026-10-04)
- `L217` 시네마틱 장면 연출과 백그라운드 준비 (2026-10-04)
- `L250` 글자·장면 오프닝 연출 (2026-10-04)
- `L287` 스토리보드·독립 그림 모션·원곡 BGM (2026-10-04 후속)
  - `L338` 참고한 연출 계약

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

### `openwiki/village-layout-research.md` — 18KB · 196줄 · ~5,761 토큰

- `L5` 현재 적용한 변경과 범위
- `L36` 울타리와 숲마을 칩셋 기본값 (2026-09-21 후속)
- `L57` 누락된 작업 복원과 연결 숲 통합 (2026-09-21)
- `L67` 굽은 외곽 숲과 생활 소품 기본 꾸밈 (2026-09-21)
- `L83` 연속 경계장과 다중 스케일 제어 (2026-09-21 후속)
- `L108` 연구에서 확인한 원칙과 한계
- `L123` 장기 설계 방향: 강을 따라 자란 마을
- `L144` 구현 경로와 소유권
- `L165` 수용 기준과 다음 검증
- `L180` 장소 라이브러리의 기준 도안
- `L188` 공용 세 마을 · 굽은 지형과 출입구 (2026-09-23)

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

### `openwiki/worldmap-terrain-editing.md` — 20KB · 182줄 · ~5,949 토큰

- `L7` 흐름
  - `L9` 세계관별 준비 상태와 우주 조수 (2026-10-04)
  - `L27` 호스트 공용 DB와 조수 (2026-10-04)
- `L74` 계약
- `L100` 새 구조 만들기 — `base: "generate"` (2026-10-03)
- `L146` 후속 조수 실행·SQLite 재로드 (2026-10-04)
- `L154` 지형 경계 v9 (2026-10-03)
- `L160` 글자 지도
- `L166` 조수 역할 적대 시험 (2026-10-03)
- `L173` 함정
