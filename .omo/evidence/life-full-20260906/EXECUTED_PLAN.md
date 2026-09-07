# life-systems-full-implementation - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 생활 탭에서 설정한 농사·낚시·채집·가공·주민·동물·건물이 실제 게임 행동과 저장 재개까지 연결됩니다. 감사의 모든 발견사항과 51개 세부 기능을 빠짐없이 수정하거나 실제 검증합니다.

**Why this approach:** 기존 처리기를 재사용하고, 먼저 자원 보존과 저장 호환성을 마련한 뒤 필드 행동과 경제·주거를 연결합니다. 기능을 켠다는 이유로 기존 저장 자산이 사라지지 않게 하기 위해서입니다.

**What it will NOT do:** 새 생활 프레임워크나 낚시 미니게임을 만들지 않습니다. 내역을 모르는 옛 자원을 추정 보상하지 않고, 기존 사용자 프로젝트를 덮어쓰지 않습니다. 이 문서는 구현 실행이 아닙니다.

**Effort:** XL
**Risk:** High — 저장 자원 보존, 하루 전환과 배치·주거의 여러 거래 경계를 함께 바꿉니다.
**Decisions to sanity-check:** 건물과 축사는 명시 연결합니다. 확인 가능한 자원만 정확히 복구하고 불명 기록은 보존합니다. 옛 저장은 새 버전에서 열지만 새 생활 저장은 새 버전에서만 사용합니다.

Your next move: 고정밀 계획 검토를 마친 뒤 별도 실행 요청으로 시작합니다. 아래는 승인된 정책을 구현자에게 전달하는 전체 명세입니다.

---

> TL;DR (machine): XL / High / 6 Phases, 20 implementation tasks, 4 final verifiers; 7 tabs / 51 subfeatures / F01-F13; review_required: true.

## Scope
### Must have
사용자가 승인한 범위는 생활 7개 탭·51개 하위 기능, 감사 F-01~F-13 전체의 구현·수정·완주 검증이다.
기존 데이터 형식을 보존한 건물-축사 명시 연결, 증빙 가능한 자원의 정확한 복구와 불명 기록 원본 보존,
옛 저장의 새 버전 로드 및 새 생활 저장의 새 버전 전용 정책을 따른다.
계획 작성과 momus 검토만 승인되었으며 이 문서 작성은 제품 구현을 실행하지 않는다.

### 근거와 확정 정책

- 작업 저장소: `/home/main/.herdr/worktrees/rpg-zzu/wish-html`. 계획 작성 시 HEAD `32ef1bcd`, 조회한 통합 기준 `f11d6febb662ce47c1737ac914258b0c886d4466`.
- 감사 원장: 통합 기준의 `reports/life-audit-2026-09-05/AUDIT.md`, `RUNTIME.md`, `EXECUTION.md`. 현재 워크트리에는 아직 없으므로 계획 중 읽은 사본은 `/home/main/z-project/rpg-zzu-life-audit-p2/reports/life-audit-2026-09-05/`다. 실행자는 통합 브랜치의 추적 파일을 정본으로 쓴다.
- 해당 두 기준 사이 project/player/database/test 변경은 없음으로 확인했다. 실행 시작 때 최신 기준과 다시 비교하되 이미 해결된 항목을 다시 구현하지 않고 동등한 검증으로 충족한다.
- 모든 `CLAUDE.md` 지침은 사용자 명시 지시로 제외한다. 나머지 AGENTS/OpenWiki의 워크트리·저장·런타임 QA 계약은 유지한다.
- 새 비용·서비스·패키지 없이 기존 TypeScript, Phaser, Vitest, Playwright, Supabase를 사용한다. 대상은 기존 단일 플레이어와 편집기 지원 화면이다.
- 동작 변경은 TDD, 문구만의 변경은 산문 고정 테스트 없이 실제 표시 검증. 이미 성공한 기능도 전체 51행의 회귀 커버리지에 포함한다.

### 실행자가 재결정하지 않을 상세 계약

**실행 의존 검증:** Phase 2 task3/4/5는 편집 전에 각각 앞 task2/3/4의
`.omo/evidence/life-full-20260906/<앞 번호>/VERIFY.md`를 읽는다.
`confirmed`, 필수 수정0, 실제 ancestor commit 일치일 때만 시작한다.
그래프 노드의 completed 표시만으로 통과시키지 않는다. 파일 부재나 needs-fix이면
제품 편집 없이 부모에게 차단을 알리고 해당 subtree의 수정·재검증을 기다린다.

**입력:** 기존 확인키를 쓴다. 각 좌표에서 이벤트→상자→명시적 생성 채집물→명시적 낚시터→농사 순서, 좌표는 기존 정면→발밑 순서다. 생활 대상의 성공뿐 아니라 명시적 거절도 입력 소비로 처리한다. 단, 농사의 기존 대상 아님 판정은 유지한다. 명시 낚시터는 물 타일 번호가 아닌 저작 영역이며, 어종 없음/기력 부족을 다른 수확이나 공격으로 대체하지 않는다. fish 사용자 규칙 없으면 새 도구 타입을 필수로 만들지 않는다.

**도구:** 기존 사용자 표는 전체 대체·순서 유지, itemId 우선이다. 최초 편집기 사용자 표 생성 때 기본 4개 규칙을 명시 행으로 복사하고 새 특수 행을 앞에 넣는다. 기존 표를 로드할 때 자동 병합하지 않는다. 빈 조건은 모든 유효 farmTool을 뜻하고 씨앗/소비재는 제외한다. requiresFarmable=false는 구역 제한만 풀며 맵 경계·지형·점유 제한은 풀지 않는다. harvest/fish 규칙이 있을 때 실제 해당 행동이 소비하며 무규칙 기존 수확은 유지한다.

**시간·농사:** 자동 XP 비활성은 부수 XP만 생략하며 명시 XP API나 활성 보상 오류의 실패 계약은 유지한다. 수확 수량 0은 0개 지급의 성공 수확이다. 재수확은 `regrowDaysRemaining`으로 분리하여 생존·제철·급수 성장 틱마다 감소한다. 옛 밭의 수확 이력을 추정하지 않고 다음 수확부터 적용한다. 가공은 기존 게임 시간(저작된 활동 하루 길이)만 사용하고 자연 분/명령/시각 설정/취침/복원에서 마감 동기화한다. 장부 렌더와 현실 시간은 상태를 진행시키지 않는다.

**주거:** `FarmBuildingTypeRecord.animalHousing?: { allowedSpeciesIds: string[] }`, `FarmBuildingLevelDefinition.animalCapacity?: number`를 추가한다. 주거 활성 유형의 각 레벨은 animalCapacity 0..9999를 명시한다. 기존 capacity는 범용 슬롯으로 유지한다. 동물 상태/시작 정의에는 `housingPlacementId?: string`을 추가하며 기존 buildingId와 동시 설정은 거부한다. 실제 배치 인스턴스 ID에 연결하고 이름/좌표/유형 ID를 추정 연결하지 않는다. 여러 배치는 각각 별도 정원이며 마을 전체 정원 풀로 합산하지 않는다.

연결 주거는 배치 map/x/y 및 현재 레벨의 정원과 종 제한에서 파생한다. 배치 이동 시 같은 주거 ID와 동물 진행을 유지한다. 철거·유형 삭제/연결 해제 시 동물은 삭제하지 않고 미배정으로 남긴다. 정원 감소는 동물 instanceId 코드포인트 오름차순으로 정원까지 유지하고 초과만 미배정으로 한다. 자동 다른 축사 이동은 하지 않는다. UI는 영향 동물 수와 미배정 결과를 확인 전에 보여준다. 재배정은 친밀도·준비품·당일 돌봄 영수증을 초기화하지 않는다. 기존 독립 축사는 그대로 작동한다.

**복구:** `PlaySession.lifeRecovery`는 `{nextSequence:number, claims:Record<string,LifeRecoveryClaim>}`이다. claim은 `id`, `sourceKind`, `sourceId`, `reason`, `items: ItemAmount[]`, `unresolved?: {record: JSON값, detail:string}`을 갖는다. ID는 세션에 저장되는 단조 증가 sequence로 만들고 랜덤/시각에 의존하지 않는다. 총 claim 4096, claim별 distinct item 64, 개별 수량은 ITEM_QUANTITY_MAX를 지킨다. 큰 입증 수량은 여러 claim으로 분할하고, 상한을 넘는 변환은 원본을 유지한 채 실패한다. 로드 시 초과 원문을 잘라내지 않고 로드를 거부하며 기존 슬롯을 보존한다.

유효한 자원은 원본 거래 또는 claim 또는 인벤토리 중 하나에만 속한다. 원본 제거+claim 생성, claim 지급+소진은 각각 하나의 draft 거래다. 알려지지 않은 item ID/증빙 없는 옛 작업은 claim의 미해결 원본으로 보관하되 지급하지 않는다. 복구 품목이 다시 정의되어도 자동 지급하지 않고 장부에서 명시 수령한다. 완료 꾸러미는 환급하지 않고 완료/보상 ID를 tombstone으로 보존한다. 미완료 기부 초과는 초과분만 반환한다. 해금 ID도 정의가 없을 때 비활성인 권리로 보존한다.

새 maker 작업에는 `contract:{inputs,outputs,durationMinutes,timeBasis:{dayStartHour,dayEndHour,daysPerSeason}}`를 동결한다. 정의가 유지/수정되어도 기존 작업은 이 약속으로 완료·지급하며 다음 작업부터 새 정의를 쓴다. 정의 삭제/패키지 비활성/시간 기준 변경으로 취소할 때 정상 이전 시각상 완료한 작업은 outputs, 미완료는 inputs만 claim으로 옮긴다. 옛 작업은 정의가 남으면 기존 현재 정의 계약, 없으면 미해결 보존이며 소급 추정 환급은 없다. 새 공간 배치에는 실제 지불 비용 영수증과 장식 회수 아이템을 기록한다. 정상 건물 철거 무환급 정책은 유지하고, 콘텐츠 비호환으로 격리되는 자산만 입증 비용을 복구한다. 과거 비용 없는 배치는 미해결 원본 보존이다.

**저장:** Project 버전과 게임 SaveSnapshot 버전을 분리한다. 게임 저장에 `SAVE_SCHEMA_VERSION=5`를 도입하고 현재 지원하던 Save4를 읽어 Save5로 올린다(주석만으로 Save3 지원을 발명하지 않는다). 기존 reader가 실제 schemaVersion 비교에서 Save5를 거절하는 것을 검증한다. 무시되는 minReader 필드만으로 보호한다고 주장하지 않는다. Project의 `SCHEMA_VERSION=4`는 그대로 두고 주거 저작 필드는 선택적 확장으로 로드/직렬화/검증한다. 승인된 새 버전 전용 정책은 게임 저장에 적용하며, 구형 편집기의 신규 주거 프로젝트 편집은 지원 대상으로 삼지 않는다.

새 수동 슬롯은 기존 키와 분리한 `oprn:save-slot:v5:` 계열을 사용하고 네임스페이스를 그대로 유지한다. 자동저장/체크포인트도 기존 키 계산에 v5 구분을 추가한다. 새 키가 없을 때만 해당 옛 키를 읽고, 손상된 새 키를 옛 진행으로 조용히 대체하지 않는다. 옛 원문은 삭제/덮어쓰기하지 않는다. migration은 메모리에서 수행하고 새 저장 성공 전까지 기존 원문은 그대로 남긴다. 서버 전체나 옛 프로그램 바이너리를 수정하지 않는다. 옛 클라이언트의 임의 파괴적인 쓰기까지 통제한다고 약속하지 않는다.

snapshot 작성은 live session을 수정하지 않는다. 저장 생성과 복원 양쪽의 lossy 필터 전에 같은 순수 `reconcileLifeState(project, snapshotDraft)`를 사용한다. 새 스냅샷에는 정합된 소유 위치만 담고, quota/검증 실패 시 이전 슬롯과 live session을 그대로 둔다. 적용은 parse→검증→정합→복원시각 가공 동기화가 성공한 draft를 마지막에 확정한다.

**옛 가공 취소의 증빙 경계:** contract 없는 legacy 작업은 현재 정의가 존재하더라도
그 정의의 inputs를 과거 지불량으로 추정하여 취소 환급하지 않는다. 그런 취소는 payable
items 없이 원본 미해결 기록으로 보존한다. 기존 정상 `collectMaker`가 준비된 legacy 작업을
현재 정의로 수령하는 호환 경로와, 과거 투입 증빙을 요구하는 복구 취소는 서로 다르다.

복원 순서는 parser → 밭·설치물 등 지속 점유 → 공간 배치 정합/복구 → 연결 주거 파생 → 동물 정합 → 나머지 생활 거래 정합 → 복원 시각 가공 동기화 → live 확정이다. 명시 housingPlacementId가 없어졌다고 legacy 시작 buildingId로 자동 재배정하지 않는다. claim 수령은 일반 세션 거래이며 즉시 디스크 저장을 의미하지 않는다. 이후 저장 실패는 이미 성공한 게임 행동을 롤백하지 않으며 이전 디스크 슬롯과 현재 메모리를 각각 보존하고 실패를 알린다.

claim 원본 JSON의 UTF-8 크기는 건별64KiB, 전체 복구기록8MiB까지다. 초과/중복claim ID/불안전sequence/invalid count는 로드를 거절하고 원문을 보존한다. 수령한 claim은 제거하되 `nextSequence`를 되돌리지 않는다. 재정합은 원본 소유 위치가 이미 사라진 동일 session에서 수행하므로 다시 발행하지 않는다. 완료 보상 tombstone은 별도 보존한다.

**점유:** 정적 배치 검사는 지형/배치/설치물/상자/밭을, 실제 거래의 추가 검사는 live 플레이어/NPC body를 본다. 저장 복원은 임시 캐릭터 겹침으로 자산을 삭제하지 않는다. live eventPositions와 runtime event 해석을 재사용한다. 배치/이동은 플레이어 몸 바깥 인접 방향의 top-left 좌표를 기본값으로 쓴다(위: top-H, 아래: bottom+1, 왼쪽: left-W, 오른쪽: right+1). 회전/강화 전체 footprint, 최소한 한 인접 보행 가능 칸을 확인한다. 전역 출구 도달성은 보장하지 않는다.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 새 생활 프레임워크·낚시 미니게임·멀티플레이·게임 장르 추가, 기존 전체 엔진 재작성.
- 기존 원격 `rpg-zzu-stardew-demo` 덮어쓰기, 사용자 WISH.md 수정, 다른 워크트리 미커밋 변경 수집.
- 테스트 삭제/skip/진단 억제, 전체 문자열 assertion 무근거 제거, baseline 갱신으로 실패 흡수.
- 함수 직접 호출이나 결과 상태/아이템 주입만으로 player.html 성공 주장.
- 이름·ID·좌표를 이용한 암묵 주거 결합, 과거 비용의 추정 환급, claim 상한 초과 자동 삭제.
- 계획 승인으로 구현·원격 쓰기 시작. 실행자는 별도 실행 요청과 그때의 shipping 옵션을 따른다.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: **TDD + Vitest**. UI는 Playwright, 게임은 `player.html` 전용 runtime QA. 산문 수정에 prose 고정 테스트 없음.
- 아래 `E`는 실행의 현재 attemptDir 아래 `life-full`이다. 실행자가 실제 절대 경로를 원장에 기록한다. 각 task의 `E/<N>/`에 RED/GREEN 출력·진짜 exit code·명령·HEAD tree·QA PNG/JSON·정리 영수증을 저장한다.
- 아래 신규 테스트 이름은 구현 작업이 함께 생성할 파일이고 기존 파일로 오인하지 않는다. 모든 `npm test -- test/<name>.test.ts`는 단일 실행에서 성공해야 한다. 실패를 타이밍 재시도로 덮지 않는다.
- 모든 동작 task는 자체 happy/failure 테스트와 실제 공개 모듈/호출자 import 실행을 한다. UI/입력 관련 task는 task 18의 실제 화면 검증도 완료 조건이다.
- QA 상태 구독은 입력 전에 설치한다. 정확한 DOM MutationObserver/이벤트/QA 행동 영수증을 bounded timeout으로 기다린다. fixed sleep/반복 polling 금지. 시간 자체 테스트는 제어된 게임 프레임 delta를 사용한다.
- 최종 명령: `npm run typecheck:app`, `npm run build`, `npm run gates`, 관련 전체 테스트, 편집기 실제 폼 저작/undo/redo/저장/재로드, 출하 player 새 게임/생활/취침/슬롯 재개.
- 이전 406pass/4fail과 전체 gates timeout은 과거 근거다. 원인 미확정이며 이번 실행을 대신하지 않는다. gates timeout 재발 시 어느 subprocess가 끝나지 않았는지 진단하고 로그/실제 상태를 남긴다. 새 실패가 있으면 완료하지 않는다.

## Execution strategy
### 이번 실행의 전달 모드

사용자의 최신 실행 요청은 `/ulw-execute life-systems-full-implementation --make-pr`다.
아래 초기 계획에 남은 자동 병합 표현보다 이 선택이 우선한다. 각 Phase는 검증·ultrabrain
승인 후 PR을 열어 두며 원격 병합하지 않는다. 다음 Phase는 검증된 앞 Phase의 커밋에서
새 워크트리를 만들고 그 브랜치를 base로 하는 stacked PR로 제출한다. 최종 main 대상
rollup PR이 전체 검증된 변경을 제공한다. 이는 전달 방식만의 정정이며 20개 작업과
4개 최종 검증, 승인된 기능·저장·주거 정책 및 증거 기준은 그대로 유지한다.

현재 실행의 기준은 `1aff8c3f13df42e92f73723a2799bc671ec8bee0`이다. 승인 후 추가된
시설 접근/구성, 장비 슬롯 등 기존 구현을 보존하고 해당 경로를 재사용한다.
계획의 행 번호보다 현재 소스의 실제 심볼/계약을 우선하되 변경 이유를 실행 원장에 남긴다.

### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

의존 안전을 폭보다 우선한다. 본 작업은 공유 session/save/renderer가 많으므로 억지 병렬화하지 않는다.
작업 1→기반(2..5)→핵심(6..10)→주거/세계(11..14)→통합(15..17)→완주(18..20)의 6개 Phase다.
각 Phase 실행 전에 별도 전용 워크트리, 병렬 편집자는 각자 하위 격리 워크트리를 만든다.
Phase는 순차, phase 내부는 아래 matrix가 허용하는 작업만 병렬. 하나의 task는 구현+테스트+증거를 함께 소유한다.
`session.ts`, `saveSlots.ts`, `dayTransition.ts`, `lifeLedger.ts`, `databaseLifeCraftingView.ts`는
여러 task가 참조하더라도 같은 파일을 동시에 편집하지 않는다. 아래 직접 의존이 그 직렬 경계를 만든다.
실행 shipping은 사용자 원래 요청에 맞춰 Phase별 PR→ultrabrain 승인→병합이다.
수정 요청은 독립 결함마다 deep 격리 작업자로 병렬 수정 후 통합 재검토한다. 승인 전 병합 금지.
이 계획 단계의 momus 승인과 실행 단계의 ultrabrain 승인은 서로 대체하지 않는다.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | 없음 | 2..20 | 없음 |
| 2 | 1 | 3,4,5 | 없음(버전 경계) |
| 3 | 2 | 4,6,12 | 없음 |
| 4 | 3 | 5,6,7,11,12,15 | 없음 |
| 5 | 4 | 14,17 | 없음 |
| 6 | 4 | 7,8,11 | 9 |
| 7 | 6 | 8,11,12,13,14 | 9 |
| 8 | 7 | 10 | 9 |
| 9 | 4 | 10,15 | 6,7,8 |
| 10 | 8,9 | 14,15 | 없음 |
| 11 | 7 | 12 | 14 |
| 12 | 11 | 13,16 | 14 |
| 13 | 12 | 16 | 14 |
| 14 | 5,10 | 16,17 | 11,12,13 |
| 15 | 10 | 16,17 | 없음(장부 통합) |
| 16 | 13,14,15 | 17,18 | 없음 |
| 17 | 5,14,16 | 18,19 | 없음 |
| 18 | 17 | 19,20 | 없음 |
| 19 | 18 | 20 | 없음(remote 직렬) |
| 20 | 18,19 | F1..F4 | 없음 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. 실패 기준과 전체 커버리지 원장을 고정한다
  - Recommended task executor category: deep — 세 byte-stability 실패의 실제 원인을 구분해야 한다.
  - Scope/References: `test/p0ProjectSchema.test.ts:64-75`, `p1FoundationSchema.test.ts:124-139`, `p2ProjectSchema.test.ts:61-71`, `p2SpatialEditorAuthoring.test.ts:36-49`, `src/project/defaults/defaultProject.ts`, `src/project/io/serialize.ts`, `src/editor/panels/database.ts:572-590`, `scripts/verify-gates.mjs`, 감사 원장.
  - Work: 최신 통합 기준/dirty/환경·포트 고정, 네 실패 재현. before/after JSON path/value/key-order 및 N(P)/N(N(P))를 출력하여 생성기와 정규화의 실제 결함만 수정한다. 의도된 migration은 독립 fixture로 분리하되 optional 무발명과 안정성 검증을 유지한다. count0는 공용 계약에 맞추고 0→양수→0/undo/redo를 더한다.
  - Acceptance/QA: `npm test -- test/p0ProjectSchema.test.ts test/p1FoundationSchema.test.ts test/p2ProjectSchema.test.ts test/p2SpatialEditorAuthoring.test.ts`; happy 네 파일 green, failure 손상 optional fixture 거부 및 정상화 반복 안정. `E/1/{red,green,normalization-diff}.txt`.
  - Coverage: task20에서 사용할 `test/fixtures/life-full/coverage.json`에 아래 51개 ID와 F01..F13을 누락 없이 등록(실측 결과가 아니라 미실행 명세). 테스트 코드를 확인한 실제 root cause만 커밋.
  - Commit: Y | `fix(project): stabilize life project normalization contracts`.

- [x] 25. Phase 1 PR의 최신 위키 색인 충돌을 보존 통합한다
  - Recommended task executor category: quick — 생성 파일 한 곳의 충돌이며 승인된 제품 변경은 없다.
  - Scope/References: Phase 1 `6fc09eee`, upstream `f3800793`, `openwiki/INDEX.md`, `scripts/openwiki-index.mjs`.
  - Work: 감독자가 최신 main을 merge --no-commit으로 통합한 뒤 생성 색인만 재생성한다. upstream 문서와 생활 정규화 기록을 모두 보존한다. 다른 코드 수정이나 PR 병합은 금지한다.
  - Acceptance/QA: `npm run openwiki:index -- --check`, `npm run openwiki:verify`, `git diff --check` 모두0. 충돌표식0, task1 관련 네 파일 테스트 재확인. 의도한 색인 변화 이외의 직접 수정0.
  - Evidence: `.omo/evidence/life-full-20260906/25/`; happy 양쪽문서절존재, failure 색인이 stale이면 check실패.
  - Commit: Y | `Merge main into life baseline and regenerate wiki index`.
  - Blocks: task2. 생성파일 통합은 감독자가 소유하며 기존 ultrabrain 승인 task1 본문은 변경하지 않는다.

- [x] 2. 새 생활 상태의 버전 및 원본 보존 경계를 구현한다
  - Recommended task executor category: deep — 프로젝트·게임 저장·내보내기 reader/writer 경계 변경.
  - Scope/References: `src/player/saveSlots.ts:118-245,286-344,424-461,752-777`, `src/player/saveSlotValidation.ts`, `src/player/autosave.ts`, 자동저장/체크포인트의 saveSlots 참조자(LSP로 전수). Project 상수는 변경하지 않는다.
  - Work: 위 저장 계약대로 독립 Save5 상수/Save4 로드, v5 키 분리, 최초 변환 원문 보존. 새 optional 상태가 없는 저장도 신규 writer는 Save5를 쓴다. task 1 기준의 실제 parser를 동결한 fixture로 버전 거부를 증명하고 단순 모사 비교로 대신하지 않는다. 인지하지 못하는 미래 버전은 명시 오류.
  - Acceptance/QA: 신규 `npm test -- test/lifeSaveVersion.test.ts`; happy v4원문 유지+v5저장→파싱→재개, failure v4 reader의v5거부/미래버전/새키손상/backup quota실패에서 원문과live상태 보존. 수동/자동/체크포인트 경로 모두. `E/2/{red,green,version-roundtrip}.json`.
  - Wiki: `openwiki/runtime-project-schema.md`, `runtime-sessions.md`. Commit: Y | `feat(save): version and preserve life-system saves`.

- [x] 26. 남은 QA 저장 키 관찰과 초기화를 이행한다
  - Recommended task executor category: deep — 독립 검증 B1의 실제 관찰·초기화 불일치를 좁게 수정한다.
  - Scope/References: `scripts/verify-gate-transfer.cjs:15,75-76`, `scripts/capture-uiux-evidence.cjs:18`, `scripts/playtest-driver2.cjs:76`, task2 `VERIFY.md` B1.
  - Work: 현재 저장 관찰은 Save5 키를 읽고 파싱한다. 세 스크립트의 깨끗한 슬롯 준비는 현재/legacy 수동1..3을 모두 지운다. 의도된 legacy compatibility fixture는 유지한다. 해당 저장 대기를 수정할 경우 저장 입력 전에 정확한 성공 신호를 구독하고 bounded timeout으로 실패시킨다.
  - Acceptance/QA: 신규 `test/lifeSaveConsumers.test.ts`에서 실제 현재 writer 출력과 추출한 스크립트 관찰/초기화 함수를 실행해 RED→GREEN. current 저장성공을 관찰 true로 보고, 초기화 후 두 키 가족은 모두 없고 다른 namespace는 그대로여야 한다. 잘못된 JSON/버전은 성공으로 보고하지 않는다. 전체 역사적 플레이스루를 재작성하지 않는다.
  - Evidence: `.omo/evidence/life-full-20260906/26/`의 RED/GREEN·공개 probe·정리. Node 문법/관련진단 및 `npm test -- test/lifeSaveConsumers.test.ts test/lifeSaveVersion.test.ts` exit0.
  - Commit: Y | `fix(qa): migrate remaining current save consumers`.
  - Blocks: task2 독립 승인과 task3. 통합 후 verify2를 새로 실행해 confirmed를 얻기 전에는 후속 제품 작업 금지.

- [x] 3. 생활 거래 증빙과 복구함 타입·순수 거래를 만든다
  - Recommended task executor category: deep — 자원 소유권과 중복 지급 방지.
  - Scope/References: `src/project/session.ts:120-170`, `makers.ts:62-141`, `itemQuantities.ts`, `src/player/saveSlotValidation.ts`; 신규 `src/project/lifeRecovery.ts`, `test/lifeRecovery.test.ts`.
  - Work: 위 claim 스키마·상한·sequence·수령 계약 구현, 새 maker contract 동결 및 새 배치 지불 영수증 타입. 원본→claim 이동과 수령을 draft로 원자화한다. claim capacity 사전 검사, unknown/invalid 구분. 렌더나 저장에 지급 부수효과 금지.
  - Acceptance/QA: `npm test -- test/lifeRecovery.test.ts`; happy item3을 원본→claim→inventory로 한 번 이동, failure 재고상한/4096초과/invalid count는 소유 위치와sequence 불변; unknown품 원문은 유지하고 지급0. `E/3/{red,green,ownership}.json`.
  - Commit: Y | `feat(life): preserve recoverable transaction claims`.

- [x] 4. snapshot 작성·복원에서 무손실 정합을 적용한다
  - Recommended task executor category: deep — writer/parser/apply와 날짜 거래가 같은 소유권 규칙을 소비.
  - Scope/References: `saveSlots.ts:286-344,509-538,660-721,1070-1113`, `lifeRecovery.ts`, `shipping.ts`, `bundles.ts`, `p1FoundationRecords.ts`, `spatialPlacementRestore.ts`, `dayTransition.ts`.
  - Work: lossy known-ID 필터 전 정합, 완료 보상 tombstone/해금 권리 유지, 미완료 기부 초과만claim, 출하 비활성/부적격 복구. 옛 동물/배치/작업의 정의 소실 원문 격리. writer live 불변, apply 전체draft 성공 후 확정. 복구 실패 시 날짜도 확정하지 않고 단계/ID를 전달한다.
  - Acceptance/QA: 신규 `npm test -- test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts`; happy 기여5→요구2면 진행2/복구3, reload2회 총량일치; failure quota/손상/다른 날짜단계 오류에 원문/live/영수증 불변. `E/4/{red,green,roundtrip}.json`.
  - Commit: Y | `fix(save): retain life assets across content changes`.

- [x] 5. 실제 생활 상태와 행동 완료의 QA 관측을 마련한다
  - Recommended task executor category: unspecified-high — 기존 QA snapshot과 하네스의 통합 확장.
  - Scope/References: `scripts/lib/runtimeQaRun.mjs:35-39,165-205,548-620`, `src/testing/sceneTestRunner.ts`, `RuntimeStateSnapshot` 및 `__oprnDebug.readState` 정의/소비자(LSP), `PlayScene`의 qaInstrumentation 계약.
  - Work: 기존 QA-only snapshot에 밭/remaining/energy/makers/housing/recovery를 읽기 전용 추가. 아직 구현 전 optional 필드는 없음으로 읽어 이 커밋 자체가 빌드되게 한다. 거절 행동에도 scene-local 증가 영수증 제공(저장하지 않음). 해당 시나리오의 sleep 기반 대기는 정확한 event/DOM 관측으로 교체한다. 일반 출하 계측 off에서는 globals/mirror/행동영수증 모두 미설치.
  - Acceptance/QA: 신규 `npm test -- test/lifeQaObservability.test.ts`; happy 입력 전에구독→거절영수증+상태불변 확인, failure 계측off에서 미러/global없음. import한 실제 snapshot builder 검증. `E/5/{red,green,instrumentation}.json`.
  - Commit: Y | `test(runtime): expose gated life action evidence`.

- [x] 27. 감독자 task5 브라우저 검증 자원을 정리한다
  - Scope: task5 감독자 재검증의 별도 `5-supervisor/` 출력, 브라우저 context, 전용 player 서버 및 전용 cache.
  - Acceptance: 실제 키 입력 off/on 검증 후 context/browser/server를 닫고 이 실행이 만든 cache만 제거한다. 원본 task5 증거와 스크린샷/JSON 검증 산출물은 보존한다.

- [x] 28. Phase 2 게이트 신규 실패의 원인을 대조한다
  - Scope: `phase2-gate-triage-input.json`의 기준선 밖 실패 25개 전부와 surface 실패를 Phase 2 직전 검증 커밋 `87de7378`에서 비교한다.
  - Acceptance: 별도 task-owned 기준 워크트리에서 파일 존재·실제 명령·exit·실패 원인을 대조해 회귀/기존/불확정을 각 행에 기록한다. 기준선 갱신·실패 삭제·skip은 금지하며, 발견된 in-scope 회귀는 별도 등록 후 수정한다.

- [x] 29. 감독자 오디오 QA 검증 자원을 정리한다
  - Scope: `5/q1-supervisor/`의 별도 증거 출력·캐시와 생략/꺼짐/켜짐 실제 player 검증의 context/browser/server.
  - Acceptance: 원본 Q1 증거를 덮어쓰지 않고 네이티브 BGM 및 QA 전역 경계를 검증한 뒤 자신의 context/browser/server/cache만 정리하고 실제 종료 영수증을 보존한다.

- [x] 30. 복구 정합의 특수 키 자원 손실을 고친다
  - Scope: `lifeStateReconciliation.ts`의 기부 수량 파싱·잔여/초과 분리와 같은 원인의 인접 복구 경로. `itemTransitions.ts`의 사용 횟수 사전과 `saveSlots.ts:parseItemUseCharges`의 읽기 사전도 포함한다. 별도 task-owned 워크트리에서 수정한다.
  - RED: 실제 `parseLifeState`에 JSON 원문 `{"bundleContributions":{"bundle":{"__proto__":1}}}`을 넣으면 수량1이 빈 객체로 사라지고 claim도 없다. 감독자 공개 모듈 probe exit1.
  - 추가 독립 반례: 같은 숫자 사전 원인으로 `itemUseCharges`의 기존 사용 횟수2가 수령·저장 중 사라지고, 특수 키 유한 품목이 다섯 번 사용해도 소진되지 않는다. 기존 FIFO 사용 횟수 보존과 5회 소진도 RED-first로 검증한다.
  - Acceptance: 원본 특수 키 수량을 파싱·저장·복원·재정합에서 단일 소유 위치에 보존한다. 미정의 품목은 원본/미해결 claim으로 남고 추정 지급하지 않는다. prototype을 오염시키지 않으며 일반 품목과 기존 한도·실패 원자성도 유지한다. RED-first 단위 회귀와 공개 왕복, 관련 tests/진단/typecheck/build, 독립 검증 및 감독자 통합 검증을 기록한다.

- [x] 38. P1 비정상 상태 테스트를 보존 계약에 맞춘다
  - Scope: `test/p1FoundationSchema.test.ts`의 기존 비정상 상태 writer/direct-apply 사례와 해당 검증 증거. 제품 코드는 수정하지 않는다.
  - 근거: 기존 동물 parser는 잘못된 수치를 정규화하지 않고 레코드를 거절했다. 이전 restore가 시작 동물을 수치0으로 재생성해서 테스트가 통과했으며, 승인된 보존 정책은 이 손실·재생성을 금지한다.
  - Acceptance: Infinity 등 JSON으로 보존할 수 없는 원본은 정확한 typed 거절과 전체 live/이전 슬롯 보존을 검증한다. JSON-safe 비정상 원본은 단일 미해결 기록·무지급·시작 동물 비재생성·반복 재개 보존을 검증한다. 날씨와 유효 상태의 기존 의미 있는 검사를 분리해 유지한다. 실패 삭제/skip/약화, 제품 회귀, baseline 변경은 금지한다.

- [x] 31. Phase 2 통합 검증 자원을 정리한다
  - Scope: 감독자 통합 검증의 build/cache/dist 및 task30 임시 워크트리. 기존 전체 테스트 보고서는 재실행 전에 별도 원본과 해시로 보존한다.
  - Acceptance: 통합된 실제 코드에서 관련 테스트·공개 왕복·진단·빌드·전체 gates를 실행하고 모든 실제 exit/한계를 기록한다. 자신이 만든 임시 자원만 정리하고 독립 VERIFY와 원본 증거를 보존한다.

- [ ] 32. Phase 2 최종 검토와 PR을 제공한다
  - Acceptance: Phase 2 전체 변경·독립 판정·감독자 검증·정리 및 명시한 게이트 한계를 최종 ultrabrain 리뷰에 제공한다. 승인 후 `agent/life-full-p1` 기준 stacked PR을 열고 URL/HEAD/증거를 기록한다. 원격 병합하지 않는다.

- [ ] 6. 자동 XP를 수확 성공과 분리한다
  - Recommended task executor category: unspecified-high — 농사·낚시·채집 세 거래 경로의 동일 결함.
  - Scope/References: `farming.ts:131-172,230-250`, `fishing.ts:27-59`, `seasonalForage.ts:80-103`, `lifeSkillProgress.ts:33-89`.
  - Work: 비활성 자동 XP만 skip, explicit XP API 유지, 활성 invalid reward는 전체 rollback. 낚시 minSkill 자격은 우회하지 않는다.
  - Acceptance/QA: 신규 `npm test -- test/lifeSkillDisabledHarvest.test.ts`; happy crop/rock/tree/fish/forage 품목획득+XP불변, failure 활성잘못된보상/기력/상한 전체상태불변. 실제 거래 함수를 import. `E/6/{red,green}.txt`.
  - Commit: Y | `fix(life): keep harvesting independent of disabled skill xp`.

- [ ] 7. 수확 수량과 정확한 재수확 일수를 일치시킨다
  - Recommended task executor category: unspecified-high — 농사 상태·그림·snapshot 연결.
  - Scope/References: `farmModel.ts:11-33,138-141`, `farming.ts:311-328,469-536`, `session.ts:FarmPlotState`, `saveSlotValidation.ts:isFarmPlotState`, `playSceneFarming.ts`.
  - Work: 수량0을 존중, remaining 추가/저장/정규화/그림/성숙판정. 초기 성장·기존 밭은 그대로, 다음 수확부터 새 타이머. 거절 수확은 타이머 미갱신.
  - Acceptance/QA: 신규 `npm test -- test/cropRegrowthContract.test.ts`; happy 성장2/재수확10의10번째급수에만재수확, 남은7왕복; failure 미급수/고사/상한에서 감소·초기화 금지. `E/7/{red,green,regrowth}.json`.
  - Commit: Y | `fix(farming): honor zero yields and regrowth duration`.

- [ ] 8. 도구 저작값과 여섯 행동의 권한을 맞춘다
  - Recommended task executor category: unspecified-high — UI·resolver·농사 판정 계약.
  - Scope/References: `toolActions.ts:11-47,87-139`, `databaseLifeCraftingView.ts:595-619`, `farming.ts:126-209,255-380`, `test/databaseLifeCraftingView.test.ts`.
  - Work: 위 도구 계약, false 왕복, 최초 기본표 materialize, ID우선 설명. 명시 구역외허용에서 벽/맵밖/점유 거절. fish 호출 연결은task10과 동일 resolver.
  - Acceptance/QA: 신규 `npm test -- test/toolActionAuthoringParity.test.ts`; happy 기본4종유지/명시false왕복/harvest조건, failure 씨앗을모든도구로오인안함/기존한행표에기본규칙추가안함. task18편집폼키보드/undo. `E/8/{red,green,editor}.json`.
  - Commit: Y | `fix(editor): align authored tool rules with gameplay`.

- [ ] 9. 가공 마감을 모든 게임 시간 경로에 연결한다
  - Recommended task executor category: deep — 자연 시간·명령·수면·복원 원자성.
  - Scope/References: `dayTransition.ts:52-79,125-139`, `makers.ts`, `playSceneTime.ts`, `saveSlots.ts`, `sceneTestRunner.ts:997-1029`, `p0Makers.test.ts`, `p0LifeLedgerUi.test.ts`.
  - Work: 위 분 진행·동결contract·0분무변경·setTime·load 계약. 중간 단계 오류면 전체draftrollback, ready는시간역행으로퇴행안함.
  - Acceptance/QA: 신규 `npm test -- test/makerClockIntegration.test.ts`; happy29→30/큰delta/자연·명령·sleep·load동일, failure 메뉴열린현실시간은미진행/수령상한/중복/날짜오류rollback. 실제 `updateGameTime` 호출 포함. `E/9/{red,green,clock-paths}.json`.
  - Commit: Y | `fix(runtime): finish makers at their game-time deadlines`.

- [ ] 10. 낚시·계절 채집을 실제 조사 입력과 렌더에 연결한다
  - Recommended task executor category: deep — 입력 우선권과 거절 처리·렌더·러너 일치.
  - Scope/References: `playSceneMovement.ts:463-527`, `playScenePlaceables.ts:42-72`, `fishing.ts`, `seasonalForage.ts`, `sceneTestRunner.ts:538-566`, `toolActions.ts`.
  - Work: 위 입력 3결과/좌표우선권/거절소비, forage 만료·그림/폴백·누락 경고, 성공refresh. 러너만성공하는대역금지.
  - Acceptance/QA: 신규 `npm test -- test/lifeFieldInteraction.test.ts`; happy `handleAction`로어획1/날짜생성forage회수1, failure event중첩/경계외/기력0/만료에서RNG·재고불변및공격미발동. task18 actualplayer입력. `E/10/{red,green,field}.json`.
  - Commit: Y | `feat(runtime): connect fishing and forage interactions`.

- [ ] 33. Phase 3 최종 검토와 PR을 제공한다
  - Acceptance: 해당 Phase 구현·감독자 검증·독립 판정·정리 후 최종 ultrabrain 승인을 받고, 검증된 앞 Phase 브랜치 기준 stacked PR의 URL/HEAD/증거를 기록한다. 원격 병합하지 않는다.

- [ ] 11. 건물별 주거 참조와 생애주기 거래를 구현한다
  - Recommended task executor category: deep — 승인된 opt-in 주거와 자산 보존.
  - Scope/References: `types/database.ts:753-775,859-877`, `types/project.ts:session`, `session.ts`, `p1FoundationRecords.ts:175-225`, `farmAnimals.ts:77-104`, `spatialPlacements.ts`, `spatialPlacementTransactions.ts`, `lifeRecovery.ts`, `io/shapeDatabaseFields.ts`, `io/references.ts`, `mapDeletion.ts`.
  - Work: 위 animalHousing/animalCapacity/housingPlacementId 계약, 파생home resolver 한 곳. legacy home 그대로, dualref거부, 건설/강화/이동/철거/축소원자화. persisted 동물 이력과새지불증빙 보존.
  - Acceptance/QA: 신규 `npm test -- test/linkedAnimalHousing.test.ts`; happy 배치2개독립정원/upgrade2→5/이동ID유지, failure 충돌·비용·종거절전체불변, shrink/철거동물삭제0/정렬고정/이중ref거부. `E/11/{red,green,lifecycle}.json`.
  - Commit: Y | `feat(life): link animal housing to farm building instances`.

- [x] 51. 유실된 실행 증거와 미커밋 수정본을 보존 복구한다
  - Result: 아홉 수정본·binary diff와 복구 자료384개의 무결성을 직접 확인했다. 공개389경로 검증0, 비공개 원본30파일은 별도 보존한다. 원본 실행 발췌는 복구했지만 r2 전체 로그·상태 캡처는 미복구이며, 이 완료는 제품 승인이나 누락 원본 복구 주장이 아니다. 수정본 체크포인트 `2e847642`; r3 검증은 별도 실행한다.
  - Scope: `spatial-rights` r2 작업자의 sparse 재설정으로 삭제된 ignored 증거와 남은 아홉 소스/테스트/위키 변경. 새 기능이나 원본 테스트 결과 생성이 아니다.
  - Acceptance: 먼저 현재 변경과 신규 테스트를 별도 안전 경로에 바이트 일치로 보관한다. st_01a07964/972 및 독립967/982의 실제 세션/tool 원문·사본에서 복구 가능한 자료를 출처와 함께 보관하고, 복구 불가능·부분 자료는 그대로 구분한다. 누락 raw를 요약/재실행 결과로 원본인 척 채우지 않는다. `E/51/`에 복구 매핑·현재 수정 해시·명시한 증거 공백을 기록한다.
  - 재실행 조건: 미커밋 원본 트리의 reset/read-tree/sparse 변경 금지. 새로운 검증 시도는 필요한 빌드 입력과 증거 경로를 먼저 보존 설정하고 이후 sparse 재설정을 하지 않는다. 보존된 수정본을 재사용하되 실제 새 baseline/RED/GREEN/공개 probe/build를 새 시도로 기록한다. 기존355 통과 주장은 검증 근거가 아니다.

- [ ] 47. 미지급 건물 금액 증빙을 수령 뒤에도 보존한다
  - Tier: HEAVY. Astra 전담 비시각 복구 거래 수정. Task12 승인 전 선행 조건.
  - Source: 통합 `b5c679ef`의 `placement-parent-astra/recovery-rights.mts` 실제 exit1. 지불 gold10+item1 건물 격리 후 item 수령이 미지급 gold10 원본까지 삭제하며 Save5 재개에서도 복구 기록이 없다.
  - Work: 기존 claim 스키마와 골드 자동 환급 없음 정책을 유지하면서 미지급 증빙을 보존한다. 지급된 claim 제거·단조 sequence·원자성·분할 claim 상한·정상 무환급 철거를 유지한다. 분할 품목마다 미지급 권리를 재발행하지 않고, 옛 혼합 기록도 추정 지급/자의적 중복 제거 없이 보존한다.
  - Acceptance/QA: 기존 정상 거래 characterization GREEN 후 양성 반례 RED-first. 수령·중복 재시도·Save5 writer/parser/apply·분할·capacity/sequence/재고 실패의 전체 상태와 원문 보존을 공개 API로 검증한다. 증거 `E/47-48/`, 독립 Astra 판정 필요. 기존 녹색 테스트로 보존 승인을 대체하지 않는다.

- [ ] 48. 장식의 실제 지불 품목 증빙을 동결해 복구한다
  - Tier: HEAVY. Task47과 같은 복구 경로를 쓰므로 한 소유자가 직렬 수정한다.
  - Source: `placement-parent-astra/recovery-rights-state.json`에서 실제 item1을 소비한 새 장식이 증빙 없는 여섯 배치 필드만 저장되고, 비호환 격리 뒤 payable items가 비어 있다.
  - Work: 새 장식의 실제 지불/회수 품목 증빙을 런타임 배치와 Save5에 동결한다. 현재 정의 변경·삭제 후에도 입증 품목만 정확히 한 번 회수한다. 현재 공개 배치는 필수 placementItemId의 품목 한 개를 소비한다. 무료 배치 기능이나 시작 배치의 지불 증빙 규칙을 새로 만들지 않는다. 증빙 없는 시작/legacy 배치는 미해결 원본으로 보존하며 옛 비용을 현재 정의로 소급 추정하지 않는다. Project4/Save4→Save5 정책과 live context 비저장은 유지한다.
  - Acceptance/QA: RED-first, 신규 유료·legacy/시작·품목 ID 누락 거절·정의/품목 변경·삭제·unknown 복구·상한 실패·정상 회수·중복 수령·반복 저장/재개를 실제 공개 API로 검증한다. H1/H2/무환급 철거/공간 안전 회귀도 보존한다. 증거 `E/47-48/`, 다른 Astra 문맥의 독립 판정 필요.

- [x] 49. 배치 코어 제작 워크트리의 증거를 보관하고 정리한다
  - Scope: `/home/main/z-project/rpg-zzu-life-full-placement-core`만. 디스크 여유2.0G에서 완료된 이 트리가327M를 점유한다. 활성47/48 트리는 건드리지 않는다.
  - Acceptance: 추적 소스가 통합 head에 실제 보존됐는지 확인하고 미추적/ignored 증거를 바이트 해시로 기존 커밋 또는 신규 아카이브에 대응시킨다. 불명 파일·활성 사용자가 있으면 제거하지 않는다. 감독자가 보관 커밋과 경로 대응을 확인한 뒤 소유 트리만 제거하고 브랜치·공유 의존성·원격 상태를 보존한다. 제거·공간 회수 영수증은 `E/49-50/`.

- [x] 50. 배치 코어 독립 검증 워크트리의 증거를 보관하고 정리한다
  - Scope: `/home/main/z-project/rpg-zzu-life-full-placement-core-verify`만. 완료된 독립 검증의327M 체크아웃이며 새 `spatial-rights-verify-r2`와 다르다.
  - Acceptance: 원본 VERIFY·성공/실패·공개 상태/저장 증거를 손실 없이 커밋 가능한 경로에 보관하고 해시·재독해 경로를 확인한다. 필요한 증거가 미보관이면 삭제하지 않는다. 감독자 보관 확인 후 이 소유 트리만 해제·제거하고 기존 결과를 새 코드 승인으로 재분류하지 않는다. `E/49-50/`에 실제 정리를 기록한다.

- [ ] 12. live 배치 안전과 저장 복원 점유를 분리한다
  - Recommended task executor category: deep — 같은 점유 함수의 거래·복원·스폰 소비자 구별.
  - Scope/References: `spatialOccupancy.ts:28-88`, `spatialPlacementTransactions.ts`, `spatialPlacementRestore.ts`, `lifeLedger.ts:135-230`, `playerStatusMenuController.ts`, live event/body 해석 모듈, `seasonalForage.ts`.
  - Work: 위 정적/live 점유 분리와몸바깥목표/전체footprint/국소탈출. 렌더상의NPC몸을passRect로축소하지않음. 적용시재검사, restore는임시캐릭터로자산삭제안함, 부적격지속배치task4복구.
  - Acceptance/QA: 신규 `npm test -- test/lifePlacementSafety.test.ts`; happy 인접배치후보행/러그위save복원, failure3×3몸/움직인NPC/밭/회전확장/막힌마지막탈출시비용불변. task18 actual장부건설. `E/12/{red,green,occupancy}.json`.
  - Commit: Y | `fix(life): validate live placement without losing saved assets`.

- [ ] 13. 동물 재배정과 연결 주거 저작 UI를 제공한다
  - Recommended task executor category: visual-engineering — 기존 DB/장부 UI의 명시 연결·영향 표시.
  - Scope/References: `databaseFarmAnimalsView.ts:493-638`, `databaseFarmSpatialView.ts:471-800`, `lifeLedger.ts:313-371`, `playerStatusMenuDetails.ts`, task11home resolver, 해당스타일모듈.
  - Work: 유형에서주거켜기/종/레벨정원, 시작개체legacy/배치선택, 장부동물별대상선택과 재검사. 미배정돌봄안내, 생산품회수가능, 철거/축소영향동물수표시. generic capacity와animalCapacity혼동제거.
  - Acceptance/QA: 신규 `npm test -- test/animalHousingAuthoringUi.test.ts`; happy UI저작→직렬화→장부배정→돌봄, failure 만원/삭제/종거절·배정반복중복돌봄차단. task18키보드와1024/1440캡처. `E/13/{red,green,ui}.json`.
  - Commit: Y | `feat(editor): author and manage linked animal homes`.

- [ ] 14. 주민·날씨·기술의 저작 경계와 표시를 일치시킨다
  - Recommended task executor category: unspecified-high — 여러 기존 폼의 bounded 수정과 runtime 이름 소비.
  - Scope/References: `databaseCharacterView.ts:543-750`, `characterProfiles.ts`, `playSceneGift.ts:44-52`, `playSceneInterpreter.ts:122-128`, `databaseDailyWeatherView.ts:334-445,645-655`, `dailyWeather.ts`, `databaseLifeCraftingView.ts:450-500`, `skillModel.ts`, `databaseCropView.ts:649-676`.
  - Work: 생일calendar상한·기존invalid경고, 자동화자프로필우선/명시speaker유지, 생략예보1/강도.5와명시값구분, 날씨128/레벨10/신규레벨보상2..max, 라벨문구일치. 폼렌더에백필금지.
  - Acceptance/QA: 신규 `npm test -- test/lifeAuthoringBounds.test.ts`; happy40일달력40생일/프로필공유/명시3·.65유지, failure28일달력29진단/129규칙추가거절/레벨1보상비자동변경/렌더serialize불변. `E/14/{red,green,bounds}.json`.
  - Commit: Y | `fix(editor): align life authoring bounds and runtime labels`.

- [ ] 34. Phase 4 최종 검토와 PR을 제공한다
  - Acceptance: 해당 Phase 구현·감독자 검증·독립 판정·정리 후 최종 ultrabrain 승인을 받고, 검증된 앞 Phase 브랜치 기준 stacked PR의 URL/HEAD/증거를 기록한다. 원격 병합하지 않는다.

- [ ] 15. 판매가·출하 목록·제작 결과·보상 처리를 완성한다
  - Recommended task executor category: unspecified-high — 기존 경제 소비자의 UI/거래 값 일치.
  - Scope/References: `shopPrice.ts:51-55`, `playSceneShop{,Parts,Dom,Goods,keeper}.ts`, `databaseLifeCraftingView.ts:504-592,782-831`, `shipping.ts`, `bundles.ts:68-69,122-125`, `commandCatalog.ts:735-740`.
  - Work: 기존 상점 helper의 상한/0값을 전 소비자에 연결하고, undefined 출하 전체에서 개별 해제 집합을 고정한다. 기부와 보상이 동일 품목이면 기부 차감 후 보상을 preflight하여 순증가를 판정한다. `craftRecipe`/`applyItemUpgrade` 명령에 선택적 `resultVariableId`를 추가한다. 지정 시 성공1/실패0을 기존 setVariable로 기록하고 이후 명령은 기존처럼 계속한다. 생략된 기존 명령은 결과변수를 만들지 않는다. 해당 command 타입·shape·참조/삭제 가드·이벤트 폼(`commandBodyCommerce.ts`, 실제 분기 소유자 확인)·preview와 sceneTestRunner도 같은 값을 소비하게 한다. 숨겨진 전역 변수를 쓰지 않는다. fixture는 결과 변수를 조건 분기하여 실패 뒤 성공 보상을 지급하지 않는다.
  - Acceptance/QA: 신규 `npm test -- test/lifeEconomyConsumerParity.test.ts`; happy100/90표시·거래·흥정reference90, A/B/C중A해제B/C, 기부1/보상1순증0; failure재료부족/merchantgold/상한에서재고불변과실패결과표시. `E/15/{red,green,economy}.json`.
  - Commit: Y | `fix(life): align economy consumers and transaction results`.

- [ ] 16. 복구 장부와 모든 패키지 비활성의 재개 경로를 연결한다
  - Recommended task executor category: visual-engineering — 복구 권리의 실제 플레이 진입과 실패 안내.
  - Scope/References: `lifeLedger.ts:51-92`, `playerStatusMenuModel.ts:173-186`, `playerStatusMenuDetails.ts`, `playerStatusMenuController.ts:198-202`, `lifeRecovery.ts`, `playSceneTime.ts`의 날짜오류표면.
  - Work: hasLifeLedgerData에session claim고려, `recovery` 탭+정확품/미해결사유/한번수령, 상한기록유지. 날짜오류에단계/문제ID/복구진입. claims만남은비활성프로젝트에서도접근가능. 메뉴키보드/포인터배제계약유지.
  - Acceptance/QA: 신규 `npm test -- test/lifeRecoveryLedgerUi.test.ts`; happy패키지모두off→복구탭→item한번수령, failureunknown/상한에버튼안내·claim유지/재시도중복0. task18실제키보드. `E/16/{red,green,ledger}.json`.
  - Commit: Y | `feat(runtime): expose preserved life assets in recovery ledger`.

- [ ] 17. 51개 기능의 완주 fixture와 결정적 하네스를 작성한다
  - Recommended task executor category: unspecified-high — 저작/출하/저장 통합 테스트 기반.
  - Scope/References: `test/fixtures/life-full/`, `scripts/qa/runtime/life-*.scenario.mjs`(신규), `scripts/lib/runtimeQaRun.mjs`, `test/e2e/life-full-authoring.spec.ts`(신규), `test/runtime/life-full.spec.ts`(신규), `playwright.runtime.config.ts`, task1coverage.
  - Work: 생활전용새fixture는제작자가일반UI로저작가능한유효프로젝트로만구성. 시작재고·날씨·달력·정원·성장/가공기간을고정. 임무/스위치로꾸러미해금이실제길을열게하고, 주민gift/talk/relationship/schedule과제작/강화실패분기포함. 기존seed에서결과ready/수확품/환급을런중주입하지않음. QA-only시간제어는게임tick경로만.
  - Acceptance/QA: `npm test -- test/lifeFullFixture.test.ts`(신규); happyvalidate→serialize→deserialize와51개ID시나리오매핑, failure필수item/map/ref하나제거시validator실패. 원격쓰기는task19만. `E/17/{red,green,coverage}.json`.
  - Commit: Y | `test(life): add complete deterministic authoring and runtime fixtures`.

- [ ] 35. Phase 5 최종 검토와 PR을 제공한다
  - Acceptance: 해당 Phase 구현·감독자 검증·독립 판정·정리 후 최종 ultrabrain 승인을 받고, 검증된 앞 Phase 브랜치 기준 stacked PR의 URL/HEAD/증거를 기록한다. 원격 병합하지 않는다.

- [ ] 18. 편집·플레이·날짜·저장 재개를 실제 표면에서 검증한다
  - Recommended task executor category: deep — 모듈 단위 통과로 놓치는 실제 연결을 검증하고 in-scope 결함 수정.
  - Scope/References: task17스펙/시나리오, `player.html`, runtime QA SUMMARY 계약, `openwiki/testing.md`, `reports/life-audit-2026-09-05/RUNTIME.md`.
  - Work/Commands: 고유포트 `DEV_SERVER_PORT=<실제배정값> npm run test:e2e -- test/e2e/life-full-authoring.spec.ts`; `npx playwright test --config playwright.runtime.config.ts test/runtime/life-full.spec.ts`; `npm run qa:runtime -- --scenario life-full --out <E/18/runtime>`. 실제서버cwd기록, 편집기셸로게임QA금지.
  - Acceptance/QA happy: 7탭폼생성/편집/복제/삭제가드/undo/redo/저장재로드, 파종→급수→수확→재수확, 물고기/새forage→출하→수면→돈, 가공당일수령, 레벨/제작/강화/꾸러미/실제길개방, 선물/생일/대화/관계명령/NPC일정, 건설→배정→생산→강화→철거미배정, 복구수령, 수동/자동저장후재개.
  - Failure: invalidref·기력·재고/골드상한·기부중복·기한직전·다른날씨/계절·만원·live점유·quota·옛클라이언트신버전거부. 각조건의0부수효과/원문보존을task5미러로확인.
  - 각51ID는 happy+failure 또는 읽기전용표시/산문에합당한 비동작QA를coverage에기록. 미실행/U가남으면완료금지. 1024×768/1440×900편집,1280×960player, 실제이미지판독가능도구를사용하며불가시미검증명시. `E/18/{coverage,actions}.json`, `runtime/SUMMARY.md`, 지정PNG.
  - Commit: Y(수정/검증자료 있으면) | `test(life): verify complete player and authoring journeys`.

- [ ] 19. 검증 프로젝트를 분리 저장하고 원격 재로드를 증명한다
  - Recommended task executor category: unspecified-high — 기존 Supabase 저장 경로 재사용과 데이터 격리.
  - Scope/References: `supabaseProjectSync.ts:saveProjectToSupabase`, `src/project/store.ts`, `scripts/save-stardew-demo.mts`는존재확인후참고만, 신규 `scripts/qa/save-life-full.mts`, task17fixture.
  - Work: 별도 ID `rpg-zzu-life-full-<execution-session-slug>`를생성. 동일ID가이미있으면이실행의영수증과hash가맞는경우만재사용, 타인의행이면중단하고새session-suffix사용. 시작전URL/key/ID·연결확인. remotePersistenceEnabled=true인실제save→같은IDload→validate→hash/의미비교. 비밀정보기록금지.
  - Acceptance/QA: `./node_modules/.bin/vite-node scripts/qa/save-life-full.mts --project-id <실제ID>`; happy저장성공과재조회전체생활정의·시작배치동일, failure미설정/잘못된key는실패영수증과쓰기0/성공미표시. 재로드데이터를task18player시나리오입력으로한번실행. 기존demo행불변증명. `E/19/remote-receipt.json`.
  - Commit: Y | `test(life): verify isolated remote save and reload`.

- [ ] 20. 통합 게이트와 새 완료 보고서를 확정한다
  - Recommended task executor category: writing — 검증된 결과를 정리하되 감독자가 명령을 직접 실행.
  - Scope/References: 모든증거/coverage, `openwiki/{editor-database,runtime-sessions,runtime-project-schema,testing}.md`, 새 `reports/life-implementation/` 보고서, `scripts/verify-gates.mjs`.
  - Commands: 감독자 `npm run typecheck:app`, `npm run build`, `npm run gates`; task1/6..17관련test파일을한번의관련suite명령으로실행. 진단은build전. gates실패는기존과신규분리, timeout은원인·pending프로세스기록후해결없이green주장금지.
  - Acceptance/QA happy: F01..F13및51개ID전부실측/회귀근거매핑, 지원되는J/P/원격왕복과반례포함, 제품실행완료보고서에새스크린샷·정확명령·projectID. failure coverage에서임의한행미실행/증거파일누락이면최종검증이실패해야함(내용문구고정test아님).
  - 과거감사보고서는당시기준기록으로보존하고새결과에링크한다. `npm run openwiki:verify` 및 필요한색인갱신을수행. `E/20/{gates,build,coverage-audit,cleanup}.txt`.
  - Commit: Y | `docs(life): record verified life-system completion and limits`.

- [ ] 36. Phase 6 최종 검토와 PR을 제공한다
  - Acceptance: 완주·원격 저장/재로드·전체 검증·정리 후 최종 ultrabrain 승인을 받고, 검증된 앞 Phase 브랜치 기준 stacked PR의 URL/HEAD/증거/원격 프로젝트 ID를 기록한다. 최종 F1..F4 승인을 대신하지 않으며 원격 병합하지 않는다.

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  - Read-only verifier: 각 task 및 F01..F13/51ID matrix와실제diff/증거를대조. 행누락·근거없는PASS·잘못된버전/주거정책은REQUEST_CHANGES. `E/final/plan-compliance.md`.
- [ ] F2. Code quality review
  - Read-only reviewer: session/save/dayTransaction 권한·중복지급·원문보존·타입/진단·미사용새레이어·비밀정보를검토. `git diff --check`, 관련test/build/gates의실제exit재확인. `E/final/code-review.md`.
- [ ] F3. Real manual QA
  - 감독자 실제 편집기와출하player로task18 happy/failure및task19재로드자료를검증한다. stale tree/주입결과/함수대역으로승인하지않는다. `E/final/manual-qa.md`와PNG.
- [ ] F4. Scope fidelity
  - Read-only verifier: 기존원격demo·타인WISH.md·제품외변경·새서비스/의존성여부확인. 승인정책3개와새writer/oldreader원문보존증거검사. `E/final/scope.md`.

위 네 결과가 모두 APPROVE일 때만 실행 최종 검토로 넘긴다. Phase PR별 최종 ultrabrain은
전체 원요청·해당Phase범위·diff·직접QA를받고승인하며, 그전병합금지. 수정은격리deep로분할하고통합재검토.
실행옵션이 `--ship`일때승인후병합까지수행한다. 계획작성의현재세션은실행하지않는다.

- [ ] 37. 전체 변경의 main 대상 rollup PR을 제공한다
  - Acceptance: F1..F4와 발견된 in-scope 회귀 검증 및 QA 정리를 완료한 뒤 전체 변경을 제공하는 main 대상 rollup PR을 열고, 여섯 Phase PR URL·커밋·증거·검증 한계·원격 저장 ID를 전달한다. 원격 PR을 병합하지 않고 요청된 최종 완료 조건을 충족하면 즉시 멈춘다.

## Commit strategy

각 task의 검증된 코드와 직접 테스트·관련 wiki는 한 원자적 커밋으로 묶는다. 준비 안 된 형식을
뒤 작업에서만 빌드 가능하게 만들지 않는다. 공유 파일 변경은 의존 순서대로 통합하며 독립 워커는
자기 워크트리만 커밋한다. 실행 감독자가 직접 gates와PR을책임진다. 사용자 변경 자동stage금지.
각Phase PR에 현재기준·증거·기존실패·최종승인목록을기록하고ultrabrain승인후병합한다.
충돌은의도기준으로해결하며무단reset/force-push/기록재작성금지. Git메시지는최근저장소관례를따른다.

## Success criteria

1. F01..F13 각각이구현·정합·명시계약으로해결되고보고서51개행이아래행소유task와task18증거를갖는다.
2. 승인된주거/복구/버전정책은유효·실패·재시도·writer/parser/apply에서일치하고원본/자원중복손실없다.
3. 전체실제표면·원격reload·빌드·최종gates를실행하고새회귀0,기존문제는원인/영향을별도명시한다.
4. 필요한PR은ultrabrain승인후에만병합하고최종보고서는새소스/tree와정확projectID/증거를가리킨다.

### 51개 행의 누락 방지 추적표

모든 행은 task17의 coverage에 그대로 등록하고 task18의 실제 시나리오에 연결한다.
아래 owner는 변경/회귀 책임이며 변경할 필요가 없다고 해서 검증을 생략하지 않는다.

| 원장 ID | owner task | 필수 실제 검증 |
|---|---|---|
| C1,C2 | 1,17 | 목록/검색/CRUD/스타터·준비카드와실제도구/밭전제 |
| C3 | 6,8,10 | 괭이·씨앗·파종·물주기 |
| C4,C5 | 7,9 | 성장/계절/고사/0수량/재수확 |
| C6 | 6,8 | 범위도구·기력·XP/실패전체보존 |
| C7 | 7,14 | 자동/명시/빈그림·프레임·편집라벨 |
| C8 | 7,9 | 추가성장/날짜커서/고사·삭제복구 |
| R1,R2,R3 | 14,17 | 프로필/고아/이름/취향·반응/이벤트우선 |
| R4,R5 | 14,18 | 취소/일일제한/생일배수·달력 |
| R6,R7,R8 | 17,18 | 대화/호감분기/명시관계전환/일정/생활이동/저장재개 |
| L0,L1 | 6,14 | CRUD/삭제참조/토글/레벨보상 |
| L2,L3 | 8,15,17 | 제작/강화성공·실패·결과분기 |
| L4 | 15 | 상점표시·실거래·출하차이 |
| L5 | 8,10 | 6개도구행동저작→실제입력 |
| L6 | 6,9 | 초기기력/소비/0회복/수면회복 |
| L7 | 4,15 | 허용목록/예치·회수/수면정산·재개 |
| L8,L9 | 4,15,17 | 실제길해금/부분기부/보상1회·삭제권리 |
| L10 | 3,4,9 | 투입/분마감/수령/삭제복구 |
| W1,W2 | 14 | 표저작/128경계/활성·기본값 |
| W3,W4,W5 | 9,14,18 | 예보/HUD/별도화면날씨/비급수·성장 |
| A1,A2,A3,A4 | 11,13 | 종/축사/시작개체/명시연결·legacy |
| A5,A6 | 4,11,13,18 | 배정·돌봄·생산·회수/미배정재개 |
| S1,S2,S3 | 11,12,13 | CRUD/비용/건설·장식/이동·강화·회수 |
| S4,S5,S6 | 4,12,18 | 시작배치/방향그림·충돌/실시간점유·복원 |
| K1,K2,K3 | 8,10,17 | CRUD·토글/어종/영역·계절·날씨·숙련/거절 |
| K4,K5 | 4,10,12 | 날짜스폰/만료/실제그림·회수/밭보호 |
| K6,K7 | 4,15,18 | 발견·출하·어획·기부/박물관조건·보상1회 |

계획 작성 완료 기준은 이 파일의구조검사와momus승인이다. 실제 구현 완료는 위 실행 증거와
최종검증을별도실행세션에서얻었을때만선언한다.
