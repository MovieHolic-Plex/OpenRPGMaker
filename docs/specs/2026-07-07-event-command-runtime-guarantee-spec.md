# 2026-07-07 이벤트 명령 런타임 보증 스펙 (Event Command Runtime Guarantee)

> 사용자 지시 (2026-07-07): "이 에디터에서 가장 중요한 것은 결국 이벤트 에디터의 작동이다.
> 이벤트 에디터에서 작성한 명령들이 제대로 작동하는 것을 보증하는 spec이 필요하다."
>
> 이 문서는 구현 지시서를 겸한다. 구현자는 codex(gpt 5.5, xhigh)이므로 **모든 파일 경로·함수
> 시그니처·판정 기준을 명시**한다. 구현자는 이 문서에 없는 설계 결정을 스스로 내리지 말고,
> 문서의 '이탈 프로토콜'을 따르라.

## 0. 한 줄 요약

에디터에서 작성 가능한 **모든** 이벤트 명령은 (1) 런타임 핸들러가 있고 (2) RM2003 의미론대로
동작하며 (3) 저장→로드 왕복 후에도 같은 결과를 내고 (4) 참조가 깨져도 크래시 없이 정의된
폴백으로 진행됨을 **기계 검증 가능한 테스트**로 보증한다. 보증할 수 없는 명령은 사용자에게
**명시적으로**(배지+린트) 그렇다고 말해야 한다 — 조용한 no-op은 금지.

## 1. 현황 실측 (2026-07-07, HEAD 기준)

### 1.1 명령은 두 네임스페이스다
| 네임스페이스 | 정의 위치 | 규모 | 런타임 진입점 |
|---|---|---|---|
| **네이티브 kind** | `src/project/commandKindRegistry.ts` (`COMMAND_KINDS`) | 42 kind + Condition 7종 | `src/player/interpreter/commandCatalog.ts` |
| **m2Command** | `src/editor/eventCommands/m2CatalogData.ts` (~125 entry) | entry별 `commandId` (예: `m2-021-damage-processing`) | `commandCatalog.ts`의 `executeM2Command` → `m2Runtime.ts` |

### 1.2 이미 있는 보증 (유지·확장 대상, 재발명 금지)
- `test/commandKindCoverage.test.ts`: registry ↔ 타입 유니온 ↔ `io/guards.ts` ↔ shape 검증 ↔
  인터프리터 처리의 **존재 수준** 완전성. 새 kind 누락 시 컴파일 에러/테스트 실패.
- `src/editor/eventCommands/runtimeSupport.ts`: m2 명령을 `runtime-full`(10개 명시) /
  `editor-only`(7개 명시) / `runtime-partial`(**나머지 전부 — 기본값**)로 분류, 에디터에 △ 배지.
- 동작 테스트 일부: `test/interpreter.test.ts`, `test/interpreterPartyVitals.test.ts`,
  `test/callMapEvent.test.ts`, `test/battleRuntime*.test.ts`.

### 1.3 격차 (이 스펙이 메우는 것)
- **[갭A] m2 기본값이 '부분 실행'**: ~108개 entry가 명시 분류 없이 partial로 굴러간다.
  `m2CommandById` 미분류 ID는 런타임에서 `console.warn` 후 **조용히 no-op**
  (`commandCatalog.ts`의 `executeM2Command`). 에디터에서 작성한 명령이 실행되지 않는 최대 표면.
- **[갭B] 시맨틱 계약 부재**: 42 kind의 "올바른 동작"이 어디에도 명세돼 있지 않다. 핸들러가
  있다는 것만 보증되고, 무엇을 해야 옳은지는 테스트 작성자 재량이었다.
- **[갭C] kind별 동작 테스트 구멍**: 최소 4개 kind(`breakLoop`, `learnSkill`, `enterHeroName`,
  `setSelfSwitch`)는 핵심 인터프리터 테스트 파일에 등장 자체가 없다(존재-grep 기준. EC1에서
  전 kind 실측으로 정밀화한다).
- **[갭D] 에디터→저장→런타임 왕복 무보증**: 명령 편집 모달이 만드는 객체가 serialize→
  deserialize 후 같은 실행 결과를 낸다는 테스트가 없다.
- **[갭E] 시나리오 수준 무보증**: 명령 단건은 맞아도 조합(분기 안 루프, 공통 이벤트 재귀,
  셀프스위치 페이지 전환)이 맞는다는 보증이 없다.

## 2. 보증 모델 — 5계층

| 계층 | 이름 | 내용 | 상태 |
|---|---|---|---|
| G0 | 존재 완전성 | 모든 kind에 핸들러·shape·왕복 | **있음** (`commandKindCoverage`) — 유지 |
| G1 | 명령 계약 | kind별 사전/사후조건·폴백·pause 의미론 명세 + 계약 테스트 | 신설 (§4, §5) |
| G2 | 왕복 보증 | 에디터 산출물 == 저장/로드 후 == 같은 실행 결과 | 신설 (§6) |
| G3 | 시나리오 골든 | 대표 스크립트 12종 결정론 재생 + 상태 스냅샷 | 신설 (§7) |
| G4 | e2e 스모크 | 에디터 작성→플레이 실행 3종 (Playwright) | 신설 (§8) |
| — | m2 트리아지 | partial 기본값 폐지, 전 entry 명시 분류 | 신설 (§9) |

## 3. 이탈 프로토콜 (구현자 필독)

§5 계약 표는 **초안**이다. 구현 중 표와 실제 코드가 다르면:
1. RM2003 원작 의미론과 비교해 **코드가 틀렸으면 코드를 고친다** (수정은 최소 diff).
2. 코드가 합리적이고 표가 틀렸으면 **표를 갱신**하고 보고서에 "계약 표 정정: <kind> — <사유>"를 남긴다.
3. 어느 쪽인지 판단이 안 서면 **코드를 바꾸지 말고** 표에 `⚠ 판정 보류` 마커를 남기고 보고서에 기록한다.
4. 어떤 경우에도 기존 테스트를 약화(단언 삭제/느슨화)해서 통과시키는 것은 금지.

## 4. G1 계약 테스트 하네스

### 4.1 파일
- `test/commandContracts/harness.ts` (신규)
- `test/commandContracts/<kind>.contract.test.ts` — kind당 1파일, 42개 (EC1~EC3에서 분담)

### 4.2 하네스 시그니처 (이대로 구현)
```ts
// test/commandContracts/harness.ts
import type { Command, Project } from "@/project/types";

export interface ContractRunOptions {
  /** 기본: createBlankProject() 기반 + 맵 1개 + 이벤트 1개. 필요 시 콜백으로 가공. */
  mutateProject?: (project: Project) => void;
  /** 세션 초기값 (골드/아이템/스위치/변수/파티). 기본: 빈 세션. */
  mutateSession?: (session: PlaySessionLike) => void;
  /** pause(step) 발생 시 자동 응답 스크립트. 예: text→dismiss, choices→인덱스 선택. */
  answers?: readonly ContractAnswer[];
  /** 최대 스텝 수 안전핀. 기본 500 — 초과 시 테스트 실패(무한루프 검출). */
  maxSteps?: number;
}

export interface ContractRunResult {
  readonly session: PlaySessionLike;      // 최종 세션 상태 (단언 대상)
  readonly pauses: readonly StepResult[]; // 발생한 pause 스텝 전부 (text/choices/wait...)
  readonly warnings: readonly string[];   // console.warn 캡처 ([interpreter] 폴백 검증용)
  readonly finished: boolean;             // 명령 리스트 끝까지 도달했는가
}

export function runCommandContract(
  commands: readonly Command[],
  options?: ContractRunOptions
): ContractRunResult;
```
- 구현은 `test/interpreter.test.ts`의 기존 부트 패턴을 추출·재사용한다(중복 구현 금지 —
  기존 파일에서 세션/인터프리터 생성 코드를 찾아 하네스로 옮기고 기존 테스트는 그대로 둔다).
- `console.warn` 캡처는 `vi.spyOn(console, "warn")`으로 하고 하네스 안에서 복원한다.
- 하네스 자체의 테스트(`test/commandContracts/harness.test.ts`)를 4개 이상 작성:
  maxSteps 초과 실패, answers 소진, warn 캡처, finished 판정.

### 4.3 kind별 계약 테스트 필수 케이스 (각 파일 공통 뼈대)
각 `<kind>.contract.test.ts`는 **최소 4케이스**:
1. **정상 효과**: §5 표의 사후조건 단언.
2. **결측 참조 폴백**: 존재하지 않는 id(맵/이벤트/액터/아이템/스위치 등) 지정 시 —
   크래시 없이 §5 표의 폴백 열대로 진행 + `warnings`에 `[interpreter]` 로그 존재 단언.
   (참조가 없는 kind — `wait`, `recoverAll` 등 — 는 이 케이스 대신 경계값 케이스: 0/음수/거대값.)
3. **왕복 동일성**: 같은 명령을 `serialize→deserialize` 통과시킨 뒤 재실행 → 최종 세션 상태가
   원본 실행과 `toEqual` (오디오 재생 같은 부수효과 제외 — 표의 '왕복 제외' 열 참고).
4. **pause 의미론**: blocking kind는 pause가 정확히 1회, 종류가 맞는지. non-blocking은 pause 0회.

## 5. 42 kind 계약 표 (초안 — EC1에서 실측 대조)

표기: [B] = blocking(pause 발생), [N] = non-blocking. '폴백'은 결측 참조 시 기대 동작.

### 5.1 메시지·입력 (EC2 담당)
| kind | B/N | 사후조건(핵심) | 폴백/경계 |
|---|---|---|---|
| text | B(text) | pause 1회, body 전달, messageWindowSettings 반영 | 빈 body도 pause는 발생 |
| changeFace | N | 이후 text pause의 face 상태 변경 | 없는 resourceId → warn + 얼굴 없음으로 진행 |
| choices | B(choices) | 선택 인덱스의 branch만 실행 | 빈 options → warn + 스킵 |
| inputWait | B | 입력까지 pause | — |
| inputNumber | B | 입력값이 variableId에 저장, digits 자릿수 상한 | 없는 변수 → 생성 or warn(실측 후 확정) |
| enterHeroName | B | actorId의 이름 변경, maxLength 준수 | 없는 actor → warn + 스킵 |
| displayTextSettings | N | messageWindowSettings 갱신, 이후 text에 적용 | — |

### 5.2 제어 흐름 (EC2 담당)
| kind | B/N | 사후조건 | 폴백/경계 |
|---|---|---|---|
| fork | N | 조건 참→then, 거짓→else 만 실행 (7종 Condition 전부 케이스) | 없는 switch/var 참조 → 거짓 취급(실측 확정) |
| label / gotoLabel | N | goto가 같은 프레임 내 label로 점프 | 없는 label → warn + 다음 명령 진행 |
| loop / breakLoop | N | body 반복, breakLoop이 최근접 루프 탈출 | 루프 밖 breakLoop → warn + no-op; **maxSteps로 무한루프 없음 검증** |
| wait | B(wait) | ms만큼 pause 스텝 | 0/음수 → pause 없이 진행(실측 확정) |
| timer | B아님 | set/start/stop 상태 전이, timer Condition과 연동 | — |
| callCommonEvent | N | 프레임 push, 재귀 한도 시 warn+진행 | 없는 id → warn + 진행 |
| callMapEvent | N | 활성 페이지 commands push, 페이지 없으면 top-level 폴백 | 없는 이벤트 → warn + 진행 |
| setFlag / setSwitch / setSelfSwitch / setVariable | N | 해당 상태 변경 (setVariable은 = += -= *= /= 전 연산자) | /0 등 경계 실측 확정 |

### 5.3 액터·파티·인벤토리 (EC3 담당)
| kind | B/N | 사후조건 | 폴백 |
|---|---|---|---|
| changeGold/changeItem/changeParty | N | 세션 골드/인벤토리/파티 증감, 하한 0 | 없는 itemId/actorId → warn + 스킵 |
| learnSkill | N | 액터 스킬 목록에 추가(중복 없음) | 없는 actor/skill → warn + 스킵 |
| changeExp/changeLevel | N | 경험치/레벨 전이 + 레벨업 파생(스킬 습득 등 실측) | 상한/하한 클램프 |
| changeEquipment | N | slot 장비 교체, 이전 장비 인벤토리 반환(실측 확정) | 없는 장비 → warn |
| changeActorHp/Mp | N | 증감+클램프(HP 0 → 전멸 처리 여부 실측 확정) | 없는 actor → warn |
| recoverAll | N | 전 파티 HP/MP 최대, 상태이상 해제 | 빈 파티 → no-op |

### 5.4 화면·오디오·시스템 (EC3 담당)
| kind | B/N | 사후조건 | 왕복 제외 |
|---|---|---|---|
| showPicture/erasePicture | N | 픽처 상태 테이블 반영 | — |
| playAudio/stopAudio | N | 오디오 상태 기록(실제 재생은 DOM 계층) | 재생 부수효과 |
| shop | B(shop) | 구매/판매가 골드·인벤토리에 반영 | 없는 상품 id → 목록에서 제외+warn |
| inn | B(inn) | 숙박 시 골드 차감+전체 회복 | 골드 부족 → 거절 경로 |
| battleProcessing | B(battle) | 승/패/도주 분기, canEscape/canLose 준수 | 없는 troop → warn + 스킵 |
| transfer | B(transfer) | currentMapId/좌표 변경 | 없는 맵 → warn + 스킵(크래시 금지) |
| moveEvent | N/B | route 적용(repeat 여부), 대상 이벤트 위치 변화 | 없는 이벤트 → warn |
| changeTile | N | 해당 레이어 타일 변경 | 범위 밖 좌표 → warn + 스킵 |
| gameOver/ending/returnToTitle | B(종료) | 세션 종료 스텝 발생, 이후 명령 미실행 | — |

## 6. G2 에디터 왕복 보증

- 파일: `test/commandContracts/editorRoundtrip.test.ts`
- 명령 편집 모달의 폼 기본값 생성 경로(`src/editor/panels/eventEditor/` 아래 —
  commandEditModal 계열에서 kind별 기본 Command를 만드는 함수를 찾아라. 없으면
  `test/commandKindCoverage.test.ts`의 `MINIMAL_COMMANDS`를 import)로 42 kind 각각:
  1. shape 검증 통과 (`validateCommandArray`)
  2. serialize→deserialize 왕복 동일 (`toEqual`)
  3. `runCommandContract([cmd])`가 크래시 없이 `finished:true` (blocking은 answers로 자동 진행)
- m2Command도 동일하게: 카탈로그 전 entry에 대해 편집 모달이 만드는 기본 fields로 실행 무크래시.

## 7. G3 시나리오 골든 12종

- 파일: `test/commandContracts/scenarios.test.ts` (+ `test/commandContracts/goldens/*.json`)
- 각 시나리오는 `runCommandContract`로 재생하고 최종 상태 요약
  `{ switches, variables, gold, party(hp/mp/level/skills), inventory, currentMapId, pausesKinds[] }`
  를 골든 JSON과 대조한다. 골든 갱신은 의도된 변경 시에만 — diff를 보고서에 첨부.
- 12종 (전부 §5 표의 kind 조합):
  1. 대화+선택지 2분기 → 각 분기 변수 기록
  2. 스위치 게이트: setSwitch → fork(switch) → 문 열림 텍스트
  3. 변수 카운터 루프: loop+setVariable+fork(variable)+breakLoop — 정확히 N회
  4. 상점 구매: changeGold → shop(구매 answers) → 골드/인벤토리 검증
  5. 인 숙박: HP 감소 상태에서 inn(수락) → 골드 차감+전체 회복
  6. 전투 승패: battleProcessing 승리/패배 answers 각각 → 분기 검증
  7. 텔레포트 왕복: transfer A→B→A, 좌표·맵 검증
  8. 타이머: timer set/start → fork(timer) 조건 분기
  9. 공통 이벤트 체인: callCommonEvent 2단 중첩 + 재귀 한도 폴백
  10. 셀프스위치 페이지 전환: setSelfSwitch → callMapEvent가 다른 페이지 실행
  11. 아이템 조건 분기: changeItem → fork(item) → learnSkill
  12. 종료 3종: gameOver/ending/returnToTitle 이후 명령 미실행 확인

## 8. G4 e2e 스모크 3종 (감독자 실행 — codex는 스크립트만 작성)

- 파일: `test/e2e/event-command-runtime.spec.ts`
- 현행 e2e 관례(`test/e2e/oprn-map-editor.spec.ts`의 `/?freshProject=1` 부트,
  `rpg-maker-*` testid)를 따른다. 시나리오: ① 이벤트에 text+choices 작성→플레이→선택→분기 확인
  ② setSwitch+fork 문 열림 ③ transfer 이동. **codex는 포트 리슨 불가이므로 작성만 하고
  실행·판정은 감독자(Claude)가 한다** — 보고서에 "미실행, 감독자 검증 대기"로 명시.

## 9. m2 트리아지 — partial 기본값 폐지

### 9.1 목표 상태
`runtimeSupport.ts`에서 **모든** m2 entry가 세 집합 중 하나에 **명시적으로** 속한다:
- `M2_RUNTIME_FULL_IDS` — 완전 구현 + G1 계약 테스트 존재
- `M2_RUNTIME_PARTIAL_IDS` (신설) — 부분 구현. **entry마다 주석으로 "무엇이 되고 무엇이 안 되는지" 1줄 명시**
- `M2_EDITOR_ONLY_IDS` — 실행 안 됨. 에디터 배지 + **저장 시 lint warning** ("이 명령은 실행되지 않습니다")
- 세 집합 어디에도 없는 entry가 있으면 **테스트 실패**:
  `test/m2RuntimeSupportCompleteness.test.ts` (신설) — 카탈로그 전 entry가 정확히 한 집합에 속함을 단언.

### 9.2 승격 우선순위 (partial→full 구현 순서)
1-tier(EC4에서 구현): 메시지/이동/화면 제어 계열 중 RM2003 마을 이벤트 빈출 명령
(카탈로그에서 category 기준 선별, 보고서에 선정 목록 명시). 2-tier 이후는 후속 웨이브 —
이 스펙의 범위는 **분류 완전성 + 1-tier 승격 + editor-only lint**까지다.

## 10. 구현 웨이브 (codex 1회 위임 = 1웨이브)

공통 제약: git commit 금지 / 포트 리슨·e2e 실행 금지 / 기존 테스트 약화 금지 /
검증은 `npx tsc --noEmit` → `npm test` 순차, 수치 원문을 보고서에 기록.

| 웨이브 | 범위 | 완료 기준 |
|---|---|---|
| **EC1** | 하네스(§4) + 하네스 테스트 + 갭C 4개 kind 계약 테스트 + 계약파일↔kind 대조 테스트(`test/commandContracts/coverage.test.ts` — `COMMAND_KINDS` 전부에 `<kind>.contract.test.ts` 파일 존재 단언, 미작성 kind는 명시적 TODO 화이트리스트로 시작해 EC2·EC3가 비워간다) + §5 표 실측 대조 보고 | 신규 테스트 ≥20, 화이트리스트=38 |
| **EC2** | §5.1 + §5.2 계약 테스트 19 kind | kind당 ≥4케이스, 화이트리스트 38→19 |
| **EC3** | §5.3 + §5.4 계약 테스트 19 kind | 화이트리스트 19→0 |
| **EC4** | G2 왕복(§6) + G3 시나리오 12종(§7) + m2 분류 완전성(§9.1)+1-tier 승격+editor-only lint | 골든 12개 커밋, m2 완전성 테스트 그린 |
| **EC5** | G4 e2e 스크립트 3종(§8) 작성 | 감독자 실행으로 판정 |

각 웨이브 착수 시 이 문서 전체를 codex에게 전달하고, 해당 웨이브 행만 "이번 범위"로 지정한다.

## 10.1 EC1 실측 정정 (2026-07-07 — EC2 이후 웨이브는 이 절이 §5 표에 우선한다)

EC1이 인터프리터 전 계층을 정독·실측한 결과 (상세: 감독 스크래치 `report-ec1.md`, 머지 커밋 참조):

1. **kind 수 정정**: `COMMAND_KINDS`는 **44개**(m2Command 포함). 화이트리스트는 40에서 시작
   (§10 표의 42/38은 산수 오류였다).
2. **B/N 정의 재정립**: §5 표의 B/N은 "인터프리터 스텝에서 pause 발생 여부"로 읽어라.
   실측상 timer(set/start/stop 전부), showPicture/erasePicture/playAudio/stopAudio,
   shop/inn/battleProcessing/transfer/changeTile/moveEvent는 **모두 pause 핸드오프 1회 발생**
   (효과 적용은 플레이어 계층). 계약 테스트의 pause 단언은 이 실측을 기준으로 한다.
3. **결측 참조 경고의 실제 설계**: `[interpreter]` warn은 callCommonEvent/callMapEvent/
   gotoLabel/m2 계열에만 존재. 나머지 kind는 참조 검증이 **저장 시점**(`deserialize`)에 몰려
   있어 런타임은 무경고 진행이 설계다. §5 표의 "warn + 스킵" 폴백 기대는 **표 정정**으로
   처리한다(런타임에 warn을 추가하지 마라). 계약 테스트의 결측 참조 케이스는
   "크래시 없음 + 실측 동작 고정"으로 작성한다.
4. **개별 정정(확정)**: wait=항상 pause(클램프 없음) / choices 빈 options=무경고 pause /
   inputNumber 없는 변수=무경고 생성 / fork 결측 참조=기본값 평가(false/0 — `var==0`은 참) /
   changeEquipment=인벤토리 반환 없음("" = 해제) / changeExp·Level=클램프만, 레벨업 파생 없음 /
   changeGold·Item·Party=하한 0 확정, 결측 id 무경고 적용.
5. **판정 보류 (EC3에서 확정, 그 전까지 코드·표 유지)**:
   - ~~breakLoop 루프 밖~~ → **EC2에서 확정**: EasyRPG `Game_Interpreter::CommandBreakLoop`
     원문 대조 결과 "루프 없으면 이벤트 끝으로 점프"가 원작 의미론 — 실측(무경고 이벤트 종료)이
     원작 호환으로 판정 완료. 표 정정, 코드 유지.
   - gameOver/ending/returnToTitle: 실측 = resume 시 다음 명령 계속 실행(종료 처리 없음).
     "이후 명령 미실행"을 구현할지 표를 정정할지 감독자 결정 대기.
   - setFlag: EC2 완료 기준 산수 충돌로 파일 분리를 EC3로 이월(legacy 동작 자체는
     setSwitch.contract.test.ts에서 고정됨). EC3 완료 기준은 화이트리스트 24→0 (setFlag 포함).
6. **버그 후보 1건**: recoverAll이 `actorStateIds`(상태이상)를 해제하지 않음 — RM2003
   의미론상 해제가 맞다. **EC3에서 §3 프로토콜로 판정 후 수정**.
7. m2Command의 계약 파일은 EC4 §9 트리아지에서 다룬다(화이트리스트 상시 항목).

## 11. 회귀 게이트 (완성 후 상시 효력)

1. 새 kind 추가 → `MINIMAL_COMMANDS` Record 컴파일 에러(기존) + 계약 파일 부재로
   `coverage.test.ts` 실패(신설) → 계약 테스트 없인 kind를 늘릴 수 없다.
2. 새 m2 entry 추가 → 분류 누락 시 `m2RuntimeSupportCompleteness` 실패 → 조용한 partial 불가.
3. 골든 12종 → 인터프리터 리팩토링 시 의미론 회귀 즉시 검출.
4. editor-only 명령 사용 시 저장 lint warning → 사용자가 "작성했는데 실행 안 됨"을 저장 전에 인지.

## 진행 기록
- 2026-07-07: 스펙 작성 (Claude Fable 5 감독, 실측 기반). 웨이브 착수 대기.
- 2026-07-07: **EC1 완료·머지** (Fable 5 서브에이전트, 신규 테스트 73, 런타임 수정 0건,
  2022 passed). §5 표 대조 차이 20건 → §10.1 실측 정정 절 신설. 보류 2건(breakLoop/종료 3종),
  버그 후보 1건(recoverAll 상태이상). 다음: EC2.
- 2026-07-07: **EC2 완료·머지** (codex xhigh, 신규 87, 화이트리스트 40→24, 2113 passed).
  breakLoop 보류 확정(원작 호환), setFlag 파일 분리는 EC3로. 잔여 결정: 종료 3종 처리,
  recoverAll 상태이상(EC3 §3 판정). 다음: EC3.
