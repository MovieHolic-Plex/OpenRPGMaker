# Actual-base gate comparison

All 167 supervisor failures are accounted for. The paired runs each cover all 91 failed suites. See `classification.json` for every assertion and its exact normalized base/current diagnostic.

| Suite | Supervisor failures | Classification / actual error |
| --- | ---: | --- |
| `test/actionDebounceFootprint.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: Cannot read properties of undefined (reading 'registry') |
| `test/actorBattleAuthoringSurface.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected null to be truthy |
| `test/actorCombatCommandBodies.test.ts` | 3 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: Cannot read properties of undefined (reading 'fields') |
| `test/aiActivityNarration.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: author_world_bridge 도구의 활동 문구 패밀리를 명시적으로 결정해야 함: expected false to be true // Object.is equality |
| `test/aiAssistantAfterUx.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: window.dispatchEvent is not a function |
| `test/aiChatObservability.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected null to be truthy |
| `test/aiChatPanelTransportError.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected null to be truthy |
| `test/aiChatPanelUxRepairs.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; Error: STACK_TRACE_ERROR |
| `test/aiImageGenerateField.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected +0 to be 1 // Object.is equality |
| `test/aiImageGenerateQueue.test.ts` | 6 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '프롬프트를 입력하면 여기에 쌓입니다. 만드는 동안에도 계속 추가할 …' to contain '고블린' |
| `test/aiPlacementCutsceneCheckpoint.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ { …(10) } ] to have a length of 2 but got 1 |
| `test/aiProposalCardUxd.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: window.dispatchEvent is not a function |
| `test/aiSelectionChipScope.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 'block' to be 'none' // Object.is equality |
| `test/appStorageMigration.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: 구 접두사 1건: |
| `test/authorHouseFacade.test.ts` | 4 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected { executionOk: true, …(12) } to deeply equal { …(13) } |
| `test/autosaveStatus.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: Cannot read properties of null (reading 'getItem') |
| `test/autotileGroupPersistence.test.ts` | 3 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '{"version":4,"meta":{"title":"새 프로젝트"…' to be '{"version":4,"meta":{"title":"새 프로젝트"…' // Object.is equality |
| `test/battleElementAdversarialFixes.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 9 to be 16 // Object.is equality |
| `test/changePartyCommandBody.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected null not to be null |
| `test/clusterRulePlacement.test.ts` | 5 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected -1 to be 260 // Object.is equality |
| `test/commandKindCoverage.test.ts` | 3 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ 'addFollower', 'addLight', …(76) ] to deeply equal [ 'addFollower', 'addLight', …(77) ] |
| `test/commentCommandBody.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected null to be truthy |
| `test/databaseAnimationPreview.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 'false' to be 'true' // Object.is equality |
| `test/databaseItemInspector.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '⚔착용 장비는 별도 항목으로 만듭니다이 항목은 이전 형식의 비착용 …' to contain '장비 탭' |
| `test/databaseKoreanRtpDefaults.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 'import { renderGrowthTreeTab } from "…' to contain '배틀러 애니메이션' |
| `test/databaseRadioCustomGuard.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: bare input 결합이 radio 까지 함께 칠한다: expected [ Array(1) ] to deeply equal [] |
| `test/databaseSkillAnimationStage.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '1' to be '2' // Object.is equality |
| `test/defaultAdventureGame.test.ts` | 3 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '이슬 장터 — 30분' to be '이슬 마을의 종' // Object.is equality |
| `test/defaultDatabase.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ 'equip_sword', …(85) ] to deeply equal [ 'equip_sword', …(10) ] |
| `test/defaults.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 'lower' to be 'upper' // Object.is equality |
| `test/demoTeach.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '[시연] 내가 타일을 직접 깔면서 보여줍니다. 텍스트 대신 이 시연…' to contain '집 구조물 문법은 하네싱 키트가 담당' |
| `test/detsukuruBrandStrings.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: 금지 표현 6건: |
| `test/devShowcaseProjects.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '이슬 장터 — 30분' to be '이슬 마을의 종' // Object.is equality |
| `test/emberQuestGame.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ 'enemy_cave_bat', …(3) ] to deeply equal [ 'enemy_cave_bat', …(4) ] |
| `test/eventCommandPickerHandoff.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected null not to be null |
| `test/eventEditorCommandLabels.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ Array(79) ] to deeply equal [ Array(78) ] |
| `test/eventEditorCommitProbe.baseline.test.ts` | 3 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: [커밋 프로브] 하한선 위반 |
| `test/eventEditorConditionSurface.baseline.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: [조건/열거값] 표면이 기준선과 다르다 (24건) |
| `test/eventEditorFormSurface.baseline.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: [폼(kind)] 하한선 위반 |
| `test/eventEditorInteractionSurface.baseline.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: 반응 퇴화 13건 — 조건부 표시/재렌더 로직이 죽었는지 확인하라 (change 핸들러 안의 syncVisibility 계열 호출, 조건부 렌더 분기가 살아 있는지). 컨트롤을 의도적으로 없앴다면 <repo>/test/fixtures/interactionNoChangeAllo |
| `test/eventEditorM2Surface.baseline.test.ts` | 1 | U14 five-entry migration complete; remaining failure identical to actual base; AssertionError: [M2(commandId)] 하한선 위반 |
| `test/eventEditorPortalSurface.baseline.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: [포털(피커/모달)] 표면이 기준선과 다르다 (3건) |
| `test/eventEditorShowAnimationPreview.test.ts` | 3 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '1' to be '2' // Object.is equality |
| `test/eventEditorTrustLoop.test.ts` | 4 | pre-existing; same failing assertion and diagnostic on actual base; ReferenceError: window is not defined |
| `test/eventEditorUiDensity.test.ts` | 5 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a wea |
| `test/fontFamilyTokenGuard.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ …(2) ] to deeply equal [] |
| `test/forestDensity.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: 영역의 30% 가 아직 걸어서 통과된다: expected 0.3003472222222222 to be less than 0.3 |
| `test/gen1DemoContent.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: actual value must be number or bigint, received "undefined" |
| `test/genrePackReceiptCli.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '{\n  "ok": false,\n  "projectRevision…' to contain '"status": "incomplete"' |
| `test/houseLotTools.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: 가방·미등록으로 시공 불가한 yard 태그: flowers("꽃"): expected [ 'flowers("꽃")' ] to deeply equal [] |
| `test/houseProtectionForest.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: Cannot read properties of undefined (reading 'type') |
| `test/interiorAutotile.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '50:nw@429,ne@430,sw@429,se@371' to be '50:nw@429,ne@430,sw@429,se@430' // Object.is equality |
| `test/interiorBench.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: t3-floor composite: expected 0.9333333333333332 to be greater than or equal to 0.999 |
| `test/interiorTerrainAutotiles.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected true to be false // Object.is equality |
| `test/interiorWallFrameQuarterComposition.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected { sources: [ { …(4) }, …(3) ] } to be null |
| `test/interpreter.test.ts` | 1 | U14 obsolete ambient contract corrected; BGS gain and untouched BGM asserted; passed |
| `test/io.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '{"version":4,"meta":{"title":"새 프로젝트"…' to be '{"version":4,"meta":{"title":"새 프로젝트"…' // Object.is equality |
| `test/koreanLocalizationDefaults.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ Array(106) ] to have a length of 29 but got 106 |
| `test/layerRouting.m1.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 243 to be 303 // Object.is equality |
| `test/mapEditCommands.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 263 to be 319 // Object.is equality |
| `test/modalEscapeLayerGate.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: body 에 띄운 새 오버레이가 Escape 계층에 참여하지 않는다. registerModal/unregisterModal 을 짝지어 쓰거나, 정말 계층이 아니면 EXEMPT 에 이유를 적어라.: expected [ 'panels/newProjectDialog.ts' ] to |
| `test/modeTransitions.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: Cannot set properties of undefined (setting 'testid') |
| `test/monsterCollection.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected undefined to be 'victory' // Object.is equality |
| `test/noLocalProjectDb.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ Array(1) ] to deeply equal [] |
| `test/pkmnBalanceB6.test.ts` | 7 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 0 to be greater than or equal to 0.6 |
| `test/playerRuntimeCss.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected true to be false // Object.is equality |
| `test/pokemonChipsetPreset.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 304 to be 303 // Object.is equality |
| `test/quickAuthoringPreviewIdentity.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected null not to be null |
| `test/regionAiHouseTreeNpc.probe.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected false to be true // Object.is equality |
| `test/regionTaskCssTokens.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: region-task.css 에 bare-white #fff/#ffffff 잔존: lines 1211, 1304 — 포커스 링을 토큰으로 교체 필요.: expected [ 1211, 1304 ] to deeply equal [] |
| `test/rm2003DatabaseUtilityRecords.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected { id: 'terrain_grassland', …(6) } to match object { id: 'terrain_grassland', …(4) } |
| `test/roleNameComparisonGate.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ …(2) ] to deeply equal [] |
| `test/scarloxyPokemonDemo.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ { …(9) }, { …(9) }, { …(9) }, …(16) ] to have a length of 16 but got 19 |
| `test/scatterObject.test.ts` | 6 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [] to have a length of 8 but got +0 |
| `test/setGroupLayout.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected -1 to be 290 // Object.is equality |
| `test/storePersistence.test.ts` | 6 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected "spy" to not be called at all, but actually been called 1 times |
| `test/teamWorkflowUi.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: window.addEventListener is not a function |
| `test/tileFlowApprovalExpansion.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected undefined to be defined |
| `test/tileGrafts.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '{"version":4,"meta":{"title":"새 프로젝트"…' to be '{"version":4,"meta":{"title":"새 프로젝트"…' // Object.is equality |
| `test/tileLayerClassification.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 'upper' to be 'both' // Object.is equality |
| `test/tilesetAiWorkspaceModal.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; TypeError: matching.matches is not a function |
| `test/tilesetHarness.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected false to be true // Object.is equality |
| `test/tilesetPaletteT1a.test.ts` | 3 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '당신은 브라우저 기반 2D RPG 에디터의 개발 어시스턴트입니다.\…' to contain '낮은 신뢰(confidence<0.5) 타일 1개' |
| `test/tilesetWave2Undo.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected { up: false, down: false, …(2) } to not deeply equal { up: false, down: false, …(2) } |
| `test/toolCatalog.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '# 툴 카탈로그 (자동 생성)\n\n> 이 문서는 `src/edit…' to be '# 툴 카탈로그 (자동 생성)\n\n> 이 문서는 `src/edit…' // Object.is equality |
| `test/unsavedChangesGuard.test.ts` | 2 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 'saved' to be 'saved-local' // Object.is equality |
| `test/uxcEditorShell.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected '빈 맵2, 2새 이벤트 · 취소 시 삭제 · 자동 저장 · 저장 준…' to contain '새 이벤트 (저장 전)' |
| `test/viteConfig.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected 'import { defineConfig, loadEnv, type …' to contain 'host: "::"' |
| `test/commandContracts/coverage.test.ts` | 5 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: setRelationship.contract.test.ts 가 없습니다. 계약 테스트를 작성하거나(권장) 화이트리스트에 명시하세요.: expected false to be true // Object.is equality |
| `test/commandContracts/evolveMonster.contract.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected undefined to be +0 // Object.is equality |
| `test/commandContracts/registry.test.ts` | 1 | pre-existing; same failing assertion and diagnostic on actual base; AssertionError: expected [ 'addFollower', 'addLight', …(75) ] to deeply equal [ 'addFollower', 'addLight', …(77) ] |

## Remaining surface failures

The final M2 diagnostic exactly equals base: `m2-019-change-state.classCount 29 < 30`, plus seven existing differences in 019/022/023/024/025/069/091. No unrelated baseline entry or floor was changed.

CSS-live exits 1 on both and its logs are byte-identical. The same 12 weighted-branch classes are missing from its stale canonical baseline; no CSS or CSS baseline was changed.

Condition, portal, form, interaction and commit-probe surface failures reproduce on base with the same diagnostics. Embedded stack source coordinates differ only because U14 inserted lines above the unchanged removeFollower body.

## No production fix or blanket regeneration

Only `test/interpreter.test.ts`, `test/eventEditorM2Surface.baseline.test.ts` and five entries each in the M2 baseline/floor were changed in this gate review. Interpreter now asserts BGS volume 0.65, no ambient engine slot, and untouched preexisting BGM. M2 adds exact music/sound membership, supported slot/channel values, no dead memory inputs, and explicit retention in the snapshot axis. Existing engine and real-player regressions remain intact.

The complete base was extracted with `git archive a79a04bbd` into an isolated directory, using the same installed dependencies and env config. No reset/stash or source swaps occurred. JSON report parsing uses Python because reports exceed the read tool single-line limit.

The full gates remain red due to proven pre-existing failures; this is a reasoned actual-base comparison, not acceptance based on the stale `.omo/gates-baseline.json` file.
