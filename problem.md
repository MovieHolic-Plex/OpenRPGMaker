# 이벤트 에디터 적대적 리뷰 문제 기록

- 감사일: 2026-07-30
- 범위: `src/editor/panels/eventEditor/`, 이벤트 초안·명령 경로·명령 목록 및 관련 테스트
- 상태 표기: **확정**은 코드 근거와 임시 회귀 테스트로 재현한 항목이다.
- 이 문서는 문제와 권고를 기록하며, 아직 제품 코드는 수정하지 않았다.

## 우선순위 요약

| 우선순위 | 문제 | 영향 | 상태 |
|---|---|---|---|
| P1 | 상점 명령에서 여러 설정을 연속 변경하면 앞선 값이 유실됨 | 저장 데이터가 UI 표시와 다르게 조용히 되돌아감 | 확정 |
| P1 | 취소한 명령 편집이 재오픈 후 Undo로 부활함 | 사용자가 폐기한 데이터가 다시 저장될 수 있음 | 확정 |
| P1 | 중첩·분기 간 드래그 재정렬이 실제 UI에서 작동하지 않음 | README/OpenWiki에 적힌 편집 기능이 비기능 상태 | 확정 |
| P2 | 이벤트 에디터 focused/E2E 테스트 계약이 현재 UI와 어긋남 | 회귀 게이트가 제품 동작을 인증하지 못함 | 확정 |

## P1-1. 상점 설정 연속 변경 시 앞선 값 유실

### 근거

- `src/editor/panels/eventEditor/commandBodyCommerce.ts:510-725`
  - 상점 종류, 구매 수량, 메시지 유형, 상인 소지금, 거래 분기 핸들러가 각각 렌더 시점의 오래된 `command`를 펼쳐 새 명령을 만든다.
- `src/editor/panels/eventEditor/commandEditDialog.ts:233-237`
  - 상점 폼은 아이템 목록 또는 분기 구조가 달라질 때만 재렌더된다.
- `src/editor/panels/eventEditor/commandEditDialog.ts:198-204`
  - 확인 시 모든 컨트롤에 합성 `change` 이벤트를 발생시킨다.

### 재현

1. 상점 명령 편집기를 연다.
2. 구매 수량을 `수량 선택 가능`으로 바꾼다.
3. 상인 소지금을 `777`로 바꾼다.
4. 확인한다.

임시 회귀 테스트 결과:

```text
Expected quantityMode: "select"
Received quantityMode: "single"
```

두 번째 핸들러가 원본 `command`에 자기 필드만 덮어쓰면서 첫 번째 변경을 되돌린다. 같은 구조인 상점 종류·메시지 유형·계절 재고도 상호 덮어쓰기 위험이 있다.

### 권고

- 상점 폼 전체가 하나의 최신 staged state/reducer를 사용하게 한다.
- 개별 핸들러가 렌더 시점 `command`가 아니라 최신 명령을 기준으로 갱신하게 한다.
- 확인 시 모든 컨트롤에 `change`를 강제하는 방식 대신 form-level commit 하나를 둔다.
- 상점 설정 4개를 연속 변경한 뒤 최종 명령 전체를 비교하는 회귀 테스트를 추가한다.

## P1-2. 취소한 명령 편집이 재오픈 후 Undo로 부활

### 근거

- `src/editor/panels/eventEditor/commandToolbarHistory.ts:28`
  - `histories`가 모듈 전역 `Map`이며 수명주기 정리 API가 없다.
- `src/editor/panels/eventEditor/commandToolbarHistory.ts:39`
  - `mapId:eventId:pageId` 키의 과거 상태를 계속 재사용한다.
- `src/editor/panels/eventEditor/modal.ts:104`
  - 취소 시 이벤트 초안은 원본으로 복원하지만 명령 히스토리는 비우지 않는다.

### 재현

1. 명령 본문을 A → B → C로 변경한다.
2. 이벤트 편집기를 취소해 A로 복원한다.
3. 같은 이벤트·페이지를 다시 연다.
4. 명령 도구바의 Undo를 누른다.

임시 회귀 테스트 결과:

```text
Expected body: "A"
Received body: "B"
```

`취소하면 열기 전 상태로 되돌립니다`라는 UI 계약을 Undo가 깨뜨린다.

### 권고

- 초안 세션마다 고유 토큰을 히스토리 키에 포함하거나 세션 시작 시 초기화한다.
- Apply/OK/Cancel, 이벤트 삭제, 프로젝트 교체 시 해당 히스토리를 명시적으로 폐기한다.
- 취소 → 재오픈 → Undo 회귀 테스트를 추가한다.

## P1-3. 중첩·분기 드래그 재정렬 비기능

### 원인 A: 히스토리 래퍼가 크로스 컨테이너 액션을 제거

- `src/editor/panels/eventEditor/content.ts:356`에는 `moveCommandAcross`가 정의돼 있다.
- `src/editor/panels/eventEditor/content.ts:115`에서 `commandHistory.wrapActions(...)`를 거친다.
- `src/editor/panels/eventEditor/commandToolbarHistory.ts:39`의 반환 객체는 `moveCommandAcross`를 전달하지 않는다.
- `src/editor/panels/eventEditor/commandListDragDrop.ts:125`는 함수가 없으면 크로스 드롭을 거절한다.

임시 회귀 테스트 결과:

```text
Expected wrapped.moveCommandAcross: function
Received: undefined
```

### 원인 B: 중첩 명령 행에 루트 컨테이너 경로를 전달

- `src/editor/panels/eventEditor/commandList.ts:172`에서 드롭 핸들러에 `containerPath`를 전달한다.
- `src/editor/panels/eventEditor/commandList.ts:310,340` 등의 재귀 호출은 자식 컨테이너 경로가 아니라 기존 루트 경로를 계속 전달한다.
- `src/editor/panels/eventEditor/commandListDragDrop.ts:137`의 컨테이너 검사에서 중첩 행 드롭이 무시된다.

fork `then` 안의 두 명령을 드래그해 바꾸는 임시 테스트에서 `moveCommandTo` 호출은 0회였다. 빈 분기는 별도 drop zone도 없다.

### 권고

- `wrapActions`가 `moveCommandAcross`를 보존하고 변경 전 히스토리를 기록하게 한다.
- 각 행의 실제 컨테이너 경로(`path.slice(0, -1)`)를 드롭 핸들러에 전달한다.
- 빈 선택지/fork/loop/shop/여관/전투 결과 분기에 명시적인 drop zone을 렌더한다.
- 루트↔분기, 분기↔분기, 동일 중첩 분기 재정렬을 각각 검증한다.

## P2-1. 테스트 계약이 현재 명령 편집 UI와 불일치

### 확인된 focused 테스트 실패

실행 대상:

```text
test/eventCommandReorder.test.ts
test/eventScriptModernViews.test.ts
test/commandEditModalPreview.test.ts
test/eventEditorModalClose.test.ts
test/shopCommandBodyUx.test.ts
```

결과:

```text
Test Files  1 failed | 4 passed
Tests       1 failed | 45 passed
```

실패 원인:

- `test/shopCommandBodyUx.test.ts:50`은 `shop-intent-card`를 기대한다.
- 실제 구현은 `src/editor/panels/eventEditor/commandBodyCommerce.ts:86`의 `shop-intent`이다.

### E2E 계약 불일치

다수 Playwright 스펙이 명령 더블클릭 후 행에 `.editing` 클래스가 붙는 과거 inline 편집 방식을 기대한다. 예:

- `test/e2e/oprn-event-commands.spec.ts:145`
- `test/e2e/oprn-shop-inn-commands.spec.ts:41`
- `test/e2e/task-10-event-stabilization.spec.ts:70`

현재 구현은 `src/editor/panels/eventEditor/commandEditDialog.ts:23-25`에서 별도 서브다이얼로그를 열며 제품 코드에는 `.editing`을 추가하는 경로가 없다.

### 권고

- E2E를 `.editing` 대신 `[data-testid="event-command-edit-dialog"]` 표시와 최종 저장 데이터 검증으로 전환한다.
- 상점 intent testid를 구현 또는 테스트 중 하나로 통일한다.
- 단순 helper/backend 테스트와 실제 DOM drag/drop 통합 테스트를 분리해 둘 다 유지한다.

## 추가 감사 결과 요약

| 우선순위 | 추가 발견 | 영향 | 상태 |
|---|---|---|---|
| P0 | Page 3 M2 리치 폼 4종이 런타임과 다른 필드명을 저장 | 플레이에서 설정값이 전부 무시되고 기본값으로 실행됨 | 확정 |
| P1 | 선택지 질문·옵션·취소 동작 연속 변경 시 앞선 값 유실 | 작성한 질문과 선택지 문구가 조용히 원래 값으로 복귀 | 확정 |
| P1 | fork 조건을 바꾼 뒤 else를 토글하면 조건이 원래 값으로 복귀 | 잘못된 분기로 플레이될 수 있음 | 확정 |
| P1 | all/any 복합 조건의 여러 자식을 연속 수정하면 첫 수정 유실 | 복합 조건 일부가 UI 입력과 다르게 저장됨 | 확정 |
| P1 | generic M2 폼에서 두 필드를 연속 변경하면 첫 필드 유실 | 카메라 등 generic 명령의 일부 설정이 원래 값으로 복귀 | 확정 |
| P2 | M2 focused 테스트가 11건 실패하고 Page 3 테스트는 동작을 검증하지 않음 | 현재 테스트로 UI→저장→런타임 계약을 인증할 수 없음 | 확정 |

## P0-1. Page 3 M2 리치 폼과 런타임 필드명 불일치

UI·카탈로그·런타임이 하나의 필드 스키마를 공유하지 않아, 네 명령은 에디터에서 정상적으로 보이지만 플레이에서는 기본값으로 실행된다.

### 1) Move to Variable Location

- UI: `src/editor/panels/eventEditor/commandBodyM2Page3.ts:201-275`
  - `{ mapId, x, y }`를 저장한다.
- 런타임: `src/player/interpreter/m2Runtime.ts:102-110`
  - `mapVariableId`, `xVariableId`, `yVariableId`를 읽는다.

재현 결과:

```text
Expected: { mapId: "7", x: 4, y: 5 }
Received: { mapId: "current", x: 0, y: 0 }
```

### 2) Get On/Off Vehicle

- UI: `commandBodyM2Page3.ts:277-305`는 `enabled`를 저장한다.
- 런타임: `m2Runtime.ts:112-114`는 `boarded`를 읽는다.

OFF를 설정해도 런타임 결과는 `vehicle_boarded: true`였다.

### 3) Set Vehicle Location

- UI: `commandBodyM2Page3.ts:307-349`는 탈것 종류를 `target`에 저장한다.
- 런타임: `m2Runtime.ts:116-125`는 `vehicle`을 읽는다.

`ship`을 선택해도 `vehicle_ship`은 생성되지 않고 기본값인 `vehicle_boat`가 갱신됐다.

### 4) Swap Event Location

- UI: `commandBodyM2Page3.ts:394-438`은 `target`과 `value`/`mapId`를 저장한다.
- 런타임: `m2Runtime.ts:130-134`는 `eventA`, `eventB`를 읽는다.

`event-a`와 `event-b`를 선택한 실행 결과는 `"<->"`였다.

### 권고

- 명령별 필드 키를 카탈로그에 한 번만 선언하고 UI와 런타임이 같은 타입/상수를 사용하게 한다.
- 기존 잘못된 키를 저장한 프로젝트를 위해 alias 읽기 또는 migration을 제공한다.
- 네 명령 각각에 `폼 조작 → Command JSON → executeM2RuntimeCommand 결과` 통합 테스트를 추가한다.
- 리치 폼이 generic 카탈로그 폼을 대체할 때 필드 키 parity를 필수 게이트로 둔다.

## P1-4. 선택지 질문·옵션·취소 연속 변경 시 값 유실

### 근거

- `src/editor/panels/eventEditor/commandBodyChoices.ts:35-40`
  - 질문 변경이 초기 `cmd`를 펼친다.
- `commandBodyChoices.ts:98-103`
  - 옵션 입력도 DOM의 옵션 텍스트만 새로 읽고 나머지는 초기 `cmd`를 사용한다.
- `commandBodyChoices.ts:191-198`
  - 취소 동작 변경이 다시 초기 `cmd`를 펼친다.

### 재현

1. 질문을 `Question`으로 입력한다.
2. 첫 선택지를 `A`에서 `A2`로 바꾼다.
3. 취소 동작을 `불가`로 바꾼다.

결과:

```text
Expected: prompt="Question", option[0]="A2", cancel="disallow"
Received: prompt=undefined, option[0]="A", cancel="disallow"
```

취소 동작 변경이 구조 재렌더를 유발하기 때문에 화면에서도 앞선 수정이 즉시 사라질 수 있다.

### 권고

- 질문, 전체 옵션 DOM 값, 취소 동작, 모든 branch 배열을 한 번에 읽는 `latestChoicesCommand()`를 둔다.
- add/remove/cancel 변경도 최신 staged 명령을 기준으로 수행한다.
- 질문 → 복수 옵션 → 취소 → 확인 순서의 회귀 테스트를 추가한다.

## P1-5. fork 조건 변경 후 else 토글 시 조건 회귀

### 근거

- `src/editor/panels/eventEditor/commandBodyCore.ts:695-697`
  - 조건 변경은 `{ ...cmd, condition }`으로 저장한다.
- `commandBodyCore.ts:706-716`
  - else 토글은 같은 초기 `cmd`의 조건과 분기를 다시 사용한다.
- 같은 조건 kind 안의 값 변경은 `shouldRerenderCommandForm`이 폼을 재생성하지 않는다.

### 재현

1. switch 조건 값을 ON에서 OFF로 바꾼다.
2. `그 외 분기`를 활성화한다.

결과:

```text
Expected condition.value: false
Received condition.value: true
```

### 권고

- fork 폼도 최신 조건과 branch를 보유하는 로컬 staged reducer를 사용한다.
- else on/off는 `condition`과 `then`을 초기 `cmd`에서 복원하지 않아야 한다.
- 조건 변경 → else on/off → 확인과 else 명령 보존을 함께 테스트한다.

## P1-6. all/any 복합 조건의 연속 수정 시 첫 자식 회귀

### 근거

- `src/editor/panels/eventEditor/conditionForm.ts:380-434`
  - `labeledGroup`이 최초 `children` 배열을 클로저로 캡처한다.
  - 한 자식을 수정할 때 다른 자식은 이 최초 배열에서 다시 가져온다.

### 재현

1. `all` 조건에 switch 조건 두 개를 둔다.
2. 첫 조건을 ON → OFF로 변경한다.
3. 두 번째 조건도 ON → OFF로 변경한다.

결과:

```text
Expected: [false, false]
Received: [true, false]
```

같은 문제가 `any`에도 적용된다. add/remove도 최초 배열을 기준으로 하므로 연속 조작 시 유사한 회귀 위험이 있다.

### 권고

- 각 child callback이 최신 조건 배열을 읽도록 하거나 변경 시 그룹 폼을 재렌더한다.
- 2개 이상의 자식 수정, 수정 후 추가, 수정 후 제거를 각각 검증한다.

## P1-7. generic M2 폼의 다중 필드 변경 유실

### 근거

- `src/editor/panels/eventEditor/commandBodyM2.ts:428-436`
  - `updateField`가 매번 최초 `cmd.fields`를 펼치고 한 필드만 바꾼다.
- `shouldRerenderCommandForm`에는 generic `m2Command` 필드 변경에 대한 재렌더 조건이 없다.

### 재현

Camera Control의 `x=10, y=12`에서:

1. X를 99로 변경한다.
2. Y를 88로 변경한다.

결과:

```text
Expected: { x: 99, y: 88 }
Received: { x: 10, y: 88 }
```

text/number/boolean/select/options/resource/record picker가 모두 같은 초기 명령을 전달받으므로 generic M2 다중 필드 폼 전반에 적용된다.

### 권고

- `CommandEditContext`에 `getCurrentCommand()` 또는 field patch API를 제공한다.
- `updateField`가 최신 `stagedCommand.fields`에 patch하도록 변경한다.
- 모든 다중 필드 generic 명령에 공통 property-based 회귀 테스트를 둔다.

## P2-2. 추가 focused 테스트의 계약 드리프트와 커버리지 공백

실행 대상:

```text
test/forkCommandBody.test.ts
test/choicesCommandBody.test.ts
test/eventEditorM2CommandBody.test.ts
test/page3CommandBodies.test.ts
test/m2EventCommandCatalog.test.ts
```

결과:

```text
Test Files  2 failed | 3 passed
Tests       11 failed | 26 passed
```

세부:

- `eventEditorM2CommandBody.test.ts`: 9개 중 6개 실패
  - 현재 리치 폼/공유 picker testid와 과거 generic picker 기대가 불일치한다.
- `m2EventCommandCatalog.test.ts`: 12개 중 5개 실패
  - runtime support 등급과 battle 명령 목록 기대가 현재 구현과 불일치한다.
- `forkCommandBody.test.ts`, `choicesCommandBody.test.ts`, `page3CommandBodies.test.ts`는 통과하지만 한 필드씩만 검사하거나 `rich preferred, generic accepted`처럼 렌더 존재만 확인한다.
- Page 3 문제 명령 4종의 UI 필드와 런타임 효과를 함께 검색한 결과 관련 테스트는 없었다.

### 권고

- 한 컨트롤 단위 테스트에서 벗어나 같은 폼의 여러 컨트롤을 순차 변경하는 테스트를 기본 계약으로 추가한다.
- Page 3 테스트의 generic fallback 허용을 제거하고 명령별 canonical rich form을 요구한다.
- UI testid뿐 아니라 최종 Command JSON과 런타임 결과를 함께 검증한다.
- 기준선 실패를 의도된 변경으로 업데이트할지 회귀로 고칠지 먼저 결정하고 게이트를 다시 녹색으로 만든다.

## 공통 원인

신규 P1 문제들의 공통 원인은 폼 컴포넌트가 렌더 시점의 `cmd`를 클로저로 캡처한 뒤, 후속 이벤트마다 `{ ...cmd, field: next }`를 만드는 구조다. `commandEditDialog`의 실제 `stagedCommand`는 갱신되지만 기존 DOM 이벤트 핸들러는 최신 값을 알 수 없다.

권장 공통 해법:

1. `CommandEditContext`에 최신 staged 명령 조회/patch API를 추가한다.
2. 개별 폼은 가능한 한 모든 현재 컨트롤 값을 읽어 하나의 명령을 생성한다.
3. 구조 변경 시 무조건 최신 staged 명령으로 재렌더한다.
4. `commitPendingControls`의 전체 합성 `change` 방식은 제거하거나 부작용 없는 단일 submit으로 교체한다.
5. `Command`를 immutable patch할 때 초기 props가 아니라 최신 state를 기준으로 한다.

## 남은 감사 범위

- 이동 경로의 parameter draft Map 수명주기와 좌표 validation
- 액터/장비/스킬/상태 폼의 연속 조작 및 undo 단위
- 골드·아이템·시간·좌표 입력의 음수/빈 값/범위 초과 처리
- battleProcessing/승급/진화 결과 분기의 재오픈 후 보존
- 실제 브라우저에서 focus, keyboard, screen-reader, viewport overflow 검증

## 검증 메모

- 기존 결함 재현 임시 테스트: 2 fail, 1 fail, 1 fail로 각각 확인했다.
- 추가 명령 임시 테스트: fork/composite/generic M2/Page 3가 4/4 fail로 재현됐다.
- 선택지 임시 테스트: 1/1 fail로 재현됐다.
- 임시 Vitest 파일은 각 실행 후 삭제했다.
- 제품 코드는 수정하지 않았고 문서 `problem.md`만 변경했다.
- 이 감사는 콘텐츠 저작이 아니므로 Supabase 저장 대상이 아니다.
