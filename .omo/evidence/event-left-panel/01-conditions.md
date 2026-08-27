# 이벤트 편집기 좌측 "언제 보이나요"(rail slug=when) — 페이지 조건 저작 ↔ 런타임 평가 감사

- 워크트리: `/home/main/z-project/rpg-zzu-event-page-props` (main 체크아웃은 미접근)
- 감사 대상 UI 경계: `src/editor/panels/eventEditor/pageProps.ts:775` 이 `[data-testid='event-classic-conditions']` 를 slug=`when` 그룹으로 담고(`pageProps.ts:780`), 그 본문이 `renderPageConditions(...)`(`pageProps.ts:692`) → `src/editor/panels/eventEditor/pageConditions.ts:23`.
  즉 "언제 보이나요"에서 저작 가능한 조건 = 간단 조건 행 12개(`pageConditions.ts:32-115`) + 고급 조건 목록(`pageConditions.ts:116` → `pageAdvancedConditions.ts:47`).
- 런타임 페이지 선택 경로: `src/project/runtimeEventState.ts:80` → `src/project/io/pageResolution.ts:17` `resolveEventPage` → `pageResolution.ts:30` `evalPageCondition`. 플레이 세션(`PlaySessionLike`)은 조건 평가에 필요한 필드를 모두 갖는다(`src/project/sessionRuntimeTypes.ts:288,291,295-296,305,307`).
- 트리거/우선순위/겹침은 다루지 않음(다른 노드 담당).

## (1) EventPageCondition 전 kind 표

유니온 정의: `src/project/types.ts:4`(re-export) → `src/project/types/events.ts:31-52`, `events.ts:54` (`EventPageCondition = Condition`). `run` 항목은 `events.ts:49` 가 참조하는 `src/project/roguelikeRun.ts:26-30`.
판정 기준: PASS = 저작 UI 있고 런타임이 평가함 / ORPHAN = 저작되지만 런타임이 무시 / BROKEN = 평가 중 깨짐. "when 패널 저작 UI 없음"은 별도 라벨 `PASS(저작 UI 없음)` 으로 표기 — 런타임은 정상 평가하지만 이 패널에서는 만들 수도 볼 수도 없는 역(逆)고아 상태다.

| kind | 에디터(when) 저작 UI 유무 (file:line) | 저장되는 필드 | 런타임 평가 위치 (file:line) | 판정 | 근거 |
|---|---|---|---|---|---|
| `switch` (`types/events.ts:32`) | 있음 — 간단 행 2개 `pageConditions.ts:32-45`, 고급 옵션 `pageAdvancedConditions.ts:32`, 고급 폼 `pageAdvancedConditions.ts:122-134` | `switchId`, `value` (UI는 항상 `true` 로만 씀: `pageConditions.ts:155`, `pageAdvancedConditions.ts:126` `showValue:false` + `forceTrueOnSwitchChange:true`) | `pageResolution.ts:33-34` | PASS (단 `value:false` 저작 불가 → (3) 참조) | 프로브 A1/A2 통과 |
| `variable` (`types/events.ts:33-38`) | 있음 — 간단 행 `pageConditions.ts:46-52`, 고급 `pageAdvancedConditions.ts:33,135-147` | `variableId`, `op`, `value` | `pageResolution.ts:35-38` (`compareVariableValue`) | PASS | 프로브 A2 `variable pass/fail` |
| `selfSwitch` (`types/events.ts:39`) | 있음 — 간단 행 "이 이벤트 기억" `pageConditions.ts:109-115`, 고급 `pageAdvancedConditions.ts:34,148-153` | `key`, `value` | `pageResolution.ts:39-42` (`session.selfSwitches[event.id][key]`) | PASS | 프로브 A2 |
| `actor` (`types/events.ts:40`) | 있음 — 간단 행 "주인공" `pageConditions.ts:60-66`, 고급 `pageAdvancedConditions.ts:36,166-177` | `actorId`, `present` (UI는 항상 `true`: `pageConditions.ts:216`, `pageAdvancedConditions.ts:170-171`) | `pageResolution.ts:43-44` | PASS (단 `present:false` 저작 불가 → (3)) | 프로브 A2 |
| `item` (`types/events.ts:41`) | 있음 — 간단 행 "아이템" `pageConditions.ts:53-59`, 고급 `pageAdvancedConditions.ts:35,154-165` | `itemId`, `present` (UI는 항상 `true`: `pageConditions.ts:232`, `pageAdvancedConditions.ts:158-159`) | `pageResolution.ts:45-46` | PASS (단 `present:false` 저작 불가 → (3)) | 프로브 A2, 기존 `test/pageItemCondition.test.ts:38-151` |
| `gold` (`types/events.ts:42`) | 있음 — 간단 행 없음, 고급 전용 `pageAdvancedConditions.ts:37,178-183`; 모든 gold 조건이 고급 목록에 노출 `pageConditionModel.ts:227-229` | `op`, `amount` | `pageResolution.ts:47-48` | PASS | 프로브 A2, `pageConditionsGuarantee.test.ts:207` 통과분 |
| `timer` (`types/events.ts:43`) | 있음 — 간단 행 2개(타이머1/2) `pageConditions.ts:67-80`, 고급 `pageAdvancedConditions.ts:38,184-191` | `timerId`, `seconds` (분·초 입력 합산 `pageConditions.ts:256-262`) | `pageResolution.ts:49-50` (`<= seconds`) | PASS | 프로브 A2(`timers.timer1=999` 로 실패 확인) |
| `timePhase` (`types/events.ts:44`) | 있음 — 간단 행 "시간대" `pageConditions.ts:81-87`, 고급 `pageAdvancedConditions.ts:39,192-196` | `phase` | `pageResolution.ts:51-52` (`conditionMatchesTimePhase`) | PASS | 프로브 A2(hour 23 로 실패) |
| `season` (`types/events.ts:45`) | 있음 — 간단 행 "계절" `pageConditions.ts:88-94`, 고급 `pageAdvancedConditions.ts:40,197-201` | `season` | `pageResolution.ts:53-54` (`conditionMatchesSeason`) | PASS | 프로브 A2(winter 로 실패) |
| `npcActivity` (`types/events.ts:46`) | 있음 — 간단 행 "활동" `pageConditions.ts:95-101`, 고급 `pageAdvancedConditions.ts:41,202-206` | `activity` | `pageResolution.ts:55-56` (`session.npcActivities[event.id]`) | PASS | 프로브 A2. 세션 채우는 쪽은 `src/player/npcSchedules.ts:184-189` 가 `eventId` 키로 기록 → 키 일치 |
| `friendshipAtLeast` (`types/events.ts:47`) | 있음 — 간단 행 "호감도" `pageConditions.ts:102-108` (+ npcKey/값 입력 `conditionForm.ts:1005-1023`), 고급 `pageAdvancedConditions.ts:42,207-212` | `npcKey?`, `value` | `pageResolution.ts:57-61` (`resolveSocialKey` → `src/project/socialKey.ts:16-24`, 키 없으면 false) | PASS | 프로브 A2 (`npcKey:"npc_probe"`), `test/characterIdRelationshipGate.test.ts:61` |
| `battleResult` (`types/events.ts:48`) | **없음** — 간단 행 없음(`pageConditions.ts:32-115` 목록에 부재), 고급 추가 옵션에도 없음(`pageAdvancedConditions.ts:31-45`), 고급 목록 열거에서도 탈락(`pageConditionModel.ts:167-235` 에 분기 없음). 저작은 fork 명령 폼에서만 가능(`conditionForm.ts:23,152-154`) | `result` | `pageResolution.ts:62-63` | PASS(저작 UI 없음) | 프로브 B1: `advancedConditionEntries` 결과가 `["gold"]` 뿐 / 프로브 B2: 추가 셀렉트에 옵션 없음 / 런타임은 프로브 A2 `battleResult pass·fail` 통과 |
| `run` (`roguelikeRun.ts:26-30`, `types/events.ts:49`) | 있음 — 간단 행 없음, 고급 전용 옵션 "탐험" `pageAdvancedConditions.ts:43,213-214`, 목록 열거 `pageConditionModel.ts:231-233` | `query` + (`value`/`op`/`flag`/`result`) | `pageResolution.ts:64-65` → `roguelikeRun.ts:103-118` | PASS | 프로브 A2(`floor>=3`, 실패는 `floor:1`) |
| `all` (`types/events.ts:50`) | **없음** — when 패널 어디에도 분기 없음(`pageConditions.ts:32-116`, `pageAdvancedConditions.ts:31-45,120-215`, `pageConditionModel.ts:167-235`). fork 폼 전용(`conditionForm.ts:25,159-161`) | `conditions[]` | `pageResolution.ts:66-67` (재귀) | PASS(저작 UI 없음) | 프로브 B1/B2 + A2 |
| `any` (`types/events.ts:51`) | **없음** — 위와 동일(`pageAdvancedConditions.ts:31-45`, `pageConditionModel.ts:167-235`) | `conditions[]` | `pageResolution.ts:68-69` (재귀) | PASS(저작 UI 없음) | 프로브 B1/B2 + A2 |
| `not` (`types/events.ts:52`) | **없음** — 위와 동일 | `condition` | `pageResolution.ts:70-71` (재귀) | PASS(저작 UI 없음) | 프로브 B1/B2 + A2 |

요약: 런타임 평가 누락(ORPHAN)은 **0건**. `pageResolution.ts:32-72` 의 switch 는 16 kind 를 모두 처리하고, 저장/불러오기 검증기도 16 kind 전부를 알고 있다(`src/project/io/shapeEventFields.ts:305-310` → `src/project/io/shapeCommandFields.ts:468-556`, `all/any/not` 재귀 포함). 문제는 반대 방향이다: `battleResult`, `all`, `any`, `not` 4종은 **런타임이 평가하는데 when 패널에서 만들 수도, 보이지도, 편집할 수도 없다**(프로브 B1 은 이 4종이 고급 목록에서 통째로 사라지는 것을 실증). 데이터에 들어오는 경로는 fork 조건 폼 재사용·AI/툴 생성·JSON 직접 편집이며, 들어온 뒤에는 편집기에서 흔적이 사라진다(고급 렌더러의 최종 폴백 `pageAdvancedConditions.ts:216` 는 빈 div).

## (2) `test/pageConditionsGuarantee.test.ts` 실패 3건 근본 원인

실행 결과(그대로 붙임):

```
$ cd /home/main/z-project/rpg-zzu-event-page-props && node scripts/run-vitest.mjs run test/pageConditionsGuarantee.test.ts --configLoader bundle

 ❯ test/pageConditionsGuarantee.test.ts (14 tests | 3 failed) 5272ms
   ✓ ... (11 passed)
   × page conditions working guarantee (all kinds) > 고급 목록: 간단 행 초과분 + selfSwitch/gold 가 모두 보인다 142ms
     → sample has battleResult: expected 0 to be greater than 0
   × page conditions working guarantee (all kinds) > 런타임: CONDITION_KINDS 전원이 true/false로 평가된다 263ms
     → Cannot read properties of undefined (reading 'kind')
   × page conditions working guarantee (all kinds) > 런타임: 각 kind를 단독으로 true/false 토글 가능하다 110ms
     → Cannot read properties of undefined (reading 'kind')

 FAIL ... > 고급 목록: ...
AssertionError: sample has battleResult: expected 0 to be greater than 0
 ❯ test/pageConditionsGuarantee.test.ts:229:43
    227|     for (const kind of CONDITION_KINDS) {
    228|       const total = conditions.filter((c) => c.kind === kind).length;
    229|       expect(total, `sample has ${kind}`).toBeGreaterThan(0);

 FAIL ... > 런타임: CONDITION_KINDS 전원이 true/false로 평가된다
TypeError: Cannot read properties of undefined (reading 'kind')
 ❯ evalPageCondition src/project/io/pageResolution.ts:32:21
 ❯ src/project/io/pageResolution.ts:24:46
 ❯ resolveEventPage src/project/io/pageResolution.ts:24:25
 ❯ test/pageConditionsGuarantee.test.ts:356:12

 FAIL ... > 런타임: 각 kind를 단독으로 true/false 토글 가능하다
TypeError: Cannot read properties of undefined (reading 'kind')
 ❯ test/pageConditionsGuarantee.test.ts:417:21

 Test Files  1 failed (1)
      Tests  3 failed | 11 passed (14)
```

### `pageResolution.ts:32` 에서 condition 이 undefined 인 이유 — 데이터 흐름

1. `CONDITION_KINDS` 는 16개다: `src/project/commandKindRegistry.ts:102-119` (`satisfies readonly Condition["kind"][]` + `commandKindRegistry.ts:123-127` 누락 방지 타입 단정).
2. 테스트의 픽스처 팩토리 `sampleCondition` 은 `CONDITION_KINDS` 를 받으면서 **11개 kind 만** case 를 갖는다: `test/pageConditionsGuarantee.test.ts:68-93` (`switch`~`friendshipAtLeast`). `battleResult`/`run`/`all`/`any`/`not` 에 대한 case 도, default 도 없다 → 런타임에 `undefined` 반환.
3. `test/pageConditionsGuarantee.test.ts:316` `const conditions = CONDITION_KINDS.map((kind) => sampleCondition(kind));` 가 길이 16 배열을 만들고 그중 인덱스 11..15 가 `undefined` 다(구멍이 아니라 `undefined` 값). 이 배열이 페이지의 `conditions` 로 들어간다(`test:326`).
4. `resolveEventPage` 가 `page.conditions.every(...)` 로 순회(`src/project/io/pageResolution.ts:24`)하다가 `undefined` 를 `evalPageCondition` 에 넘기고 `pageResolution.ts:32` `switch (condition.kind)` 에서 터진다. 세 번째 실패는 같은 원인이 테스트 코드 쪽에서 더 먼저 터진 것(`test:417` 에서 `condition.kind` 접근, 소스는 `test:392` 의 `sampleCondition(kind)`).
5. 첫 번째 실패도 같은 뿌리: `test:173-196` 의 수기 픽스처 배열에 `battleResult`/`run`/`all`/`any`/`not` 항목이 없는데 `test:227-229` 루프는 `CONDITION_KINDS` 16종 전부에 `> 0` 을 요구한다. `CONDITION_KINDS` 순서상 처음 걸리는 것이 `battleResult`(`commandKindRegistry.ts:114`).

**sparse/누락 배열을 만드는 코드는 src 가 아니라 테스트 픽스처다**: `test/pageConditionsGuarantee.test.ts:68-93`(팩토리)과 `test/pageConditionsGuarantee.test.ts:316`(map). src 측 정규화·검증(`shapeEventFields.ts:305-310`, `shapeCommandFields.ts:468-556`)은 조건 배열에서 항목을 떨어뜨리지 않으며, 에디터 쓰기 경로(`pageConditionModel.ts:238-253`, `pageConditions.ts` 의 각 `apply`)도 `undefined` 를 push 하지 않는다.

컴파일러가 왜 못 막았나: `tsc --noEmit` (tsconfig.json, test 포함, `noImplicitReturns: true`) 는 실제로 잡는다 —
```
$ npx tsc --noEmit | grep pageConditionsGuarantee
test/pageConditionsGuarantee.test.ts(71,67): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```
그러나 `npm run build` 는 `tsconfig.app.json`(package.json:23, app 설정은 `test` 제외: tsconfig.app.json `exclude`)만 검사하므로 빌드에서는 통과한다. 참고로 리포지토리 전체 `tsc --noEmit` 은 이미 625줄 규모의 선재(pre-existing) 오류를 뱉는 상태다(내 프로브 파일 관련 오류는 0건).

### 제안 최소 수정 (적용하지 않음)

1. `test/pageConditionsGuarantee.test.ts:68-93` `sampleCondition` 에 `battleResult`/`run`/`all`/`any`/`not` case 5개를 추가해 16 kind 총망라로 만든다(`test/_probe-conditions.test.ts:30-67` 의 `probeCondition` 을 그대로 이식하면 됨).
2. `test/pageConditionsGuarantee.test.ts:173-196` 픽스처에 위 5종 항목을 추가하고, 세션에도 `battleResult`/`roguelikeRun` 을 채운다(프로브 `passingSession()` 과 동일).
3. 다만 그 5종은 when 패널에 UI가 없으므로 `test:227-229` 의 "고급 목록에 보인다" 요구는 (3)의 UI 결손을 고치지 않으면 여전히 실패한다 — 테스트만 고칠지, `pageAdvancedConditions.ts:31-45` + `pageConditionModel.ts:167-235` 에 4종을 추가할지는 제품 결정 사항.

## (3) 값이 store 로 반영되지 않거나 왜곡되는 컨트롤

모든 간단 행/고급 행 컨트롤은 `change` 리스너가 붙어 있고 `updateEventPage` 로 store 에 쓴다(체크박스 `pageConditions.ts:129`, 스위치 `:153-166`, 변수 `:191-192,196-201`, 주인공 `:214-224`, 아이템 `:230-240`, 타이머 `:265-266`, 시간대 `:286-289`, 계절 `:301-304`, 활동 `:315-320`, 호감도 `:329-344`(→`conditionForm.ts:1022-1023`), 셀프스위치 `:346-352`(→`conditionForm.ts:738-746,760-770`)). **이벤트 미바인딩으로 완전히 죽은 컨트롤은 발견되지 않았다.** 대신 필드 왕복(round-trip)이 끊기는 결손이 4건 있다.

1. 스위치 `value:false` 를 저작·표시·보존할 수 없다. 간단 행은 항상 `value: true` 로 쓰고(`pageConditions.ts:155`), 접미 라벨도 "켜짐" 고정(`pageConditions.ts:37`), 체크박스 재활성 경로도 `{ ...condition, value: true }` 로 덮는다(`pageConditionModel.ts:112`). 고급 행은 값 셀렉트를 숨기고 스위치 교체 시 true 로 강제한다(`pageAdvancedConditions.ts:124-126` → `conditionForm.ts:654-659`). 결과: 데이터에 `switch value:false` 가 있으면 화면에는 "켜짐"으로 보이고, 스위치를 한 번 바꾸면 조용히 `true` 로 뒤집힌다. 런타임은 `false` 를 정상 비교하므로(`pageResolution.ts:33-34`) 에디터 표시와 실제 동작이 갈린다.
2. 아이템 `present:false`("소지 안 함") 동일 문제 — 간단 행이 항상 `present:true` 로 쓰고(`pageConditions.ts:232`) 라벨은 "보유 중" 고정(`pageConditions.ts:58`), 고급 행도 `showPresent:false` + `forcePresentOnItemChange:true`(`pageAdvancedConditions.ts:157-159` → `conditionForm.ts:845-850`).
3. 주인공 `present:false`("파티에 없음") 동일 — `pageConditions.ts:216`, 라벨 "파티에 있음" 고정(`pageConditions.ts:65`), 고급 `pageAdvancedConditions.ts:169-171` → `conditionForm.ts:812-817`.
4. 아이템/주인공 셀렉트를 "(선택)"(빈 값)으로 되돌리면 조건이 조용히 삭제된다(`pageConditions.ts:216`, `:232` 의 `if (id)` 가드로 push 생략 → 체크박스는 여전히 켜진 채 조건 0개). 활동 입력도 공백으로 지우면 같은 방식으로 삭제된다(`pageConditions.ts:317-318`). 삭제 의도가 아니면 상태가 어긋난다.

부가로, (1)에서 적은 `battleResult`/`all`/`any`/`not` 은 UI 자체가 없어 "값 반영 경로" 이전 단계에서 끊긴다 — 고급 목록 열거(`pageConditionModel.ts:167-235`)와 추가 셀렉트(`pageAdvancedConditions.ts:31-45`) 양쪽에 분기가 없다.

## 프로브 결과

파일: `test/_probe-conditions.test.ts` (조사용으로 새로 작성, src 무수정)

```
$ cd /home/main/z-project/rpg-zzu-event-page-props && node scripts/run-vitest.mjs run test/_probe-conditions.test.ts --configLoader bundle

 ✓ test/_probe-conditions.test.ts (4 tests) 3037ms
   ✓ probe: page condition authoring vs runtime > A1: 16 kind 전부를 한 페이지에 넣어도 런타임이 undefined 없이 true 로 평가한다  985ms
   ✓ probe: page condition authoring vs runtime > A2: 각 kind 단독으로 런타임 true/false 가 갈린다  1100ms
   ✓ probe: page condition authoring vs runtime > B1: 고급 조건 목록이 battleResult/all/any/not 을 통째로 누락한다  471ms
   ✓ probe: page condition authoring vs runtime > B2: 조건 추가 셀렉트에도 battleResult/all/any/not 옵션이 없다  476ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

해석: A1/A2 는 `resolveEventPage` 가 16 kind 전부를 실제로 평가하고 각 kind 단독으로 true/false 가 갈린다는 뜻(= 런타임 ORPHAN 0건). B1 은 `advancedConditionEntries` 가 `battleResult/all/any/not` 4종을 포함한 페이지에서 `["gold"]` 만 돌려준다는 것, B2 는 "조건 추가" 셀렉트 옵션에 그 4종이 없고 `run` 만 있다는 것을 고정한다.

## UNKNOWN / 미확인

- 브라우저 실제 조작(체크박스 클릭 → 렌더 갱신 → 저장 파일)의 end-to-end 확인은 하지 않았다(dev 서버 금지 지침). 위 판정은 코드 읽기 + 단위 프로브 근거다.
- `npcActivity` 의 세션 키 일치는 `src/player/npcSchedules.ts:184-189` 를 읽어 확인했으나, 스케줄 노드 담당 범위라 스케줄 적용 타이밍 자체는 검증하지 않았다.
- `battleResult`/`all`/`any`/`not` 이 실제 프로젝트 데이터(defaults/AI 생성물)에 얼마나 존재하는지 스캔하지 않았다 — 영향 범위는 UNKNOWN.
