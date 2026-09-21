# 구역 드나듦 트리거 (locationTransition) — 수용 근거

브랜치 `agent/loctrans`, 워크트리 `/home/main/z-project/rpg-zzu-loctrans`, 개발 포트 9861.
OPRN-OUT-020 이 「엔진에 걸음마다의 로케이션 변화 훅이 없다 · 제품 책임자 결정 필요」로
미뤄 둔 enter/leave 의 구현이다. 승인 후 진행.

## 1. 먼저 조사한 것: 무엇을 확장하고 무엇을 만들지 않았나 — **MET**

**확장한 것: 기존 트리거 유니온(`Trigger`)과 기존 트리거 디스패치.**
**만들지 않은 것: 새 스케줄러, 두 번째 내부/외부 판정.**

실측한 세 기계와 판단:

| 기계 | 어디 | 왜 이 트리거의 집이 아닌가 / 왜 맞는가 |
|---|---|---|
| 이벤트 페이지 트리거 | `Trigger` 유니온 → `runtimeEventView.trigger = page.trigger ?? event.trigger` → `activeRuntimeEvents(kind)` → `runEvent` | **맞다.** 저작·직렬화·페이지 우선순위·검증이 이미 이 축을 지난다. 종류 하나를 더하는 것이 최소 변경이다 |
| 자동 실행(auto) | `fireAutoTriggers`(`playSceneMapRuntime.ts:704`) — `autoStartedKeys` 로 «맵당 한 번» | 성질이 같다(프레임 루프가 아니라 **사건 하나**가 실행을 시작한다). 그래서 이 트리거의 발동·회복 규약을 auto 에서 그대로 베꼈다 |
| 병렬(parallel) | `updateParallelEvents`(`playSceneSchedulers.ts:66`) — 프레임마다 인터프리터를 조금씩 굴린다 | **아니다.** 여기 필요한 것은 «걸음이 끝났을 때 한 번» 이다. 프로세스 생명주기·wait 누적·배틀 핸드오프가 전부 불필요한 무게다 |

**걸음마다의 훅은 실은 이미 있었다** — OPRN-OUT-020 노트가 말한 «없다» 는 *로케이션* 훅이
없다는 뜻이었고, 걸음 완료 지점 자체는 `playSceneMovement.advancePlayerStepFrame` 의 칸 확정
블록이다(`scene.tileX = scene.movingTo.x` 직후, `fireTouchTriggers` / `maybeTriggerRandomEncounter`
가 이미 그 자리에 산다). 그래서 새 훅을 발명하지 않고 그 줄 옆에 한 줄을 더했다.

기하 해석은 `mapNamedLocations.pointInLocation` / `locationsAtPoint` **하나뿐**이다.
드나듦은 「안에 있는가」의 **시간 미분**이므로 점유 집합의 차집합만 계산한다 — 두 번째
내부/외부 규칙을 만들면 `insideLocation` 조건과 트리거가 서로 다른 답을 내는 순간이 생긴다.

## 2. 트리거 추가 — **MET**

`{ kind: "locationTransition", locationId, transition: "enter" | "leave" }`.
판정: `src/project/locationTransitions.ts`(순수). 배선: `src/player/playSceneLocationTransitions.ts`.
상태: `PlaySession.occupiedLocationIds`(mapId → locationId[], **ID 만**, optional).

호출 지점 셋:
1. 걸음 완료 — `playSceneMovement.advancePlayerStepFrame`(칸 확정 직후, 접촉 트리거 앞)
2. 순간이동 완료 — `playSceneMapCommands.transferTo`(착지 후, 자동 트리거 앞)
3. 이벤트 종료 후 재개 — `playSceneMapRuntime.refreshRuntimeSurfaces` / `refreshRuntimeEntities`

**(3) 은 브라우저 실측이 만들어 낸 것이다.** 아래 6절 참조.

```
$ npm run typecheck:app
> tsc --noEmit -p tsconfig.app.json
(출력 없음 / exit 0)
```

## 3. 경계 사례 — 전부 결정하고 검사했다 — **MET**

```
$ npx vitest run test/locationTransitions.test.ts --maxWorkers=2
 ✓ test/locationTransitions.test.ts (25 tests) 2158ms
 Test Files  1 passed (1)
      Tests  25 passed (25)

$ npx vitest run test/locationTransitionRuntime.test.ts --maxWorkers=2
 ✓ test/locationTransitionRuntime.test.ts (19 tests) 1409ms
 Test Files  1 passed (1)
      Tests  19 passed (19)

$ npx vitest run test/locationTransitionAuthoring.test.ts --maxWorkers=2
 ✓ test/locationTransitionAuthoring.test.ts (12 tests) 2790ms
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

| 요구된 경계 | 결정한 계약 | 근거 |
|---|---|---|
| 순간이동 진입/이탈(중간 걸음 없음) | 출발 맵 점유 전부 leave + 도착 지점 enter. `transferLocationOccupancy` **한 번의 원자적 판정** | `locationTransitions.test.ts` "순간이동은 출발 맵 leave 와 도착 지점 enter 를 한 번에 낸다", `locationTransitionRuntime.test.ts` "구역 안에서 다른 맵으로…", "도착 지점이 구역 안이면…" + 브라우저 `09-teleport-into-plaza.png` |
| 같은 맵 안 워프 | 같은 구역 안으로 떨어져도 leave + enter **둘 다**(벗어났다 돌아온 것이고 재진입 연출이 다시 돌아야 한다) | "같은 맵 안 순간이동으로 같은 구역 안에 떨어지면…", 런타임판 "구역 안에서 같은 구역 안으로…" |
| 겹친 구역(안에서 다른 구역 진입) | B 의 enter 만, A 는 유지. 집합 차이라 포함관계를 특별 취급하지 않는다 | "겹친 구역: 광장 안에서 좌판에 들어가면…", "좌판에서 광장으로 되돌아 나오면 좌판 leave 만…" |
| 서 있는 채로 구역 삭제 | 다음 판정에서 leave 로 정리. 끊긴 참조를 가리키는 이벤트는 발동하지 않는다 | "구역이 삭제되면 그 안에 서 있던 점유는…", 런타임판 "삭제된 구역을 가리키는 트리거는 조용히 실행되지 않는다" |
| 서 있는 채로 구역 축소 | 발밑을 벗어나면 leave, 다시 넓히면 enter | "구역이 축소되어 발밑을 벗어나면…", 런타임판 같은 이름 |
| 안에서 저장 → 불러오기 | **아무것도 발동하지 않는다**(기록이 세이브에 실려 복원된다) | "점유 기록이 세이브에 실려 복원되므로 불러오기가 enter 를 다시 내지 않는다" |
| 기록 없는 옛 세이브 | 첫 판정은 **기준선만 심는다** | "점유 기록이 없는 옛 세이브는 불러온 뒤 기준선만 심고…" |
| 저장 후 구역이 삭제된 프로젝트로 불러오기 | 다음 판정에서 leave 로 정리 | "저장한 뒤 구역이 삭제된 프로젝트로 불러오면…" |
| 같은 칸 재진입 두 번 발동 금지 | 점유 집합이 같으면 사건이 없다 | "같은 칸에 다시 서면 아무 사건도 나지 않는다", 런타임판 "구역 안을 계속 걸어도 enter 는 한 번뿐이다" + 브라우저 `05-walk-inside-no-refire.png` |
| (추가) 나갔다 다시 들어오기 | enter 가 **다시** 난다(일회성이 아니다) | 런타임판 "나갔다 다시 들어오면 두 번째 enter 가 난다" |
| (추가) 새 게임 시작 지점이 구역 안 | 기준선만 심는다(시작 연출은 auto 의 일) | 런타임판 "시작 지점이 구역 안이면 부팅만으로는 enter 가 나지 않는다" + 브라우저 `02-field-start-outside.png` |

### 스키마 load / migrate / save — **MET, 버전 불변**

- `SCHEMA_VERSION` **오르지 않았다.** 트리거 매개변수는 새 트리거 종류에만 있고 세션 필드는
  optional 이다. `locationTransitions.test.ts` 의 "트리거가 왕복하고 스키마 버전이 오르지 않는다".
- **트리거 데이터가 없는 옛 프로젝트는 byte-stable**: "트리거 데이터가 없는 옛 프로젝트는
  로드/저장으로 한 바이트도 바뀌지 않는다"(`serialize(deserialize(before)) === before` 단정 +
  `session.occupiedLocationIds` 부재 단정).
- 와이어 검사는 `transition` 열거와 `locationId` 문자열만 강제한다 — **로케이션 실재 여부는
  보지 않는다**("삭제된 구역을 가리키는 트리거도 로드는 통과한다"). 열리지 않으면 고칠 수단이
  사라진다는 OPRN-OUT-020 의 판단을 그대로 잇는다.
- 세이브 스키마도 불변: `occupiedLocationIds` 는 writer·apply·와이어 파서에 optional 로 들어갔고
  `isLocationOccupancyRecord` 가 구조만 본다.

## 4. 저작 표면 — **MET**

- 페이지 「시작 방식」 선택기에 **「구역에 드나들면」**, 고르면 그 아래 구역·시점 선택기
  (`event-page-trigger-location`, `event-page-trigger-location-transition`).
- **구역은 이름으로 고른다 — 좌표 입력칸이 없다.** `locationTransitionAuthoring.test.ts` 의
  "선택기 항목이 현재 맵 구역의 **이름**이고, 값은 안정 ID 다"(`fields.querySelectorAll("input").length === 0`
  단정 포함), "이름을 바꿔도 저작된 트리거는 같은 구역을 가리킨다".
- **삭제된 구역은 조건과 같은 진단·복구 통로다:** 선택기에 「(삭제된 로케이션 …)」 항목으로 남고
  (`"선택기에서 사라지지 않고 …"`), `eventDraftValidator` 가 `page.trigger.location-missing`
  (error, field `event-page-trigger-location`)로 막고(`"이벤트 검증기가 error 로 막고 …"`),
  `projectLint` 가 `map-location-missing-ref` 로 올리고(`locationTransitions.test.ts` 의
  "삭제하면 projectLint 가 …"), `repairMapLocationReferences` 의 `remap` / `detach` 가 고친다.
- **트리거의 `detach` 는 시작 방식을 `action` 으로 강등한다.** `auto` 로 강등하면 맵에 들어가는
  순간 멋대로 돌고, 명령을 지우면 저작이 사라진다. 근거 테스트가 그 이유를 주석으로 담고 있다.
- `triggerFromKind` 는 이제 `SimpleTriggerKind` 만 받는다 — 매개변수 있는 이 트리거를 `{ kind }`
  만으로 짓는 실수를 **타입으로** 막았다(콘텐츠 생산기 6곳을 그 타입으로 바꿨다).

## 5. 출하 플레이어 브라우저 증거 — **MET**

```
$ npx tsx scripts/qa/runtime/loc-transition-fixture.mts > /tmp/loc-transition.json
$ npm run qa:runtime -- --scenario loc-transition --project /tmp/loc-transition.json \
    --out verify-shots/loc-transition
{"qaBrowser":"chromium","qaPort":40157}
리포트: verify-shots/loc-transition/SUMMARY.md  ← 먼저 읽어라
게이트: 통과
```

`verify-shots/loc-transition/SUMMARY.md` — 비트 9개 중 0개 실패, 런타임 에러 없음.
편집기 셸을 통과하지 않는다(`player.html` + `exportProjectStoreShim`, AGENTS.md 하드 룰).

| 샷 | 증명하는 것 |
|---|---|
| `02-field-start-outside.png` | 시작 (10,8) 광장 밖 — 대사창 없음(부팅이 «진입» 이 아니다) |
| `04-enter-plaza.png` | 경계를 밟는 걸음에서 「광장에 들어섰다.」 |
| `05-walk-inside-no-refire.png` | 안에서 두 칸 더 걸어도 대사창 없음(재발동 없음) |
| `06-leave-plaza.png` | 경계를 넘는 걸음에서 「광장을 나섰다.」 |
| `09-teleport-into-plaza.png` | 문을 밟은 **장소 이동**에서 「광장에 들어섰다.」(중간 걸음 없음) |

픽스처(`scripts/qa/runtime/loc-transition-fixture.mts`)는 최소 엔진 계약이고 출하 데모
콘텐츠가 아니며 원격에 저장하지 않는다 — AGENTS.md 「LegacyDb 필수」 하드 룰의 좁은 예외
(순수 엔진/편집기 코드 변경 + 계약용 최소 픽스처). 새 저작 콘텐츠는 만들지 않았다.

타이밍 운에 기대지 않는다: 걸음은 저작 이동 루트(`playerRoute`) + `waitForPosition` 조건
대기이고, 타자기는 고정 sleep 대신 결정 키 한 번으로 페이지를 완성시킨다
(`consumeRemainingPage`, 출하 입력 경로).

## 6. 브라우저 QA 가 실제로 잡은 결함 (유닛 테스트가 못 본 것)

**첫 실행 결과:**

```
게이트: 실패
  실패 enter-plaza: visibleText: dialogue-box 기대 "광장에 들어섰다." 포함, 실제 "▼"
  실패 leave-plaza: visibleText: dialogue-box 기대 "광장을 나섰다." 포함, 실제 "▼"
  실패 reenter-fires-again: … 실제 "광▼"
  실패 teleport-into-plaza: op waitForPosition 실패: Timeout 30000ms exceeded.,
                            testid 누락: dialogue-box
```

앞의 셋은 **하네스 문제**(타자기 진행률을 관측했다)였고 시나리오를 고쳤다.
네 번째는 **제품 결함**이었다:

문(playerTouch)을 밟아 장소 이동하면 `transferTo` 가 **문 이벤트의 인터프리터 안에서**
불리므로 그 시점 `scene.running` 이 참이고 `runEvent` 는 running 이면 즉시 되돌아 나온다 —
즉 **가장 흔한 저작(문으로 구역에 들어가기)의 enter 이벤트가 한 번도 돌지 않았다.**

유닛 테스트로는 보이지 않았다: `runSceneTest` 하네스는 이벤트를 중첩 실행하므로 running
개념이 없고, 그래서 하네스 쪽 15건은 전부 통과하고 있었다.

수정: 실행할 수 없었던 것을 버리는 대신 **아직 돌리지 못한 이벤트 id** 를 큐에 담아
자동 트리거가 회복되는 것과 같은 자리(`refreshRuntimeSurfaces`)에서 뽑는다. 결정 셋:
1. 큐는 **이벤트 id** 를 담는다(사건이 아니다) — 사건 → 이벤트 해석을 나중으로 미루면 그 사이
   바뀐 페이지 조건이 «그때 반응했어야 할 이벤트» 를 지운다.
2. 첫 이벤트가 대화를 열면 **꼬리만** 되돌려 담는다 — 사건을 통째로 담으면 이미 돌린 것이 두 번 연소.
3. 상한 8 — 긴 전투 동안 지나온 구역 전부를 뒤늦게 연소시키면 다섯 구역의 대사가 한꺼번에 터진다.

회귀 3건(`locationTransitionRuntime.test.ts` 의 "진행 중이면 밀리고 이벤트가 끝나면 돌아온다")은
씬 대역으로 running 수명을 직접 흉내낸다. **셋 다 되돌려 실패를 확인했다:**

```
# 큐잉 제거 → 2건 실패
   × running 중의 순간이동 진입은 버려지지 않고 이벤트 종료 후 실행된다
   × running 중의 걸음 진입도 같은 자리에서 회복된다
      Tests  2 failed | 17 passed (19)

# 꼬리 대신 전체를 되돌려 담기 → 1건 실패
   × 한 사건에 두 이벤트가 반응하면 첫 이벤트가 대화를 열어도 두 번째가 살아남는다
      Tests  1 failed | 18 passed (19)
```

## 7. 기존 계약 회귀 — **MET**

```
$ npx vitest run test/mapNamedLocations.test.ts test/mapLocationTools.test.ts \
    test/mapLocationLayer.test.ts test/conditionEvaluatorParity.test.ts \
    test/runtimeEventTouchPlayerCollision.test.ts test/commandKindCoverage.test.ts --maxWorkers=2
 ✓ test/mapNamedLocations.test.ts (31 tests)
 ✓ test/conditionEvaluatorParity.test.ts (38 tests)
 ✓ test/commandKindCoverage.test.ts (180 tests)
 ✓ test/runtimeEventTouchPlayerCollision.test.ts (3 tests)
 ✓ test/mapLocationTools.test.ts (12 tests)
 ✓ test/mapLocationLayer.test.ts (7 tests)
 Test Files  6 passed (6)
      Tests  271 passed (271)
```

`conditionEvaluatorParity` 의 divergence allowlist 는 여전히 **비어 있다**.

```
$ npx vitest run test/eventDraftValidator.test.ts --maxWorkers=2      → 21 passed
$ npx vitest run test/runtimeMovementStability.test.ts --maxWorkers=2 → 51 passed
$ npx vitest run test/playBootRecovery.test.ts --maxWorkers=2         → 11 passed
$ npx vitest run test/sidebarModeWorkflow.test.ts test/customSeasonSave.test.ts \
    test/editorMenuSidebarIa.test.ts --maxWorkers=2                   → 113 passed (3 files)
```

## 8. 의도적으로 하지 않은 것 (deferred, 사유 명시)

- **조수(AI) 툴 스키마에 이 트리거를 열지 않았다.** `schemaShapes.ts` 의 페이지 trigger enum 과
  `eventTools.triggerFromArg` 는 6종 그대로다. 이번 계약이 요구한 저작 표면은 **이벤트 편집기**이고,
  툴 표면을 열려면 「모델이 존재하지 않는 로케이션 ID 를 발명했을 때 어떻게 되돌리나」를 먼저
  결정해야 한다(`delete_map_location` 의 `brokenReferences` 같은 명시 게이트). 스키마만 넓히면
  커밋 게이트가 error severity lint 로 막아 모델이 같은 인자를 반복 재전송하게 된다 — 그 실측
  선례가 `shapeReferenceFields.ts:26` 주석에 있다.
- **저작 중(편집기 play 모드) 구역 기하 변경의 즉시 반영 훅을 만들지 않았다.** 출하 런타임은
  프로젝트 스냅숏을 읽으므로 이 경로가 없고, 삭제·축소는 다음 걸음/불러오기 판정에서 정리된다
  (3절의 두 줄이 그것을 검사한다). 매 프레임 점유를 다시 재는 훅은 근거 없는 무게다.
- **맵을 넘는 leave 이벤트는 실행되지 않는다** — 이것은 미룬 것이 아니라 **결정**이다.
  「이벤트는 자기 맵 안에서만 산다」는 엔진 규칙의 따름정리이고, 출발 맵의 이벤트는 착지 시점에
  이미 화면에서 사라져 있다. 문 저작에서 바깥 구역의 이탈 연출이 필요하면 문 이벤트 자신의
  명령에 쓰는 것이 옳다.

## 9. 기준선 대비 (감독자용)

기준선이 빨간불이라는 계약대로, 새로 생긴 실패만 회귀로 본다.
- `npm run typecheck:app`: **0 에러 / exit 0** (내 파일 포함 전부 초록).
- `npm run typecheck` 전체와 전체 스위트, `npm run gates` 는 기준선부터 빨간불이라 게이트로
  쓰지 않았다(quickstart 2절). 위에 적은 스위트는 전부 지정 실행으로 초록임을 확인했다.
- 내가 만진 파일이 끼어 있는 기존 스위트를 골라 돌렸고(7절) 새 실패는 없다.

## 10. 커밋

`agent/loctrans` 위에서만 작업했다. main 을 체크아웃/머지하지 않았고 push 하지 않았다.

| 커밋 | 내용 |
|---|---|
| `6e7ce116f` | feat(project): 스키마(트리거 종류·세션 점유 기록)와 순수 판정 모델, 참조 수집·복구 |
| `b534d05a4` | feat(player): 기존 트리거 디스패치 배선(걸음·순간이동), 세이브 왕복, 하네스 거울 |
| `5a4475594` | feat(editor): 「시작 방식」 선택기 + 이름 기반 구역 선택기 + 검증기 |
| `d4274fadb` | test(loctrans): 경계 사례 전량(3파일) |
| `63d7323b5` | fix(player): 이벤트 안에서 난 드나듦을 큐에 담아 종료 후 돌린다 (브라우저 실측 결함) |
| `cc251313f` | test(qa): 출하 플레이어 시나리오·픽스처 + `verify-shots/loc-transition/` |
| (문서) | openwiki 4쪽 갱신 + 이 노트 |

## 11. 갱신한 openwiki

- `runtime-project-schema.md` — 「구역 드나듦 트리거」 절 신설(계약 소유). 경계 사례 표, 큐 결정,
  세이브·스키마 불변 근거.
- `editor-event-authoring.md` — 「구역 드나듦 트리거」 절 신설(저작 표면·끊긴 참조 통로).
- `runtime-pre-edit-routing.md` — 세 호출 지점과 «새 스케줄러 만들지 마라» 경고.
- `editor-pre-edit-routing.md` — 로케이션 레이어 라우팅에 드나듦 판정 파일과 트리거 포인터 추가.
- `testing.md` — 런타임 QA 함정 3건(타자기를 sleep 으로 기다리지 마라 / 장소 이동의 중간 좌표는
  관측되지 않는다 / `loc-transition` 시나리오 실행법과 그것이 잡은 결함).
