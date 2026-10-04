# E 팔레트 2차 프로파일 (2026-09-30, 기본 1140칸 칩셋, freshProject, 헤드리스, 포트 9838)

측정은 다른 에이전트 부하로 흔들린다. 큰 차이만 믿는다. 스크립트: `prof2.mjs <mapswitch|layer|filter> <cpu|trace>`.

## 시간 분해 (op 1회당 메인 스레드 자기 시간, trace)
| 동작 | style | js | layout | paint/raster | gc |
|---|---|---|---|---|---|
| 맵 전환 | 253ms | 86ms | 23ms | 42ms | 78ms |
| 층 버튼(상/하) | 61ms | 47ms | 0.5ms | 29ms | 0.4ms |

맵 전환의 style 은 UpdateLayoutTree 3726요소 ~50~100ms 가 op 당 1~2회다. 원인 무효화(BODY, 「Invalidation set invalidates subtree」):
- 맵 전환: `panels/editor.ts` `refreshAuthoringJourney`(756~757)·`paintPersistenceBanner`(409~411)의 `clearChildren` → BODY ScheduleStyle.
- 층 전환: `panels/menu.ts:114` `renderTopbar` 재실행(`selectSidebarLayer` → `editorState.set`) 하나만 남음. 팔레트 기원 무효화는 0.

## 자기 시간 상위 (맵 전환 cpu, ms/op, (program)/(idle)/native 제외)
| ms/op | 함수 | 위치 |
|---|---|---|
| 55.5 | getBoundingClientRect (강제 레이아웃) via syncCommandBarClearance | panels/aiChatPanel.ts:2756 (호출 3008 ← 구독자 2096) |
| 44.6 | getBoundingClientRect via measuredDeck/effectiveWidth/syncAria/mountHandle | panels/aiChatResizeChrome.ts:19/20/44/60 |
| 14.5 | deepClone (warmRoundtripCheck ← warmApplyCaches) | io/guards.ts:22 |
| 10.8 | cloneJson | io/guards.ts:25 |
| 9.9 | (garbage collector) | - |
| 7.9 | addMeaning (makeBrushAssistSection → tileSimilarityContext) | panels/tileBrushTools.ts:109 |
| 6.0 | splitFacesetPairs | io/migration.ts:115 |
| 5.5 | (anon) | assets/imageWarmQueue.ts:75 |
| 4.5 | deserialize | io/serialize.ts:35 |
| 3.6 | nodeToken | core/contentDigest.ts:61 |
| 3.0 | serializeForRoundtripCheck | io/sharedDictionaryJson.ts:68 |
| 2.6 | eventWithoutDraft | project/eventDrafts.ts:9 |
| 1.8 | t.exports | dist/phaser.min.js |
| 1.7 | decodeThenFinish | assets/imageWarmQueue.ts:98 |
| 1.7 | tileSimilarityContext | panels/tileBrushTools.ts:75 |

getBoundingClientRect 100ms 는 함수 자체가 아니라 앞선 무효화의 스타일 재계산을 동기로 밀어내는 값이다. 팔레트 밖 소유.

층 버튼 cpu 는 JS 가 얕다: 자기 시간 1위가 imageWarmQueue.ts:75 6ms/op 뿐이고 나머지는 phaser 1~2ms 대. 층 전환 비용은 JS 가 아니라 스타일 재계산(~60ms)이다.

## 이번 라운드 변경 (tilePalette.ts)
- 살아 있는 판을 DOM 에서 떼지 않고 둘레만 교체(1차 커밋 이후 보강).
- 선택 타일 칩·붓 컨트롤 동기화가 자식 목록을 바꾸지 않게 제자리 갱신(`updateSelectedTileStatus`, `patchBrushControlsInPlace`).
- 효과: tilePalette 기원 BODY 스타일 무효화 제거(trace 로 확인). 맵 전환 평균 287 → 220ms(12회, 1차 후 297).

## 전후 (기본 1140칸)
| 항목 | 라운드 1 전 | 1차 후 | 2차 후 |
|---|---|---|---|
| 맵 전환 평균 | 287ms | 297ms | 220ms |
| 층 전환 | ~85ms(노이즈 28~170) | 96ms | ~100ms |
| 필터 「나무」 | 269ms | 281ms | ~290ms |

목표 「절반」은 미달. 층·필터·맵 전환의 남은 시간은 팔레트 밖 무효화(위 표)가 지배한다.

## 픽셀 비교 (HEAD tilePalette.ts vs 수정본, 같은 스크립트 shot.mjs, 팔레트 요소 크롭 290x851)
default 2px · upper 0 · lower 1 · filter 0 · cleared 0 · sel300 0 · sel700 1 차이 — 안티앨리어싱 수준(실질 동일).

## :has() 가설 — 미증명
`:has(` 규칙 319개(`body:has(.right-panel)` 등)가 BODY 전체 재계산을 키운다는 가설은 증명하지 못했다. 런타임 규칙 삭제 실험은 신뢰할 수 없었고 빈 규칙도 ~45ms 였다.

## 소유권 밖 필요 변경
- panels/editor.ts: `refreshAuthoringJourney`·`paintPersistenceBanner` 가 맵 전환마다 `clearChildren` 로 다시 짓는다 → 내용이 같으면 건너뛰거나 제자리 갱신.
- panels/menu.ts:114 `renderTopbar` 층 전환마다 재실행(leftLayerSwitcher.ts:21/32/59 의 editorState.set) → 변경된 조각만.
- panels/aiChatPanel.ts: 구독자 2096 → `applyAssistantViewPolicy` 3008 → `syncCommandBarClearance` 2756 의 rect 읽기가 강제 레이아웃. 값이 안 바뀌면 생략하거나 rAF 로 한 번만.
- panels/aiChatResizeChrome.ts: `effectiveWidth`(20)·`syncAria`(44)·`mountHandle`(60) 이 매번 rect 를 읽는다(~45ms/op). 캐시 필요.
- panels/tileBrushTools.ts:109 `addMeaning` 7.9ms/op — 맵 전환마다 `tileSimilarityContext` 재계산(입력 불변이면 캐시).
- tools/applyChangesetToStore.ts:209 `warmApplyCaches` → lint/projectLint.ts `warmRoundtripCheck` 의 deepClone 25ms/op (맵 전환에 실릴 이유 없음).
- EditScene.ts redraw ~24ms.
