# OPRN-OUT-013 — 좌표 목적지 이동, 수용 기준별 증거

Branch `agent/oprn013` (worktree `/home/main/z-project/rpg-zzu-oprn013`, dev port 9851).
Spec: `/tmp/oprn/OPRN-OUT-013.md`.

## 재현 명령 (전부 이 워크트리 안에서)

```bash
npm run typecheck:app                                    # 0 errors / exit 0
npx vitest run test/coordinateDestinationMove.test.ts --maxWorkers=2      # 38 passed
npx vitest run test/coordinateMoveCommandBody.test.ts --maxWorkers=2      # 22 passed
npx vitest run test/eventEditorM2Surface.baseline.test.ts --maxWorkers=2  # 16 passed
npm run gates -- --only css                              # exit=0, 기준선 대비 회귀 없음

# 저작 UI 브라우저 증거 (dev server 9851)
npx vite --configLoader runner --host 127.0.0.1 --strictPort --port 9851
RPG_ZZU_URL=http://127.0.0.1:9851 node scripts/capture-coordinate-move-form.mjs
#   → verify-shots/oprn-013/*.png + summary.json

# 출하 플레이어(Test Play) 증거
npx tsx scripts/prepare-coordinate-move-qa.mts
node scripts/qa-coordinate-move.mjs
#   → verify-shots/oprn-013/test-play/ (SUMMARY.md 를 먼저 읽어라)
```

**주의 (실측):** `npm run dev:worktree` 는 이 워크트리에서 포트를 잘못 잡는다 —
`vite --configLoader runner` 가 `node_modules` 정션을 통해 **본 저장소의 `.env.local`**
(`DEV_SERVER_PORT=9841`)을 읽어 다른 에이전트의 서버와 충돌한다. `--port 9851` 을
명시하면 정상 동작한다. 저장소 설정 결함이 아니라 워크트리 env 해석 문제다.

## 수용 기준별 판정

### 1. 주인공 / 이 이벤트 / 고른 이벤트를 고정 X·Y 로 이동 — **met**

- 저작: `verify-shots/oprn-013/01-legacy-fixed-coordinates.png`(이 이벤트 · 고정 6,4),
  `06-target-event-selected.png`(고른 이벤트, 원시 id 를 손으로 넣지 않고 목록에서 선택).
  `verify-shots/oprn-013/summary.json` 의 `06-target-event-selected.fields.target` =
  `ev_oprn013_guard` — 「확인」을 눌러 실제로 커밋된 값이다.
- 런타임: `test/coordinateDestinationMove.test.ts`
  「대상 player/this-event/ev_target 로 고정 좌표 이동 단계를 낸다」 3건,
  「고른 이벤트를 걷게 하고…」·「빈 target 은 this-event 처럼…」 2건(실제 프레임 디스패처).
- 대상 값의 정본은 `@player` / `this-event` / 이 맵 이벤트 id 이고 픽커는
  OPRN-OUT-012 의 `eventTargetCatalog` 를 그대로 쓴다.

### 2. X·Y 가 각각 표준 변수 픽커로 기존 변수를 읽는다 — **met**

- `verify-shots/oprn-013/03-standard-variable-picker.png` 은 **손대지 않은** 표준 레코드
  픽커 패널이다(검색 · 사용처 수 · 이름 편집 · 「+ 새 변수」).
- `04-x-variable-selected.png` + `summary.json` 의
  `04-x-variable-selected.fields` = `{xSource:"variable", xVariableId:"var_oprn013_x", …}`.
  같은 파일의 `07-failure-policy-and-result.fields` 는 두 축 모두 변수인 경우다.
- 축을 독립적으로 섞는 것: `test/coordinateMoveCommandBody.test.ts`
  「X 는 변수, Y 는 숫자처럼 축마다 다르게 저작할 수 있다」.

### 3. 고정값과 변수 참조에 「런타임 전에 알 수 있는」 진단만 붙는다 — **met**

- 두 축 모두 고정일 때만 지도 범위를 단정한다(`map.position.out-of-bounds`).
  한 축이라도 변수면 단정하지 않는다:
  `test/coordinateMoveCommandBody.test.ts` 「한 축이라도 변수면 지도 범위를 단정하지 않는다」.
- 고정값의 소수·음수 → `m2.coordinate.fixed.invalid` (런타임과 **같은 해석기**).
  「변수」인데 미선택 → `m2.coordinate.variable.unselected`.
  없는 변수 → 기존 `reference.variable.missing`.
- 미리보기 경고: `verify-shots/oprn-013/08-unselected-variable-warning.png`
  (「주의:」 접두어 + `--danger` — 색만으로 상태를 구분하지 않는다).

### 4. 없음·비수치·비유한·소수·음수·맵 밖을 (0,0) 없이 반려 — **met**

- 순수 해석기 6케이스: `test/coordinateDestinationMove.test.ts`
  「변수 {없는 변수 / 숫자가 아닌 값 / 무한 / NaN / 소수 / 음수} 는 좌표가 되지 못하고 이유가 남는다」.
- **핵심 계약**: 「변수 없음」과 「값 0」이 구별된다 —
  「변수 값 0 은 유효한 좌표이고, 「변수 없음」과 구별된다」.
  구현은 `session.variables[id]` **원시 조회**다(`getVariable` 의 `?? 0` 이 이 결함의 원인이었다).
- 인터프리터: 「무효한 변수 값(소수/음수)은 이동 단계를 아예 내지 않는다 — (0,0) 으로 떨어지지 않는다」.
- 출하 플레이어 실측: `verify-shots/oprn-013/test-play/report.json`
  stage2 에서 X=9999 → 결과 코드 3(맵 밖), 좌표는 `(6,5)` 유지 — **(0,0) 이 아니다**.
  `02-out-of-bounds.png`.

### 5. 막힘·경로 없음이 문서화된 결과를 내고 대기 명령이 항상 끝난다 — **met**

- 결과 열거와 정수 코드(계약): `arrived 0 / invalidInput 1 / missingTarget 2 /
  outOfBounds 3 / blocked 4 / unreachable 5 / interrupted 6`.
  문서: `openwiki/runtime-m2-flow-controls.md` 「좌표 목적지 이동의 실패 계약」.
- 유닛: 「막힌 칸으로는 blocked 로 끝나고 대기가 풀린다」,
  「지형으로 완전히 둘러싸인 칸은 unreachable 로 구별된다」,
  「이 맵에 없는 대상은 missingTarget 이고 그 자리에서 끝난다」,
  「중단(abort)도 결과로 남고 대기가 즉시 풀린다」.
- 출하 플레이어: stage3(물로 둘러싼 (9,5)) → 코드 5, `STAGE 3 CONTINUED` 대사가 실제로
  떴다 = 대기가 풀렸다. `test-play/03-walled.png`, `SUMMARY.md` 의
  "stage3 blocked/unreachable = 5; waiting command terminated".
- 해석 실패는 이동 단계를 **아예 내지 않으므로** 기다릴 대상이 없다:
  「변수가 없으면 대기 설정이어도 즉시 다음 명령으로 간다 — 영원히 기다리는 경로가 없다」.

### 6. 실패 후 분기·계속 또는 opt-in 대체를 저작자가 고른다 · 기본이 안전 — **met**

- 기본값은 `onFailure: "continue"` + `fallback: "none"` 이고, **키가 없으면** 그렇게 읽힌다:
  「키가 없는 옛 저장본은 고정 좌표로 읽힌다」 + 카탈로그 defaultValue 단정.
- 「이벤트 중단」: 전경 `test/…` 「「실패하면 이벤트 중단」은 뒤 명령을 실행하지 않는다」,
  병렬 「병렬 이벤트에서도 「실패하면 중단」은 뒤 명령을 실행하지 않는다」.
  출하 플레이어 stage4: `cm_stage_done=true`(중단 전) · `cm_after_stop=false`(중단 후) ·
  「SHOULD NOT APPEAR」 대사 없음 — `test-play/04-stop-on-failure.png`.
- **분기**는 결과 변수/스위치 + 기존 조건 분기 명령의 조합으로 한다(아래 「의도적 설계 선택」).
- opt-in 대체: 「대체 목적지를 켜면 맵 밖 좌표가 가장 가까운 통행 가능한 칸으로 이동한다」.
  꺼져 있으면 클램프하지 않는다(기준 4 의 stage2 실측).
- 미리보기가 현재 정책을 글자로 말한다: `verify-shots/oprn-013/summary.json`
  `01…preview` = "실패해도 다음 명령으로 진행합니다. … (0,0) 으로 떨어지지 않습니다."

### 7. 도착과 모든 실패가 경쟁 없는 방법으로 구별된다 — **met**

- 코드 7종이 서로 다르다: 「결과 코드는 일곱 종이 모두 다르다」.
- **명령별** 기록: 「명령마다 다른 변수를 쓰면 나중 명령이 앞 명령의 결과를 덮지 않는다」,
  「고른 이벤트를 걷게 하고 **그 명령의 결과 변수에만** 기록한다」(불간섭 문자 42 로 증명).
- 두 명령이 겹칠 때: 「두 명령이 각자 결과 변수를 쓰면 교체된 쪽은 interrupted,
  새 쪽은 도착으로 남는다」 — 같은 테스트가 공유 `pathfindSucceeded` 는 마지막 명령의
  것임을 함께 단정한다(그래서 명령별 기록처가 필요하다는 근거).
- 병렬 이벤트의 대기 이동도 자기 결과 변수에 기록한다:
  「병렬 이벤트의 대기 이동도 자기 결과 변수에 기록하고 다음 명령으로 간다」.

### 8. 기존 경로탐색·변수 픽커·검증을 재사용, 중복 엔진 없음 — **met**

- 경로: `playScenePathfinding` → `findChasePath`(A*) 그대로. 새 탐색기 없음.
- 대체 목적지: 기존 `nearestPassableTile`(`playSceneMapCommands`) 그대로.
- 대상: `createMoveRouteTargetPicker` + `project/eventTargetCatalog`(OPRN-OUT-012).
  `05-target-event-picker.png` 의 옵션 testid 가 `move-route-event-option-*` — 같은 픽커다.
- 변수/스위치: 표준 `databasePicker` → `openRecordPickerPanel`(03 스크린샷).
- 검증: 기존 `M2_REFERENCE_RULES` · `validateMapPosition` 재사용.
- 좌표 판정은 순수 모듈 **하나**(`coordinateDestination.ts`)를 저작 폼 · 저작 진단 ·
  런타임 · m2Runtime 기록이 공유한다 — 규칙이 갈라질 자리가 없다.
- `MoveRoute.skippable` 은 **감사 후 재사용하지 않았다**. 사유는 아래 「의도적 설계 선택」.

### 9. 기존 고정 좌표 명령이 마이그레이션/기본값 뒤에도 그대로 로드·동작 — **met**

- 런타임 단계 모양이 **바이트 단위로** 이전과 같다:
  「옛 고정 좌표 명령의 단계는 새 키 없이 이전과 같은 모양이다」(`toEqual` 로 잰다).
  기존 `test/eventRuntimeExecution.test.ts`(13건)·`test/commandContracts/m2Command.contract.test.ts`(83건)·
  `test/runtimeMovementStability.test.ts`(51건)이 손대지 않고 초록이다.
- 저작: 「옛 고정 좌표 명령을 열면 숫자 칸이 보이고 변수 칸은 숨는다」,
  「폼을 열기만 해도 저장값이 바뀌지 않는다」(`replaced` 가 빈 배열).
- 진단: 「옛 고정 좌표 명령(새 키 없음)은 아무 진단도 새로 만들지 않는다」.
- 마이그레이션 코드가 **없다** — 없는 키가 기본값으로 읽히는 것이 곧 호환이고,
  저장본을 다시 쓰지 않는다(옛 프로젝트를 여는 것이 편집이 되지 않는다).
- 「변수 위치로 이동」(소스 키 없는 별 명령)의 기존 필수 참조 검증은 그대로다:
  `test/eventDraftValidator.test.ts` 21건 초록.

### 10. 고정·변수 좌표 / 대상 종류 / 무효값 / 막힘·경로없음 / 대체 / 대기 / 병렬 / 지속성 / Test Play 도착 — **met**

| 축 | 증거 |
|---|---|
| 고정 좌표 | `coordinateDestinationMove` 「대상 …로 고정 좌표 이동」·「옛 고정 좌표 …같은 모양」 |
| 변수 좌표 | 같은 파일 「변수 좌표를 읽어 목적지로 쓴다」 + Test Play stage1 |
| 대상 종류 3종 | 위 3건 + 씬 재생 「고른 이벤트」·「빈 target」 |
| 무효값 | 순수 6케이스 + 인터프리터 2케이스 + Test Play stage4 |
| 막힘·경로 없음 | 씬 재생 blocked / unreachable 2건 + Test Play stage3 |
| 대체 선택 | 씬 재생 「대체 목적지를 켜면 …」 (끄면 stage2 처럼 실패) |
| 대기 | 위 전부 `wait:true` 로 잰다 + 「영원히 기다리는 경로가 없다」 |
| 병렬 명령 | 병렬 2건(도착·중단) + 결과 불간섭 2건 |
| 지속성 | 「저장/로드 왕복 뒤에도 같은 목적지가 나온다」(serialize→deserialize 2회) |
| **Test Play 도착** | `verify-shots/oprn-013/test-play/SUMMARY.md` = **PASS**, `01-variable-arrival.png`. `report.json` 의 `stage1Positions` 59 표본이 `(10,8)→(9,8)→(8,8)→…→(6,5)` 로 **걸어간** 궤적을 남긴다(순간이동 아님) |

합계: 새 테스트 **60건**(38 + 22) 초록. `npm run typecheck:app` 0 errors.

## 의도적 설계 선택 (추측이 아니라 근거 있는 결정)

1. **분기는 「결과 브랜치」가 아니라 결과 변수/스위치 + 기존 조건 분기다.**
   스펙이 둘 중 하나를 허용한다("a result branch **or** a documented result
   switch/variable"). m2 명령의 `fields` 는 `Record<string, string|number|boolean>` 이라
   하위 명령 목록을 담을 자리가 없고, 담게 만들면 m2 스키마 · 지속성 · 브랜치 편집 UI ·
   AI 툴 스키마까지 번지는 별 작업이 된다. 결과 변수는 **경쟁이 없고**(명령별) 실패
   **종류까지** 구별하므로 요구를 더 잘 만족한다. 도착 여부만 필요하면 스위치를 쓴다.
2. **`MoveRoute.skippable` 은 재사용하지 않았다** (이슈의 감사 항목).
   그 옵션은 이동 루트의 **개별 단계**가 막혔을 때 그 단계를 버리는 것이고, 이 이슈는
   **목적지 전체**의 성공/실패 판정을 요구한다. 게다가 `moveEvent` 인터프리터 단계가
   그 값을 아예 싣지 않는다(런타임 단계 타입에 필드가 없다) — 고쳐 쓰려 해도 의미가
   이 계약을 덮지 못한다. 사유를 `openwiki/runtime-m2-flow-controls.md` 에 남겼다.
3. **`session.flags.pathfindSucceeded` 는 없애지 않았다.** 이미 저작된 프로젝트와
   `runtimeMovementStability` 회귀가 읽는다. 다만 「전역 한 칸이라 병렬에서 경쟁한다」를
   위키에 명시하고, 명령별 기록처를 정본으로 세웠다.
4. **결과 정수 코드는 계약이다.** 저작자가 조건 분기에서 그 숫자를 쓰므로 순서 변경·
   재사용을 금지한다고 위키와 소스 주석에 못박았다.

## 부수적으로 고친 것 (이 작업이 드러낸 실제 결함)

- **죽은 입력.** `.actor-m2-field { display: grid }` 가 `[hidden]` 의 UA `display:none` 을
  이겨, 배타 필드(숫자/변수)와 대상 검색 줄이 숨겨야 할 때도 보였다. 브라우저 QA 가
  계산된 `display` 를 재서 잡았다(스크린샷만으로는 놓쳤을 결함).
  Page3 `valueSourceControls` 도 같은 계약을 공유하므로 함께 고쳐졌다.
- **대상 픽커 무스타일.** 이동 대상 픽커 CSS 가 전부 `.move-route-editor` 스코프여서
  다른 폼에서 재사용하면 목록이 날것으로 나왔다. 규칙을 복제하지 않고 선택자에
  스코프를 하나 더 붙였다.
- **missing-field 콘솔 도배.** 변수 소스일 때 `x`/`y` 가 없을 수 있는데
  `m2ModernRuntime` 이 `fieldNumber` 로 읽어 매 실행마다 경고를 냈다(출하 플레이어 QA
  실측). 이제 해석된 목적지를 기록하고 경고하지 않는다. 회귀 단정 추가.

## 이관/한계 (deferred, 추측하지 않음)

- **`verify-shots/runtime-qa/` 는 `.gitignore` 대상**(하네스가 매 실행 디렉터리째
  재생성한다). 저장소 규약대로 보존본을 `verify-shots/oprn-013/test-play/` 로 복사해
  추적했다. 원본 경로는 재실행으로 언제든 재생산된다.
- **LegacyDb 저장 의무 없음.** 이 변경은 순수 엔진/에디터 코드이고, 맵·이벤트·데모
  콘텐츠를 새로 저작하지 않는다(루트 `AGENTS.md` 하드 룰의 명시적 예외).
  Test Play 픽스처는 계약 검증용 최소 fixture 이며 원격 저장 경로를 타지 않는다.
- **전체 `npm run typecheck` 와 전체 vitest 는 기준선부터 빨간불**이다(quickstart 2절).
  기준선 대비 새 실패를 만들지 않았음을 확인한 범위: 위 재현 명령의 스위트들 +
  `moveRoute*`(51건) + `eventRuntimeExecution`·`m2Command.contract`·`m2EventCommandCatalog`·
  `interpreter`·`eventDraftValidator`. `test/eventCommandSupportRepairs.test.ts` 의 6건은
  **기준선에서도 실패**한다(내 변경 전 커밋에서 동일 6건 실패 실측) — 손대지 않았다.
- **감독자 몫**: 전체 `npm run gates`, 빌드, 통합. 이 워크트리에서는
  `npm run gates -- --only css` 만 돌렸다(스타일을 만졌으므로).
