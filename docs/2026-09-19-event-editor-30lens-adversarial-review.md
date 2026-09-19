# 이벤트 편집기 30렌즈 적대적 리뷰 — 기능·UX·AX·DX (2026-09-19)

## 방법

- GLM 5.3 Flash 서브에이전트 30개가 렌즈 1개씩 맡아 정적 분석으로 적대적 리뷰했다(기능/UX 16, AX 7, DX 7). 세션 모델(zcode/glm-5.3-flash) 워커를 그대로 사용했다 — GLM 전용 `review` 서브에이전트 레인은 401 Authentication Failed(30/30 즉사)로 폐기.
- 각 에이전트는 read/grep/glob만 사용, 발견 최대 5건, 모든 발견에 file:line+코드 인용을 요구받았다. 2026-09-17 실측 리뷰(`docs/2026-09-17-event-editor-authoring-adversarial-review.md`)의 18건은 dedupe 리스트로 주어 신규 결함을 우선하게 했다.
- L02(삽입·재배치)는 JSON 스키마 위반으로 발행에 실패해 트랜스크립트에서 회수했고, 주장 중 1건은 코드 대조로 기각했다(§I).
- 145건 수집 → 감독자(본 문서 저자)가 전 건의 증거 인용을 원본과 대조 검증: **423/430(98%) 그대로 확인, 근거 소실 0, 좌표 미세 이동(>20줄) 15건은 파일 이동으로 판정**. 이후 교차 중복 8쌍 병합, 기각 2건, 아래 채택.

## 요약

| 등급 | 기능 | UX | AX | DX | 합계 |
|---|---|---|---|---|---|
| P1 | 16 | — | 8 | 4 | 28 |
| P2 | — | 39 | 13 | 25 | 77 |
| P3 | 1 | 1 | 4 | 13 | 19 |

P1은 "데이터 유실·기능 파탄·접근 불가"다. 최다 뭉치는 **드래프트/삭제 수명주기의 유실 경로**(A1–A4)와 **편집기↔런타임 괴리**(A5–A11: 미리보기 시뮬·Tint 단위·선택지 취소·계절 가격·전투 피커)다. AX P1 8건은 전부 키보드·스크린리더 조작 불가다. DX P1은 데이터 경계(m2Command 무검증), 토큰 hex 사본, 도움말 입구 부재, 서브다이얼로그 660px 하드픽셀이다.

## A. P1 — 기능·데이터 (사용자가 만든 것과 게임이 달라지는 것)

**A1. 이벤트 삭제가 미적용 드래프트 편집을 무경고 파괴하고 복구 약속은 수정 전 본문만 되살림**

- 근거: `src/editor/eventDeletion.ts:9` · `src/editor/eventDeletion.ts:20-21` · `src/project/eventDrafts.ts:44-45`
- 문제: 편집기 푸터 「이벤트 삭제」(modal.ts:684-685)와 목록 삭제가 적용 전 드래프트 작업본을 전부 파괴한다. 삭제 확인은 네이티브 confirm 한 번뿐이고 문구는 삭제 자체만 물으며 「복구/Ctrl+Z로 되돌릴 수 있다」고 약속하지만, recordProjectSnapshot이 찍는 before는 mapWithCommittedEvents라 편집 초안은 draft.original(수정 전 본문)로 스냅샷되고 new 초안은 아예 제외된다. 여기에 금고 엔트리를 삭제 직전에 지우므로 복구 시 되살아나는 것은 수정 전 이벤트뿐이다. 최소화 상태에서 목록 삭제를 하면 열린 편집기가 store 구독을 타고 closeHandler(true)로 조용히 닫히며(minimize 중에도 구독 생존, modal.ts:371-374) 칩만 사라진다. 적용 안 된 30분치 명령·페이지 편집이 회복 불가로 소실되는 최우선 유실 경로.
- 제안: eventDeletion.ts deleteEditorEvent에서 eventDraftHasUserChanges가 true면 네이티브 confirm 대신 showConfirm으로 「적용하지 않은 편집도 함께 삭제됩니다」를 고지하거나 삭제를 차단. 복구 신뢰성을 위해 삭제 시점 live 본문을 별도 슬롯(예: vault에 tombstone 엔트리)에 보존해 복구 액션이 작업본 기준으로 되살리게 하고, 스냅샷은 기존 mapWithCommittedEvents 규약을 유지.

**A2. new 드래프트가 에디터 없이 남으면 좀비 이벤트가 된다 — 모든 열기 입구가 무반응**

- 근거: `src/project/store.ts:1368-1370` · `src/editor/eventDraftActions.ts:54` · `src/editor/panels/eventEditor/modal.ts:66-68`
- 문제: 새 이벤트 작성 중 크래시·새로고침이 나면 adoptProject(restoreVault:true)가 vault의 draft.kind="new" 이벤트를 되살려 맵에 마커로 보이지만, 모든 열기 입구(맵 더블클릭·이벤트 목록·검색·월드매니저)가 openEventEditorModal로 수렴하고 beginExistingEventDraft가 kind="new"를 거부해 modal.ts:67에서 침묵 귀환한다. closeHandler(true) 경로(프로젝트 전환·이벤트 부재)는 draft를 폐기하지 않고 에디터만 닫아(416행은 !saved일 때만 폐기) 같은 좀비를 만들며, 해당 타일은 점유돼 새 이벤트 생성도 막힌다. 삭제하면 undo 스냅샷(committed가 new 초안 제외)에도 없어 완전 소실한다.
- 제안: beginExistingEventDraft에서 draft.kind==="new"도 세션 재개를 허용해 openDraftEventEditorModal로 진행한다. 진입 실패 시 복구 안내 토스트+「이어서 편집/폐기」 대화상자로 침묵 경로를 제거하고, closeHandler(true) 종료 시 new 드래프트의 남김/폐기 정책을 명문화한다.

**A3. 최소화 중 프로젝트 가져오기가 확인 없이 열린 드래프트와 금고를 통째로 소각**

- 근거: `src/editor/panels/menu.ts:1110-1111` · `src/project/store.ts:774` · `src/editor/panels/eventEditor/modal.ts:366-367`
- 문제: 가져오기 입구(doImport → replaceProjectFromJson/Package)에는 확인 대화상자가 없다. 데모 로더들은 전부 showConfirm(danger)으로 「현재 작업을 지우고」를 묻는 반면(menu.ts:893 등) 가져오기는 파일 선택 즉시 store.replaceProject를 호출한다. replaceProject는 clearEventDraftVault로 localStorage 체크포인트까지 소각하고 preserveEventDrafts:false로 live 작업본을 폐기한다. 최소화된 편집기(백드롭 숨김, 메뉴 접근 가능)의 store 구독이 identity 변경을 보고 closeHandler(true)로 닫히는데, 이 경로는 requestClose의 더티 가드를 우회하므로 미적용 편집 전부가 무경고로 사라지고 칩만 제거된다. 「버리고 닫기」조차 묻지 않는 유일한 닫기 경로.
- 제안: menu.ts replaceProject에 데모 로더와 동일한 showConfirm(danger) 도입. 나아가 store.replaceProject 진입 시 열린 드래프트 존재 여부(eventDraftHasUserChanges 요약)를 문구에 승격하고, 최소화 칩이 붙어 있으면 「이벤트 편집 중: …」을 명시해 교체 전 작업 보존을 유도.

**A4. 드래프트 복원이 이벤트 전체를 통째로 덮어써 원격 변경 유실·삭제 이벤트 부활이 무경고로 일어난다**

- 근거: `src/project/eventDraftVault.ts:107-109` · `src/project/store.ts:556` · `src/project/store.ts:1305`
- 문제: flush·병합·스냅샷 채택(store.ts:556·655·688·755)이 incoming 프로젝트 위에 라이브 드래프트와 금고 항목을 이벤트 단위로 통째로 대체/추가한다. 베이스라인·개정 비교도 충돌 프롬프트도 없어, (a) 다른 기기가 같은 이벤트에 커밋한 변경이 작업 사본에서 즉시 지워지고 다음 저장에서도 사라진다(제출 본문은 projectWithoutEventDrafts — store.ts:1305), (b) 다른 탭/기기에서 삭제된 이벤트가 금고 push 경로로 되살아나 다음 저장에 반영된다. discardEventDraft가 스테일 original로 되돌리는 것도 같은 뿌리다.
- 제안: applyEventDraftVault/projectWithLiveDrafts의 replace·push 전에 드래프트 original과 incoming 본문을 비교해 불일치하면 충돌 다이얼로그(내 편집 유지/상대 수용/사본 내보내기)를 띄운다. 존재하지 않는 이벤트 부활은 updatedAt과 삭제 사실(부재)을 근거로 1회 확인을 요구하거나 기본 스킵으로 바꾼다.

**A5. 새 페이지 추가가 '조건 없음 + 최우선 배치'라서 클릭 한 번에 기존 페이지가 런타임에서 몰래 가려진다**

- 근거: `src/editor/eventPages.ts:127-128` · `src/project/io/pageResolution.ts:36-37` · `src/project/io/pageResolution.ts:38-38`
- 문제: 탭 끝 + 버튼이 만드는 새 페이지는 조건 0개(빈 배열 every = 항상 참)이면서 배열 맨 끝, 즉 최고 우선순위다. 런타임 규칙은 '뒤에서부터 조건이 맞는 첫 페이지 승리'(pageResolution.ts:36-42)라서 추가 즉시 새 빈 페이지(그래픽·명령 없음)가 게임에서 승자가 되고 기존 페이지의 그래픽·대사가 전부 가려진다. 복제에는 '지금은 원본이 먼저 이겨요' 토스트가 있지만 추가에는 사용자 피드백이 전혀 없고, 검증기도 그림·명령·조건이 모두 없는 untouched 페이지를 경고 대상에서 제외하고(eventDraftValidator.ts:286-289) 페이지 간 가려짐 진단은 AI explain 용 storyEventExplain.ts:349 에만 존재해 사람 편집 화면에서는 아무도 잡아주지 않는다. 도움말 노트조차 '빈 조건 페이지는 보통 첫 페이지에 둔다'고 말해 시스템 자문과 모순된다.
- 제안: (1) addEventPage 의 push 를 '현재 선택 페이지 바로 앞 splice'로 바꿔 복제·붙여넣기와 같은 낮은 우선순위 삽입 계약으로 통일하고, (2) pageProps.ts:382 클릭 핸들러에 복제와 동일한 형식의 토스트(예: '조건 없는 새 페이지를 마지막에 추가했어요 — 지금부터 게임에서는 이 페이지가 이겨요.')를 붙이며, (3) eventDraftValidator.validatePage 순회 뒤에 '마지막 페이지가 조건 없음 + 그 앞에 내용 있는 페이지 존재'이면 warning(page.shadowed-empty-last)을 내는 검사를 추가한다. 최소 (2)는 즉시 적용.

**A6. 전투 이벤트 피커가 맵 규칙으로 선택 가능 집합 판정 — 전투 전용 명령 10종 삽입 불가**

- 근거: `src/editor/panels/eventEditor/commandPicker.ts:273` · `src/project/eventCommands/m2Catalog.ts:181-184` · `src/project/eventCommands/m2RuntimeClassificationData.ts:178-179`
- 문제: 피커의 선택 가능 판정은 request.context 를 완전히 무시하고 isM2CatalogEntrySelectableInMap 만 쓴다. 그 결과 트룹(전투) 이벤트 피커에서 index 98–108 전투 전용 행(적 HP/MP/상태 변경, 적과 싸우기, 전투 이벤트, 전투 중단, 강제 도망, 행동 횟수 추가 등 10종)이 selectable=false 가 되어 탭 2 그리드에서 아예 빠지고, 검색에서만 "여기서는 고를 수 없습니다"+"다른 곳: 명령 목록 삽입" 정보 행으로 나온다. 그런데 이 행들은 M2_TROOP_FULL_IDS 로 전투 실행기가 실제로 실행하는 명령이고, 전투 컨텍스트용 판정 함수 isM2CatalogEntrySelectableInBattleEvent 가 m2Catalog.ts 에 존재하지만 호출부가 0개인 죽은 코드다. 배지는 context 를 반영해 "전투에서 돈다"고 말하는 반면 입구는 막혀 있어 정보가 서로 모순된다. 덧붙여 databaseCommandListAdapter.ts:124 는 troop 피커 제목도 하드코딩된 "공통 이벤트 명령"으로 잘못 표시한다.
- 제안: commandPicker.ts 의 commandEntryFromCatalog 에 picker context 를 전달해 맥락별 판정으로 교체할 것 — context==="troop" 이면 isM2CatalogEntrySelectableInBattleEvent, 그 밖은 기존 함수. 같은 파일 databaseCommandListAdapter.ts:124 의 제목도 context 에 따라 "전투 이벤트 명령" 등으로 분기. 배지(commandRuntimeSupportDescriptor)는 이미 context 를 받으므로 같은 값을 selectable 판정에 흘려보내면 된다.

**A7. 상태 변경 명령 대부분이 시뮬레이션에서 무시되어 뒤따르는 조건 분기 판정이 시작 세션 기본값으로 확정된다**

- 근거: `src/editor/panels/eventEditor/previewSimulation.ts:382-383` · `src/editor/panels/eventEditor/previewSimulation.ts:253-254` · `src/player/interpreter/commandCatalog.ts:497-498`
- 문제: applyCommandToState 는 switch/variable/gold/item/party/selfSwitch/flag/changeFace(·craftRecipe)만 반영하고 timer·setTime·advanceTime·sleepUntilMorning·changeFriendship·changeActorHp·runControl 등은 default 로 버린다. 그런데 evalForkCondition 은 insideLocation 외에는 항상 then/else 를 확정 돌려준다. 실증: [타이머 60초 설정 → 분기(타이머≤5초)] 페이지에서 프리뷰는 startSession 기본 timers(0)로 0≤5=true 를 읽어 then 분기를 「실행」으로 표시하고 else 분기에 「실행되지 않는 분기」 배지를 붙인다. 런타임(commandCatalog.ts:497-498)은 setTimer(60) 후 60≤5=false 로 else 를 실행한다. battleResult·timePhase(수면 후)·friendshipAtLeast(changeFriendship 후)도 동일하게 거짓 확정 판정을 내며, 저작자가 이 배지를 믿고 맞는 분기를 지우면 실제 콘텐츠가 깨진다.
- 제안: previewSimulation.ts 의 applyCommandToState 에 timer/setTime/advanceTime/sleepUntilMorning/changeFriendship 등 상태 갱신 케이스를 런타임과 1:1로 추가하거나, conditionNeedsMap(257-269)을 conditionNeedsUnsimulatedState 로 확장해 timer·timePhase·season·friendshipAtLeast·relationshipAtLeast·battleResult·run·npcActivity 조건은 선행 명령 구성에 따라 unknown 경로로 돌려 「판정 불가」 배지를 보여준다. 최소한 이미 존재하는 unknown 메커니즘(251)을 재사용하면 된다.

**A8. Tint Screen 전환시간 3중 단위 해석: 다이얼로그 ms·목록 미리보기 ms/300폴백·런타임 ≤60=초**

- 근거: `src/project/eventCommands/m2Catalog.ts:479` · `src/player/interpreter/m2Runtime.ts:321-322` · `src/editor/panels/eventEditor/commandPreview.ts:1353`
- 문제: 색조 전환 시간이 표면마다 다르게 해석된다. 편집 다이얼로그는 값을 ms로 취급해 45 입력 시 프리뷰에 "0초 전환"(durationPhrase가 ms 가정)을 보여 주고, 명령 목록 미리보기는 45ms 애니메이션을 그리지만, 실제 런타임 toDurationMs는 60 이하를 '초'로 판단해 45초(45,000ms)로 변환한다. 0 입력 시 다이얼로그는 "즉시 전환", 런타임은 0, 목록 미리보기는 300ms 폴백 — 같은 저장값에 세 가지 연출이 나온다. 같은 피커 페이지의 Flash/Shake는 durationMs(ms)를 쓰므로 45ms 의도 입력이 45초가 되는 침묵 손상이다.
- 제안: 필드 키를 durationMs(ms 정본)로 통일한다 — commandCatalog.ts:998이 이미 durationMs 우선 폴백을 갖고 있다. m2Runtime.ts:320 toDurationMs의 ≤60 초-판단 휴리스틱을 제거하고, 기존 저장값은 io 마이그레이션에서 1회 변환(≤60 → ×1000)한다. 단기 완화로 tintScreenBody 라벨에 "ms" 명시 + renderPreview가 toDurationMs와 같은 해석을 쓰게 맞춘다.

**A9. cancelBehavior 미설정 선택지를 폼은 「선택지 2」로 표시하지만 런타임은 취소를 무시한다**

- 근거: `src/editor/panels/eventEditor/commandBodyChoices.ts:58` · `src/player/dialogue.ts:943` · `src/editor/tools/storyArcTools.ts:70`
- 문제: cancelBehavior 가 undefined 인 choices(AI 스토리 아크 생성(storyArcTools.ts:70), V1 임포트(eventCompile.ts:507-511)로 다수 존재)를 폼에서 열면 normalizeCancelBehavior(cmd.cancelBehavior ?? "choice2") 때문에 「선택지 2」 라디오가 체크된다. 그러나 런타임은 undefined 를 취소 없음(disallow)으로 처리한다(commandCatalog.ts:476 이 원값 전달 → dialogue.ts cancelChoiceIndex null 반환). 저작자는 Esc 가 2번 선택지로 빠진다고 믿지만 실제 게임에서는 아무 일도 없다. 요약 줄(commandSummary.ts:1067 `if (!behavior) return ""`)까지 세 표면이 서로 다른 값을 말한다. eventDraftValidator 도 choices 를 검증 없는 fallthrough(eventDraftValidator.ts:1103-1104)로 두어 안전망이 없다.
- 제안: commandBodyChoices.ts:58 의 `?? "choice2"` 를 제거하고 undefined 를 런타임 계약과 동일한 「취소 없음」 체크 상태로 표시한다. 대안으로 생성/임포트 경로(eventCompile.ts, storyArcTools.ts 등 전부)에서 cancelBehavior 를 명시 기록하게 정규화하고 폼은 저장된 값만 표시한다. commandSummary.ts:1067 도 behavior 없으면 "취소 없음" 으로 렌더해 세 표면을 일치시킨다.

**A10. 선택지 6개 이상 명령을 폼에서 편집하면 초과 옵션과 분기 본문이 조용히 삭제된다**

- 근거: `src/editor/panels/eventEditor/commandBodyChoices.ts:244-245` · `src/editor/panels/eventEditor/commandBodyChoices.ts:272-273` · `src/project/types/events.ts:280`
- 문제: 편집기는 MAX_CHOICE_OPTIONS=5 로 행을 그리고(normalizeOptions slice), 옵션 텍스트를 한 글자만 고쳐도 readOptionsFromDom 이 보이는 5개 행 기준으로 명령 전체를 재작성한다. 그런데 런타임과 타입에는 개수 상한이 없고(events.ts:280, dialogue.ts:559 전부 렌더, resume.ts:29-31 전부 실행), 임포트/AI 생성물은 6개 이상 선택지를 가질 수 있다. 이 상태로 폼에서 아무 옵션이나 수정하면 6번째 옵션과 그 branch 본문이 경고 없이 영구 삭제된다. 왼쪽 명령 목록에는 6번째 분기 마커가 eventCommandBranches.ts:69-75 에 의해 여전히 보이므로, 저작자는 본문이 살아 있다고 믿은 채 폼에서 텍스트만 고치다 본문을 잃는다.
- 제안: 절단을 렌더 제한으로만 유지하고 데이터는 보존한다: normalizeOptions/readOptionsFromDom 의 slice 를 제거하고 6개 이상일 때는 폼 상단에 "N개 중 5개만 표시 — 저장하면 나머지 분기가 삭제됩니다" 경고를 띄운 뒤 커밋 시에만 확인을 받는다. 장기적으로는 eventCompile 임포트 시 초과 선택지를 fork 변환하거나 임포트 warning 을 남긴다.

**A11. 계절별 가격(priceBySeason)이 편집기·미리보기 어디에도 실제 판매가로 표시되지 않고, 시각 편집 수단도 없음**

- 근거: `src/editor/panels/eventEditor/shopEditorGoods.ts:69` · `src/project/shopStock.ts:124-125` · `src/editor/panels/eventEditor/commandPreview.ts:865`
- 문제: 런타임은 계절별 가격(priceBySeason)을 최우선으로 청구하지만(shopStock.ts:124-125, interpreter/commandCatalog.ts:640 resolvePricedShopStock 경유), 상품 행·상세·명령 미리보기는 전부 `priceOverride ?? 기본가`만 계산한다. priceBySeason이 설정된 상점이면 저작자는 실제 판매가와 다른 숫자를 보고 가격 결정을 하고, 계절별 가격은 상세 패널의 안내 문구 한 줄(shopEditorGoods.ts:172) 외에는 값 조회·수정·삭제 수단이 없다(AI 도구 eventTools.ts:1185 와 스키마 커스텀 필드로만 저작 가능).
- 제안: 행 가격·shopStage 가격 계산을 shopStock.stockEntryPrice(entry, 현재 계절)로 통일하고, stockEditor에 계절별 가격 편집(계절 칩→가격 입력) 또는 최소한 '계절별 가격 있음' 배지를 클릭해 실값 보기/초기화하는 버튼을 추가한다. shopEditorGoods.ts:160의 warning처럼 우선순위(계절 > 직접 지정 > 기본)를 경고문에 명문화한다.

**A12. 적용(이대로 하기)이 생성 시점 스냅샷으로 현재 목록을 통째로 교체 — 재검증 없음**

- 근거: `src/editor/panels/eventEditor/aiAssist.ts:486-487` · `src/editor/panels/eventEditor/aiAssist.ts:422` · `src/editor/panels/eventEditor/commandDiff.ts:349-351`
- 문제: 생성 완료 시점에는 livePage.commands와 beforeCommands를 비교해 변경을 감지하지만(422행), 적용 버튼에서는 같은 검증이 없다. applyCommandDiff는 diff 행에 캡처된 before/after 스냅샷으로 전체 목록을 재구성하므로, 초안이 대기 중인 동안 사용자가 툴바 ↶ 되돌리기를 누르거나 인스펙터에서 명령을 고치거나 다른 AI 세션이 이벤트를 편집하면 그 변경이 조용히 유실된다. 프리뷰의 「그대로」 행은 '현재 값을 유지한다'고 약속하지만 실제로는 생성 시점의 옛 값이 써지므로 미리보기와 결과가 어긋난다. 상태 문구는 "…반영했어요"뿐이다.
- 제안: applyBtn 클릭 핸들러에서 generate()의 beforeCommands 패턴을 재사용해 store의 현재 페이지 commands와 staged 기준 스냅샷을 비교하고, 불일치하면 적용을 막고 "목록이 바뀌었으니 다시 만들어 주세요" 상태로 diff를 폐기하라. 또는 apply 직전 diffCommandLists(현재 목록, applyCommandDiff 결과)를 재계산해 베이스라인을 리베이스하라.

**A13. append scope에서 모델이 기존 명령을 되출력하면 중복 검증 없이 그대로 덧붙어 이벤트 이중 실행**

- 근거: `src/ai/eventCommandAssist.ts:265` · `src/ai/eventCommandAssist.ts:415-416` · `src/editor/panels/eventEditor/aiAssist.ts:709`
- 문제: append scope에서는 모델이 기존 명령을 되출력해도 막는 장치가 프롬프트 규약 한 문장(7번)뿐이다. parseAndValidate의 배열 수준 검사는 빈 배열 여부가 전부고, withAppended는 출력 전체를 조건 없이 splice로 덧붙인다. 모델이 「최종 목록」 습관대로 기존 명령을 되돌려 주면 그것들이 add 행으로 미러링돼 「추가할 명령 미리보기」에 정상 추가처럼 보이고, 이대로 하기를 누르면 같은 명령이 두 개 삽입되어 아이템 이중 지급·대사 이중 실행 등 헤더 코멘트가 말하는 '이벤트가 두 번 실행' 결함이 append 경로로 재발한다. 자가수정 루프도 중복을 검증하지 않아 잡을 수 없다.
- 제안: append scope 파싱 단계(eventCommandAssist.ts parseAndValidate)에서 모델 출력 각 명령의 ownFieldSignature(commandDiff.ts)를 기존 목록 서명 집합과 대조하고, 일치 항목이 있으면 자가수정 오류(「기존 커맨드를 다시 출력했습니다 — 새 명령만 출력하세요」)로 되돌리라. 방어막으로 aiAssist의 diff 렌더에서 기존 keep 행과 서명이 같은 add 행에 「중복」 배지를 붙여 적용 전에 드러내라.

**A14. openNewEventEditorModal 동기 반환 계약 붕괴 — 가드 확인 경로에서 템플릿 명령 유실·무음 드롭**

- 근거: `src/editor/panels/eventEditor/modal.ts:72-81` · `src/editor/panels/eventEditor/modal.ts:89-90` · `src/editor/eventLayerContextMenu.ts:179-181`
- 문제: guardedCloseExistingEventEditorModal의 확인 대화상자는 비동기인데 openNewEventEditorModal은 동기적으로 created를 반환한다. 다른 이벤트 편집기에 변경이 남아 있어 「버리고 열기」 확인이 뜨는 순간 호출부는 즉시 ""을 받는다. eventLayerContextMenu.ts의 createTransferEvent(179)·createVehicleLocationEvent(214)는 반환 id로 transfer/vehicle 템플릿 명령을 붙이는데, id가 ""이면 그대로 return해 템플릿 명령이 조용히 유실되고 나중에 확인을 눌러도 템플릿 없는 맨 이벤트 편집기만 열린다. 확인을 취소하면 메뉴 동작이 아무 일 없었던 것으로 증발한다. 또한 switchGuard 진행 중(89)이나 다른 모달이 최상위일 때(90)는 next() 호출 없이 무음 반환되어 맵에서 이벤트를 클릭해도 아무 피드백 없는 죽은 클릭이 된다.
- 제안: modal.ts의 openNewEventEditorModal을 Promise<string>으로 바꾸거나 onOpened(eventId) 콜백 인자를 추가해 eventLayerContextMenu.ts의 두 생성기가 지연 생성된 id를 받아 템플릿 명령을 이어 붙이게 한다. 가드의 무음 return 두 곳(89-90)에는 toast로 상태를 알리는 공통 early-exit 헬퍼를 둔다.

**A15. replaceEventPageCommandAt 경계 검사 부재 + 변경 경로 전체의 write-mode 분기 생성 — 희소 배열·엉뚱 슬롯 교체·유령 분기**

- 근거: `src/editor/eventPages.ts:377-378` · `src/editor/eventPages.ts:356-357` · `src/editor/eventPages.ts:512`
- 문제: 같은 경로 기반 변경 함수군에서 방어 수준이 제각각이다. insertEventPageCommandAt은 인덱스를 클램프하고(357) move/delete는 범위를 검사하는데, replaceEventPageCommandAt만 list[lastIdx] = ... 을 경계 검사 없이 대입한다. 편집 대화상자·인스펙터가 잡아 둔 path가 되돌리기/다시 실행(replaceEventPageCommands 전체 교체)으로 리스트가 짧아지거나 재배열된 뒤 적용되면 ① 인덱스가 길이 밖이면 구멍(hole)이 있는 희소 배열이 만들어져 저장 시 null 명령으로 직렬화되고, ② 길이가 같으면 전혀 다른 슬롯의 명령을 덮어쓴다. 여기에 resolvePageCommandList가 모든 변경 함수에서 missingBranches:"create" 모드를 써서(512), delete/move/replace에 낡은 분기 path가 오면 대상이 없어도 cancelBranch·else 같은 유령 분기를 만들어낸다(mutator가 no-op이어도 store.update는 기록을 남기므로 감사 로그까지 오염된다).
- 제안: eventPages.ts의 replaceEventPageCommandAt에 lastIdx 범위 검사(0 ≤ lastIdx < list.length, 위반 시 return)를 추가한다. resolvePageCommandList는 기본을 read 모드로 바꾸고 create 모드는 addEventPageCommandAt 등 컨테이너 생성이 의도된 add 계열 호출부만 별도 인자로 쓰게 분리한다.

**A16. "+ 새 스위치/변수"가 기존 (빈 이름) 레코드를 납치해 개명한다 — 생성 표면과 참조 수 표시가 서로 모순**

- 근거: `src/editor/actions.ts:465-468` · `src/editor/panels/eventEditor/recordPickerPanel.ts:175-176`
- 문제: "+ 새 스위치/변수"는 addSwitch/addVariable(actions.ts:465-472, 497-500)이 이름 없는 첫 슬롯을 재사용하므로 새 레코드 생성이 아니라 기존 빈 이름 레코드의 개명일 수 있다. 그런데 패널은 이를 그냥 "생성"으로 보여 주고, 그 행의 참조 수 표시("쓰는 곳 N곳", recordPickerPanel.ts:412)가 그대로 붙는다. 저작자는 "방금 만든 스위치"가 이미 다른 이벤트 수곳에서 읽히는 것을 보고 혼란을 겪고, 그 상태로 명령을 박으면 기존에 그 스위치를 읽던 이벤트들이 의도치 않게 함께 동작한다(잘못된 배선 유도). 참조가 0인 빈 슬롯이면 재사용이 합리적이지만, 참조된 빈 이름 슬롯까지 조용히 납치한다.
- 제안: recordKinds.createRecord가 재사용 후보 슬롯의 참조 수를 createUsageCounter로 검사해 참조가 있는 빈 이름 슬롯은 건너뛰고 새 id를 발급하게 하고, 재사용 시에는 패널이 "빈 슬롯 #N 재사용"을 행·토스트로 명시한다. 최소한 actions.ts addSwitch/addVariable에 참조된 빈 슬롯 스킵 가드를 넣는다.

## B. P1 — 접근성 (키보드·스크린리더 사용 불가)

**B17. aria-activedescendant 부재 — 활성 옵션이 스크린리더에 전혀 공지되지 않음**

- 근거: `src/editor/panels/eventEditor/customSelect.ts:102-103` · `src/editor/panels/eventEditor/customSelect.ts:326-328`
- 문제: setActiveOption 은 is-active 클래스 토글과 scrollIntoView 만 하고, 트리거 키다운 경로(322-329, 364-371)는 focus=false 로 옵션 버튼에 포커스를 옮기지도 않는다. list(role=listbox)나 트리거 어디에도 aria-activedescendant 를 설정하지 않아(src/editor 전역 grep 0건), 키보드로 메뉴를 열면 포커스가 트리거에 머물고 하이라이트가 움직여도 스크린리더는 옵션 텍스트를 전혀 낭독하지 못한다. 메뉴 안 옵션 버튼용 keydown 핸들러(198-218)는 Tab 이 곧바로 closeMenu 로 팝오버를 지워버려 키보드 사용자는 도달 자체가 불가능한 죽은 코드다. 결과적으로 SR 사용자에게 드롭다운은 '열리기만 하고 탐색 불가능한' 위젯이다.
- 제안: customSelect.ts 의 setActiveOption 에서 대상 option 버튼에 nextSelectId() 기반 고유 id 를 부여하고 menu.list.setAttribute("aria-activedescendant", target.id) 를 함께 갱신한다. 포커스를 옵션 버튼으로 옮기는 경로(buildMenuOptions/search 의 focus=true 분기)는 제거해 '트리거 포커스 + activedescendant' 단일 모델로 수렴시키고, 필터 결과 수 공지용 role=status 라이브 리전을 popover 에 하나 둔다.

**B18. 트리거 aria-label 이 현재 선택값을 덮어씀 — SR 은 현재값을 들을 수 없음**

- 근거: `src/editor/panels/eventEditor/customSelect.ts:387` · `src/editor/panels/eventEditor/customSelect.ts:409-410`
- 문제: 트리거 버튼에 aria-label(필드 라벨만 담은 accessibleSelectName 결과)을 지정하면 이름 계산에서 버튼 내용물(현재 선택값을 보여주는 valueLabel 텍스트)이 완전히 덮인다. aria-label 은 enhanceSelect 시 1회 설정 후 sync() 에서 갱신되지도 않는다. 네이티브 select 는 '라벨 + 현재값'을 낭독하는데 커스텀 대체물은 '라벨'만 들리므로, SR 사용자는 매번 메뉴를 열어 aria-selected 를 확인하기 전까지는 현재 값이 무엇인지 알 수 없다 — 원시 select 대비 명백한 열화다.
- 제안: customSelect.ts enhanceSelect 에서 라벨 요소(select.labels[0] 등)와 valueLabel 에 id 를 부여해 trigger.setAttribute("aria-labelledby", `${labelId} ${valueId}`) 로 바꾸고 aria-label 은 라벨을 못 찾았을 때만 폴백으로 쓴다. 값은 valueLabel.textContent 로 이미 갱신되므로 sync() 추가 작업 없이 값 변경이 자동 낭독 이름에 반영된다.

**B19. 옵션 검색창이 키보드로 도달 불가 (≥9 옵션 select)**

- 근거: `src/editor/panels/eventEditor/customSelect.ts:356-357` · `src/editor/panels/eventEditor/customSelect.ts:65`
- 문제: 옵션이 9개(SEARCH_THRESHOLD) 이상이면 검색 입력이 만들어지지만(259-266), openSelectMenu 가 검색창에 포커스를 주지 않고(307-317 포커스 호출 없음) 검색창은 root=백드롭 맨 끝에 붙은 popover 안에 있다(289). 메뉴가 열린 상태에서 Tab 을 누르면 트리거 keydown 이 closeMenu(false) → popover.remove() 로 검색창을 DOM 에서 지워버리고(65) 포커스는 폼의 다음 컨트롤로 넘어간다. 결과적으로 키보드 사용자는 200개 변수 목록 같은 큰 셀렉트에서 부분문자열 검색 기능 자체에 영구 접근 불가다(트리거 typeahead 는 startsWith 만 지원).
- 제안: customSelect.ts openSelectMenu 에서 options.length >= SEARCH_THRESHOLD 이면 popover append 직후 search.focus({ preventScroll: true }) 로 열고(APG combobox 팝업 개관), focus 가 트리거에 남는 경로(마우스 클릭 등)에는 검색창이 Tab 첫 정지가 되도록 searchWrap 을 list 앞에 유지하되 Tab 처리를 closeMenu 대신 search↔list 순환으로 바꾼다. 최소한 'Tab 이 팝오버를 삭제하는' 동작(65)만이라도 메뉴 열림 중엔 막는다.

**B20. 비동기 상태 변화가 보조기술에 무전달 — 저장 상태·검증 종에 live region이 없다**

- 근거: `src/editor/panels/eventEditor/modal.ts:687-690` · `src/editor/panels/eventEditor/validationBell.ts:96-109` · `src/editor/panels/eventEditor/modal.ts:798`
- 문제: 저장 상태(store.subscribeAutoSave→refreshModalFooterStatus)와 검증 종(편집마다 validateEventDraft→refreshEventValidationBell)은 비동기로 갱신되는데 모달 전체에 aria-live/role=status가 0건이다. 푸터 remote-status span은 inline display:none으로 영구 숨겨져 있고(CSS만으론 이길 수 없음), 헤더 저장 상태도 같은 이유로 죽은 UI여서 「저장 실패: …」라는 데이터 유실 신호가 시각적으로도 노출되지 않는다. 유일하게 보이는 draft-status·벨 개수도 스크린리더에 무전달이다.
- 제안: remote-status의 inline display:none을 제거하고 data-state로 표시를 제어하며, draft-status·remote-status·벨 count 배지에 role="status" aria-live="polite" aria-atomic="true"를 부여한다. refresh는 직전 값을 모듈 상태로 보관해 값이 변했을 때만 textContent를 쓰고, state==="error"일 때 toast(role=alert 경유)를 함께 발화한다.

**B21. 재렌더 때 포커스가 body로 떨어지면 Tab 트랩을 우회해 뒷창으로 탈출**

- 근거: `src/editor/panels/eventEditor/subdialog.ts:70-71` · `src/editor/panels/eventEditor/commandEditDialog.ts:63-64` · `src/editor/panels/eventEditor/moveRouteDialog.ts:116-117`
- 문제: 초기 포커스는 open 시 1회만 설정되고(subdialog.ts:91), 트랩은 windowEl에서 발생한 keydown에만 물려 있다. 그런데 분기 추가/행 삭제(renderEditor), 이동 경로 행 선택(replaceChildren+목록 재빌드), NPC 행 선택(render에서 clearChildren(list)) 같은 조작은 방금 클릭한 버튼을 통째로 다시 그려 포커스가 document.body로 떨어진다. 포커스가 body에 있으면 Tab keydown의 전파 경로가 windowEl을 지나지 않으므로 트랩도 복구 분기도 없이 브라우저 기본 탭 순서가 작동해, 시각적으로 가려진 맵 에디터 뒤쪽으로 Tab이 빠져나간다. 키보드만 쓰는 사용자는 한 번의 행 클릭으로 대화상자 운용을 잃고 뒷창의 보이지 않는 컨트롤을 Tab/Enter로 건드리게 된다.
- 제안: (1) subdialog.ts의 트랩을 windowEl 대신 document 캡처 키다운으로 옮기고, keydown 시 activeElement가 windowEl 밖(body 포함)이면 focusFirstControl(windowEl)로 되돌리는 복구 분기 추가 — modal.ts:913 installFocusTrap도 동일 구조이므로 같이 수정. (2) 재렌더 지점 3곳(commandEditDialog.ts renderEditor, moveRouteDialog.ts renderAndSyncList, characterIdPickerDialog.ts render)은 재빌드 전 focused 요소의 testid/인덱스를 저장해 새 노드에서 동일 컨트롤로 focus() 복원 — commandPicker.ts의 captureCommandPickerFocus/restoreCommandPickerFocus 패턴 재사용.

**B22. 커맨드 컨텍스트 메뉴에서 Enter/Space가 포커스 항목을 대신해 고정 동작(삽입/편집)을 실행**

- 근거: `src/editor/panels/eventEditor/commandListContextMenu.ts:85-91` · `src/editor/panels/eventEditor/commandListContextMenu.ts:145-149` · `src/editor/panels/eventEditor/commandListContextMenu.ts:240`
- 문제: 커맨드 컨텍스트 메뉴의 keydown이 handleCommandShortcut으로 전역 단축키 레이어를 그대로 통과시키는데, 이 레이어는 포커스된 항목과 무관하게 Enter=「아래에 삽입」, Space=「편집」을 실행하며 preventDefault로 네이티브 버튼 활성화를 죽인다. 그 결과 메뉴를 열면 첫 항목(편집)에 포커스가 가 있어도(commandListContextMenu.ts:92) 삭제·잘라내기·전체 선택 항목을 키보드로 실행할 방법이 없다(단축키 코드를 외운 경우 Ctrl+X 등으로만 대체 가능). 또한 메뉴는 document.body에 붙어 모달 focus trap 밖이라(commandListContextMenu.ts:71, modal.ts:915 isTopModal(backdrop)이 false) Tab으로 마지막 항목을 지나면 페이지 밖으로 포커스가 탈출하고, role="menu"/menuitem임에도 화살표 탐색이 전혀 없다.
- 제안: commandListContextMenu.ts의 menu keydown 핸들러에서 포커스가 menuitem 위에 있을 때는 Enter/Space를 네이티브 활성화에 맡기고(early return), 메뉴 자체 화살표 탐색(↑↓ 순환·Home/End·Tab 랩)을 추가하라. pageTabContextMenu.ts:79-85의 Escape-전용 패턴이 정답류이다. handleCommandShortcut은 메뉴가 닫혀 있고 .cmd-head에 포커스가 있을 때만 Enter/Space를 해석하도록 호출부(commandList.ts:226, content.ts:252)에서 게이트를 나눠라.

**B23. 명령 행 액션 버튼(위로/아래로/삭제)과 드래그 핸들이 display:none으로 탭 순서에서 소멸**

- 근거: `src/styles/event/command-list.css:418-421` · `src/editor/panels/eventEditor/commandList.ts:228` · `src/styles/event/command-list-2.css:610-611`
- 문제: 명령 행의 위로/아래로/삭제 버튼(.cmd-actions)과 드래그 핸들(.cmd-drag-handle)이 event 레이어의 display:none 규칙(command-list.css:418-422, 929-933 동일 규칙 중복)에 걸려 렌더링 자체가 되지 않는다. 유일한 재노출 규칙(command-list-2.css:610-628)은 .cmd-item > .cmd-head > .cmd-actions라는 존재하지 않는 DOM 관계를 겨냥하고(commandList.ts:228에서 cmd-actions는 head의 형제), 게다가 opacity만 조정하므로 display:none을 되살리지 못한다. hover/selected/focus-visible 어느 경로로도 버튼이 나오지 않아 탭 순서에서 행 단위 이동·삭제 컨트롤이 완전히 제거되고, 키보드 사용자에게는 기억해야만 쓸 수 있는 단축키와 툴바만 남는다. 핸들은 role=button+tabindex=0+aria-label을 갖고 렌더링되므로(display:none으로 현재 비활성) 활성화해도 아무 동작이 없는 죽은 포커스 대상이 된다(commandListDragDrop.ts에 keydown 핸들러 전무 — grep 확인).
- 제안: command-list.css:418-422와 929-933에서 .cmd-actions/.cmd-drag-handle을 display:none 셀렉터 목록에서 제거하고(cmd-inline-editor 등 유산 요소만 남김), command-list-2.css:610-628의 재노출 셀렉터를 실제 DOM에 맞게 .cmd-item > .cmd-actions 계열(.cmd-item:hover/.selected/:focus-within > .cmd-actions)로 고쳐라. 핸들은 살릴 것인지 별도 결정이 필요하다 — 살린다면 Enter/Space로 이동 모드를 여는 키보드 대안을 commandListDragDrop.ts에 추가하고, 죽인다면 role/tabindex/aria-label을 제거해 허위 포커스 대상을 없애라.

**B24. :focus-visible 에서 outline 제거 후 알파 후광으로 대체 — 5개 블록이 비텍스트 대비 3:1 미만**

- 근거: `src/styles/event/command-list.css:547-549` · `src/styles/event/footer.css:419-421` · `src/styles/event/command-forms/forms-4.css:300-302`
- 문제: 키보드 포커스 인디케이터가 저알파 후광으로 대체돼 WCAG 1.4.11(3:1)을 크게 미달한다. 화이트 합성 대비 실측: 푸터/페이지 액션 .btn 24% 후광 1.42:1, 커맨드 툴 22% 1.36:1, 초안 검증 이슈 행 8% 배경≈1.1:1·30% 테두리 1.55:1, 서브다이얼로그 버튼 34% 아웃라인(command-list.css:455) 1.66:1, 커스텀 셀렉트 옵션 inset 55% 2.49:1. 전수 grep에서 :focus-visible 선택자는 21개 파일 약 70개인데 outline:none 을 선언하는 focus 블록이 8개(command-list 545·651, footer 417, pages-2 465, pages-3 577, shell 794, forms-3 127, forms-4 300, dialogs-4 854)이고 이 중 5개가 실효 지시자 3:1 미만이다. 특히 푸터 저장/취소 .btn(pages.css:130 기본 베벨 테두리 불변)과 커맨드 툴(631 기본 --event-modern-border 불변)은 테두리 변화도 없어 키보드 사용자가 포커스 위치를 알 수 없다. pages-2:465·dialogs-4:854처럼 accent 테두리 변경이 함께 있는 규칙은 통과하므로 후광 단독 규칙만이 문제다.
- 제안: command-list.css:545·651, footer.css:417, forms-4.css:300, command-list.css:442 의 5개 규칙을 dialogs-5.css:206 패턴( outline: var(--focus-outline); outline-offset: var(--stroke-2) )으로 통일하고 후광은 보조로만 유지. --ev-issue-tone 8%/30% 대신 --focus-outline 을 쓰거나 톤 100% 2px 테두리로 상향.

## C. P1 — 개발자 경험 (경계·토큰·도움말)

**C25. m2Command 경계 무검증 — 미등록 commandId·fields 구조 붕괴가 로드를 통과하고 런타임에서 조용히 스킵된다**

- 근거: `src/project/io/shapeCommandFields.ts:437-438` · `src/player/interpreter/commandCatalog.ts:103-106`
- 문제: 79개 kind 중 가장 표면이 넓은 m2Command(events.ts:498, commandId+fields)가 validateCommandShape에 case가 없어 default:return으로 통과한다. kind 멤버십만 보는 이 스위치는 같은 파일 19행의 fail-closed 원칙("알 수 없는 kind: throw")과 정면 배치된다. 구버전/손상 저장본의 fields: null이나 미등록 commandId가 경계를 통과하면 편집기에서는 commandSummary.ts:671 `m2CommandById(cmd.commandId)?.title ?? ""`로 제목이 공백이 되고 commandList.ts:80-84가 행을 broken placeholder로 렌더링하며, 런타임에서는 위 인용처럼 console.warn 한 줄 후 resumeNext로 명령이 조용히 무시된다. migration.ts:300("저장본은 칸을 숫자로도 문자열로도 들고 있었다(m2 필드)")가 실제 저장본에서 m2 필드 타입 흔들림이 있었음을 문서화하고 있음에도 경계 검증은 비어 있다.
- 제안: shapeCommandFields.ts validateCommandShape에 case "m2Command" 추가: commandId는 requireString + m2CommandById 조회(미등록이면 ProjectFormatError), fields는 requireRecord 후 각 값이 string|number|boolean인지 순회 검사. M2_COMMAND_CATALOG의 entry.fields FieldSpec으로 키별 타입·enum 검증까지 확장 가능. test/commandKindCoverage.test.ts에 m2Command 음수 케이스(fields 누락·미등록 id가 throw함)를 추가한다.

**C26. 모달 창이 전역 토큰 13종을 hex 사본으로 재정의 — tokens.css가 이벤트 편집기의 진실이 아니며 이미 2개 토큰이 드리프트 중**

- 근거: `src/styles/event/shell.css:876-888` · `src/styles/tokens.css:45-49`
- 문제: shell.css:876-888이 .event-editor-modal-window 스코프에서 전역 토큰 13종(--bg-base/-raised/-inset, --text-1/2/3, --accent, --accent-muted, --on-accent, --danger, --warning, --border, --border-strong)을 hex로 재선언한다. 사본은 이미 썩었다 — --text-3은 #64748B vs tokens.css #626E89(모달 내 보조 텍스트가 #F7F8F8 위 4.47:1, AA 미달), --border-strong은 alpha 0.16 vs 0.461. 같은 파일에서 --mk-accent가 스코프마다 var(--gold)와 var(--accent)로 이중 정의되고, event/*.css의 var() 폴백 아닌 직접 hex는 약 69곳이다. tokens.css를 고쳐도 이벤트 편집기는 무반응이다.
- 제안: 복사 블록을 삭제해 전역 토큰 상속으로 회귀하고 표면 고유 값은 tokens.css의 --event-* 이름으로 선언해 var() 참조만 한다. 어긋난 --text-3/--border-strong은 즉시 원값 복원, --mk-accent 이중 정의와 :root alias-collapse 블록(833-848)은 제거한다.

**C27. 이벤트 에디터 도움말(10개 섹션 가이드)이 열리는 입구가 하나도 없다 — 모듈 통째로 미연결**

- 근거: `src/editor/panels/eventEditor/eventEditorHelp.ts:2` · `src/editor/panels/eventEditor/eventEditorHelp.ts:89` · `src/editor/panels/eventEditor/modal.ts:684`
- 문제: src 전역 grep에서 openEventEditorHelp 호출부와 eventEditorHelp 모듈의 import가 0건이다(옛 증적 .omo/evidence/event-editor-hierarchy-20260826/pin-red.txt:4450에는 import가 있었다 — 입구가 제거되고 모듈만 남음). 이벤트 에디터 안 10개 섹션 가이드는 어떤 버튼·단축키로도 열 수 없다. 더 큰 문제는 도움말 본문 스스로 존재하지 않는 푸터 「도움말」 버튼을 안내한다는 것 — 모듈이 살아나도 초보는 버튼을 찾아 헤맨다. 온보딩의 핵심 수단(첫 명령 추가까지의 경로 설명)이 통째로 미연결 상태다.
- 제안: modal.ts renderModalFooter(671-721)에 footerButton("도움말", "event-editor-help", openEventEditorHelp, false, "ghost")을 복원한다(modalStack 최상단 등록·Esc 처리는 기존 구현 그대로). 동시에 eventEditorHelp.ts:89의 하단 버튼 나열을 실제 푸터 4버튼(이벤트 삭제/취소/적용/저장하고 닫기) 기준으로 고치고, 라벨 문자열을 modal.ts와 상수로 공유해 재발을 막는다.

**C28. 이동경로 서브다이얼로그 min-height: 660px 하드픽셀 — 뷰포트 높이 700px 미만에서 푸터 버튼이 화면 밖으로 절단(known #5 동류 재발)**

- 근거: `src/styles/event/subdialogs/dialogs-2.css:552-553` · `src/styles/event/subdialogs/dialogs.css:38-40` · `src/styles/event/shell.css:426-427`
- 문제: 창 높이는 min(860px, 100vh-36px)이지만 CSS에서 min-height(660px)가 height 하한으로 이겨, 뷰포트 높이-36px가 660px 미만이면 창이 그대로 660px로 강제된다. 고정 backdrop이 place-items:center라 위·아래가 동시에 잘리고, 이벤트 에디터가 열려 있는 동안 body 스크롤이 잠겨(shell.css:426-427) 잘린 푸터에 도달할 방법이 없다. 1366×768 노트북(브라우저 UI 제외 실뷰포트 620~660px, 2026년 최다 보급 스펙)에서 이동경로 편집 시 하단 버튼 행이 절단되고, 600px대 뷰포트에서는 적용/취소 버튼에 도달할 수 없다. transfer-player에는 높이 대응(dialogs-3.css:389-391)이 있지만 move-route에는 가드가 없다. 2026-09-17 리뷰 P0-5(메인 모달 푸터 화면 밖)와 같은 결함류가 서브다이얼로그에 재발한 상태다.
- 제안: dialogs-2.css:553을 min-height: min(660px, calc(100dvh - 36px)); 로 바꾸거나 아예 제거하고 목록 패널의 minmax(0,1fr)+overflow 스크롤로 내용을 수렴시킨다. 병행으로 @media (max-height: 700px)에서 창을 calc(100dvh - 36px)에 맞춰 어떤 높이에서도 푸터(적용/취소)가 시각 내에 오게 한다.

## D. P2 — UX 마찰

**D29. 페이지가 많아지면 새 탭과 키보드 이동한 탭이 스크롤 영역 밖에 머문다**

- 근거: `src/editor/panels/eventEditor/pageProps.ts:453-453` · `src/styles/event/pages-4.css:473-474`
- 문제: 탭 줄은 .evt-page-segments 가 overflow-x:auto(pages-4.css:468-476)로 스크롤되는 구조인데, (a) + 로 추가된 새 탭은 항상 맨 끝에 붙지만 아무도 scrollIntoView 하지 않아 방금 선택된 '편집 중' 탭이 화면 밖에 남고, (b) 방향키/Home/End 탐색도 focusRenderedPageTab 이 preventScroll:true 로 포커스만 주고 스크롤을 막아(pageProps.ts:453) 보이지 않는 탭에 포커스가 간다. 사용자 눈에는 '눌렀는데 화면이 안 바뀐' 상태가 되어 수동 스크롤을 강요당한다. database 모달(database.ts:856)·커스텀 셀렉트(customSelect.ts:108)는 활성 항목 scrollIntoView 관례가 있는데 페이지 탭만 빠져 있다.
- 제안: focusRenderedPageTab 에서 focus 뒤 tab.scrollIntoView({ block: "nearest", inline: "nearest" }) 를 호출하고(customSelect.ts:107-111 처럼 try/catch 가드), addEventPage 성공 직후 새 탭에도 동일 적용하라. pageTabDropIndex 처럼 pageTabDragDrop.ts 옆 헬퍼로 두면 드래그·우클릭 경로에도 재사용된다.

**D30. '우선순위' 한 단어가 두 개념(겹침 층 vs 탭 순서 승부)에 동시에 쓰인다**

- 근거: `src/editor/panels/eventEditor/pageProps.ts:1011-1011` · `src/editor/panels/eventEditor/options.ts:178-178` · `src/editor/panels/eventEditor/pageProps.ts:189-189`
- 문제: 인스펙터 fieldset '우선순위'(pageProps.ts:1011)는 그리기·충돌 층 선택(EVENT_PRIORITY_OPTIONS: 맵 아래/같은 층/맵 위)이고, 실제 '어느 페이지가 이기는가'는 탭 순서(마지막 일치 승리, pageResolution.ts:36-42)로만 결정된다. 그런데 토스트·이동 버튼 툴팁은 탭 순서를 '낮은/높은 우선순위'라 부른다(pageProps.ts:189, 222, 236). 입문자가 '이 페이지가 우선하기를' 바라며 fieldset 우선순위를 '맵 위'로 바꿔도 아무것도 안 바뀌는 경험을 한다. 헬프(eventEditorHelp.ts:117)만 '우선순위(겹침)'로 구분하고 정작 UI 라벨에는 구분이 없다.
- 제안: fieldset 제목을 '겹침 층' 또는 '표시 층'으로 바꾸고(pageProps.ts:1011, testid·저장값 유지), 페이지 순서 쪽 안내 문구는 '탭 순서'로 통일하라. 아울러 페이지바에 1줄 캡션('뒤 탭이 조건이 맞으면 그 탭이 이깁니다')을 상시 노출해 title 툴팁·토스트 의존을 끊는다.

**D31. 조건 편집마다 목록 끝으로 재배치되어 스위치1/2 행과 고급 넘침 행이 서로의 조건을 바꿔 가리킴**

- 근거: `src/editor/panels/eventEditor/pageConditions.ts:316-317` · `src/editor/panels/eventEditor/pageConditionModel.ts:23-24` · `src/editor/panels/eventEditor/pageConditionLayout.ts:14-15`
- 문제: 단순 행의 모든 apply가 withoutNthCondition/withoutFirstCondition으로 조건을 떼었다가 next.push(...)로 목록 '끝에' 다시 붙인다. 조건 순서가 바뀌면 행과 조건의 결속이 서수 기반(switchConditionAt(slot), advancedConditionEntries의 seen 카운터)이라 재렌더 시 행이 다른 조건을 가리킨다. 실제 시나리오: [스위치A, 스위치B, 변수C]에서 스위치1 행의 켜짐/꺼짐만 바꾸면 A가 끝으로 이동해 [B, C, A']가 되고, 스위치1 행은 B를, 스위치2 행은 방금 편집한 A'을 보여준다. 저작자는 "방금 꺼짐으로 바꿨는데 왜 켜짐이지"라고 보고 다시 만지며 B까지 의도치 않게 바꾼다. 스위치 3개 이상이면 고급 목록의 넘침 행도 서수가 밀리며 다른 조건으로 바뀐다.
- 제안: pageConditions.ts의 각 apply에서 push 대신 제자리 대체(map으로 해당 서수 노드만 교체)하거나, pageConditionModel.ts에 replaceNthCondition(conditions, kind, slot, next) 헬퍼를 만들어 쓴다. 근본책은 행↔조건 결속을 서수가 아닌 불변 식별자(조건 생성 시 id 부여)로 바꾸는 것.

**D32. 칩 토글(비활성화)이 삭제+재시드로 구현돼 구성한 조건이 되돌림 없이 소실됨**

- 근거: `src/editor/panels/eventEditor/pageConditionModel.ts:113-119` · `src/editor/panels/eventEditor/pageConditionModel.ts:216-217`
- 문제: 칩(aria-pressed)과 행 체크박스의 '끄기'가 데이터에서 조건을 삭제하고, '켜기'는 항상 빈 기본값을 새로 심는다(pageConditionModel.ts:113-139). 스위치 칩은 피커를 자동으로 다시 열어주지만(pageConditions.ts:241) 나머지 12종(변수·아이템·주인공·타이머·시간대·구역 등)은 선택해둔 대상과 방향이 조용히 초기화된다. 고급 목록에서도 all/any를 not으로 바꾸면 children[0]만 남고 나머지 하위 조건이 확인 없이 삭제된다(pageConditionModel.ts:216). '일시적으로 끄기'라는 정상적 저작 행위가 되돌릴 수 없는 삭제와 동치라서, 실수 한 번에 구성이 소실된다.
- 제안: ① 조건 모델에 enabled 불린 필드를 두고 칩 토글은 enabled만 반전(런타임 pageResolution.ts:38의 every 앞에서 disabled 필터), ② 마이그레이션이 부담이면 토글 off 시 직전 조건을 스냅샷으로 보관해 on 시 복원, ③ convertGroupKind의 not 전환은 하위 2개 이상일 때 confirm 또는 첫 하위 유지 경고 토스트를 노출.

**D33. 조건 문장이 구역·관계 조건을 못 읽어 «특수 조건 insideLocation» 내부 토큰을 노출함**

- 근거: `src/editor/panels/eventEditor/pageConditionSentence.ts:93-96` · `src/editor/panels/eventEditor/pageConditions.ts:146-147` · `src/editor/panels/eventEditor/conditionEvalPreview.ts:159-160`
- 문제: clauseParts의 switch에 insideLocation(구역)과 relationshipAtLeast(관계) 케이스가 없어 둘 다 default로 떨어져 «특수 조건 insideLocation», «특수 조건 relationshipAtLeast»처럼 영문 내부 토큰이 저장 전 확인 문장에 그대로 노출된다. 구역과 관계는 단순 팔레트의 1급 칩(pageConditions.ts:146-171)인 가장 흔한 조건인데, 문장 요약 표면만 이 둘을 못 읽는다. 같은 조건을 미리보기 describeCondition은 제대로 한글화한다(conditionEvalPreview.ts:159-164) — 요약 표면 간 불일치이며, 두 조건을 건 페이지는 «이 페이지는 …, 특수 조건 insideLocation이 모두 맞을 때 보입니다»로 저장 직전 검독이 깨진다.
- 제안: pageConditionSentence.ts clauseParts에 case "insideLocation"(insideLocationSentence 재사용 — conditionEvalPreview.ts:10의 import 경로)과 case "relationshipAtLeast"(relationshipStateName(condition.state) + npcKey 라벨, friendshipAtLeast 케이스 80-82행과 동일 형식)를 추가하고, pageConditionSentence.test.ts에 두 종류 문장화 회귀 테스트를 추가.

**D34. 미설정 타이머 조건: 런타임은 참(페이지 노출)인데 미리보기는 «판정 불가»라 괴리**

- 근거: `src/editor/panels/eventEditor/conditionEvalPreview.ts:98-99` · `src/project/io/pageResolution.ts:68-69` · `test/conditionEvaluatorParity.test.ts:27-27`
- 문제: 타이머가 한 번도 설정되지 않은 상태에서 런타임은 남은 시간을 0으로 간주해 «타이머 1 ≤ 60초» 페이지 조건이 참 — 즉 게임 시작부터 타이머와 무관하게 페이지가 선택된다(pageResolution.ts:68-69, session.ts:855-857 동일). 그러나 편집기 미리보기 평가기는 hasOwn 가드로 '판정 불가'를 표시한다(conditionEvalPreview.ts:98-99). npcActivity(런타임: 미등록=거짓, 미리보기: 불가), battleResult도 같은 괴리다. 패리티 테스트는 완전히 채워진 상태만 입력해(ALLOWLISTED_DIVERGENCES = {}, 미설정 상태 케이스 부재) 이 간극을 못 잡는다. 저작자는 미리보기에서 «플레이해봐야 안다»는 인상을 받지만 실제로는 결정적이고 반대 방향(참)이다 — 타이머 게이트 페이지가 의도와 달리 처음부터 열리는 대표적 사고 경로.
- 제안: 두 표면을 정렬하되 설계 결정이 선행: (a) «미설정 타이머=조건 미충족»이 의도면 pageResolution.ts:69과 session.ts:856을 미설정 시 false가 되도록 바꾸고 미리보기 가드도 false 판정으로 통일, (b) 현행 «미설정=0=참»이 의도면 conditionEvalPreview.ts:98-99의 hasOwn 가드를 제거해 참으로 평가. 어느 쪽이든 test/conditionEvaluatorParity.test.ts CASES에 timers:{}/npcActivities:{} 미설정 상태 케이스를 추가해 회귀 고정.

**D35. 검색이 실패하는 실제 사례 — "대화"·"메시지"·"돈"·"텔레포트" 전부 0건**

- 근거: `src/editor/panels/eventEditor/commandPicker.ts:540-542` · `src/project/eventCommands/m2CatalogData.ts:252` · `src/project/eventCommands/m2CatalogData.ts:336-337`
- 문제: 검색은 label·그룹명·alternateRoute 의 부분일치뿐이다. 별칭/동의어 테이블이 없어 실제로 실패하는 질의가 있다: "대화"→0건(기본 문장 표시를 찾으려는 사용자. 유일한 라벨 "고급 대화"는 deprecated 로 COMMAND_PAGES 에서 제외되어 더더욱 0건), "메시지"→0건, "돈"/"골드"→0건(소지금 변경), "텔레포트"→0건(장소 이동), "체력"→0건(HP 변경). 또한 카탈로그 행의 영문 원명(row.title="Show Text" 등)은 검색 대상이 아니라서 RM2k3 어휘로도 못 찾는다. 리소스 검색(resourceSearch.ts)에는 이미 동의어 보강 패턴이 있는데 명령 피커에는 없다.
- 제안: M2CommandCatalogEntry/CommandEntry 에 searchTerms: readonly string[] 를 추가하고 renderSearchResults 의 filter 에 포함할 것. 최소 세트: 문장 표시→[대화, 메시지, Show Text], 소지금 변경→[돈, 골드, Gold], 장소 이동→[텔레포트, Transfer], HP 변경→[체력], 그림 표시→[픽처, Picture], 라벨로 점프→[점프]. 영문 title 도 자동 포함(KOREAN_LABEL_BY_TITLE 역방향 매핑으로 생성 가능). 빌드 타임 테스트로 "대화"가 m2-001 을 반환하는지 고정.

**D36. 같은 기능 명령 2중 등재 — "애니메이션 표시" vs "애니메이션 표시..." 등 3쌍이 한 그리드에**

- 근거: `src/editor/panels/eventEditor/commandPicker.ts:125-126` · `src/editor/panels/eventEditor/commandPicker.ts:63-66` · `src/project/eventCommands/m2PickerLayout.ts:297,300`
- 문제: 탭 3 같은 헤딩 아래에 같은 기능의 두 삽입점이 나란히 있다: 조명·날씨 그룹에 "날씨 설정"(native setWeather)과 "날씨 효과 설정..."(m2-050), 화면 연출 그룹에 "애니메이션 표시"(native)와 "애니메이션 표시..."(m2-054 — 표시명이 ... 하나 차이), "동영상 재생"(native)과 "동영상 재생..."(m2-066). rank 재정렬은 중복을 인정하면서 순서만 바꿀 뿐 없애지 않고, 하나는 네이티브 폼 하나는 제네릭 m2 폼을 열어 어느 쪽을 골라야 하는지 알 수 없다. 프로젝트는 이미 같은 문제를 m2-055/m2-209 를 DEPRECATED_M2_COMMAND_IDS(supersededBy) 로 은퇴시켜 해결한 전례가 있는데 이 3행에는 적용하지 않았다. 또 commandPicker.ts:127-128 주석("playMovie 는 editorOnly 라 selectable=false")은 commandGuaranteeRegistry.ts:222(map full+mainPicker)와 모순되는 낡은 주석이다.
- 제안: m2-050/m2-054/m2-066 을 DEPRECATED_M2_COMMAND_IDS 에 supersededBy:native 로 등록해 피커에서 제거할 것(m2-055 선례 재사용, 저장 프로젝트 호환은 기존 로드 경로가 유지). 즉시 대안으로는 existingKind 를 붙여 정규화하거나, rank 1 제네릭 행을 탭 그리드·검색 모두에서 tabGridEntries 와 동일하게 걸러낼 것. stale 주석(commandPicker.ts:127-128)도 실제 selectable 값에 맞게 수정.

**D37. 피커↔목록·인스펙터 명칭 불일치 — 반복 중단/반복 탈출 등 6쌍, 라벨 진실원 3곳**

- 근거: `src/editor/panels/eventEditor/commandSummary.ts:145` · `src/project/eventCommands/m2CatalogData.ts:148` · `src/editor/panels/eventEditor/options.ts:57`
- 문제: 같은 명령이 표면마다 다른 이름으로 불린다. 피커(카탈로그 라벨) vs 목록 요약(commandSummary 수기 라벨) vs 인스펙터 제목(commandKindLabel): 반복 중단(피커)↔반복 탈출(목록·인스펙터), 라벨로 점프(피커·목록)↔라벨 이동(인스펙터), 그림 삭제(피커)↔그림 지우기(목록·인스펙터), 타이머 조작(피커)↔타이머(목록·인스펙터), 키 입력(피커)↔키 입력 대기(목록·인스펙터), BGM 재생/SE 재생(피커)↔소리 재생(목록·인스펙터). 특히 "BGM 페이드아웃..."(m2-062)을 골라 넣으면 목록에는 "소리 정지"로 표기되어 방금 넣은 명령을 알아볼 수 없다. 진실원 3곳(options.ts COMMAND_KIND_OPTIONS, m2CatalogData KOREAN_LABEL_BY_TITLE, commandSummary 스위치)이 각자 갱신되며 이미 갈라져 있다.
- 제안: options.ts COMMAND_KIND_OPTIONS 를 정본으로 선언하고, m2Catalog.ts buildCatalogEntry 에서 existingKind 행의 label/pickerLabel 생성 시 이 표와 불일치하면 빌드 에러를 내는 단언을 추가할 것(라벨 필터 사고를 id 로 막은 m2CatalogData.ts:319-322 선례의 구조적 해법과 동일). 단기 픽스는 최소 5종(breakLoop, gotoLabel, erasePicture, timer, playAudio)을 한쪽 명칭으로 일치시키는 것.

**D38. 기본 보기(list)가 항상 1열 — 약 160개 명령이 1행 1항목 세로 스크롤**

- 근거: `src/styles/event/subdialogs/dialogs-4.css:712-716` · `src/styles/event/subdialogs/dialogs-2.css:782-785` · `src/editor/panels/eventEditor/commandPicker.ts:76-78`
- 문제: 기본 보기(list)에서 피커는 항상 1행 1항목이다. dialogs-4.css:713-716 의 .event-command-picker-grid:not(.icon-grid){grid-template-columns:minmax(0,1fr)} 가 dialogs-2.css:782 의 2열 규칙보다 같은 layer(event) 에서 나중에 로드되어 모든 뷰포트에서 2열을 덮는다. 기본 viewMode 는 list(commandPicker.ts:77,787)이므로 카탈로그 125행+네이티브/파생을 합쳐 약 160개 버튼이 전폭 1열로 쌓여 원하는 명령까지 세로 스크롤이 길고, 2열 기본 그리드는 list 모드에서 도달 불가능한 죽은 규칙이 된다. 검색 결과·즐겨찾기·최근 명령 섹션도 같은 1열을 상속한다.
- 제안: dialogs-4.css:713 규칙을 뷰포트 분기로 한정하거나 list 모드에도 repeat(2, minmax(0,1fr)) 를 적용해 1100px 이상에서 2열을 회복할 것. 즐겨찾기/최근 명령/검색 결과(renderSearchResults)는 항목 수가 적으니 2열 고정이 안전. 근본적으로는 기본 viewMode 를 icon-grid 로 바꾸고 list 를 밀도 옵션으로 내리는 쪽이 명령 100+종 탐색이라는 IA 목적에 맞다.

**D39. 기본 점프(dx=dy=0)의 미리보기·라벨이 런타임 2칸 전방 점프와 불일치**

- 근거: `src/editor/panels/eventEditor/previewMoveRoute.ts:163-164` · `src/player/playSceneAutonomousCommands.ts:230-231` · `src/editor/panels/eventEditor/moveRouteCommandCatalog.ts:36-38`
- 문제: 「점프」 버튼은 dx/dy 기본값 0으로 삽입되는데, 런타임은 (0,0) 점프를 「바라보는 방향 2칸 점프」로 해석한다(playSceneAutonomousCommands.ts:226-233, DEFAULT_JUMP_DISTANCE=2). 그러나 미리보기 궤적 tracePath는 +0 이동이라 시작점만 찍히고, 리스트 라벨도 moveCommandLabel이 (0,0)일 때 좌표 표시를 생략해 「점프」 한 단어뿐이다(moveRouteCommandCatalog.ts:227-229). 저작자는 제자리 점프를 넣었다고 믿고 저장하지만 테스트 플레이에서 NPC가 2칸을 날아간다. 라벨·궤적·도움말 어디에도 2칸 기본 규칙이 노출되지 않는다.
- 제안: previewMoveRoute.ts step()의 jump 케이스에서 dx===0&&dy===0이면 facing을 알 수 없으므로 「전방 2칸(방향 따름)」 불확정 마커를 그리거나, 최소한 moveCommandLabel(moveRouteCommandCatalog.ts:227)에서 (0,0)일 때 "점프(전방 2칸)"로 라벨을 바꿔 런타임 규칙을 저작 UI에 노출.

**D40. NPC 맵 이동 좌표가 손입력 숫자칸뿐 — 기존 맵 포인트 피커 미사용, 즉시 검증 없음**

- 근거: `src/editor/panels/eventEditor/moveRouteDialogParts.ts:118-119` · `src/editor/panels/eventEditor/moveRouteDialogParts.ts:293-294` · `src/editor/panels/eventEditor/pageNpcLiving.ts:79-81`
- 문제: NPC 맵 이동(npcTransfer) 목적지는 숫자칸 두 개가 유일한 입력 경로다. min="0" 속성은 스피너만 제한하고 직접 입력한 음수(-5)는 parseInt로 그대로 저장되며, 맵 크기 상한 검증도 다이얼로그 어디에도 없다. 클램프·범위 안내는 저장 시점 검증기(eventDraftValidator.ts:1463 validateMapPosition)에서만 뒤늦게 잡힌다. 프로젝트에는 정확히 이 용도의 맵 포인트 피커(mapPointDialog.ts — 「맵 위 한 칸을 눈으로 고르는 공용 서브다이얼로그」, 맵 전환 시 clampDraftIntoMap까지 내장)가 이미 있는데 생활 이동(pageNpcLiving.ts:79)에서만 쓰이고 이동 경로 다이얼로그는 물지 않았다.
- 제안: moveRouteDialogParts.ts mapSelect 옆에 「칸 고르기…」 버튼을 두고 openMapPointDialog({ testIdPrefix: "event-page-move-route-npc", onApply로 npcTargetMapId/X/Y 동시 설정 })로 연결. 당장이라도 numberInput의 onChange에서 store.getCurrent().maps[npcTargetMapId]의 width-1/height-1로 clamp하고 음수는 0으로 고정.

**D41. 점프 체공값(dx/dy/높이/시간)은 선택 단계 편집 불가 — 삭제 후 재추가만 가능**

- 근거: `src/editor/panels/eventEditor/moveRouteDialog.ts:190-192` · `src/editor/panels/eventEditor/moveRouteDialog.ts:109-110`
- 문제: 점프/낙하는 4개 매개변수(dx·dy·높이px·시간ms)를 갖는 유일한 다필드 명령인데, 행을 선택해도 editedIndex가 세팅되지 않아(selectCommand는 setSwitch/changeGraphic/playSe/npcTransfer만 처리, moveRouteDialog.ts:109-115) 패널에 기존값도 안 불러오고, onHopDx~onHopDurationMs 핸들러(184-195)는 editSelected를 호출하지 않으므로 선택 단계 수정도 불가능하다. 이미 넣은 점프의 거리·높이·시간을 고치는 방법은 삭제→재설정→재추가뿐이고, 목록에서 위치도 맨 뒤로 밀린다. 반면 스위치·효과음·NPC 이동은 선택 즉시 편집되는 것과 불균형.
- 제안: selectCommand에서 move.kind가 "jump"|"dropIn"일 때 해당 행의 dx/dy/heightPx/durationMs를 패널 상태에 읽어 들이고 editedIndex를 세팅한 뒤, onHop* 핸들러를 editSelected(move => move.kind가 jump/dropIn일 때 hopDx→dx 등으로 병합)로 바꾼다. moveRouteCommandCatalog.ts inferHopParameters(190-210)를 행 단위 재사용하면 된다.

**D42. 상점 유형 전환 시 숨겨진 필드가 값을 유지한 채 활성 상태로 남고, sellOnly에서 구매 전용 컨트롤이 그대로 편집됨**

- 근거: `src/editor/panels/eventEditor/commandBodyShop.ts:461-462` · `src/editor/panels/eventEditor/commandBodyShop.ts:58` · `src/editor/panels/eventEditor/commandPreview.ts:847`
- 문제: withShopType은 legacy allowSell만 제거하고 merchantGold·economy(흥정/마일리지)·quantityMode·shopServiceKind 등을 전부 유지한다. buyOnly로 바꾸면 매입 예산 필드만 숨겨지(hidden)고 값은 그대로 직렬화되며, 다시 normal로 돌리면 조용히 부활한다. sellOnly(런타임 모드 ["sell","cancel"], playSceneShopDom.ts:566-567)에서는 규칙 탭의 '구매 수량' 셀렉트가 여전히 편집 가능한 채 남아 무의미한 값을 기록하고, 미리보기는 buyOnly 상점에도 '상인의 매입 예산' 행을 그대로 보여준다.
- 제안: withShopType에서 유형별 무의미 필드를 정규화(제거)하거나, 유지 정책을 유지하더라도 전환 시 '매입 예산 1,000G 유지됨' 식의 확인 배지를 summary에 표시한다. 규칙 탭 컨트롤(구매 수량·UI 프리셋 일부)의 활성화를 budget.hidden처럼 shopType에 동기화하고, shopStage 미리보기에서도 buyOnly일 때 예산 행을 생략한다.

**D43. 여관 변수 요금({kind:'var'})이 초기 렌더에서 유령 표시되고 첫 가격 편집에 조용히 0(무료)으로 파괴됨**

- 근거: `src/editor/panels/eventEditor/commandBodyCommerce.ts:35` · `src/editor/panels/eventEditor/commandBodyCommerce.ts:117-119` · `src/editor/panels/eventEditor/commandBodyCommerce.ts:325`
- 문제: normalizeInnPrice는 변수 요금 {kind:'var',id}를 정상값으로 보존하고 힌트·미리보기 칩도 '변수 요금'을 표시하지만, 요금 input은 number 타입이라 초기 렌더에서 String(객체)='[object Object]'가 되어 빈 칸으로 보인다(35행 — commit 내부 104행은 typeof 가드가 있는데 초기값엔 빠져 있음). 사용자가 요금 칸을 한 글자라도 고치면 onPriceInput의 parseInt||0이 변수 요금을 숫자(보통 0=무료)로 덮어써 저장하며, input+change 이중 리스너 때문에 키 입력마다 중간 커밋·값 재작성이 일어난다. 변수 요금을 설정/해제하는 UI는 어디에도 없다.
- 제안: commandBodyCommerce.ts:35를 commit 내부와 동일한 typeof 가드로 고치고, 요금 입력 옆에 고정/변수 모드 토글을 추가한다(commandBodyVariable.ts:158-160의 operand 패턴 재사용). onPriceInput은 input 이벤트에서 커밋하지 말고 change로 내리며, 입력 비움은 이전 값 복원 또는 별도 '무료' 체크박스로 분리해 0 확정을 없앤다.

**D44. 여관 미리보기가 본문 문구 함수를 우회해 같은 다이얼로그가 편집기 안에서 서로 다르게 보임(변수 요금=(무료), 예/아니오 vs 숙박/거절)**

- 근거: `src/editor/panels/eventEditor/commandPreview.ts:798-799` · `src/editor/panels/eventEditor/commandBodyCommerce.ts:343` · `src/editor/panels/eventEditor/commandBodyCommerce.ts:192-193`
- 문제: innStage는 innNoteText/innQuestionText를 쓰지 않고 문구를 인라인으로 재작성한다. 변수 요금 여관은 본문 다이얼로그 목업에는 '변수 N G 입니다…'(commandBodyCommerce.ts:341-343)로 보이는데 명령 미리보기에서는 price가 0으로 계산돼 '하룻밤 묵으시겠습니까? (무료)'가 뜬다(칩에는 '변수' 표기 — 한 창 안에서 상충). 선택지 라벨도 본문 목업은 '숙박/거절', 미리보기는 '예/아니오'로 서로 다르다. commandBodyShop.ts:363-366 주석이 명시한 '미리보기는 런타임과 같은 함수를 부른다' 원칙의 위반.
- 제안: innStage가 commandBodyCommerce.ts:337-346의 innNoteText/innQuestionText를 import해 사용하게 하고, 선택지 라벨은 상수로 추출해 본문 목업과 미리보기가 공유한다. 이후 문구 변경은 한 곳만 고치면 되도록 테스트로 양쪽 동일성을 고정한다.

**D45. 진열 순서 변경이 상세 패널의 ↑/↓ 한 칸 이동뿐 — 표시 순서가 곧 게임 노출 순서인데 대량 재정렬이 불가능**

- 근거: `src/editor/panels/eventEditor/shopEditorGoods.ts:102` · `src/editor/panels/eventEditor/shopEditorGoods.ts:123`
- 문제: 진열 순서는 런타임 노출 순서와 직결됨을 편집기가 스스로 안내하지만, 정렬 수단은 상세 패널에서 대상 상품을 선택한 뒤 ↑/↓로 한 칸씩 옮기는 것뿐이다. 20~30개 진열 상점에서 맨 아래 상품을 맨 위로 올리려면 최대 29회 클릭이고, 드래그 재정렬·순서 검색·카탈로그 다이얼로그 내 순서 편집은 없다. 행 자체에는 이동 핸들이 없어 매 이동마다 선택 상태를 유지해야 한다.
- 제안: 상품 행에 드래그 핸들을 추가해 commandListDragDrop.ts의 포인터 드래그 패턴을 재사용하고(withShopItems가 순서 변경 시 stock 오버레이를 보존하므로 커밋 경로는 그대로 쓴다), 최소한 ↑/↓ 버튼을 목록 행(선택 불필요)으로 옮기고 카탈로그 다이얼로그에 '순서대로 다시 담기' 모드를 둔다.

**D46. 문장 폼 한도·미리보기가 화자(2줄 페이지)와 흉상/전신 폭을 반영하지 않는다**

- 근거: `src/editor/panels/eventEditor/commandBodyCore.ts:187-189` · `src/player/dialogue.ts:757-758` · `src/player/dialogue.ts:102-103`
- 문제: 문장 폼의 권장 한도와 LIVE 미리보기는 런타임 페이지 규격을 반영하지 않는다. (1) 힌트는 항상 「4줄」 기준이지만 게임은 화자 이름표가 있으면 페이지당 2줄이다(dialogueMaxLines 실측 주석, dialogue.ts:768-782) — 말하는 사람을 채운 대사는 3~4줄에서 페이지가 나뉘는데 편집기는 문제 없다고 알려준다. (2) 힌트의 얼굴 모드는 boolean 하나라 흉상/전신(본문 폭 96~100px 예약)과 일반 얼굴(48+8px)이 같은 38자를 받는다. 실제 흉상·전신 허용 폭은 절반 가까이 좁다. (3) 미리보기는 paginateDialogueSegments 를 쓰지 않고 renderPreviewDialogueBody 로 통짜 텍스트를 CSS pre-wrap 으로 붙이므로 게임에서 플레이어가 클릭해 넘길 페이지 경계가 보이지 않는다(commandPreview.ts:273, 302-343). 그런데 헤더는 「줄바꿈이 게임과 같습니다」(commandBodyCore.ts:284)라고 약속한다.
- 제안: refreshLimitHint 를 런타임 규격과 동일하게: 화자 값이 있으면 줄 기준을 2로, previewFace.resourceId 에 faceDisplayModeOf 를 적용해 bust/full 는 ~26자 기준으로 조정한다. 미리보기 본문은 paginateDialogueSegments(maxWidth≈282−예약폭 px, maxLines=2/4)로 그려 페이지 경계와 「N/M」 커서를 보여주고, 반영 전까지는 「줄바꿈이 게임과 같습니다」 문구를 삭제한다.

**D47. 빈 선택지 텍스트를 폼은 보존, 프리뷰는 숨김, 게임은 빈 버튼으로 실행한다**

- 근거: `src/editor/panels/eventEditor/commandBodyChoices.ts:272-274` · `src/editor/panels/eventEditor/commandPreview.ts:579` · `src/player/dialogue.ts:559-560`
- 문제: 빈 선택지 텍스트가 세 곳에서 다르게 해석된다. 폼은 주석대로 임시 빈 값을 의도적으로 보존하고(commandBodyChoices.ts:272), 프리뷰는 빈 텍스트 항목을 필터해 없는 것처럼 그린다(commandPreview.ts:579). 그러나 런타임은 빈 텍스트 선택지도 버튼으로 렌더(dialogue.ts:559-571)하고 번호 키·클릭으로 선택 가능하며, resume 은 텍스트와 무관하게 branch 를 실행한다(resume.ts:29-31). 즉 프리뷰에서 2개로 보이던 선택지가 게임에서는 3개(빈 행 포함)이고, 빈 행을 누르면 분기가 실행된다. 검증기도 빈 텍스트를 잡지 않는다(eventDraftValidator.ts:1103-1104).
- 제안: 세 상태를 통일한다: (a) change 커밋 시 빈 텍스트를 placeholder 라벨(「선택지 N」)로 채워 저장하거나, (b) choicesMock 의 filter 를 제거해 빈 항목도 빈 버튼으로 그려 런타임과 동일하게 보인다. 아울러 eventDraftValidator 의 choices case 에 빈 텍스트 warning(코드 choice.option.empty)을 추가해 저장 전에 잡아 준다.

**D48. 생성 중 취소 수단·진행 표시 없음 — 최악 수십 분 busy 잠금**

- 근거: `src/editor/panels/eventEditor/aiAssist.ts:405-411` · `src/ai/eventCommandAssist.ts:680` · `src/ai/llmClient.ts:774`
- 문제: runEventCommandAssist와 chatCompletion은 AbortSignal을 지원하지만 aiAssist의 generate()는 신호를 넘기지 않고, UI에는 중단 버튼이 없다. busy 동안 generateBtn만 잠기고(재렌더 후에도 state.statusKind==="busy"로 재잠김) 도크를 닫아도 요청은 계속된다. 최악 경로는 요청당 180초 타임아웃 × llmClient 1회 재시도 × MAX_ATTEMPTS 3회 자가수정으로 수십 분이며, "스스로 N번 고쳤습니다"는 성공 후에만 보이므로 대기 중에는 몇 번째 시도인지도 알 수 없다. 도크를 닫았다 다시 열면 busy 칩만 남은 채 아무 조작도 불가하다.
- 제안: generate()에서 AbortController를 만들어 runEventCommandAssist({ signal })로 넘기고, busy 중 generateBtn 자리를 「그만하기」로 바꿔 abort 시 LlmAbortError를 조용히 소비하라. 자가수정 회차를 onProgress 콜백으로 노출해 "2번째 시도 검증 중…"을 status에 표시하라.

**D49. 참조 목록 40개 초과 프로젝트에서 요청이 구조적으로 실패하고 실패 안내가 원인을 말하지 않음**

- 근거: `src/ai/eventCommandAssist.ts:135-138` · `src/editor/panels/eventEditor/aiAssist.ts:452-453`
- 문제: 스위치·변수·아이템 등 참조 목록이 종류당 40개를 넘으면 초과분 id가 프롬프트에서 누락되는데, 사용자의 요청이 정확히 그 누락된 id를 필요로 하면 모델은 구조적으로 실패하고 자가수정 루프도 눈에 보이지 않는 id를 알 수 없어 3회 모두 실패한다. 사용자에게 보이는 것은 "존재하지 않는 switchId…" 같은 검증기 원문뿐이라, 문장을 아무리 다시 써도 같은 실패가 반복되며 원인(참조 목록 상한 초과)은 어디에도 안내되지 않는다.
- 제안: parseAndValidate의 참조 오류를 분류해 누락 원인 후보(상한 초과)를 에러 문자열에 명시하고, refSection에 «…외 N개 생략»만이 아니라 requestText에 언급된 이름과 매칭되는 항목은 상한과 무관하게 우선 실어 보내라(eventAudioPromptSection의 score 기반 addGroup 패턴 재사용).

**D50. choices 명령 무검증 — 선택지 0개·빈 선택지 문구를 진단하지 못하고 미리보기와 런타임이 다르게 보인다**

- 근거: `src/editor/eventDraftValidator.ts:1103-1104` · `src/player/interpreter/commandCatalog.ts:474` · `src/editor/panels/eventEditor/commandPreview.ts:584`
- 문제: 선택지 명령은 상점(shop.items.empty, eventDraftValidator.ts:1061-1070)과 달리 검증이 하나도 없다. UI로는 0개 선택지를 만들 수 없지만 구버전/임포트 데이터(types/events.ts:686-690 CommandV1)는 가능하고, 이때 런타임은 선택지 창을 빈 채로 띄워 진행 불가 상태에 빠진다. 빈 option.text도 검증 없이 통과하는데, 미리보기는 `선택지 N` 폴백을 보여주는 반면 런타임(commandCatalog.ts:474)은 빈 버튼을 그대로 렌더한다 — 편집기에서는 멀쩡해 보이고 게임에서만 깨지는 신뢰 격차다.
- 제안: eventDraftValidator.ts validateCommand에 choices 케이스 구현: (1) options.length === 0 → severity "error", code "choices.options.empty"(shop.items.empty 선례 준용, field는 event-inspector-body), (2) option.text.trim() === "" → severity "warning", code "choices.option.text-empty". 아울러 commandCatalog.ts:474에 미리보기와 동일한 `선택지 ${index+1}` 폴백을 넣거나 양쪽 중 한쪽으로 계약을 정렬.

**D51. 진단 갱신이 렌더마다 2회 전체 프로젝트 검증 — authoredWrites 있으면 전체 structuredClone까지 2회**

- 근거: `src/editor/panels/eventEditor/modal.ts:357` · `src/editor/panels/eventEditor/content.ts:162` · `src/project/eventDraftAuthored.ts:56`
- 문제: 진단 갱신이 store·editorState 변경마다(즉 타이핑마다) 동기 2회 실행된다 — bell용(modal.ts:357)과 콘텐츠용(content.ts:162)이 같은 이벤트를 따로 검증한다. validateEventDraftBody는 호출마다 referenceSets에서 데이터베이스 전체를 ~21개 Set으로 재구축하고(eventDraftValidator.ts:189-223), checkCallDepth(166행)는 이 이벤트가 callCommonEvent를 하나도 안 써도 프로젝트 공통 이벤트 전부를 순회한다(106-108행). 게다가 linked authoredWrites가 걸린 이벤트에서는 매 렌더마다 프로젝트 전체 structuredClone이 2번 일어나 큰 프로젝트에서 편집 지연으로 번진다.
- 제안: (1) renderSurface가 검증을 1회만 계산해 bell과 renderEventEditorDynamic에 인자로 공유 — modal.ts:342-357 사이에서 한 번 validate한 결과를 재사용. (2) eventDraftAuthored.ts:53-58의 투영을 이벤트 객체 단위 clone으로 축소(프로젝트 전체 clone 불필요 — authoredWrites는 characters/switches 이름뿐). (3) checkCallDepth는 이벤트 본문에 callCommonEvent가 존재할 때만 호출하는 게이트 추가.

**D52. 종 행 hover 툴팁에 내부 토큰(code·pageId·commandPath) 그대로 노출 — 알려진 #14 후반부 잔존**

- 근거: `src/editor/panels/eventEditor/validationBell.ts:181`
- 문제: 종 목록 행의 hover 툴팁(title)이 `page.invisible-collision · page_e869… · []` 같은 내부 토큰을 그대로 보여준다. 178-180행 주석은 가시 텍스트에서 토큰을 치운 근거를 «조건 문구에 내부 토큰을 넣지 마라» 위반으로 명시하는데, title은 hover 시 사용자에게 그대로 보이고 스크린리더의 접근 가능 설명으로도 노출되므로 같은 규칙을 툴팁 채널에서 여전히 위반한다 — 알려진 결함 14의 «내부 토큰 노출» 절반이 여기에 잔존한다(«새 이벤트 기본 경고» 절반은 eventDraftValidator.ts:285-298의 untouched 가드로 수정 확인).
- 제안: validationBell.ts:181의 title을 사람용 문구(cause·expected·hint 요약)로 교체하거나 제거한다. 기계 토큰은 이미 dataset.issueCode/commandPath/field(168-175행)와 진단 복사(validationActions) 경로에 남아 있으므로 title의 토큰은 순수 중복이다.

**D53. 순환 호출 경고가 이름 대신 원시 ID를 말하고, 클릭 점프는 무관한 현재 선택 인스펙터로 떨어진다**

- 근거: `src/editor/eventDraftValidator.ts:92` · `src/project/types/events.ts:677-678` · `src/editor/panels/eventEditor/validationBell.ts:123-124`
- 문제: 공통 이벤트 순환 호출 경고가 조회 가능한 이름(ce.name, types/events.ts:678) 대신 원시 ID 토큰을 문구에 출력한다(eventDraftValidator.ts:95에서 ce 객체를 바로 얻는다). 또한 이 이슈는 pageId가 빈 문자열이라 종 행을 클릭해도 페이지·명령 어디로도 이동하지 못하고, eventDraftIssueDetails.ts:31-32의 폴백 앵커(event-inspector-body)만 타서 현재 선택된 명령의 인스펙터로 데려갈 뿐 — 순환을 만드는 callCommonEvent 행이나 해당 공통 이벤트로는 갈 수 없어 이 이슈 클래스에서 클릭→점프 계약이 무너져 있다(recursionDepth:84도 동일).
- 제안: eventDraftValidator.ts:92의 message를 `다른 이벤트 '${ce.name}'가 순환 호출됩니다.`처럼 이름으로 바꾸고, eventDraftIssueDetails.ts RULES에 callCommonEvent.cycle/recursionDepth 등록 진행을 추가해 공통 이벤트 목록을 여는 openTestId를 제공한다. 대상이 없는 프로젝트 급 이슈는 행에 «이동 없음»을 명시해 무반응 클릭을 없앤다.

**D54. 드래프트 금고에 용량·정리·실패 처리가 없어 크래시 복구가 말 없이 죽는다**

- 근거: `src/project/eventDraftVault.ts:194-196` · `src/editor/panels/eventEditor/modal.ts:383-384` · `src/project/eventDraftVault.ts:104-105`
- 문제: (1) quota 초과 시 console.warn뿐이라 이후 모든 체크포인트가 조용히 실패하고 크래시 복구가 죽었음을 UI가 알리지 않는다. (2) 체크포인터는 original 대비 diff만 보므로 이미 체크포인트된 변경도 매 1.5초마다 remember(무조건 set+schedule, eventDraftVault.ts:29-40)되어 금고 전체 JSON이 setItem된다 — 변경이 있는 편집기가 켜져 있기만 해도 재직렬화가 반복된다. (3) 용량 상한·만료·LRU가 없고 맵 삭제는 금고 행을 지우지 않는다(eventDeletion.ts:21의 이벤트 삭제 forget과 대비, actions.ts:162 삭제 경로에 forget 부재) — 없는 맵의 행이 영구 잔존하며 매 persist마다 다시 쓰인다.
- 제안: persist 실패를 푸터 상태 배지·토스트로 승격하고 재시도를 둔다. rememberEventDraftVaultEntry에 본문 해시 비교를 넣어 무변화 재직렬화를 끊고, 금고에 용량 상한+오래된 항목 만료를 둔다. deleteMap 경로에서 해당 mapId의 금고 행을 forget한다.

**D55. '변경 있음'과 '저장됨 HH:MM:SS'가 동시에 떠 작업 본문이 저장되지 않는다는 사실을 가린다**

- 근거: `src/editor/panels/eventEditor/modal.ts:829` · `src/project/eventDrafts.ts:44-45` · `src/editor/panels/eventEditor/modal.ts:797`
- 문제: 편집 초안이 열려 있는 동안 원격 저장은 초안 이전 original만 저장하는 규약인데(이벤트 생성 초안은 아예 제외 — committedEvents), 드래프트 편집마다 원격 타임스탬프가 갱신되어 "변경 있음 · 저장됨 12:00:05"가 계속 최신으로 올라온다. 사용자는 "내 편집이 저장되고 있다"로 읽지만 작업 본문의 유일한 내구 사본은 1.5초 localStorage 체크포인트뿐이고 그 실패는 무경고다(앞 항목). 푸터의 "새 이벤트 · 취소 시 삭제 · 자동 저장" 칩(761행)도 정규 저장에서 제외된 new 드래프트에 "자동 저장"이라고 적어 같은 오독을 돕는다.
- 제안: 편집 초안 존재 시 원격 라벨을 "프로젝트 저장됨(편집 전 내용)"으로 바꾸거나 작업 본문 상태를 별도 칩("임시 보관됨 · 적용 전")으로 분리한다. 타임스탬프 갱신 조건에 초안 유무를 반영하고, new 드래프트 칩의 "자동 저장"을 "임시 보관" 같은 정확한 말로 고친다.

**D56. 이벤트 편집기 열기는 맵 편집 잠금을 검사하지 않아 잠금을 우회하고, 거절도 무반응이다**

- 근거: `src/editor/panels/eventEditor/modal.ts:66-68` · `src/editor/mapEditLocks.ts:56-57` · `src/editor/EditScene.ts:1515-1516`
- 문제: 타일 칠·이동·삭제 등 모든 변경 표면은 canEditMap+mapEditLockNotice로 막지만(DragOperationHandler.ts:220-221, actions.ts:425-426), 이벤트 편집기 열기에는 그 검사가 없다(modal·eventDraftActions 어디에도 mapEditLocks 미임포트). 타 팀원이 잠긴 맵의 이벤트를 더블클릭하면 편집기가 열리고 드래프트 생성부터 적용까지 로컬에서 통과한다 — 잠금 체계가 가장 무거운 편집 표면에서만 무력화되며 앞 항목의 충돌 유실로 직결된다. 또 뷰어/fail-closed 세션(teamAccess.ts:6 'Fail closed')에서는 begin 실패가 무반응으로 끝나는데, 같은 파일 EditScene.ts:1508의 "피드백 없는 실패는 금지" 원칙을 이 입구만 어긴다.
- 제안: openEventEditorModal·openNewEventEditorModal 입구에서 canEditMap(mapId)을 검사해 실패 시 mapEditLockNotice 토스트로 거절하고, beginExistingEventDraft가 false를 반환해도 안내를 내보낸다. 잠금 보유자 변경 시 열린 편집기에는 편집 차단 배너를 띄워 적용을 막는다.

**D57. 최소화 복귀 경로 — minimized 동안 렌더 전부 유실, restoreWindow가 재렌더 없이 복귀**

- 근거: `src/editor/panels/eventEditor/modal.ts:179-180` · `src/editor/panels/eventEditor/modal.ts:324-325` · `src/editor/editorState.ts:134-135`
- 문제: renderSurface는 minimized 동안 모든 store/editorState 갱신을 조기 반환으로 버린다(modal.ts:325, store.subscribe→refresh 364-376). 그런데 restoreWindow는 editorState.set이 동기 구독자를 부르는 시점에 minimized가 아직 true인 상태로 set을 먼저 날리고(editorState.ts:134-135, set은 동기) un-hide 후 재렌더를 요청하지 않는다. 결과: 최소화 중 일어난 프로젝트 변경이 전부 유실되고, 다음 store 변경이 올 때까지 본문·푸터 상태가 최소화 시점 그대로다. 실제 시나리오 — 최소화 후 맵에서 이벤트를 드래그로 이동하면 복귀해도 헤더 좌표 칩이 옛 좌표를 보인다(좌표 칩은 애초 refreshHeaderPageSegments:803-820에 갱신 코드가 없어 열 때 값이 영원히 남는다).
- 제안: restoreWindow에서 minimized=false·hidden 해제 뒤 renderSurface()를 1회 호출해 유실된 갱신을 재적용하고, modal.ts의 refreshHeaderPageSegments에서 [data-testid=event-editor-coords] 칩을 ev.x/ev.y로 함께 갱신한다.

**D58. 피커로 대상 스위치/변수를 바꿔도 폼의 참조 힌트가 이전 레코드 기준으로 고정된다**

- 근거: `src/editor/panels/eventEditor/commandBodyVariable.ts:213` · `src/editor/panels/eventEditor/commandEditDialog.ts:307`
- 문제: recordUsageHint는 렌더 시점의 recordId로 텍스트가 박힌 정적 div(recordUsageHint.ts:15-20)인데, setVariable/setSwitch/getFriendship 폼은 id만 바뀔 때 재빌드되지 않는다(commandEditDialog.ts shouldRerenderCommandForm — setVariable은 소스/연산 변경에서만 true, 303-308행). 그래서 피커 패널로 대상 변수를 바꾸면 프리뷰/수식은 갱신되지만 폼 아래 참조 힌트는 이전 변수의 것을 계속 보여 준다. 이 힌트의 존재 이유가 "지금 고른 레코드가 어디서 쓰이는지"인데 반대 정보를 준다. commandBodyCore.ts:1057(setSwitch), 1208(getFriendship)도 동일.
- 제안: recordUsageHint가 { root, update(id) } 핸들을 반환하게 바꾸고 commandBodyVariable.ts apply()·commandBodyCore.ts setSwitch/getFriendship onChange에서 update(currentId)를 호출한다. 또는 hint를 context.getCurrentCommand() 기반 지연 렌더로 바꾼다.

**D59. 참조 수 표기 "이벤트 N곳 / 쓰는 곳 N곳"이 실제로는 JSON 문자열 발생 수다**

- 근거: `src/editor/panels/eventEditor/recordUsageHint.ts:18` · `src/editor/panels/eventEditor/recordUsageHint.ts:28-29`
- 문제: countRecordReferences(recordUsageHint.ts:23-38)와 recordKinds.createUsageCounter(recordKinds.ts:112-135)는 JSON 직렬화 문자열에서 "\"id\"" 발생 횟수를 그대로 센다. 같은 이벤트 안에서 V5를 2번 참조(V5=V5 등)하면 "이벤트 2곳에서 쓰입니다"가 되고, 이벤트 1곳에서 3번 쓰여도 "3곳"이다. 피커 패널 행의 "쓰는 곳 N곳"(recordPickerPanel.ts:412)과 "이 맵에서 쓰는 중" 분류(recordPickerPanel.ts:252-255)도 같은 발생 수 기반이라 실제 사용처 수와 어긋난다. 또 임의 문자열 필드가 같은 id를 가지면 참조가 아닌데도 집계된다.
- 제안: 집계를 "발생 수"에서 "이벤트 수"로 바꾼다: project.maps/commonEvents를 순회하며 이벤트별로 id 포함 여부를 검사하는 카운터로 교체(recordUsageHint.ts, recordKinds.ts 공용화). 문구가 발생 수를 유지할 거라면 "N번 참조"로 단위를 고치고 두 표면을 일치시킨다.

**D60. 전투 처리 폼의 변수 목록 재선택 후에도 옵션 라벨이 개명 전 이름·날 id로 남는다**

- 근거: `src/editor/panels/eventEditor/commandBodyDatabase.ts:467` · `src/editor/panels/eventEditor/commandBodyDatabase.ts:478-479`
- 문제: 전투 처리 폼의 변수 픽커(namedVariablePicker)는 생성 시점의 namedVariablesOf 스냅샷을 클로저에 박아두고(commandBodyDatabase.ts:467), "변수 목록" 패널에서 변수를 새로 만들거나 개명한 뒤 선택하면 onSelect → rebuild(id)가 낡은 named로 옵션을 다시 그린다(472-483). 결과: 새로 지은 이름을 가진 변수는 옵션에 없으므로 날 id(예: "var21")가 라벨로 박히고(478-479), 개명한 변수는 옛 이름이 그대로 표시된다. id는 옳아도 폼이 저작자에게 거짓 이름을 보여 주는 known #7과 같은 클래스의 미보고 화면이다.
- 제안: rebuild가 호출될 때마다 namedVariablesOf(store.getCurrent())를 다시 읽게 하고(467행 스냅샷 제거), onSelect에서 options.onChange 전에 rebuild(id)가 최신 프로젝트를 보도록 순서를 유지한다. switchVariablePicker.ts:63-72 labelOf의 라이브 읽기 패턴을 그대로 따른다.

**D61. 미리보기 「전체 맥락 보기」가 전체가 아니라 현재 단계 캡션 한 줄의 복제**

- 근거: `src/editor/panels/eventEditor/eventScriptModernViews.ts:156-157` · `src/editor/panels/eventEditor/eventScriptModernViews.ts:72-74` · `src/styles/event/previews/command-preview-4.css:101-103`
- 문제: details 요약은 「전체 맥락 보기」·aria-label 「전체 명령 및 분기 맥락」이라 약속하지만, renderStep이 body에 현재 단계 캡션 한 줄을 덮어써 넣는 것이 전부다. 5em 스크롤 영역이 준비돼 있어도 내용은 항상 한 줄이라, 긴 페이지의 전체 펼친 스크립트(건너뛴 분기 포함)를 훑을 창이 미리보기 안에 실제로 없다. 라벨을 믿고 펼친 사용자는 스크롤해도 캡션과 동일한 문장의 중복만 발견한다.
- 제안: eventScriptModernViews.ts renderStep에서 contextBody.textContent 대입을 제거하고 flattenScript(page.commands, eventId, mapId) 전체 스텝을 행으로 한 번 렌더한 뒤 단계 이동 시 해당 행만 클래스 토글로 강조(스크롤은 scrollIntoNearestScroller 재사용). 라벨은 실제 내용에 맞춰 정리.

**D62. AI 초안 diff에서 되돌린 부모 아래 자식 행의 마크·토글이 실제 적용과 어긋나는 죽은 컨트롤**

- 근거: `src/editor/panels/eventEditor/stagedDiffView.ts:198-199` · `src/editor/panels/eventEditor/stagedDiffView.ts:110-111` · `src/editor/panels/eventEditor/commandDiff.ts:364-365`
- 문제: branchProjection은 제외한 부모 아래 자식 투영을 none/before로 물려주지만 renderRow는 이 값을 받지 않고 status != keep인 모든 행에 마크와 「빼기」 토글을 무조건 렌더한다. aiAssist.ts:334-338의 onToggle은 자식 id를 excluded에 넣고 다시 그릴 뿐, applyCommandDiff는 부모가 제외되면 하위 트리째 스킵하므로 자식 토글은 결과에 아무 영향이 없다. 자식 행은 「＋ 새로 생김」처럼 보이면서 실제로는 적용되지 않고, 토글을 누르면 표시만 바뀌어 「적용하면 이렇게 됩니다」라는 뷰의 핵심 신뢰가 깨진다.
- 제안: appendRows→renderRow로 projection을 전달해 projection이 none/before인 자식은 토글을 생략하거나 disabled로 바꾸고 「부모와 함께 적용 취소됨」 캡션을 붙인다. 마크(STATUS_MARK)도 row.status 대신 투영 기준으로 계산해 번호 유무(rowSurvives)와 정합.

**D63. 보기 전환 후 선택 명령이 화면 밖에 남음 — 스토리보드 재생성 시 스크롤 복원·선택 스크롤 부재**

- 근거: `src/editor/panels/eventEditor/content.ts:306-307` · `src/editor/panels/eventEditor/content.ts:311-312` · `src/editor/panels/eventEditor/modal.ts:326-326`
- 문제: 보기 전환(list↔스토리↔플로우)은 applyViewMode가 스토리보드를 통째로 새로 그리는데, modal.ts의 스크롤 스냅샷·복원은 스토어 refresh 경로(326→354행)에만 걸려 있어 전환 시 적용되지 않는다. 선택 복원은 인스펙터 채우기까지만 하고 카드를 화면으로 데려오는 코드가 없다(eventEditor 내 scrollIntoView는 피커·커스텀 셀렉트·경고벨뿐). 긴 이벤트에서 명령을 고른 뒤 뷰를 옮기면 하이라이트는 유지되지만 화면 밖에 남아 매번 수동으로 찾아야 하고, 열 스크롤은 콘텐츠 길이가 다른 새 뷰에 낡은 offset 그대로 남는다.
- 제안: content.ts applyViewMode에서 스토리보드 재생성 직후 storyboardEl.querySelector('[aria-current="step"]')를 구해 validationBell.ts:159-162의 scrollIntoNearestScroller(target, "center")로 명령 열 안에서만 스크롤. 플로우 전환 시에도 flowHost의 .event-flow-node.is-current에 동일 적용.

**D64. 스토리·플로우 요약이 잘리는데 전문을 볼 통로가 없음(title 칸이 조작 안내로 점유)**

- 근거: `src/editor/panels/eventEditor/storyboardView.ts:337-338` · `src/styles/event/command-list-3.css:611-611` · `src/editor/panels/eventEditor/eventScriptModernViews.ts:301-301`
- 문제: 스토리 카드 상세는 nowrap 말줄임으로 잘리지만 row title 칸은 고정 조작 안내(「한 번 클릭하면 선택…」)가 점유해 잘린 전문을 볼 툴팁이 없다. 전문은 aria-label에만 있어 시각 사용자는 편집 창을 열기 전까지 대사·조건 전문을 읽을 수 없다. 플로우 노드는 46자 JS 절단에 title조차 「누르면 오른쪽에서…」라 요약 전문이 어디에도 없다. 뷰 3종(목록 요약 80자/스토리 CSS 말줄임/플로우 46자)이 각자 다른 기준으로 정보를 잃는다.
- 제안: storyboardView.ts 카드·브랜치 리프와 eventScriptModernViews.ts flowNode의 detail span에 이미 계산된 info.detail/summary 전문을 title로 주입하고, 조작 안내는 aria-label(이미 존재)로 일원화한다. 자르기 기준(80/46/CSS)은 commandSummary 쪽 상수 하나로 통일해 뷰별 편차를 없앤다.

**D65. 명령 추가 후 새 명령이 선택되지 않음(인스펙터에 이전 선택 잔존)**

- 근거: `src/editor/panels/eventEditor/content.ts:1021-1023` · `src/editor/panels/eventEditor/eventActions.ts:159-159`
- 문제: 「+ 다음 명령」/분기 추가/빈 이벤트 CTA 모두 추가 콜백이 addCommand·insertCommand만 호출하고 선택을 갱신하지 않는다(eventActions의 add/insert는 store.update 외 부수효과 없음). 모달 refresh 후 새 명령은 하이라이트·인스펙터 바인딩 없이 목록 끝에만 붙고 이전 선택이 그대로 남아, 방금 만든 카드가 어디 붙었는지 시각 피드백이 전혀 없다.
- 제안: content.ts 추가 콜백에서 적용 후 실제 경로를 계산해 selectStoryboardCommand(path)를 호출한다(루트 추가는 [activePage.commands.length-1], insert는 [...path.slice(0,-1), lastIdx]). selectionScope가 목록·스토리·플로우에서 공유되므로 이 한 줄로 세 뷰의 하이라이트와 인스펙터가 동시에 맞춰진다.

**D66. 도움말이 「새 페이지는 앞선 페이지의 그래픽을 물려받는다」고 거짓 안내한다 — 실제로는 항상 빈 그래픽 페이지**

- 근거: `src/editor/panels/eventEditor/eventEditorHelp.ts:116` · `src/editor/eventPages.ts:119-126`
- 문제: addEventPage는 createDefaultEventPage에 sprite를 넘기지 않아(eventPages.ts:119-126, :31에 의해 graphic:{}) 그래픽·명령·조건이 모두 빈 페이지를 만드는데, 도움말은 그래픽 상속을 보장한다. 초보자는 + 뒤 빈 미리보기를 버그로 오해하거나 그림이 물려받았다고 믿고 조건만 고쳐 저장했다가 게임에서 캐릭터가 사라진다.
- 제안: addEventPage가 직전 페이지의 graphic·trigger·movement를 복사하되 conditions만 비우게 하거나(RM 계열 관례), 최소한 eventEditorHelp.ts:116의 상속 문구를 실제 동작(빈 페이지)으로 고친다.

**D67. 도움말이 실제 UI와 다른 버튼 이름·단축키·용어를 가르친다**

- 근거: `src/editor/panels/eventEditor/eventEditorHelp.ts:89` · `src/editor/panels/eventEditor/eventEditorHelp.ts:49` · `src/editor/panels/eventEditor/options.ts:31-35`
- 문제: ① 푸터: 실제 라벨은 「저장하고 닫기」·「이벤트 삭제」인데 도움말은 「확인」「삭제」「도움말」이라 부른다(푸터에 없는 도움말 버튼을 안내한다). ② 단축키: 「+ 새 페이지 추가」는 어디에도 바인딩이 없다(전역 +는 맵 줌이며 이벤트 편집기 안에선 가드·무동작). ③ Ctrl+K 설명의 「스킬」은 제거된 기능이고, 에디터 안 Ctrl+K는 전역 팔레트가 아니라 명령 피커를 연다. ④ 트리거를 「실행 행동, 정기 병렬…」이라는데 실제 선택지는 「말을 걸면/플레이어가 닿으면/나타나면 바로 실행/뒤에서 계속 실행」. ⑤ 개요 캡션의 레이아웃도 실제 3열 구조와 다르다.
- 제안: GUIDE_SECTIONS의 라벨·단축키·용어를 실제 소스(TRIGGER_OPTIONS, modal.ts 푸터 문자열, Ctrl+K 실동작)에서 상수로 인용하게 바꾸고, 도움말 문장과 실제 라벨의 대조 테스트를 추가해 드리프트를 잡는다. 「+ 페이지 추가」 행은 삭제한다.

## E. P2 — 접근성

**E68. 탭 이름 바꾸기 확정 순간 포커스가 사라진다 — 재정렬 경로와 달리 복원이 없다**

- 근거: `src/editor/panels/eventEditor/pageProps.ts:125-126` · `src/editor/panels/eventEditor/pageProps.ts:440-440`
- 문제: 이름 바꾸기 Enter 확정 → updateEventPage → modal.ts:364-375 의 store.subscribe → refresh → renderSurface 가 페이지바를 통째로 다시 그려 입력 상자가 DOM 에서 제거되고 포커스가 body 로 떨어진다. Ctrl+←/→ 재정렬 경로는 focusRenderedPageTab 으로 탭을 되찊지만(pageProps.ts:440) 이름 바꾸기 확정 분기에는 이 호출이 없어, F2 → 이름 입력 → Enter 만으로 키보드 사용자가 탭 줄에서의 위치를 잃고 다음 Tab 은 포커스 트랩 시작점(모달 첫 컨트롤)부터 다시 돌게 된다.
- 제안: beginPageTabRename 의 commit 분기에서 updateEventPage 직후 focusRenderedPageTab(page.id) 를 호출하라(pageProps.ts:440 과 동일 패턴). store 렌더가 동기이라 호출 시점에 이미 새 탭이 마운트돼 있다.

**E69. optgroup 헤더가 role=listbox 안 무자격 div — 그룹 시맨틱 붕괴(실사용 경로)**

- 근거: `src/editor/panels/eventEditor/customSelect.ts:166-167` · `src/editor/panels/mapCreateDialog.ts:42-46`
- 문제: optgroup 을 role=listbox 안에 평문 div 로 렌더링하고 옵션 버튼들은 그 형제로 붙인다(167-189). ARIA listbox 의 자식은 option|group 이어야 하므로 무자격 div 헤더는 규격 위반이고, 헤더가 group 이 아니므로 옵션들의 소속 관계도 스크린리더에 전달되지 않는다. 이 경로는 실사용이다 — mapCreateDialog.ts(하위 맵 만들기)와 mapProps 타일 그림판 select 가 openEventSubdialog(subdialog.ts:88)로 감싸져 appendGroupedTilesetOptions 의 optgroup 을 그대로 통과한다.
- 제안: customSelect.ts buildMenuOptions 에서 그룹 전체를 role=group + aria-labelledby=헤더 id 컨테이너로 감싸고 옵션 버튼을 그 안에 append 한다. 헤더 div 는 role=presentation(또는 aria-hidden)으로 바꿔 이중 낭독을 막고, filterMenu(224-237)의 group.hidden 로직은 헤더가 아니라 group 컨테이너 기준으로 수정한다.

**E70. 명령 행 드래그 핸들이 중첩 role=button — 행 접근 이름 오염 + 키보드로는 엉뚱한 동작(삽입 피커) 발화**

- 근거: `src/editor/panels/eventEditor/commandList.ts:142-144` · `src/editor/panels/eventEditor/commandList.ts:154-157` · `src/editor/panels/eventEditor/commandListDragDrop.ts:10-14`
- 문제: 명령 행 head가 role="button" tabindex=0(commandList.ts:142-147)인데 그 안에 드래그 핸들이 또 role="button" tabindex=0 + aria-label="명령 0.1 순서 변경 핸들"(:154-159)로 중첩되어 있다. (1) 접근 이름 계산(name-from-content)에서 자손의 aria-label이 그대로 더해지므로 행 버튼 이름이 '명령 0.1 순서 변경 핸들 (명령 요약)'처럼 핸들 문구로 시작해 읽힌다. (2) 버튼 안의 버튼은 중첩 대화형 위반이고 행마다 탭 정지점이 2개 생긴다. (3) 핸들에는 자체 keydown/click이 없고 enableItemDrag는 pointerdown만 바인딩(commandListDragDrop.ts:10-14)하므로, 키보드 사용자가 '순서 변경 핸들 버튼'에서 Enter/Space를 누르면 head로 버블된 handleCommandShortcut(commandListContextMenu.ts:145-156)이 Enter=삽입 피커, Space=편집 모달을 열어 발표된 이름과 다른 동작을 한다.
- 제안: commandList.ts의 핸들에서 role="button"과 tabindex를 빼고 aria-hidden="true" + title로 드래그 전용 시각 요소로 만든다(키보드 재정렬은 이미 행에 있는 '위로/아래로' 버튼 commandList.ts:542-551로 가능하니 head title·aria-keyshortcuts에 그 경로를 안내). 행 head의 접근 이름은 commandSummary 텍스트 기반 'N번째 명령: {요약}'으로 고정하려면 head에 aria-label을 직접 부여해 자손 오염을 차단한다.

**E71. 명령 목록이 role 없는 div 나열 — 목록 시맨틱 부재, 실행 순서 번호는 aria-hidden**

- 근거: `src/editor/panels/eventEditor/content.ts:195` · `src/editor/panels/eventEditor/commandList.ts:121-124` · `src/editor/panels/eventEditor/commandList.ts:178-183`
- 문제: 명령 목록 전체가 role 없는 div 나열이다. .cmd-list(content.ts:195)도 .cmd-item(commandList.ts:121)도 list/listitem 역할이 없어 스크린리더의 목록 탐색(예: NVDA 리스트 단축키)이 불가능하고, 분기 마커·빈 분기·추가 줄까지 구분 없이 한 덩어리 텍스트로 낭독된다. 실행 순서를 알려주는 cmd-step 번호는 aria-hidden으로 감춰져 있어(commandList.ts:178-183) '몇 번째 명령인지'도 청각으로는 알 수 없다. 같은 리포지토리의 stagedDiffView.ts:50,155는 role="list"/"listitem"을 이미 쓰고 있어 패턴 부재가 아니라 이 표면만 빠졌다.
- 제안: commandList.ts renderCommandList에서 host에 role="list" + aria-label("이 페이지 명령 순서"), renderCommandItem의 .cmd-item과 renderMarkerLine·renderEmptyBranchLine·renderBranchAddLine 행에 role="listitem"을 부여한다. cmd-step은 aria-hidden을 제거해 '1', '2' 번호를 낭독하거나, 유지할 경우 head aria-label에 `${step}번째`를 포함한다.

**E72. 워크벤치 3열에 헤딩·랜드마크 없음 — 열 제목이 div/span, 인스펙터 열엔 열 제목 자체가 없음**

- 근거: `src/editor/panels/eventEditor/content.ts:463-468` · `src/editor/panels/eventEditor/content.ts:416-419` · `src/editor/panels/eventEditor/content.ts:351`
- 문제: 다이얼로그 본문에서 유일한 구조 단위인 워크벤치 3열(설정·명령·인스펙터)이 모두 일반 div다. columnLabel이 반환하는 열 제목도 div/span(content.ts:463-471)이라 헤딩이 아니고, columnLabel 호출은 settings(:351)와 commands(:394-400)뿐이라 inspector 열에는 열 제목 요소 자체가 없다(column-label-inspector 렌더 코드 부재 — commandInspector.ts에도 열 머리글 없음). 스크린리더 사용자가 헤딩 탐색으로 3열 사이를 건너뛸 수 없고, 대형 모달 전체가 랜드마크 없는 평지라 페이지 탭 줄 다음 어디가 어디인지 파악이 어렵다. 창 자체는 role="dialog" aria-label="이벤트 편집"(modal.ts:144-147)뿐이고 어떤 헤딩/필드와도 연결되어 있지 않다.
- 제안: content.ts columnLabel의 제목 span을 h2(또는 role="heading" aria-level="2")로 바꾸고 inspector 슬롯 호출을 복원('선택한 명령')한다. settingsColumn/commandsColumn/inspectorColumn에 role="region" aria-labelledby={열 제목 id}를 부여하고, modal.ts windowEl에 aria-labelledby로 이벤트 이름 필드 또는 숨은 h1을 연결해 창 이름을 현재 이벤트와 묶는다.

**E73. 적용 후 복귀 포커스가 스코프 첫 버튼(헤더 툴바)에 떨어져 편집 위치 상실**

- 근거: `src/editor/panels/eventEditor/subdialog.ts:54-55` · `src/editor/panels/eventEditor/content.ts:236`
- 문제: 확인(적용)으로 닫으면 onApply가 목록을 재렌더해 원래 트리거 행이 파괴되고(subdialog.ts:47의 document.contains 체크 실패), 폴백은 스코프(이벤트 편집기 모달)의 '첫 번째 button'에 포커스를 꽂는다 — DOM 순서상 헤더의 검증 벨/테스트 버튼 쪽. 편집하던 명령은 목록 깊숙이 있는데 복귀 포커스는 창 최상단 툴바에 떨어지므로, 키보드 사용자는 명령을 편집할 때마다 위치를 잃고 목록을 처음부터 다시 Tab해야 한다. 취소로 닫을 때만 의도한 행 복귀가 일어나는 비대칭도 혼란을 키운다.
- 제안: openEventSubdialog에 returnFocusHint(복귀 대상 셀렉터/요소) 옵션을 추가해 close() 폴백이 스코프 전체 첫 버튼 대신 힌트를 먼저 시도하게 하고, content.ts:233 호출부에서는 적용 후 편집된 명령 행(path 기반 testid)을 재검색해 전달. 최소 수정은 폴백 검색 범위를 .cmd-list 내부 버튼으로 좁히는 것.

**E74. NPC 관계 연결 목록의 role=listbox/option 시맨틱 위반**

- 근거: `src/editor/panels/eventEditor/characterIdPickerDialog.ts:165` · `src/editor/panels/eventEditor/characterIdPickerDialog.ts:330` · `src/editor/panels/eventEditor/characterIdPickerDialog.ts:240-241`
- 문제: role=listbox 컨테이너 안에 role=option 버튼과 옵션이 아닌 일반 div(빈 상태 안내)가 섞여 ARIA 구조를 위반한다. listbox 역할을 부여하면 스크린리더는 방향키 탐색과 단일 선택 모델을 기대하지만, 구현은 행별 Tab 이동뿐이고 aria-activedescendant도 없어 발표된 역할과 실제 키 동작이 어긋난다. 안내 div는 옵션 목록의 자식이라 '옵션 N개' 읽기와 탐색을 오염시킨다.
- 제안: listbox/option 모델을 지키려면 컨테이너에 tabindex=0+aria-activedescendant를 두고 방향키 이동을 구현하며, 빈 상태 안내 div는 listbox 밖 형제 요소로 이동. 구조를 단순화하는 쪽이면 role을 제거하고 aria-label을 붙인 일반 버튼 목록으로 바꾸는 것이 기존 Tab 동작과 일치한다.

**E75. 컨텍스트 메뉴 활성 항목 텍스트 3.08:1 — --text-inverse 미정의 상태에서 폴백 var(--text-1) 사용**

- 근거: `src/styles/event/command-list.css:511-515` · `src/styles/database/light-theme.css:2,84`
- 문제: 명령 우클릭 메뉴의 hover/focus 활성 항목이 background: var(--accent) 위에 color: var(--text-inverse, var(--text-1)) 을 쓰는데, --text-inverse 는 .database-modal-backdrop(light-theme.css:84)과 map/core.part-1.css:39 스코프에서만 정의되고 이벤트 에디터에서는 미정의다. 폴백 var(--text-1)(#0F172A) 이 인디고 #4A57D6 위에 찍혀 대비 3.08:1 — 13px 본문에 AA 4.5:1 미달. dialogs-2.css:924-926 의 단축키 표시(color: var(--text-1))도 동일 계산. 같은 파일 dialogs-4.css:743 은 var(--text-inverse, #fff) 로 올바르게 폴백해 불일치도 있다.
- 제안: command-list.css:514 과 dialogs-2.css:926 의 폴백을 var(--on-accent) 로 교체(토큰은 tokens.css:58 에 정의됨). 애초 --text-inverse 를 :root 에 --on-accent 별칭으로 리브리지(tabs-b-shell-layout.css 패턴)하면 재발 방지.

**E76. 숫자 입력 커서 슬롯 표시가 --focus-ring(45% 알파) 하나뿐 — #F7F8F8 위 1.98:1, 형태 변화 없는 색만 상태**

- 근거: `src/styles/event/previews/command-preview.css:873-875` · `src/styles/tokens.css:94`
- 문제: 입력 숫자 프리뷰에서 다음에 입력될 자리를 알려주는 .cursor 슬롯은 .filled 와 border-color(--border-default), 배경, 글자색이 모두 같고 유일한 차이가 box-shadow: var(--focus-ring) 뿐이다. 이 토큰은 rgba(74,87,214,0.45) 로 #F7F8F8 합성 시 1.98:1 — 3:1 미달이고 '커서가 여기다'를 색 차이 하나로만 전달한다(WCAG 1.4.1·1.4.11 동시 미달). 토큰 자체가 tokens.css:94 에서 45% 알파로 정의돼 있어 재사용 시마다 같은 결함이 복제된다(forms-4.css:392 주의 애니메이션도 이 토큰 소비).
- 제안: tokens.css:94 의 --focus-ring 알파를 0.55→0.75 로 올리거나(흰 위 3:1 확보), .ecp-number-slot.cursor 는 border-color: var(--accent) + 1px 점선 캐럿 glyph 을 추가해 형태 차이로도 구분. --focus-ring 을 실질 포커스 인디케이터로 쓰는 곳은 --focus-outline(2px solid var(--accent), 5.79:1)으로 치환.

**E77. 선택/무효 상태가 저대비 색 tint 만으로 전달됨 — transfer 맵 행(aria 상태 없음), 드롭 불가 행(색+투명도만)**

- 근거: `src/styles/event/subdialogs/dialogs-2.css:406-407` · `src/editor/panels/eventEditor/transferPlayerDialog.ts:279-281` · `src/styles/event/command-list-2.css:364-366`
- 문제: 장소 이동 다이얼로그의 맵 목록에서 '지금 선택된 대상'은 .selected 배경 tint(color-mix(--accent-soft 78%)) 하나로만 표시된다. --accent-soft=--accent-muted(12% 알파)이므로 흰 위 실질 대비 ≈1.1:1 로 색 자체도 거의 안 보이고, 버튼 attrs 는 type:button 뿐이라 aria-pressed/aria-current 도 없어 스크린리더엔 아예 미전달. 같은 패턴으로 드래그 드롭 불가 행(.cmd-drop-invalid)은 붉은 링 65%+opacity 0.6 조합만이 상태 전달 수단이다(텍스트/아이콘 없음).
- 제안: transferPlayerDialog.ts:281 attrs 에 aria-pressed: String(node.mapId === draft.mapId) 추가, dialogs-2.css:406 에는 배경 대신 inset 링(color-mix(--accent 100%) 2px) 또는 선행 ✓ 마커를 대어 색 의존 제거. cmd-drop-invalid 는 command-list-2.css:363 에 ✕ 글리프/«놓을 수 없음» 라벨 병기.

**E78. 그래픽 미리보기 무한 걷기 루프 2종이 prefers-reduced-motion 미대응**

- 근거: `src/styles/event/subdialogs/dialogs.css:913-914` · `src/styles/event/subdialogs/dialogs-4.css:467-468`
- 문제: 이벤트 그래픽 프리뷰(eventGraphicPreview.ts:258 markMovingPreview 가 .moving 부여)와 NPC 걷기 프리뷰(npcGraphicPicker.ts:104, commandBodyAdvanced.ts:911)가 배경 스프라이트를 660ms/880ms steps(1,end) infinite 로 영구 순환한다. event/ 폴더에는 축소 모션 블록이 8곳 있고 shell-2.css:315 는 "prefers-reduced-motion 사용자에게는 아예 돌지 않는다"가 방침인데, 이 두 무한 루프는 어느 블록에도 걸리지 않아 전정 장애 사용자에게 서브다이얼로그가 열려 있는 내내 움직임을 강제한다. 같은 파일 dialogs-4.css:877 의 .is-attention 1회 펄스도 forms-4.css:367 블록(팝오버만 커버)에 걸리지 않는다.
- 제안: dialogs-4.css 에 @media (prefers-reduced-motion: reduce) 로 .npc-graphic-picker .npc-walk-preview 와 .event-graphic-preview.moving 에 animation:none + 0% 키프레임 background-position(var(--npc-walk-frame-0) / var(--event-graphic-frame-a)) 고정을 추가하고, 같은 블록에 .event-custom-select-trigger.is-attention { animation: none; } 도 포함한다.

**E79. 페이지 탭·런타임 배지 툴팁이 지연 툴팁 계약을 어긴다(키보드 초점 무표시)**

- 근거: `src/editor/panels/eventEditor/pageProps.ts:318-319` · `src/editor/panels/eventEditor/commandRuntimeBadge.ts:10-11` · `src/editor/delayedTooltipRollout.ts:15`
- 문제: openwiki/delayed-tooltip.md 는 "아이콘만 있는 컨트롤·탭에 한 가지 지연 툴팁 동작"과 "키보드 초점은 같은 라벨을 즉시 보여 준다"를 계약으로 명시하지만, 이벤트 편집기는 이를 우회한다. 초점 가능한 페이지 탭(조건 요약이 title 에만 존재, pageProps.ts:465 pageTabTooltip)과 아이콘만 있는 런타임 배지(text: badge.icon, 라인 8)가 네이티브 title 을 쓰는데 네이티브 title 은 키보드 초점에 절대 표시되지 않아 탭 조건·배지 사유가 마우스 전용 정보가 되고, 1.2초 지연·Escape·pointerdown 닫기 계약도 적용되지 않는다. 롤아웃 표 27줄에 이벤트 편집기 대상은 0개다.
- 제안: DELAYED_TOOLTIP_ROLLOUT 에 이벤트 편집기 페이지 탭 testid 와 런타임 배지 testid(commandRuntimeBadge) 줄을 추가하고 attachDelayedTooltip 으로 전환한다. name 은 기존 pageTabTooltip/badge.tooltip 문자열을 재사용하고 label 은 6자 이하 규칙을 유지하며, title 은 계약대로 포인터 얹힌 동안만 떼는 기존 delayedTooltip.ts 구현에 맡긴다.

**E80. 토스트 자동 소멸이 읽기 시간을 보장하지 않고 만료 뒤에도 포커스 가능**

- 근거: `src/util/toast.ts:118` · `src/util/toast.ts:79-80` · `src/styles/map/palette-player.css:50-51`
- 문제: 이벤트 편집기 전역(명령 복사·삭제·검증 안내)이 쓰는 토스트가 메시지 길이와 무관하게 info 2초·error 4초로 고정이고 hover/focus 시 타이머 일시정지가 없어 읽던 중 사라진다. 게다가 만료된 최신 토스트는 show 클래스만 떼고 DOM 에 남는데(테스트 계약 유지용), 기본 스타일은 opacity:0 + pointer-events:none 일 뿐 visibility:hidden/inert 가 없어 만료 직전 action 버튼(삭제 복구 등)에 키보드 포커스가 가면 눈에 보이지 않는 버튼에 포커스가 머문다.
- 제안: toast.ts:118 을 최소 표시시간 = max(기본값, 1200 + message.length × 65ms, 상한 8s) 로 바꾸고, ensureStack 에 pointerenter/focusin 에서 clearTimeout·pointerleave/focusout 에서 재가동하는 pause 를 추가한다. palette-player.css 에는 .toast:not(.show) { visibility: hidden; transition: visibility 0s 0.2s; } 를 넣어 퇴장 애니메이션은 보존하되 만료 즉시 탭 순서에서 제거한다.

## F. P2 — 개발자 경험

**F81. 리치 폼 공용 헬퍼 12계열이 2~5개 파일에 복붙(약 350줄) — valueSourceControls 등은 이미 드리프트 진행 중**

- 근거: `src/editor/panels/eventEditor/commandBodyM2Page3.ts:1770-1841` · `src/editor/panels/eventEditor/commandBodyM2Actor.ts:954-1031` · `src/editor/panels/eventEditor/commandBodyPage3Native.ts:1546-1548`
- 문제: shell 3벌, intentCard 4벌, fieldBlock 4벌, line/note/layout 2벌씩, variableLabel 4벌, clamp01 2벌, eventRecords 3벌(형태 이미 상이), numberInput 5벌 — 합산 약 350줄이 복붙돼 있다. 특히 valueSourceControls 78줄이 M2Page3:1770-1841과 M2Actor:954-1031에 거의 동일하고 M2Actor 사본에만 setNumber가 추가돼 갈라지기 시작했다. 다음 수정자는 4곳을 모두 고쳐야 하고 한 곳만 고치면 폼 간 동작 불일치가 생긴다.
- 제안: richFormKit.ts를 신설해 12계열을 이전하고 valueSourceControls는 setNumber를 항상 노출(미사용 no-op)해 한 벌로 통합, 4파일의 로컬 정의를 삭제 후 import로 교체한다. variableLabel은 "(미선택)"/"" 두 동작을 옵션 인자로 흡수한다.

**F82. M2 전용폼과 네이티브폼이 같은 명령 4종을 병렬 재구현(날씨 한 쌍만 290줄) — 색 팔레트는 4벌로 분열**

- 근거: `src/editor/panels/eventEditor/commandBodyM2Page3.ts:1-2` · `src/editor/panels/eventEditor/commandBodyM2Page3.ts:880-881` · `src/editor/panels/eventEditor/commandBodyPage3Native.ts:527-530`
- 문제: 같은 사용자 의도(화면 효과·그림·애니메이션·타일)가 m2Command용과 네이티브 kind용으로 두 벌 구현돼 있다: 날씨 setWeatherEffectsBody(M2Page3:880-1026, 147줄) vs setWeatherBody(Page3Native:527-669, 143줄), 애니메이션 showAnimationM2Body(1229-1296) vs showAnimationBody(795-983), 그림 pictureBody(1087-1227) vs showPictureBody(1099-1331), 타일 changeTileM2Body(1659-1715) vs changeTileBody(1382-1522). 파일 머리 주석이 '복제해 결합도를 낮춘다'고 선언하지만 실제로는 위젯·프리뷰 로직 전체가 복제됐다. 여기에 같은 팔레트/종류 목록이 중복된다: SCREEN_COLOR_OPTIONS가 m2Catalog.ts:100과 m2ModernCatalog.ts:116(export, commandBodyM2.ts:9에서 사용)에 2벌 + M2Page3 SCREEN_COLOR_SEGMENTS:39·TINT_COLOR_CHIPS:51 2벌 = 4벌, 날씨 종류도 WEATHER_CHIPS(M2Page3:82)·WEATHER_SEGMENTS(Page3Native:62)·WEATHER_PRESETS(Page3Native:82) 3벌. 한쪽만 색/종류를 추가하면 M2 폼과 네이티브 폼이 달라 보인다.
- 제안: m2Catalog.ts와 m2ModernCatalog.ts의 SCREEN_COLOR_OPTIONS를 m2ModernCatalog 쪽 한 벌로 일원화(m2Catalog는 re-export). 날씨·색조·그림슬롯 위젯은 commandBodyScreenFx.ts로 추출해 setWeatherEffectsBody/setWeatherBody가 같은 칩행+강도 스텝퍼+프리뷰 무대를 공유하게 하고, 각 본문은 필드 바인딩만 남긴다. WEATHER 종류 목록도 카탈로그 단일 상수 + SegmentOption 어댑터로.

**F83. 날씨 종류 라벨 맵 3벌 — 이미 어긋나 같은 'none'이 폼에선 "없음", 프리뷰에선 "맑음"**

- 근거: `src/editor/panels/eventEditor/commandBodyPage3Native.ts:1655-1656` · `src/editor/panels/eventEditor/commandPreview.ts:1676-1677` · `src/editor/panels/eventEditor/commandBodyM2Page3.ts:83`
- 문제: WeatherKind 라벨 맵이 3벌 난립한다: weatherLabel(Page3Native:1653-1666, none→"없음"), weatherPreviewLabel(commandPreview:1674-1689, none→"맑음"), WEATHER_CHIPS(M2Page3:83, none→"없음"). 이미 드리프트가 실제로 발생해, 같은 setWeather 명령을 폼에서는 '없음'으로 고르고 프리뷰 무대에서는 '맑음'이라는 다른 단어로 본다. 저작자는 두 표현이 같은 상태인지 확신할 수 없고, 새 날씨 종류 추가 시 3곳 중 한곳이라도 빠뜨리면 라벨이 영어 raw 값으로 새어 나온다(weatherPreviewLabel default는 String(kind) 그대로 반환).
- 제안: WeatherKind 라벨을 src/project/ 쪽 단일 상수(예: weatherLabels.ts의 WEATHER_KIND_LABELS)로 정의하고 weatherLabel·weatherPreviewLabel·WEATHER_CHIPS·WEATHER_SEGMENTS 4곳이 전부 import하게 한다. '맑음/없음' 중 정본을 하나 고르되 프리뷰 문체가 필요하면 프리뷰 전용 접두어로 조합하고 사전 어휘는 공유한다.

**F84. commandPreview.ts 1,786줄 — 50종 핸들러 디스패치+대사 엔진+효과 시뮬레이터 등 책임 5개, 추출 후보 3개 명확**

- 근거: `src/editor/panels/eventEditor/commandPreview.ts:112-113` · `src/editor/panels/eventEditor/commandPreview.ts:237-239` · `src/editor/panels/eventEditor/commandPreview.ts:1380-1383`
- 문제: commandPreview.ts는 1,786줄에 다음 책임을 모두 품는다: (a) visualPreviewHandlers:112-168에 50개 커맨드 종류 등록 디스패치, (b) 대사창 모의 엔진 — runtimeStage:222·messageWindowMock:237·renderPreviewDialogueBody:302·renderPreviewControlBadge:346·settingsMessageMock:522·choicesMock:570 (198-607 구간, 제어코드 배지·감정 프레임 포함), (c) 화면효과 재생 시뮬레이터 — legacyScreenEffectCommand:1343·screenEffectPreviewModel:1500·screenEffectPlayButton:1510·nextFrame:1550 (1330-1553, 약 224줄), (d) 시뮬레이션 상태 기반 설명 describeRuntimeEffect:1716, (e) M2 특수 케이스 m2VisualPreview:170·m2Preview:1691. 추출 후보 상위 3: ① 대사창 묶음 198-398+522-607 약 270줄 ② 화면효과 묶음 1330-1553 약 224줄 ③ 상거래 묶음 itemStage:718·storageChestStage:735·innStage:789·shopStage:827·goldStage:896 약 204줄. 분리 없이는 프리뷰 한 곳을 고치는 diff가 전부 이 파일에 몰린다.
- 제안: ① previewDialogueWindow.ts(198-398+522-607) ② previewScreenEffect.ts(1330-1553) ③ previewCommerce.ts(718-921)로 추출하면 commandPreview.ts는 핸들러 맵·요약 카드·describeRuntimeEffect만 남아 약 800줄이 된다. 세 묶음 모두 export 경계가 명확해(각 stage 함수가 visualPreviewHandlers에서만 참조) 기계적인 이동이 가능하다.

**F85. 스키마 선언 77/79종 완료됐는데 렌더 승계는 4종(5%) — 커스텀 위젯 6종 전부 미연결 placeholder라 신규 명령은 어차피 수동 commandBody를 이중으로 써야 함**

- 근거: `src/editor/panels/eventEditor/schemaCommandBody.ts:7-8` · `src/editor/panels/eventEditor/schemaCommandBody.ts:354-356` · `src/editor/eventCommands/schema/defineCommand.ts:4-5`
- 문제: 실측: 스키마 선언은 catalog.ts 53종 + catalogExtended.ts 24종 = 77종으로 네이티브 kind 78종을 사실상 전부 커버하지만, 실제 편집 폼으로 승계된 것은 SCHEMA_RENDERED_KINDS 4종(cutsceneControl/changeGold/changeItem/changeLifeSkillExp)뿐이다(4/78≈5%). 승계를 막는 구조적 병목은 FieldSpec의 custom 위젯 6종(moveRoute/choiceOptions/condition/shopStock/faceGraphic/screenPoint)이 전부 "전용 편집기" placeholder로만 존재한다는 점이다 — 분기·이동경로·상점·조건을 쓰는 명령은 스키마로 표현 자체가 불가능. 게다가 defineCommand.ts 헤더는 "15파일/약 12,000줄"이라 쓰고 있는데 glob 실측 commandBody*.ts는 23파일(commandBodyCore ~2,400줄, commandBodyAdvanced 1,706줄, commandBodyM2 ~1,700줄 등)로 이미 어긋나 있다. 신규 명령 추가자는 (1) 스키마 카탈로그에 선언(의무, 테스트가 강제)하고 (2) 수동 commandBody에 또 폼을 쓰는 이중 작업을 하며, 어느 쪽이 정답인지 안내하는 주석은 실측과 다르다.
- 제안: (1) defineCommand가 spec.type==="custom" 위젯 미연결을 등록 시 throw로 차단해 죽은 선언을 원천 봉쇄. (2) 커스텀 위젯 6종을 실제 위젯에 연결해 승계 불가 명령군(분기·shop·choices·fork)의 병목 제거. (3) defineCommand.ts 헤더의 파일 수·줄 수를 실측으로 갱신하고, commandBody.ts 상단에 "신규 명령 추가 시 만질 파일 순서" 체크리스트 주석을 둔다.

**F86. 요약문이 3벌 기술돼 있고 스키마 쪽은 죽은 코드 — advanceCropGrowth는 이미 두 문구로 갈라짐**

- 근거: `src/editor/panels/eventEditor/schemaCommandBody.ts:88-89` · `src/editor/eventCommands/schema/catalog.ts:297` · `src/editor/panels/eventEditor/commandSummary.ts:162`
- 문제: schemaSummary()와 schema.summary는 src 전수 grep에서 제품 소비처가 0개다(유일한 소비는 schemaCommandBody.ts:148 no-fields 힌트인데, 등재 4종은 전부 필드가 있어 도달 불가). 그러나 test/eventCommandSchema.test.ts:66-70은 모든 스키마의 summary가 비지 않았음을 강제한다 — 즉 77종 문장을 테스트만 위해 평생 관리해야 한다. 실제 목록 행은 commandSummaryPartHandlers(commandSummary.ts:88-98), 미리보기 카드는 같은 파일의 describeRuntimeEffect(commandPreview.ts:1716-1781, 68줄짜리 kind 스위치)가 각자 문장을 만들며, 스키마 문구와 이미 어긋났다: advanceCropGrowth는 스키마 "작물 N일 성장" vs 실요약 "작물 성장 진행 N일". defineCommand.ts:6-7이 말한 "폼에서 고쳤는데 목록 표시가 그대로" 버그 구조가 요약문 레이어에 그대로 남아 있다.
- 제안: commandSummaryParts()가 commandSchemaFor(kind)?.summary를 우선 사용하고 실패·부재 시 기존 handler로 폴백하게 승격해 스키마를 실제 단일 진실로 만들거나, 반대로 CommandSchema.summary 필드와 schemaSummary()를 삭제해 이중 기술을 끊는다(전자 권장 — 승계 4종은 이미 검증된 문장이 있다). describeRuntimeEffect는 시뮬 상태 보간이 필요한 changeLevel 등 일부만 남기고 commandSummaryParts 재사용으로 축소.

**F87. 분기 명령 1개 추가가 src 32개 파일을 건드린다 — success/failure 재열거만 20곳, eventCommandBranches.ts가 스스로 정한 '여기에만 추가' 규칙이 이미 붕괴**

- 근거: `src/editor/eventCommandBranches.ts:3-4` · `src/editor/eventCommandBranches.ts:15` · `src/editor/panels/eventEditor/commandDiff.ts:88-89`
- 문제: evolveMonster 한 kind의 문자열이 src 32개 파일에 흩어져 있다(grep 전수). 그중 successBranch/failureBranch 2개 분기를 직접 세는 곳은 "정본" eventCommandBranches.ts를 빼고도 19곳이다: commandDiff.ts 2곳(88-91, 136-139), databaseCommandReferences.ts 3곳(172-175, 260-261, 302-303), commandReferenceValidation.ts 2곳(109-112, 304-308), questGraph.ts 2곳(572, 634-635), horrorExperienceQa.ts 2곳(124-126, 204-206), tools/commandArgs.ts(124-128), authoredCommandIndex.ts(56-58), characterIdStamp.ts(65-66), storyFlagUsage.ts(249-251), shapeCommandFields.ts(250-253), rewriteLegacyDialogue.ts(35-37), sceneTestRunner.ts(1890-1892), eventTools.ts(1292-1294), eventCommandPaths.ts(122,189-193). 이 파일이 2026-08-30에 5벌 드리프트(그중 3벌이 shop 실패 분기 누락)를 막으려고 만든 규칙 1이 다시 깨져 있는 것. 새 분기 명령을 추가하려면 정본 1줄 외에 19곳 case를 기억해야 하고, 한 곳이라도 빠지면 검증·diff·참조스캔·QA 순회가 그 분기를 조용히 놓친다. 비교: 분기 없는 advanceCropGrowth는 src 15파일로 끝난다 — 분기가 붙는 순간 2배 이상이다.
- 제안: EventCommandBranch는 이미 kind/label/branchIndex/commands를 반환하므로 검증·diff·툴도 eventCommandBranches() 1회 호출로 교체 가능하다(뷰 의존 없음). success/failure 쌍 명령(promoteActor, evolveMonster)부터 치환하고, "eventCommandBranches 임포트 없이 command.successBranch를 직접 순회"하는 패턴을 grep 게이트 테스트로 차단한다. 신규 명령 체크리스트(강제 항목)에 "분기 명령은 eventCommandBranches + eventCommandPaths 인덱스 상수 2곳만"을 명시.

**F88. 명령 라벨이 5개 소스에서 각자 관리된다 — 빠른추가 팔레트에 '엔딩' 버튼이 2개, 스키마·드롭다운·피커·요약 문구가 서로 어긋남**

- 근거: `src/editor/panels/eventEditor/options.ts:171-172` · `src/editor/panels/eventEditor/options.ts:51` · `src/editor/panels/eventEditor/commandPicker.ts:803`
- 문제: 같은 명령의 이름이 (1) options.ts COMMAND_KIND_OPTIONS(79행 수동 목록), (2) 같은 파일 PAGE_COMMAND_BUTTONS 축약 라벨(33행 수동), (3) 스키마 catalog label, (4) M2_COMMAND_CATALOG existingKind 라벨(commandPicker commandLabel이 이쪽을 우선), (5) commandSummary 첫 토큰 다섯 곳에서 각자 관리된다. 실측 드리프트: 빠른추가 팔레트에 triggerEnding="엔딩"과 ending="엔딩"으로 같은 라벨 버튼 2개가 나란히 있고(구분 불가), advanceCropGrowth는 스키마 "작물 성장" vs 옵션 "작물 성장 진행". 커버리지 테스트조차 EXPECTED_COMMAND_KINDS라는 세 번째 전수 사본(test/eventEditorCommandLabels.test.ts:6-86)을 들고 COMMAND_KIND_OPTIONS와 toEqual로 맞춘다 — 신규 명령 추가 시 라벨만 최소 4곳 수정 + 테스트 사본 1곳 동기화다.
- 제안: 라벨 단일 소스를 정한다: 스키마 label을 정본으로 승격해 commandKindLabel이 스키마를 fallback 체인에 넣거나, 반대로 스키마 label 필드를 삭제하고 options만 남긴다. PAGE_COMMAND_BUTTONS는 Record<CommandKind, {testId,label}> 전수 타입(quick 미대상 kind는 명시 제외)으로 바꿔 누락·중복 라벨을 컴파일로 잡고, EXPECTED_COMMAND_KINDS 사본은 COMMAND_KINDS 직접 import로 대체한다.

**F89. '명령 1개 추가' 체크리스트에서 강제 항목과 무음 항목이 구분 없이 섞여 있다 — 요약 누락은 '명령' 한 단어, 오류 점프는 수동 testid 맵으로 조용히 깨진다**

- 근거: `src/editor/panels/eventEditor/commandSummary.ts:90` · `src/editor/eventDraftIssueDetails.ts:68` · `src/editor/eventDraftIssueDetails.ts:79`
- 문제: commandKindRegistry(컴파일 강제), eventCommandFactory(never 검사), commandKindCoverage MINIMAL_COMMANDS(Record 타입 강제)는 누락이 잡히지만, 강제되지 않는 쪽이 더 많다: (1) commandSummaryPartHandlers는 [K in CommandKind]? 옵셔널이라 handler를 안 쓰면 목록 행이 "명령" 한 단어로 조용히 저하(commandSummary.ts:90), (2) PAGE_COMMAND_BUTTONS에 넣지 않으면 그 명령은 빠른추가 팔레트에서 무음 부재(테스트는 기존 버튼만 순회), (3) eventDraftIssueDetails.commandReferenceField의 "kind:라벨→testid" 34항목 수동 맵은 eventDraftValidator require()의 한글 라벨 문자열과 스트링리 결합돼 있고(예: evolveMonster:진화 대상 종), 새 명령은 맵에 없으면 오류 클릭이 인스펙터 최상단(event-inspector-body)으로만 가서 필드를 못 찾는다. 무엇이 컴파일 강제이고 무엇이 무음 폴백인지 코드에 표시가 없어, 신규 명령 작업의 검수 기준이 작성자의 기억에 의존한다.
- 제안: (1) commandSummary 폴백을 "[요약 없음: kind]"로 바꿔 누락이 보이게 하고, COMMAND_KINDS 전수로 handler 존재를 단언하는 커버리지 테스트 추가. (2) commandReferenceField 맵을 Record<CommandKind, Partial<Record<필드라벨, testId>>> 전수 타입으로 승격하고 검증 라벨은 공용 상수로 참조하게 해 스트링리 결합 제거. (3) commandKindRegistry.ts 상단에 강제/무음 항목을 구분한 신규 명령 추가 체크리스트를 주석으로 고정.

**F90. 명령 kind 79종 중 20종(25%)이 default:return으로 필드 무검증 — 커버리지 테스트는 양수 케이스만 봄**

- 근거: `src/project/io/shapeCommandFields.ts:154-157` · `test/commandKindCoverage.test.ts:201-204`
- 문제: COMMAND_KINDS 79종(commandKindRegistry.ts:14-92) 중 validateCommandShape에 case가 있는 것은 59종이고, text·wait·inputWait·label·gotoLabel·breakLoop·timer·changeTile·callCommonEvent·callMapEvent·changeParty·showPicture·erasePicture·playAudio·stopAudio·gameOver·ending·returnToTitle·setFlag·m2Command 20종(25%)은 default:return으로 필드가 전혀 검증되지 않는다. 가장 흔한 text조차 body 문자열 여부를 확인하지 않고, transfer는 direction/fade만 보고 필수 필드 mapId/x/y를 검사하지 않는다(154-157행). 커버리지 테스트는 정상 최소 인스턴스 통과라는 양수 단언뿐이라(ms 누락 wait도 통과) 이 구멍을 잡지 못한다. 결과적으로 구버전·손상 저장본이 로드되지만 타입이 보장한다고 믿는 ms/body/mapId 등이 undefined·잘못된 타입으로 런타임에 흘러간다.
- 제안: commandKindRegistry에 kind별 최소 필수 필드 스펙(필드명·원시 타입)을 선언하고 validateCommandShape의 default를 스펙 기반 require* 검사로 교체해 신규 kind 추가 시 검증 누락이 구조적으로 불가능하게 한다. 우선순위: transfer(mapId/x/y), text(body), wait(ms), changeTile, showPicture, playAudio/stopAudio(channel enum). test/commandKindCoverage.test.ts:201-204 루프에 "필수 필드 제거·왜곡 시 throw" 음수 단언을 짝지어 추가한다.

**F91. 쓰기 경계 무검증 — serialize는 검증 없이 저장하고 편집기는 `as unknown as Command`로 명령을 만들어 다음 로드가 전체 거부할 수 있음**

- 근거: `src/project/io/serialize.ts:24-25` · `src/editor/panels/eventEditor/schemaCommandBody.ts:140`
- 문제: 경계 검증이 로드(deserialize→validateProjectV4)에서만 작동하고 저장(serialize)은 무검증 JSON.stringify다. 그런데 편집기 쪽 명령 생성·치환 경로는 schemaCommandBody.ts:92/131/140/143/148의 Record<string,unknown> 왕복, commandPicker.ts:488 `onSelect(command as unknown as Command)`, followerPresets.ts:110/113 `as unknown as Command`처럼 전부 무검증 단언으로 Command를 만들어낸다. 어느 작성 경로 하나가 타입 위반 값(예: 숫자 필드에 문자열)을 넣어도 저장은 성공하고, 다음 열기에서 validateProjectV4가 ProjectFormatError를 던져 프로젝트 전체가 열리지 않는다(menu.ts:1105는 "가져오기 실패"만 표시). fail-closed 경계가 자기 앱이 쓴 데이터를 거부하는 비대칭이다.
- 제안: 쓰기 경계에도 같은 검증기 재사용: store 커밋 또는 serialize 직전 validateCommandArray 실행, 혹은 replaceCommand 액션에서 kind별 스키마 검증 통과 후 반영. 최소한 schemaCommandBody.ts:140의 `as unknown as Command`는 제거하고 patch 결과를 CommandSchema FieldSpec 타입으로 강제한다.

**F92. changeLifeSkillExp 검증만 원시 Error 던짐 — ProjectFormatError 계약 위반으로 가져오기 실패 시 상세 메시지 유실**

- 근거: `src/project/io/shapeCommandFields.ts:177` · `src/editor/menu.ts:1105`
- 문제: 파일 전체가 ProjectFormatError로 오류를 보고하는데 유일하게 changeLifeSkillExp 케이스만 원시 Error를 던진다. ProjectFormatError를 instanceof로 골라 상세 메시지를 보여주는 소비부(menu.ts:1105, player/oprnGameFile.ts:47, editor/spatial/authoringConnections.ts:61)에서 이 오류만 계약 밖으로 나가, 가져오기·게임파일 오류 시 어떤 명령의 op가 잘못됐는지라는 상세가 사라지고 제네릭 실패로 떨어진다. 검증기의 오류 계약이 한 곳만 어겨도 소비자 전부가 신뢰할 수 없게 된다.
- 제안: shapeCommandFields.ts:177을 `throw new ProjectFormatError(...)`로 교체. 재발 방지로 io/ 경계 모듈에 `new Error` 금지 lint 규칙(eslint no-restricted-syntax, NewExpression callee.name === 'Error')을 걸어 ProjectFormatError 외 사용을 린트 단계에서 차단한다.

**F93. 조건 컴파일 테스트의 공허한 단정 — 컴파일→평가 계약이 사실상 무검증**

- 근거: `test/conditionCompile.test.ts:39-40` · `src/editor/panels/eventEditor/conditionCompile.ts:13-16`
- 문제: 조건 컴파일 테스트가 2개 it 뿐이고, 그중 평가 검증 테스트는 typeof === "boolean" 만 단정한다 — 컴파일 결과가 실제로 참/거짓을 올바르게 내는지는 전혀 확인하지 않는 공허한 단정이다(테스트가 실패할 수 있는 유일한 방식은 예외뿐). compileConditionFromText 의 핵심 계약인 warnings 생성, 미매칭 토큰 처리, AND/OR/NOT 혼합 우선순위, 동명 레코드 중복 매칭은 어떤 테스트도 못 본다. conditionCompile.ts 는 프로젝트 인자만 받는 순수 함수라 테스트하기 가장 쉬운 대상인데도 커버리지가 이 수준이다.
- 제안: conditionCompile.test.ts 를 확장해 (1) "sw_a AND 밤" 조합에 세션 상태별 구체적 기대값(true/false)을 단정, (2) OR/NOT 각각에 evalCondition 기대값 단정, (3) warnings 배열과 미매칭 입력의 ConditionCompileResult 형태를 고정한다. 모두 기존 createBlankProject+startSession 패턴 안에서 순수 단위 테스트로 충분하다.

**F94. draft vault 만료·버전 계약 부재 — version/updatedAt 은 죽은 필드, 오염 localStorage 복구 경로 무테스트**

- 근거: `src/project/eventDraftVault.ts:205-206` · `src/project/eventDraftVault.ts:216`
- 문제: localStorage 복구 경로(loadEventDraftVaultFromLocalStorage)는 version 필드를 타입에 선언해 파싱만 해두고 값 검증은 한 번도 하지 않는다(209행에서 entries 배열만 확인). updatedAt 도 저장·보존만 될 뿐 소비하는 코드가 src 전체에 없다(grep: eventDraftVault.ts 내 기록 6곳, 읽기 0곳) — 즉 draft 만료·스키마 가드 계약이 코드에도 없고 테스트도 없는 죽은 필드다. 형식만 맞는 오염 항목은 event shape 검증 없이 vault 에 로드되고 applyEventDraftVault 가 프로젝트에 밀어 넣는다. 기존 eventDraftVault.test.ts 는 정상 round-trip 4케이스만 있어 손상/구버전 localStorage 가 프로젝트를 오염시키는 경로를 아무 회귀 테스트가 못 잡는다.
- 제안: 계약을 코드로 명시하라: (1) version 불일치 시 전체 폐기+경고, (2) 항목 단위 shape 가드(io/shapeEventFields.ts 패턴 재사용), (3) 만료 정책(예: updatedAt 기준 N일 경과 항목 스킵) — 각각에 loadEventDraftVaultFromLocalStorage 단위 테스트를 eventDraftVault.test.ts 에 추가(손상 JSON, version 불일치, 만료 항목, 유효 항목 혼합). 만료를 의도적으로 두지 않겠다면 version/updatedAt 필드를 제거해 죽은 계약을 없애는 편이 낫다.

**F95. 통합 삽입 규칙 계약(2026-09-17 P0-3 수정)에 회귀 테스트가 없고 키보드 Ctrl+V는 이미 재이격됐다**

- 근거: `src/editor/panels/eventEditor/commandInspector.ts:133-134` · `src/editor/panels/eventEditor/commandList.ts:66` · `src/editor/panels/eventEditor/commandListContextMenu.ts:260-261`
- 문제: P0-3 수정(삽입 규칙 통합)이 코멘트 선언만으로 방어되고 defaultInsertionPath/insertionPathAfter/describeInsertionPath의 단위 테스트가 test/ 어디에도 없다. 그 사이 재이격이 진행됐다: 리스트 host의 Ctrl+V 핸들러(commandList.ts:66)는 선택을 무시하고 항상 [...containerPath, commands.length] 즉 컨테이너 끝에 붙이는데, 컨텍스트 메뉴 붙여넣기는 '선택 행 바로 아래 같은 깊이'라서 두 경로가 다른 결과를 낸다. 분기 추가 줄·마커 행에 포커스가 있어도 이 경로를 타므로 분기 안에서 붙여넣으면 루트 끝으로 들어간다. defaultInsertionPath는 인자와 무관하게 모듈 전역 selectedPaths를 읽는 상태 결합 함수라 순수 단위 테스트도 불가하다.
- 제안: insertionPath 계약 단위 테스트를 새로 만들어(선택 없음/루트 아래/분기 안 같은 깊이/다중 선택/스테일 경로) 고정하고, commandList.ts Ctrl+V 경로를 defaultInsertionPath로 통일하거나 '끝 붙여넣기' 의도를 명시해 두 규칙 모두 테스트로 잠근다. test/eventCommandRemediation/에 P0-3 대응 케이스를 추가한다.

**F96. Ctrl+A 다중 선택 후 드래그는 한 행만 이동하고 나머지 선택은 무시된다**

- 근거: `src/editor/panels/eventEditor/commandListDragDrop.ts:10-21`
- 문제: enableItemDrag는 pointerdown한 행 하나에만 draggable=true를 걸고 dragstart에 단일 path만 싣는다. Ctrl+A로 여러 행을 골라 드래그해도 선택 경로 목록은 전송되지 않아 한 행만 이동하고, 드래그 종료 후 낡은 선택 경로로 엉뚱한 행이 하이라이트된다.
- 제안: dragstart에 선택 경로 배열을 실어 moveCommandTo가 다중 처리하게 하거나, 다중 선택 시 드래그를 막고 안내한다.

**F97. 이벤트 편집기 실패 로그가 전부 원시 console — 링버퍼·진단 채널에서 존재하지 않는 결함**

- 근거: `src/editor/panels/eventEditor/modal.ts:345-349` · `src/project/eventDraftVault.ts:194-195`
- 문제: 이벤트 편집기 70+ 파일 전체에 createLogger 사용이 0건이고 원시 console 호출 8곳(commandList.ts:83,438 / modal.ts:348,361 / storyboardView.ts:111,324,418 / schemaCommandBody.ts:94)이 남아 있다. 위키(editor-observability.md:419)는 "raw 콘솔은 버퍼에 남지 않아 사후 조사에서 존재하지 않는 것과 같다"며 createLogger 를 쓰라고 고정하는데, 정작 이벤트 편집기의 본문 렌더 크래시(크래시 배너 경로)와 초안 금고 저장 실패가 전부 raw console 로만 남는다. 디버깅 레시피의 __oprnLogs / __oprnErrors, 로컬 진단 세션(localDiagnostics.ts가 subscribeLogs 로 수집) 어디에도 이 실패가 흡수되지 않는다. 특히 eventDraftVault 의 persist 실패는 미적용 초안의 유일한 안전망이 조용히 꺼진 사건인데 localStorage 쿼터 초과 시 매 체크포인트마다 실패해도 사용자·로그 채널에 흔적이 없다.
- 제안: src/editor/panels/eventEditor/modal.ts 에 `const log = createLogger("event-editor")` 를 두고 8곳의 console.* 를 log.error/log.warn 으로 교체한다. src/project/eventDraftVault.ts:195,222 도 createLogger("event-draft-vault") 로 옮긴다. 재발 방지로 test/aiUiEventContract.test.ts 선례처럼 src/editor/panels/eventEditor/** 원문에서 /console\.(warn|error|log)/ 부재를 잠그는 구조 테스트를 추가한다.

**F98. 진단 ID↔코드 대응표(RULES) 미커버 — 5개 이상 error 코드가 validation.advisory 로 뭉개져 전달물에서 규칙 식별 불가**

- 근거: `src/editor/eventDraftIssueDetails.ts:31-32` · `src/editor/eventDraftValidator.ts:956-957`
- 문제: eventDraftIssueDetails.ts 의 RULES 표(17개)가 검증기의 error 코드 전부를 커버하지 못한다. page.trigger.location-empty(:258), page.trigger.location-missing(:266), battle.troop.empty(:957), m2.coordinate.variable.unselected(:1346), m2.coordinate.fixed.invalid(:1360) 5개 이상의 error 코드가 RULES 에 없어 eventValidationDiagnostics.ts:11 이 fallback 으로 빠지고, fallback 은 code 를 통일된 "validation.advisory" 로 갈아치운다. 그 결과 「진단 복사」·「로컬 조수에게 묻기」로 넘어간 보고서에서는 빈 적 그룹 오류와 M2 좌표 오류가 구분 불가능한 동일한 문구(page·commandPath 만 남음)가 되어, 진단 전달물의 목적인 "어떤 규칙이 왜 깼나" 재현이 깨진다. AI_UI_ACTIONS 을 test/aiUiEventContract.test.ts 로 잠근 것과 달리 RULES↔검증기 코드 대응을 잠그는 테스트도 없다.
- 제안: RULES 에 상기 5개 코드(원인·기대·힌트·testId 포함)를 추가하고, fallback 이 issue.code 를 보존하게 바꾼다(코드는 검증기 상수라 임의 입력 아님 — unmapped 여부는 kind: "unmapped" 같은 별도 필드로 표시). 동시에 eventDraftValidator 의 코드 상수를 한 곳으로 모아 검증기 error 코드 ↔ RULES 키 대응을 소스 원문에서 잠그는 test/eventValidationRuleGuidanceCoverage.test.ts 를 추가한다.

**F99. 금고 복원 실패 시 모달이 무기록·무안내로 닫힘 — "에디터가 갑자기 사라졌다"가 어디에도 남지 않음**

- 근거: `src/editor/panels/eventEditor/modal.ts:330-331` · `src/project/store.ts:946-947`
- 문제: 이벤트가 store 에 없고 금고 복원도 실패하면 모달이 closeHandler(true) 로 조용히 닫힌다(modal.ts:330-332, 371-373 refresh 구독·오토세이브 구독 양쪽). restoreEventDraftFromVault 의 false 는 ① canWriteTeamProject() 거부 ② 금고 항목 부재라는 서로 다른 원인을 구분하지 않고, 실패 분기는 store mutation 이 아니라서 초크포인트도 지나지 않는다 — 성공 복원만 "드래프트 금고 복원" 감사 1건이 남고 실패는 어느 채널(edit activity·logger·오류 트랩)에도 0건. 사용자는 "편집하던 이벤트 에디터가 갑자기 사라졌다"는 증상만 보고 사후 추적 수단이 없다. 위키의 mapEditLocks 거부 미기록 항목(known-gaps 표 마지막 행)과 동형 결함이 이벤트 편집기 경로에 그대로 있다.
- 제안: store.restoreEventDraftFromVault 가 실패 사유("no-team-write" | "no-entry")를 반환하게 바꾸고, modal.ts 두 호출부에서 createLogger("event-editor") 로 log.warn + 사용자 토스트(예: "보존된 초안이 없어 편집 창을 닫았습니다")를 남긴다. 근거가 되는 이벤트 id·mapId 를 detail 로 넣어 링버퍼에서 재현 가능하게 한다.

**F100. 렌더 경로의 store 쓰기 — renderEventEditorDynamic 내 ensureEventPages·restoreEventDraftFromVault가 동기 구독자 재진입 유발**

- 근거: `src/editor/panels/eventEditor/content.ts:148-149` · `src/editor/panels/eventEditor/content.ts:134` · `src/editor/eventPages.ts:78-83`
- 문제: 렌더 함수가 store를 쓴다. renderEventEditorDynamic은 매 refresh마다 staged 버퍼에 다시 그려지는 함수인데, 그 안에서 ensureEventPages(content.ts:149)와 restoreEventDraftFromVault(134)가 store.update를 수행한다. store.update는 동기 구독자를 바로 돌므로 이벤트 에디터 본문 렌더 도중에 맵 캔버스·이벤트 목록 등 모든 구독자가 재렌더되고, modal.ts는 이 재진입을 refreshing/refreshPending 플래그(310-323)로 겨우 흡수하고 있다. 플래그가 없는 다른 구독자는 반쯤 그려진 staged DOM과 꼬인 타이밍에 노출된다. 렌더=읽기, 변경=액션 경계가 깨진 전형적 부수효과 구조다.
- 제안: ensureEventPages·restoreEventDraftFromVault 호출을 렌더 밖(openDraftEventEditorModal의 초기 refresh 직전, 또는 modal.ts renderSurface의 live 체크 단계)으로 옮겨 renderEventEditorDynamic을 순수 읽기 함수로 만든다. 불가피하게 남긴다면 content.ts에 store 갱신 후 재렌더는 호출자가 한 번만 한다는 계약을 주석과 함께 명시한다.

**F101. characterId 자동완성이 폼 재렌더마다 document 캡처 리스너를 누적시킨다 — destroy가 한 번도 호출되지 않음**

- 근거: `src/editor/panels/eventEditor/pageProps.ts:775-779` · `src/editor/panels/eventEditor/characterIdAutocomplete.ts:243`
- 문제: renderEventCharacterSocialExtras(pageProps.ts:775)는 attachCharacterIdAutocomplete가 돌려주는 destroy 핸들(characterIdAutocomplete.ts:267-276)을 버린다. attach 때 document에 capture pointerdown 리스너(characterIdAutocomplete.ts:243)가 붙는데, 캐릭터 필드는 content.ts:335가 이벤트 편집기 재렌더(페이지 전환·talkFriendship 토글·이름 수정 등 store 갱신 때마다)마다 다시 붙어서 리스너가 무한 누적되고 폐기된 input/dropdown 클로저를 계속 붙잡아 GC를 막는다. 같은 파일의 구독 정리 선례(pageProps.ts:175-178 subscribeCopiedEventPage의 isConnected 자가해제)와 달리 자기 정리가 전혀 없다.
- 제안: renderEventCharacterSocialExtras가 handle을 반환해 content.ts 재렌더 경로에서 이전 handle.destroy()를 호출하거나, attachCharacterIdAutocomplete가 스스로 input.isConnected를 주기 검사해 해제되면 destroy와 동일 정리를 수행하게 한다(첨부 시점에 requestAnimationFrame 체크).

**F102. narrow.css 워크벤치 블록(73-120행)·balanced 변수 체계가 전면 사문 — command-focused 상시 클래스 때문에 command-workbench.css가 항상 승자**

- 근거: `src/editor/panels/eventEditor/content.ts:124` · `src/styles/event/command-workbench.css:7` · `src/styles/event/narrow.css:86`
- 문제: content.ts:124가 .event-editor-command-focused를 항상 부여(토글 코드 없음)하고 command-workbench.css가 index.css 마지막 import라 (0,4,0)으로 narrow.css(0,3,0/0,6,0)의 ≤1100 2열 전환·인스펙터 덮개·232/196/320px 튜닝을 모든 폭에서 이긴다. 실제 기하는 command-workbench의 4열(기본 minmax(200px,240px)+6px+1fr+minmax(280px,28%), ≤1100에선 200/6/1fr/260 고정, ≤800 스택) 하나뿐이라 narrow.css 73-120행과 shell-2·inspector·command-list-3의 balanced 변수 체계는 어느 폭에서도 적용되지 않는다. narrow.css의 2026-09-18 수정 서사(「명령을 고르면 인스펙터는 오른쪽 덮개로 뜬다」, 「≤900: 설정 열 196px」)는 실제 동작과 다르고, 이후 뷰포트 튜닝을 narrow.css에 추가하면 전부 무효가 된다.
- 제안: narrow.css 73-120행을 삭제하거나 .event-editor:not(.event-editor-command-focused) 스코프로 한정하고, 살아있는 소유자 command-workbench.css의 ≤1100(79행)·≤800(82-95행) 블록으로 폭별 튜닝을 모은다. narrow.css 헤더의 실측 서사(「창은 704px」)도 현 기하(풀뷰포트 계층형, shell.css:864-903) 기준으로 재검증해 갱신한다.

**F103. 선택 행 색 1개를 바꾸려면 5개 파일 9곳의 세대 체인을 거쳐야 하고, 마지막 세대는 이전 세대를 명시 리셋해서 이긴다**

- 근거: `src/styles/event/command-list-4.css:277-285` · `src/styles/event/command-list.css:57-59` · `src/styles/event/command-list-2.css:682-684`
- 문제: 시나리오 실측: 「선택 행 색만 바꾸기」 = command-list.css 3곳(58, 305, 841) + command-list-2.css 2곳(490, 682) + command-list-3.css 1곳(824) + command-list-4.css 2곳(277, 282) + shell-2.css 1곳(154) = 5개 파일 9개 규칙을 순서대로 추적해야 한다. 결정적으로 command-list-4.css:277의 `background: transparent; box-shadow: none`은 앞 3세대의 선택 스타일을 의도적으로 상쇄하는 리셋 규칙인데, 그 우선순위 근거는 import 순서+특이도 에스컬레이션(.event-editor-modal-window 접두로 (0,6,0))뿐이다. 게다가 선택 클래스 컨벤션이 3종(selected/sel/is-selected)으로 갈라져 DOM이 storyboardView.ts:355처럼 세 클래스를 동시에 얹는 방어 코드를 유지하고, modal.ts:1019-1025도 세 철자의 셀렉터를 모두 쿼리한다. -2/-3/-4 파일은 '구성 요소 버킷'이 아니라 실제로는 후속 덮어쓰기 층으로 동작하고 있다.
- 제안: 선택 상태를 command-list-4.css 한 파일의 '선택' 섹션으로 수렴: 이전 세대 7곳(command-list.css:58/305/841, command-list-2.css:490/682, command-list-3.css:824-829, shell-2.css:154-158)과 리셋 규칙(command-list-4.css:277-280)을 삭제하고 최종 스타일(282-285)만 남긴 뒤 scripts/check-css-winners.mjs로 재검증. DOM은 is-selected 1종으로 정리하고 modal.ts:1019/1024/1069의 삼중 셀렉터 쿼리도 1종으로 줄인다.

**F104. fallback·rgba 사본·로컬 hex가 4세대 팔레트를 동시 휴대 — 토큰 교체가 조용히 어긋나고 분류색 체계가 5갈래로 복제됨**

- 근거: `src/styles/event/previews/command-preview-2.css:252-254` · `src/styles/event/inspector.css:196-198` · `src/styles/event/command-list-2.css:25`
- 문제: 같은 토큰에 파일마다 다른 fallback hex가 박혀 있다: --accent는 #C2703D(주황, command-list-2.css:25·command-preview-3.css:179) / #4A57D6(인디고, command-list.css:776) / #d9a441(골드, command-list-2.css:465), --text-2는 #5C5348 vs #5B5347 vs #475569, --text-3는 4종, --success는 #18764F/#258A62/#2F8A4E, --bg-raised는 #FFFDF8/#F7F3EA/#FFFFFF — 크림·슬레이트·골드·맵킷 4세대 팔레트가 fallback 층에 동시 휴대된다. 토큰 이름이 바뀌거나 빠지는 순간 각 규칙이 제각기 다른 옛 팔레트로 떨어진다. 또한 토큰 값의 rgba 사본(command-preview-2.css:252-254의 rgba(24,118,79)/rgba(198,64,61))은 --success/--danger를 바꿔도 안 따라가고, 분류색도 --cmdcat-*(shell.css) / --blk-cat(command-list-2.css) / --lg-cat hex 7종(inspector.css:196-206) / --mk-cat-flow / --storyboard-accent로 5중 인코딩됐다. pages-3.css의 #2d9b70은 한 규칙 안에서 3회 하드코딩됐다.
- 제안: rgba 사본은 color-mix(in srgb, var(--success) 12%, transparent) 형태로 교체(--success/--danger가 자동 추종). --lg-cat 7종은 --cmdcat-* 참조로 수렴하거나 tokens.css로 승격. --text-2/-3·--accent·--bg-raised/-inset의 fallback을 tokens.css 현재값으로 통일하되, 장기적으로는 fallback 제거 + 빌드 타임 var 존재 검증 게이트(scripts/check-css-winners.mjs에 단계 추가)가 낫다.

**F105. import 순서가 유일한 우선순위 원천이며 '최종 승자' 파일과 모달 창 테마층이 3개 파일에 중복 분산됨**

- 근거: `src/styles/event/subdialogs/dialogs-5.css:394-395` · `src/styles/event/subdialogs/dialogs-5.css:447-448` · `src/styles/event/command-forms/forms-6.css:486-488`
- 문제: index.css의 34개 시트 순서는 의미에서 도출된 것이 아니라 '접기 전 유효 순서의 보존'(index.css:1)이고, 최종 외형은 마지막에 오는 시트가 결정한다고 파일 스스로 선언한다(dialogs-5.css:395 '이 시트가 캐스케이드 최종 승자다'). 그 최종 테마층이 한 파일이 아니라 command-list-4.css·forms-6.css·dialogs-5.css(+pages-5/footer/inspector)에 흩어져 있으며, forms-6.css:484-503의 .event-editor-modal-window 접두 셀렉터 목록은 command-list-4.css:135-155와 거의 동일한 사본이다(같은 cmd-step/cmd-drag-handle/cmd-line-marker/kicker 목록을 두 파일이 각각 유지). dialogs-5.css:447-448은 '앞 세대의 5중 클래스 선택자를 이기기 위한 특이도'라고 특이도 에스컬레이션을 공식화한다. 그 결과 어떤 시트든 앞에 삽입하거나 순서를 바꾸면 무소음으로 외형이 바뀌고, 글자 크기 한 종(font-size)이 command-list-4(12px)→dialogs-5(14px)처럼 세대를 건너 재조정된다.
- 제안: modal-window 최종 테마층(.event-editor-modal-window 접두 규칙)을 한 파일로 모으고 command-list-4/forms-6에 흩어진 셀렉터 목록 사본을 병합. index.css 세대 파일에는 '같은 셀렉터를 두 버킷에 두지 않는다' 규칙을 check-css-winners.mjs 게이트로 추가하고, '반드시 blocks 다음'/'최종 승자' 류 순서 계약 주석을 기계 검증 대상(시트 쌍 목록)으로 전환한다.

## G. P3 — 잡다 (실측·근거 있음, 우선순위 낮음)

| # | 제목 | 근거 | 한 줄 |
|---|---|---|---|
| 106 | PageUp/PageDown 미처리 — 뒤 배경 스크롤 난동 + 대형 목록 빠른 이동 부재 | `src/editor/panels/eventEditor/customSelect.ts:204-205` | 트리거 keydown(320-372)과 옵션 keydown(198-218) 어디에도 PageUp/PageDown 분기가 없다. 네이티브 select 는 PageUp/PageDown 으로 건너뛰기를 지원하는데 커스텀 셀렉트에서는 preventDefault 되지 않은 채  |
| 107 | 이벤트 편집기의 AI 진단 전달 행위가 프론트 액션 로그에 전혀 남지 않음 | `src/editor/panels/eventEditor/validationActions.ts:26-27` | AI 프론트 액션 로그(uiEventLog)의 위임 수집은 AI_UI_EVENT_SURFACES 8개 표면만 인정하고 이벤트 편집기 모달은 목록에 없다(src/editor/panels/eventEditor 전체에서 recordAiUiEvent/AI_UI_ACTIONS  |
| 108 | 진단 보고서의 page: 0 센티널 — 존재하지 않는 페이지와 소실된 페이지 참조가 구분 불가 | `src/editor/eventValidationDiagnostics.ts:15-16` | 진단 보고서의 page 는 findIndex+1 로 만드는데 pageId 가 현재 이벤트의 어떤 페이지와도 일치하지 않으면(삭제된 페이지를 참조하는 stale issue, eventDraftValidator.ts:122 처럼 pageId: "" 로 남는 이슈 등) Ma |
| 109 | 표면 스냅샷 게이트의 숫자 마스킹 블라인드 스팟 — 수치 안내 문구 회귀를 못 봄 | `test/eventEditorShellSurface.baseline.test.ts:325-326` | 표면 게이트의 labels 축은 maskLabel 이 모든 숫자를 # 로 접고 80자에서 끊으므로, 라벨 안 수치·단위가 바뀌어도 게이트가 차이를 못 본다(주석상 DB 개수 잡음 차단이 목적이지만 부작용으로 수치 표기 회귀가 블라인드 스팟이 됨). 예컨대 2026-09 |
| 110 | 피커 이중 열림 가드가 content.ts 의 DOM 질의 조기 return 으로 묻혀 단위 테스트 불가 | `src/editor/panels/eventEditor/content.ts:1011` | 명령 피커 이중 열림 방지가 content.ts(1,045줄) 깊은 곳에서 document.querySelector 조기 return 으로 구현돼 있다. 피커가 이미 열려 있으면 「+ 명령」 클릭이 아무 피드백 없이 조용히 삼켜지는데, 이 동작을 검증하려면 render |
| 111 | failedTransactionBranch가 타입에 이미 있는데도 `as unknown as` 단언 잔존 — 죽은 타입 거짓말이 미래 드리프트를 가림 | `src/project/types/events.ts:454-455` | failedTransactionBranch는 이미 shop 유니온 멤버의 정식 필드인데(events.ts:455), 이 필드가 타입에 추가되기 전의 임시방편 `as unknown as ... & { failedTransactionBranch?: Command[] }`가 |
| 112 | 죽은 CSS 블록과 '한 번도 적용되지 않은 사본'이 상주 — 존재하지 않는 .preview 마크업에 43줄·하드코딩 8색 소비 | `src/styles/event/shell-2.css:167-168` | shell-2.css:166-209의 .event-editor .preview 블록(약 43줄, .preview/.sky/.sky::after/.box/.who/.preview p, hex 8종)은 src 전역 어디에도 bare `preview` 클래스를 만드는 코드가 |
| 113 | shell.css 레거시 워크벤치 분기 3종(≤960 1열 / ≤1240 430px / ≤900 300px) 전부 사문 — 트랙 소유자는 command-workbench.css 단 하나 | `src/styles/event/shell.css:325` | 같은 .event-editor-workbench의 grid-template-columns를 shell.css(≤960 1열, ≤1240 8px 리사이저 3열, ≤900 6px 리사이저 3열), inspector.css((0,2,0) 변수 3열), command-work |
| 114 | 모달 전역 word-break: keep-all + overflow-wrap: normal이 비상 줄바꿈을 꺼 두고, 컴포넌트가 제각각 anywhere로 재수습하는 패턴 반복 | `src/styles/event/shell.css:515-516` | .event-editor-modal-window *에 overflow-wrap: normal을 못박아 긴 무공백 토큰(파일명·경로·ID·영문 라벨)이 모달 어디서도 비상 줄바꿈되지 않는다. 그 결과 footer.css:443, inspector.css:67, pages |
| 115 | 인스펙터 열 display:flex가 [hidden]을 이기는 구조 — hidden=true가 도달하면 빈 260px 유령 패널이 남는 잠복 결함 | `src/styles/event/command-workbench.css:16` | 인스펙터 열은 focused 레이아웃에서 항상 display:flex(command-workbench.css:15-24)라 author 규칙이 UA [hidden]{display:none}을 이긴다. 현재는 emptyPreview가 content.ts:187에서 항상  |
| 116 | 도움말 목차 스크롤이 reduced-motion 설정을 무시하고 smooth 고정 | `src/editor/panels/eventEditor/eventEditorHelp.ts:423` | 이벤트 편집기 도움말 오버레이의 목차 클릭 이동이 behavior:"smooth" 로 고정돼 축소 모션 사용자에게 불필요한 스크롤 애니메이션을 강제한다. 같은 워크벤치의 경고 항목 이동(scrollIntoNearestScroller.ts:27)은 scrollTop 직접 |
| 117 | 서브다이얼로그 제목 라벨링 중복(aria-label+h3)·부제 미연결 | `src/editor/panels/eventEditor/subdialog.ts:40` | 창의 aria-label과 헤더 h3가 같은 문자열을 별도로 유지해 스크린리더가 대화상자 진입 시 제목을 두 번 읽고, 두 문자열이 어긋날 여지도 만든다. subtitle 옵션은 어떤 ARIA 속성으로도 연결되어 있지 않아(WAI-ARIA describedby 부재)  |
| 118 | 그래픽 다이얼로그 초기 포커스가 부수 입력(AI 이름 가르치기)에 꽂힘 | `src/editor/panels/eventEditor/npcGraphicPicker.ts:285-286` | 그래픽 다이얼로그에서 '본문 첫 텍스트 입력' 정책(subdialog.ts:120)이 DOM 순서상 첫 typing 입력, 즉 우측 패널 깊숙한 '이 칸 이름(AI가 이 이름으로 찾습니다)' 보조 입력에 초기 포커스를 꽂는다. 이 다이얼로그의 주 과업은 자산 목록에서  |
| 119 | 선택지 프리뷰에 choices-compact 누락, 프롬프트 제어문자 미파싱 | `src/player/dialogue.ts:467` | 선택지 프리뷰가 런타임 조건을 반영하지 않는다. 게임은 옵션이 4개 이상이면 choices-compact 로 글자·행간을 줄이지만(dialogue.ts:467) 프리뷰는 이 클래스를 절대 붙이지 않아, 편집기가 허용하는 4~5개 선택지에서 정확히 미리보기와 게임 레이아 |
| 120 | resolveAssistScope 임계값 측정(압축 JSON)과 실제 프롬프트 직렬화(pretty JSON) 불일치 | `src/ai/eventCommandAssist.ts:228` | resolveAssistScope는 압축 JSON 문자열 길이로 12,000자 상한을 판정하지만, 실제로 프롬프트에 실리는 것은 indent 1의 pretty JSON이다. 중첩 분기가 많은 페이지에서 pretty 직렬화는 압축본의 1.5~2배가 되므로, 상한을 겨우  |
| 121 | conditionModeCache 무폐기 — 조건 모드 전환마다 성장하는 미제한 Map | `src/editor/panels/eventEditor/conditionForm.ts:56` | conditionModeCache는 조건 모드를 바꿀 때마다 map::event::page::path::kind 키로 Condition 복제물을 쌓지만 어디에서도 delete/clear하지 않는다(파일 내 set/get만 존재). 같은 편집 세션에서 페이지·조건 슬롯을 |
| 122 | 상점 프리뷰가 shopServiceKind 를 무시해 수리점·감정소·전당포가 일반 「구매/판매」 상점으로 표시된다 | `src/editor/panels/eventEditor/commandPreview.ts:832-833` | 에디터는 상점 명령에 shopServiceKind(수리/감정/전당포)를 저작할 수 있고(commandBodyShop.ts:131-148), 런타임은 이에 따라 제목을 수리점/감정소/전당포로 바꾸고 안내 문구와 빈 풀 실패 흐름(playSceneShop.ts:78-83) |
| 123 | 드래그 페이로드가 text/plain JSON 경로 — 입력 필드에 떨어뜨리면 "[0,1]" 텍스트가 삽입된다 | `src/editor/panels/eventEditor/commandListDragDrop.ts:19` | dragstart가 text/plain에 JSON.stringify(path)를 싣고 hasDragData도 text/plain을 드래그 데이터로 인정한다. 명령 행을 메모·이름 같은 입력 필드 위에 실수로 떨어뜨리면 JSON 경로 문자열이 그대로 입력된다. |
| 124 | 핸들 클릭(드래그 아님) 뒤 draggable이 잔류해 이후 텍스트 선택이 드래그로 튕긴다 | `src/editor/panels/eventEditor/commandListDragDrop.ts:12-14` | pointerdown이 draggable=true로 걸고 dragend에서만 되돌리는데, 클릭만 하고 드래그하지 않으면 dragend가 발화하지 않아 draggable이 남는다. 이후 행 텍스트를 선택하려고 하면 드래그가 시작돼 선택이 깨진다. |

## H. 2026-09-17 실측 리뷰 18건 중 현재도 남아 있는 것 (이번 렌즈 재확인)

| known | 상태 | 근거 |
|---|---|---|
| #2 조건 스위치 칩 → switches[0] 결속 | 본건(페이지 조건 스위치)은 해소(빈 참조 시드로 변경). 그러나 동일 «첫 레코드 자동결속»이 conditionForm.ts:86/89/107(조건 분기 폼: actor/item/location)과 pageConditionModel.ts:100·pageAdvancedConditions.ts:512(insideLocation)에 잔존 | `src/editor/panels/eventEditor/conditionForm.ts:1230` |
| #13 움직임 fieldset 밀도·legend 겹침 | 잔존. 빈도 fieldset 라디오 8개 nowrap, 매개변수 11트랙 그리드로 상단 바 최소폭 1,100px+ | `src/editor/panels/eventEditor/moveRouteDialogParts.ts:92-105` |
| #14 새 이벤트 기본 경고 | «빨간 경고 1로 시작»은 수정 확인(eventDraftValidator.ts:286-289 untouched 가드). «내부 토큰 노출» 절반은 잔존 — 종 행 hover title이 code·pageId·commandPath를 그대로 보여줌(D52) | `src/editor/panels/eventEditor/validationBell.ts:181` |
| #15 명령 입구 다수·적용↔자동저장 공존 | 잔존. 「변경 있음」과 「저장됨 HH:MM:SS」가 동시에 떠 원격 저장은 초안 이전 본문만 저장된다는 사실을 가림(D55). 별도 확인: 템플릿 「회상 오프닝」만 검토 없이 즉시 전면 교체(`src/editor/panels/eventEditor/content.ts:976-977`) | `src/editor/panels/eventEditor/modal.ts:829` |
| #16 스토리 뷰 | JS 40자 고정 잘림은 사라지고 80자 cap+CSS 말줄임으로 개선됐으나 전문을 볼 통로가 없음(D64). 「명령 추가 후 미선택」은 그대로(D65) | `src/editor/panels/eventEditor/content.ts:1020-1024` |
| #17 피커 1행 1항목 | 잔존. 기본 보기(list)에서 `grid-template-columns:minmax(0,1fr)`이 2열 규칙을 덮음(D38) | `src/styles/event/subdialogs/dialogs-4.css:712-716` |
| #3 명령 삽입 규칙 불일치 | **수정 확인** — 컨텍스트 메뉴·피커·붙여넣기 모두 '선택 아래 같은 깊이'로 통합, 분기 슬롯 보존, 스토리보드 텍스트 선택 차단. 단 키보드 Ctrl+V는 재이격(F95) | `src/editor/panels/eventEditor/commandListContextMenu.ts:260-261` |
| #1,#4,#5,#6~#12,#18 | 이번 렌즈 배정에서 담당하지 않았거나(중복 방지), 정적 분석으로 판정 불가한 실행 화면 결함 | — |

## I. 선별 기록

- **수집 145건** (29개 렌즈 × 5건 + L02 트랜스크립트 회수 5건).
- **증거 검증**: 145건 전부의 코드 인용을 원본과 대조 — 423/430 인용 그대로 확인, 근거 소실 0. 좌표 20줄 이상 이동 15건은 파일 이동으로 판정해 유효 처리.
- **병합 8쌍**: 동일 근본원인(좀비 new 드래프트, live region 부재, 토큰 hex 사본, 그래픽 상속 거짓, 도움말 드리프트, 리치 폼 헬퍼 복붙, 삽입 규약 테스트 부재) — 각각 항목 하나로 합침.
- **기각 2건**:
  1. L02 「자기 분기 안 분기 드래그 무효검사·호버 예고 부재」 — `src/editor/panels/eventEditor/commandListDragDrop.ts:125-128`에 `isDropAllowed`의 `isContainerInsideCommand` 가드와 [P2] 설계 주석이 존재해 '검사 부재' 주장은 사실과 다름(호버 예고 부재 여부만 별도 확인 과제).
  2. L27 「m2Preview 마지막 summaryCard 폴백 도달 불가」 — 단일 호출부가 동일 조건을 이중 검사하는 잡코드 수준, 문서화 가치 낮음.
- **모델 노트**: 요청된 "glm 5.3 flash" 그대로 세션 워커 레인(zcode/glm-5.3-flash)을 사용했다. GLM 전용 서브에이전트 레인(`review`)은 401 Authentication Failed로 전량 실패해 폐기했다.
