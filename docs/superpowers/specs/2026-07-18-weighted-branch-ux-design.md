# 가중 분기(Weighted Branch) 입력 UX 개선 설계

날짜: 2026-07-18  
상태: implemented (2026-07-18)
범위: 에디터 UX (런타임/스키마 유지)

## 문제

현재 가중 분기 편집 UI는 일반 M2 필드 렌더러에 의존한다.

- `가중치 표` = freeform textarea (`success=1\nfailure=1`)
- `결과 변수` = free text
- 도움말 = 공통 문구 `"필요한 값을 선택하고 확인을 누르세요."`
- 리스트 요약 = `table: success=1 failure=1` 원문 나열

사용자 관점 장벽:

1. `label=weight` 문법을 알아야 한다.
2. 라벨 문자열이 런타임 키가 아니라 **줄 순서 인덱스**라는 사실이 숨겨져 있다.
3. 각 결과가 몇 %인지 계산해야 한다.
4. 이 명령 단독으로 분기가 생기지 않고, 다음에 **조건 분기**로 변수 인덱스를 비교해야 한다는 흐름이 안내되지 않는다.
5. 결과 변수가 DB 변수 피커가 아니라 문자열 입력이라 오타/미연결이 쉽다.

## 목표

- 문법을 몰라도 결과 행을 추가/수정/삭제할 수 있다.
- 각 행의 **확률(%)** 과 **결과 번호(#index)** 가 즉시 보인다.
- 결과 변수를 프로젝트 변수 목록에서 고른다.
- 폼 안에서 “다음에 조건 분기로 이어가는 법”이 보인다.
- 리스트 요약이 사람 읽기 좋은 형태가 된다.

## 비목표

- 이벤트 목록에 자동 가지(then/else 골격) 삽입
- `fields` 키 변경, 프로젝트 스키마 마이그레이션
- `selectWeightedIndex` / `misc` RNG 동작 변경
- 라벨 문자열을 런타임 분기 키로 승격

## 결정 요약

| 항목 | 결정 |
|---|---|
| 접근 | A. 리치 폼 + 다음 분기 안내 |
| 데이터 계약 | 기존 `table` 문자열 + `resultVariableId` 유지 |
| 런타임 | 변경 없음 (양수 가중치, 0-based index, misc stream) |
| 폼 패턴 | Actor M2 리치 바디와 동일: 전용 renderer가 있으면 일반 필드 루프 스킵 |

## 사용자 흐름

1. 명령 피커에서 **가중 분기** 선택 또는 기존 행 더블클릭.
2. 결과 변수 피커에서 변수 선택 (권장, 비워둘 수는 있음).
3. 결과 행 편집:
   - 이름(라벨, 사람용)
   - 가중치(양수)
   - 실시간 % / #index 확인
4. 확률 바와 “다음에 할 일” 카드로 연결 방법 확인.
5. 확인 → `table` 직렬화 + `resultVariableId` 저장.
6. 이벤트 목록에서 조건 분기 추가 → 변수 == 0/1/… 비교.

## UI 명세

### 레이아웃 (위→아래)

1. **설명 한 줄**  
   `가중치 비율로 하나를 고르고, 결과 번호를 변수에 저장합니다.`

2. **결과 변수**  
   - 컨트롤: 기존 `databasePicker("variable", …)`  
   - 빈 값 허용  
   - 빈 값일 때 경고 힌트:  
     `비어 있으면 결과를 나중에 분기할 수 없습니다.`

3. **결과 목록**
   - 행 구조:  
     `[#n] [이름 text] [가중치 number ≥ 0] [pct] [삭제]`
   - 하단: `+ 결과 추가`
   - 최소 1행 유지 (마지막 1행 삭제 차단)
   - 기본 2행: `성공=1`, `실패=1` (현 기본값과 동등)
   - 새 행 기본: 이름 `결과{k}`, 가중치 `1`
   - 인덱스 배지 `#n` 은 **현재 유효 행 순서** 기준 0-based  
     (저장 직렬화에 포함되는 행 순서와 동일해야 함)

4. **확률 바 + 범례**
   - 분모: 양수 가중치 합
   - 합이 0이면 바 비활성 + `유효한 가중치가 없습니다`
   - 범례 예: `성공 50% · #0`

5. **다음에 할 일 카드**
   - 변수 선택됨:  
     ```
     이 명령 다음에 「조건 분기」를 넣고
     변수 [이름] == 0 → 첫 결과
     변수 [이름] == 1 → 둘째 결과
     …
     ```
   - 상위 3개 인덱스까지 예시, 4개 이상이면 `…`  
   - 변수 미선택:  
     `결과 변수를 고른 뒤, 조건 분기에서 그 변수를 비교하세요.`

### 리스트 요약

현재:

```text
가중 분기 : table: success=1 failure=1
```

목표:

```text
가중 분기  성공 50% · 실패 50% → 변수 loot_roll
```

규칙:

- 라벨 우선, 없으면 `결과{n}`
- 확률은 반올림 정수 % (합 보정: 마지막 항목이 잔여)
- 항목 3개 초과 시 `외 n`
- 변수 없으면 `→ 변수 (미선택)`

### 프리뷰 패널

기존 우측 요약 패널이 있으면 같은 요약 문자열 + 짧은 안내 한 줄을 재사용.  
전용 대형 프리뷰 렌더러는 이번 범위 밖 (있으면 보너스, 필수는 아님).

## 데이터 계약 (변경 없음)

```ts
fields: {
  table: string;              // "label=weight\n..." 
  resultVariableId: string;   // variable id or ""
}
```

런타임 (`m2ModernRuntime.ts`) 유지:

- 줄 분리 → `=` 오른쪽 숫자 → finite && > 0 만 사용
- `nextSessionRandom(session, "misc") * total` 로 인덱스 선택
- `session.variables[resultVariableId] = selectedIndex` (id 있을 때)

### 파싱 / 직렬화

```ts
type WeightedBranchRow = {
  label: string;
  weight: number; // editor number; may be 0 while editing
};

parseWeightedBranchTable(table: string): WeightedBranchRow[]
serializeWeightedBranchTable(rows: readonly WeightedBranchRow[]): string
```

규칙:

- parse: 빈 줄 스킵. `=` 없으면 label=전체 trim, weight=0 으로 두지 말고 **유효하지 않은 줄은 drop** + (옵션) 로드 힌트.
  - 권장 단순안: `name=weight` 형태만 채택. weight 파싱 실패/≤0 인 줄은 drop.
  - 전부 drop 되면 기본 2행으로 폴백하지 말고 **빈 목록 UI 금지** → 최소 1행 `결과1=1` 시드.
- serialize: 각 행 `label=weight`, weight는 숫자 그대로(정수는 정수 표기). 라벨 trim, 빈 라벨은 `결과{n}`.
- 에디터에서 weight 0 입력 허용(편집 중). 저장 시 0 이하 행은 직렬화에서 제외하거나 저장 전 경고 후 제외.
  - 권장: **저장 직렬화 시 weight>0 행만 기록**. 모두 제외되면 `결과1=1` 한 줄 폴백.

라벨은 런타임 무시. 순서만 의미 있다. UI 카피는 이 사실을 숨기지 않는다 (`#n` 배지).

## 구현 스케치

### 파일

| 파일 | 역할 |
|---|---|
| `src/editor/panels/eventEditor/commandBodyWeightedBranch.ts` (신규) | 리치 폼 |
| `src/editor/panels/eventEditor/weightedBranchTable.ts` (신규, 소형) | parse/serialize/prob helpers |
| `src/editor/panels/eventEditor/commandBodyM2.ts` | `renderM2CommandBody` 초반에 Weighted Branch 전용 바디 위임 |
| `src/editor/panels/eventEditor/commandSummary.ts` | 요약 문자열 개선 |
| `src/styles/**` (기존 event editor css) | 행 리스트/확률 바/안내 카드 최소 스타일 |
| `test/...` | parse roundtrip, % 계산, summary |

기존 catalog 필드 스펙(`m2ModernCatalog.ts`)는 **데이터 기본값 소스**로 유지해도 된다.  
리치 폼이 뜨면 generic textarea는 렌더하지 않는다.

### 상태 갱신

- Actor/Choices 패턴과 같이 `context.actions.replaceCommand` 로 `fields` 갱신.
- 행 추가/삭제/가중치 input 시 확률 바·안내 카드·요약 프리뷰가 같이 갱신.
- `shouldRerenderCommandForm` 이 막으면 로컬 DOM 갱신 또는 staged replace 후 재렌더 — 기존 모달 staged 편집 규약 준수.

### 접근성 / i18n

- 행 삭제/추가 버튼에 명확한 `aria-label` / testid
- 한국어 카피 우선 (에디터 기본 언어)

## 테스트 계획

1. **단위**
   - parse ↔ serialize roundtrip (`성공=1\n실패=2`)
   - 무효 줄 drop
   - 확률 % 합 100 보정
   - summary: 2행/4행/변수 없음
2. **컴포넌트/통합 (기존 테스트 스타일)**
   - Weighted Branch 명령 body가 textarea 대신 행 에디터 testid를 노출
   - 변수 피커 변경이 `resultVariableId`에 반영
3. **수동 브라우저**
   - 기본 성공/실패 편집 → 확인 → 리스트 요약 확인
   - 3행 추가 후 % 바
   - 기존 프로젝트의 구 `table` 문자열 로드

## 검증 게이트

- 타입/단위 테스트 통과
- 브라우저: 폼 스크린샷 증거 (`output/evidence/weighted-branch-ux-*.png`)
- 런타임 회귀: 기존 interpreter 테스트의 Weighted Branch 기대 유지

## 롤아웃

1. helper + summary 먼저 (동작 가시성)
2. 리치 폼 연결
3. 스타일 폴리시
4. 증거 캡처

## 열린 결정 (구현 시 기본값으로 고정)

- 확률 표시: **정수 %**, 마지막 항목 잔여 보정
- 0 가중치 행: 편집 중 허용, 직렬화 시 제외
- 자동 가지 삽입: **하지 않음** (후속 과제 가능)

## 성공 기준

- 신규 사용자가 `label=weight` 문법을 보지 않고도 50:50 분기를 설정할 수 있다.
- 폼만 보고 “변수에 0/1이 들어가고 조건 분기로 이어간다”를 설명할 수 있다.
- 기존 저장된 `table` 문자열이 깨지지 않고 로드·재저장된다.
