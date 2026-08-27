# 이벤트 편집기 좌측 패널 — 결함표와 처리 결과

입력: `01-conditions.md`, `02-movement.md`, `03-memory.md`, `04-schedule.md`, `05-look-trigger.md`
(5개 감사 레인). 아래 표의 모든 항목은 감독자가 코드를 직접 읽고, 수정 전 실패(RED)와 수정 후
통과(GREEN)를 각각 캡처해 확인했다. 레인 보고서의 주장 중 감독자가 재확인하지 못한 것은
마지막 절에 UNVERIFIED 로 남겼다.

## 사용자 신고 증상: "NPC·몬스터를 배치했는데 전혀 움직이지 않는다"

원인은 하나가 아니라 **네 개가 겹쳐** 있었다. 발생 빈도 순:

1. **D01** 시간 시스템이 켜진 프로젝트에서 일정 행을 가진 NPC 는 이동 유형이 통째로 무시됐다.
   예제 마을이 정확히 이 조건이다(시간 시스템 ON + 주민마다 일정) → 마을 주민은 무작위를 줘도
   영원히 제자리. 조건 없는 일정 행이면 원점에 못 박히기까지 했다.
2. **D02** 이동 루트 명령이 한 번 걸린 NPC 는 그 뒤 페이지 이동이 되살아나지 않아 맵 재로드까지
   영구 정지. NPC 일정의 teleportNpc 도 같은 형태로 무버를 지운다.
3. **D03** 필드 스폰 몬스터와 `spawnEvent` 산출물은 접근·도주 이동이 한 칸도 실행되지 않았다.
4. **D06** 새로 배치한 이벤트의 기본 이동 유형은 `정지`(RM 계약)인데, 접힌 "움직임과 속도" 그룹
   요약이 원시 enum `fixed` 를 그대로 보여줘서 저작자가 그 사실을 알아채지 못했다.

## 결함표

| ID | 사용자 관점 증상 | 근본 원인 | 심각도 | 처리 |
|---|---|---|---|---|
| D01 | 일정 있는 NPC 가 이동 유형을 무시하고 정지 | `playScenePageMoveRoutes.ts` 등록 게이트가 `resolveTimeSystem && event.schedule?.length` 만 보고 페이지 이동을 통째로 폐기 | P0 | **수정** — 일정·명령 경로가 실제로 무버를 몰고 있는 동안만 양보. 회귀: `test/runtimeSchedulePageMovementCoexist.test.ts` |
| D02 | 이동 루트 명령 후 NPC 영구 정지 | 재등록 판정이 `pageMoveRouteKeys`/`EventIds` 만 보고 무버 생존을 확인하지 않음 | P0 | **수정** — 무버 생존을 판정에 포함. 회귀: `test/runtimePageMovementAfterCommandRoute.test.ts` |
| D03 | 스폰 몬스터가 접근·도주하지 않음 | `playSceneAutonomousRouteDirection.eventPositionForPlayerRelativeDirection` 이 `map.events` 에 없는 이벤트에 **플레이어 좌표**를 반환 → dx=dy=0 → 방향 null | P0 | **수정** — `eventPositions` → `session.eventLocations` → 원본 순 조회, 미지면 null. 회귀: `test/runtimeSpawnedEventMovement.test.ts` |
| D04 | "기억과 정리" 그룹에 아무 설정도 없음 | `pageProps.wrapPageSettingsAsAccordion` 의 memory 셀렉터가 when 이 이미 claim 한 서브트리를 겨눠 claim 0개, 이어서 미claim 자식이 `rail.lastElementChild` 로 흘러들어 읽기 전용 칩만 담김 | P0 | **수정** — 겹침 fieldset 을 직속 자식으로 승격해 memory 가 claim, 미분류는 "기타" 그룹으로 드러냄. 회귀: `test/eventRailGroupComposition.test.ts` |
| D05 | "중복 실행 방지" 를 켜도 중복 실행이 막히지 않음 | `overlapForbidden` 의 실제 효과는 **같은 칸 통행 차단**이고 실행 억제 코드는 없다 — 라벨이 기능을 오설명 | P1 | **수정** — 라벨 "겹침 금지(같은 칸 통행 차단)", 그룹 제목 "겹침과 통행", 기본값 규칙 `!== false` 통일 |
| D06 | 왜 안 움직이는지 패널을 펼치기 전엔 알 수 없음 | 접힌 그룹 요약이 `page.movement.type` 원시 enum | P1 | **수정** — "정지" / "무작위 · x2 빠름" |
| D07 | 이동 속도 7·8 을 저작할 수 없음 | select 는 1~6, 런타임 `clampSetting` 은 1~8 | P1 | **수정** — 1~8 + x6·x8 빠름 라벨 |
| D08 | "스위치가 꺼져 있을 때" 조건을 만들 수 없고, 데이터에 있으면 보이지 않으며 id 를 바꾸면 조용히 켜짐으로 뒤집힘 | `pageConditions.ts` 의 switch/item/actor apply 가 항상 `value:true`/`present:true` 로 덮음 | P0 | **수정** — 극성 select 3개 추가, 재활성 시 기존 값 보존. 회귀: `test/eventPageConditionOffValue.test.ts` |
| D09 | battleResult·all·any·not 조건이 화면에서 통째로 사라짐 | `pageConditionModel.advancedConditionEntries` 가 그 4종을 열거하지 않음(런타임은 정상 평가) | P1 | **수정** — battleResult 편집 가능, all/any/not 은 읽기 전용 요약 + 삭제. 회귀: `test/pageConditionsGuarantee.test.ts` 14/14 |
| D10 | "이벤트에서 접촉" 트리거가 발동하지 않음 | `firePlayerTouchEvent` 가 `eventTouch` 를 필드 스폰 id 에서만 발동. 이동 유형이 정지면 무버가 없어 영원히 발동 불가 | P0 | **수정** — 충돌 규칙을 `src/project/eventTouchRules.ts` 하나로 모아 양방향 발동. 회귀: `test/runtimeEventTouchPlayerCollision.test.ts` |
| D11 | 방향 고정 애니메이션 유형인데 걸을 때 방향이 돌아감 | 조사 회전 경로만 `canActionTurn` 으로 규칙을 지키고 자율 이동 경로는 이동 루트 명령 플래그만 봄 | P1 | **수정** — 등록 시 애니메이션 유형에서 `directionFix` 설정. 회귀: `test/runtimeAnimationTypeDirectionFix.test.ts` |
| D12 | 정지 애니메이션(제자리 걷기)이 재생되지 않음 | `playSceneAutonomousSprites` 가 `normal`/`fixedGraphic` 만 분기. `step`·`fixedDirectionStep`·`fourFrame` 은 normal 취급 | P2 | **미수정·문서화** — 무버 없는 이벤트에도 프레임 클록이 필요해 별도 작업. `openwiki/runtime-pre-edit-routing.md` 기록 |
| D13 | "안 움직인다" 류 회귀를 테스트가 못 잡음 | `sceneTestRunner` 는 chase 무버만 시뮬레이션 → `expect eventAt <원좌표>` 가 항상 통과 | P1(테스트) | **미수정·문서화** — 러너를 넓히면 기존 스펙의 전제가 대량으로 흔들려 이 PR 범위 밖. `openwiki/testing.md` 기록 |
| D14 | 부팅 직후 테스트 플레이가 열리지 않음(참조 문제 18건) | 부팅 시 생성되는 `item_gen_*` 팩이 존재하지 않는 배틀 애니메이션을 참조 → 저작 테스트 게이트가 차단 | P0 | **범위 밖** — 좌측 패널이 아니라 데이터베이스/부팅 영역. 증거만 캡처(토스트 원문 + 18건 목록). 제품이 안내하는 "참조 복구" 버튼으로 우회 가능 |
| D15 | 워크트리에서 e2e 가 전부 타임아웃 | `playwright.config.ts` 가 `npm run dev`(포트 9999 하드코딩 + strictPort)를 쓰므로 워크트리에서 서버가 아예 안 뜬다 | P1(인프라) | **문서화** — `openwiki/testing.md` 에 판별법(`curl` → 000)과 회피법 기록 |

## 좌측 5개 그룹 감사 요약 (C2)

| 그룹 | 저작 컨트롤 | 판정 |
|---|---|---|
| 모습과 대화 | 그래픽 스프라이트·방향·패턴, 이벤트 이름, 연결 NPC | PASS. 페이지 반투명도(0..255)와 페이지 얼굴그림은 스키마에 있으나 저작 UI 없음(UNVERIFIED 절 참조) |
| 언제 보이나요 | 스위치×2, 변수, 아이템, 주인공, 타이머×2, 고급 조건 목록(16종) | D08·D09 수정 후 PASS. 조건 16종 전부 화면 노출 + 런타임 평가(`test/pageConditionsGuarantee.test.ts`) |
| 움직임과 속도 | 이동 유형 6종, 움직임 빈도, 이동 속도, 애니메이션 유형, 사용자 지정 경로, 생활 이동 목적지 | D01·D02·D03·D06·D07·D11 수정 후 PASS. D12(정지 애니메이션 3종) 미구현 |
| 겹침과 통행 (구 "기억과 정리") | 겹침 금지 체크박스 | D04·D05 수정 후 PASS. 셀프 스위치·이벤트 소거는 조건/명령 쪽이 소유하며 이 그룹에는 없다 |
| NPC와 일정 | 연결 NPC, 시간대별 일정 행(조건·목적지·방향·활동) | D01 수정 후 PASS(일정과 이동 유형 공존). 일정 자체의 조건·목적지 경로는 기존 테스트가 커버 |

## UNVERIFIED (레인 보고서 주장 중 감독자 미확인)

- 페이지 반투명도·페이지 얼굴그림 저작 UI 부재, `route.skippable` ORPHAN, 일정 행 조건 종류의
  정확한 지원 범위: 레인 보고서(`05-look-trigger.md`, `02-movement.md`, `04-schedule.md`)의 주장이며
  감독자가 코드로 재확인하지 않았다. 수정하지 않았고 회귀 테스트도 없다.
- `02-movement.md` 는 D03 을 "정상"으로 판정했는데, 그 레인은 **수정 이후의 코드**를 읽었다.
  수정 전 RED 캡처(`test/runtimeSpawnedEventMovement.test.ts`, 60틱 동안 좌표 불변)가 근거다.
