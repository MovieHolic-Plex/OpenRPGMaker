# 격리된 테스트 원장 (quarantine)

2026-09-13 격리. 이 파일들은 **이 저장소의 원래 빨간불**이었다 — 기준선(`.omo/gates-baseline.json`)
저장 시점부터 계속 실패했고 그 뒤로도 한 번도 초록이 아니었다. 게이트는 "기준선 대비 새 실패"만
회귀로 세므로 이들은 **아무것도 게이팅하지 않는다**. 그런데도 vitest CPU 시간의 **약 2056초(전체 8,363초의 25%)**를
먹었고, 부하가 높을 때 재실행을 강요하는 소음의 원인이었다.

## 무엇을 했나

- 파일 이름을 `X.test.ts` → `X.quarantine.test.ts` 로 바꿨다(삭제 아님, 내용 불변).
- `vitest.config.ts` 의 exclude 에 `test/**/*.quarantine.test.ts` 를 추가해 기본 스위트에서 뺐다.
- 이름 규칙이라 깊이가 그대로다 — `./fixtures/...` 같은 상대 import 가 살아 있다.

## 다시 돌리는 법

```bash
npm run test:quarantine
```

## 다시 넣는 법

`.quarantine` 만 떼면 된다:

```bash
git mv test/foo.quarantine.test.ts test/foo.test.ts
```

**초록으로 고친 뒤에만** 넣는다. 고치지 않은 채 이름만 되돌리면 게이트에 빨간불이 다시 쌓인다.

## 왜 삭제하지 않았나

"테스트를 지워 초록으로 만드는" 작업이 아니다. 이들이 검사하려던 동작은 여전히 유효할 수 있고
(오래된 기대값·이름 변경·가드 추가로 깨진 것), 원장이 있어야 누가 다시 본다.
폐기된 기능을 검사하는 것이 확인되면 그때 파일을 지운다.

## 목록 (134개)

| 파일 | 실패 종류 | 차지하던 CPU 시간 |
|---|---|---|
| `storePersistenceLineage.test.ts` | assertion | 221.9s |
| `aiWorkPlanTerminalFocus.test.ts` | assertion | 92.1s |
| `functionalCompositeClarification.test.ts` | assertion | 74.4s |
| `npcCastSession.test.ts` | assertion | 60.0s |
| `aiStickyChecklist.test.ts` | assertion | 55.4s |
| `aiNewGoalDraftRetirement.test.ts` | assertion | 54.8s |
| `databaseCinematics.test.ts` | assertion | 53.3s |
| `walkthroughRunner.test.ts` | assertion | 45.0s |
| `spatialLegacyImport.test.ts` | assertion | 38.9s |
| `assistantMapPreservationGuard.test.ts` | assertion | 37.2s |
| `assistantFunctionalReviewIntegration.test.ts` | assertion | 35.8s |
| `mapPlanningSpecCapture.test.ts` | assertion | 30.2s |
| `applyProposedProjectHouseProtection.test.ts` | assertion | 30.1s |
| `aiWorkItemStall.test.ts` | assertion | 29.9s |
| `assistantMultiMapSpec.test.ts` | assertion | 28.4s |
| `regionTaskCompletedHouse.test.ts` | assertion | 27.9s |
| `assistantP2ReviewIntegration.test.ts` | assertion | 27.7s |
| `clusterAiModalHouseProtection.test.ts` | assertion | 25.4s |
| `aiChatSessionScope.test.ts` | assertion | 25.2s |
| `projectWikiTimeout.test.ts` | assertion | 23.3s |
| `aiChatObservability.test.ts` | timeout | 21.0s |
| `aiBlockedEventRelocation.test.ts` | assertion | 17.8s |
| `aiRegionChatBoundary.test.ts` | assertion | 17.2s |
| `regionTaskHouseProtection.test.ts` | assertion | 16.7s |
| `aiRunEpochPanel.test.ts` | assertion | 16.3s |
| `eventValidationNavigationContract.test.ts` | assertion | 15.7s |
| `aiChatPanelTransportError.test.ts` | assertion | 15.7s |
| `assistantFinalAssessment.test.ts` | assertion | 15.6s |
| `databaseConceptFirstNav.test.ts` | assertion | 15.6s |
| `eventEditorTrustLoop.test.ts` | assertion | 14.3s |
| `placedPlaceBoundaries.test.ts` | assertion | 14.0s |
| `eventCommandSupportRepairs.test.ts` | assertion | 14.0s |
| `aiAutonomousRunSmoke.test.ts` | assertion | 13.1s |
| `interiorConceptAssemblies.test.ts` | assertion | 12.9s |
| `assistantImageTransport.test.ts` | assertion | 11.7s |
| `toolImageGraftReadiness.test.ts` | assertion | 11.7s |
| `assistantSpatialObligations.test.ts` | assertion | 11.7s |
| `regionTaskRun.test.ts` | assertion | 11.6s |
| `spatialToolProjectionBoundary.test.ts` | assertion | 11.3s |
| `spatialAuthoringHistory.test.ts` | assertion | 10.5s |
| `mapPlanningReuse.test.ts` | assertion | 10.1s |
| `databaseSystemView.test.ts` | assertion | 7.2s |
| `aiChatPanelUxRepairs.test.ts` | assertion | 7.2s |
| `treeNamespaceStore.test.ts` | assertion | 7.2s |
| `agentBlueprintTurnEnd.test.ts` | assertion | 6.8s |
| `spatialOverviewLifecycle.test.ts` | assertion | 6.0s |
| `gameTitleAcceptance.test.ts` | assertion | 5.9s |
| `assistantAcceptanceNewMapCharacterization.test.ts` | assertion | 5.9s |
| `spatialAuthoringRefresh.test.ts` | assertion | 5.6s |
| `llmRetry.test.ts` | assertion | 5.5s |
| `aiBlockedContinue.test.ts` | assertion | 5.2s |
| `aiToolDiscoveryEscalation.test.ts` | assertion | 5.2s |
| `spatialToolAcceptance.test.ts` | assertion | 5.1s |
| `devRuntimeArchive.test.ts` | assertion | 4.6s |
| `databaseStudioV2.test.ts` | assertion | 4.6s |
| `interiorLongTable.test.ts` | assertion | 4.6s |
| `spatialOverviewIdentity.test.ts` | assertion | 4.3s |
| `tilesetWave2Undo.test.ts` | assertion | 4.2s |
| `aiProposalCardUxd.test.ts` | assertion | 4.1s |
| `propRejectionDiagnostics.test.ts` | assertion | 3.8s |
| `aiSelectionChipScope.test.ts` | assertion | 3.8s |
| `refactorTools.test.ts` | assertion | 3.7s |
| `regionAiHouseTreeNpc.probe.test.ts` | assertion | 3.3s |
| `aiRunOutcomeIntegration.test.ts` | assertion | 3.3s |
| `editSceneCameraFocus.test.ts` | assertion | 3.2s |
| `tileFlowApprovalExpansion.test.ts` | assertion | 3.1s |
| `projectLint.test.ts` | assertion | 3.0s |
| `shopDecisionInput.test.ts` | assertion | 2.8s |
| `spatialAuthoringOverview.test.ts` | assertion | 2.5s |
| `actionRpgAuthoringAcceptance.test.ts` | assertion | 2.5s |
| `tilesetTabActivation.test.ts` | assertion | 2.4s |
| `p0ProjectSchema.test.ts` | assertion | 2.4s |
| `systemAudioCueOverrides.test.ts` | assertion | 2.4s |
| `audioDescriptionCommandSurfaces.test.ts` | assertion | 2.2s |
| `databaseTilesetFolder.test.ts` | assertion | 2.2s |
| `aiSettingsEntryParity.test.ts` | assertion | 2.2s |
| `questGraph.test.ts` | assertion | 2.1s |
| `unsavedChangesGuard.test.ts` | assertion | 2.1s |
| `softConfirmUxFixes.test.ts` | assertion | 2.1s |
| `spatialOverviewForgery.test.ts` | assertion | 2.0s |
| `runtimePlayWindowSkins.test.ts` | assertion | 2.0s |
| `projectWikiSession.test.ts` | assertion | 1.9s |
| `aiToolCallSessionProtocol.test.ts` | assertion | 1.9s |
| `aiAssistantAfterUx.test.ts` | assertion | 1.7s |
| `originalContext.test.ts` | assertion | 1.7s |
| `spatialOverviewContract.test.ts` | assertion | 1.6s |
| `aiEventPlacementSurfaceGate.test.ts` | assertion | 1.6s |
| `io.test.ts` | assertion | 1.6s |
| `innConceptRebuild.test.ts` | assertion | 1.4s |
| `webExportBattleDependencies.test.ts` | assertion | 1.3s |
| `worldAiExclusion.test.ts` | assertion | 1.2s |
| `aiPanelContextSurfaces.test.ts` | assertion | 1.2s |
| `overInsertionCancel.test.ts` | assertion | 1.2s |
| `spatialLegacyCharacterization.test.ts` | assertion | 1.2s |
| `aiComposerEffortPanel.test.ts` | assertion | 1.1s |
| `placedSpaceCommands.test.ts` | assertion | 1.1s |
| `assistantAcceptance.test.ts` | assertion | 1.0s |
| `monsterEvolutionTypeChart.test.ts` | assertion | 0.9s |
| `storeMutationInstrumentation.test.ts` | assertion | 0.8s |
| `spatialBuiltinAssets.test.ts` | assertion | 0.8s |
| `stoneHearth.test.ts` | assertion | 0.7s |
| `spatialOccurrenceDraft.test.ts` | assertion | 0.7s |
| `systemAudioCueAuthoring.test.ts` | assertion | 0.6s |
| `gen1Damage.test.ts` | assertion | 0.6s |
| `databaseRadioCustomGuard.test.ts` | assertion | 0.5s |
| `innExploration.test.ts` | assertion | 0.5s |
| `modalEscapeLayerGate.test.ts` | assertion | 0.5s |
| `aiBusyQueue.test.ts` | assertion | 0.5s |
| `commandContracts/registry.test.ts` | assertion | 0.5s |
| `spatialAssetsCli.test.ts` | assertion | 0.4s |
| `elementRatesPartialAccept.test.ts` | assertion | 0.4s |
| `developmentOntology.test.ts` | assertion | 0.2s |
| `vitePreviewProxy.test.ts` | assertion | 0.2s |
| `databaseKoreanRtpDefaults.test.ts` | assertion | 0.1s |
| `databaseSelectChevronGuard.test.ts` | assertion | 0.1s |
| `playerInputCss.test.ts` | assertion | 0.1s |
| `runtimeQaInstrumentationBoundary.test.ts` | assertion | 0.0s |
| `interiorRoomVocab.test.ts` | assertion | 0.0s |
| `toolCatalog.test.ts` | assertion | 0.0s |
| `mapSurfaceFocus.test.ts` | assertion | 0.0s |
| `requestBudgetFromModel.test.ts` | assertion | 0.0s |
| `dialoguePreviewPresentationCss.test.ts` | assertion | 0.0s |
| `aiDeckCss.test.ts` | assertion | 0.0s |
| `touchPadModalVisibility.test.ts` | assertion | 0.0s |
| `innArchitecture.test.ts` | suite-error | 0.0s |
| `phase4Extras.test.ts` | timeout | 0.0s |
| `playSceneAssetResilience.test.ts` | suite-error | 0.0s |
| `runtimePictureStacking.test.ts` | suite-error | 0.0s |
| `spatialOverviewBoundary.test.ts` | suite-error | 0.0s |
| `spatialOverviewCompatibility.test.ts` | suite-error | 0.0s |
| `spatialOverviewFootprint.test.ts` | suite-error | 0.0s |
| `spatialOverviewShared.test.ts` | suite-error | 0.0s |
| `spatialOverviewWorld.test.ts` | suite-error | 0.0s |
| `aiActivityLiveRow.test.ts` | 미측정 | — |

종류 집계: assertion 123 · timeout 2 · suite-error 8 · 미측정 1

마지막 줄 `aiActivityLiveRow.test.ts` 는 2026-09-13 격리분이 아니다. 영역 작업 창을 폐기한
`24f204623 feat(editor): 우클릭 드래그 바는 곧바로 채팅 턴으로`(2026-09-25)에서 옛 영역 경로
의존 때문에 격리됐고, 그 커밋은 규칙상 테스트를 돌리지 않았으므로 실패 종류·CPU 시간이 없다.

## 원장에서 뺀 행 (2026-09-25 정정)

원장이 156개라고 적어 두었지만 디스크의 `*.quarantine.test.ts` 는 134개였다. 차이 23개는
**폐기된 기능과 함께 테스트 파일 자체가 삭제된 것**이다 —
`91c4e105f test(persistence): 퇴역에 맞춰 테스트를 이관·폐기하고 /rest/v1 금지·모듈 부활 금지 가드를 단다`
(2026-09-17). 원장은 재진입 작업목록이므로 없는 파일을 가리키는 행은 다음 에이전트를 빈 경로로
보낸다. 그래서 아래 23행을 목록에서 뺐다. 되돌릴 대상이 아니라 **이미 처리가 끝난 항목**이다
(위 「왜 삭제하지 않았나」의 "폐기된 기능을 검사하는 것이 확인되면 그때 파일을 지운다" 경로를 탄 결과).

`spatialStoreActivation` · `transactionalRemoteSourceLineage` · `audioDescriptionConcurrentPersistence` ·
`spatialActivationSafety` · `aiStaleProposal` · `storeDeferredLineage` · `storePersistence` ·
`storeLifecycleReentrancy` · `aiNewGoalEarlyOwnership` · `projectWikiDelivery` · `aiOutcomeEntryOwnership` ·
`monsterMetadataPersistence` · `interiorLoadConsistency` · `spatialRecoverySignals` · `spatialStoreTransactions` ·
`aiOutcomeContinuationDelivery` · `aiRunOutcomeApply` · `lakeVillageCenterRebuild` · `aiRunOutcomeLifecycle` ·
`aiOutcomeApplyPolicy` · `lakeVillageTwoMaps` · `aiRunOutcomeOwnership` · `roundLakeStamp`

원장을 고칠 때는 수를 손으로 세지 말고 실측한다:

```bash
find test -name '*.quarantine.test.ts' | wc -l
```
