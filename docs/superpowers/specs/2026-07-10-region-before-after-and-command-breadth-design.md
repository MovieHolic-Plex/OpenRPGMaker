# 영역 작업 승인 게이트·before/after + 명령어 능력 확장 + 기본 모드 발견성 — 디자인 스펙

- 생성일: 2026-07-10
- 작성자: Claude (브레인스토밍 세션, 사용자 전체 승인)
- 기준 브랜치: `feat/basic-mode-ai-ux` (PR #12 위 스택 — `proposalInlineApproval` 레지스트리·선택 칩에 의존)
- 근거 자료: `docs/superpowers/research/2026-07-10-region-task-command-corpus.md` (50개 명령어 코퍼스: 가능 28 / 부분 가능 19 / 불가 3)

## 1. 배경과 목표

현재 영역 지정 AI 작업(`runRegionTask`)은 검증 통과 시 **맵에 즉시 적용**되어 사용자가 결과를 사전에 비교·거부할 수 없다. 또한 도구 카탈로그는 60여 종인데 영역 작업 프롬프트는 6개만 안내해, 코퍼스 50개 중 22개(44%)가 "부분 가능/불가"로 떨어진다. 기본 모드 시작 화면은 기능 발견 단서가 부족하다.

사용자 확정 목표:

1. **승인 게이트**: AI 완료 → 적용하지 않고 before/after 비교 → 사용자가 적용/버리기 결정
2. **비교 UI**: 캔버스 고스트 + "원본 보기" 토글 + 팝오버 내 before/after 썸네일 2장
3. **명령어 능력**: 의도 라우팅으로 도구 노출 확장 + 갭 도구 3종 신설
4. **발견성**: 영역 작업 추천 명령 칩 + 기본 모드 시작 화면 리치화
5. **검증**: 코퍼스 50개 전수 단위 테스트 + 카테고리별 대표 8~12개 실제 LLM 실측

## 2. 섹션 1 — 승인 게이트 + before/after 비교

### 2-A. PendingRegionApply (게이트 코어)

`runRegionTask`를 게이트 모드로 전환한다. 검증(`validateLayoutPlacement`) 통과 후 `deps.applyProject` 를 즉시 호출하는 대신:

- `RegionTaskResult`에 `pending?: PendingRegionApply` 를 추가한다.
  - `PendingRegionApply = { readonly clippedProject: Project; readonly mapId: MapId; readonly region: RegionRect; readonly changedCells: number; readonly changedEvents: number; readonly instruction: string; apply(): void; discard(): void; }`
  - `apply()` = 현행 적용 경로 그대로: `recordProjectSnapshot(라벨, mapId)` + `store.replace(clippedProject)` (undo 1개), 이후 고스트 프리뷰 정리.
  - `discard()` = 고스트 프리뷰 정리만. 맵 무변경.
  - apply/discard는 **한 번만** 유효(이후 호출은 no-op). 상태 조회용 `settled: boolean`.
- 고스트 프리뷰는 턴 종료 시 지우지 않고 **pending이 해소될 때까지 유지**한다 (`clearAgentGhostPreview()` 호출을 pending 해소 시점으로 이동). 오류/중단 경로는 현행대로 즉시 정리.
- pending 상태 모듈 `src/editor/regionTask/pendingRegionApply.ts` (신규): 전역 단일 pending 보관 + subscribe. 새 영역 작업 시작 시 기존 pending은 자동 `discard()`.
- 헤드리스 훅: `window.__rpgzzuRegionTaskPending = { get, apply, discard }`.
- 기존 즉시 적용 경로가 필요한 호출자(레거시/테스트)를 위해 `RegionTaskOptions.gate?: "approval" | "immediate"` — 기본값 `"approval"`. 선택 칩 프리셋(구조물/다듬기)·모달 실행 모두 approval.

### 2-B. 캔버스 인라인 승인 + 원본 보기

- PR #12의 `proposalInlineApproval` 레지스트리에 pending region apply 를 등록해 고스트 마커 위 미니 툴바를 재사용: `[✓ 적용] [✗ 버리기] [원본 보기]`.
  - 적용/버리기는 `PendingRegionApply.apply()/discard()` 배선.
  - `상세 보기` 슬롯은 영역 작업에서는 `원본 보기`로 대체(레지스트리 항목에 라벨/핸들러 주입 가능하게 확장).
- **원본 보기**: pointerdown 동안 고스트 프리뷰 렌더만 숨긴다(`agentGhostPreview`에 `setGhostPreviewHidden(boolean)` 시각 토글 추가 — 상태 파괴 없음). pointerup/leave 시 복원. 키보드 접근: 버튼 focus 상태에서 Space 누름/뗌 동일 동작.

### 2-C. 팝오버 before/after 썸네일

- `src/editor/regionSnapshot.ts` (신규): `mapScreenshot.ts`의 레이어 draw 로직을 내부 공유 함수로 추출하고, `renderRegionSnapshot(project, map, region, opts?) => Promise<Blob | HTMLCanvasElement>` 제공. 영역만 크롭 렌더, 스케일은 썸네일 목표폭(~140px)에 맞춰 클램프(최소 1px/타일). 이벤트(NPC)는 차셋 스프라이트 1프레임을 셀 위에 오버레이(가능한 범위에서 단순 렌더, 실패 시 셀 마커로 폴백).
- `regionTaskModal`: 실행 완료(성공) 시 요약 아래 `[before 썸네일][→][after 썸네일]` + `[✓ 적용] [✕ 버리기]` 버튼 행 표시. before = 실행 시점 base, after = clipped 결과. 썸네일 클릭 시 2배 확대 팝업(선택 사항 아님 — 포함).
- 팝오버 닫기(✕/Esc/backdrop)·새 영역 작업 시작 시 pending은 `discard()`. 적용/버리기 후에는 요약을 결과 문구로 갱신("적용됨 — 34칸 타일 · 이벤트 2건" / "버려짐 — 맵 무변경").
- `describeRegionTaskResult`는 pending 상태 문구를 추가: "제안 준비 — 34칸 타일 · 이벤트 2건 · 적용 여부를 선택하세요".

### 2-D. 진행 배지와의 연결

- 기존 `regionTaskStatus` 배지("AI 작업 중…")는 pending 생성 시 "확인 대기"로 전환, pending 해소 시 제거. (이벤트 페이로드에 `phase: "running" | "pending" | "done"` 추가.)

## 3. 섹션 2 — 의도 라우팅 + 갭 도구 신설

### 3-A. 의도 라우터

- `src/editor/regionTask/regionIntentRouter.ts` (신규): `routeRegionIntent(instruction: string): RegionIntentCategory[]` 순수 함수. 키워드/정규식 기반, LLM 불사용.
- 카테고리(7): `structure`(집·성·울타리·광장), `npc-shop`(주민·상인·경비·상점), `door-transfer`(문·계단·텔레포트·입구), `quest-trigger`(퀘스트·플래그·조사·표지판·컷신), `battle-trap`(몬스터·인카운터·함정·추격), `mood`(조명·분위기·시간), `transform`(대칭·반복·복사·지우기).
- `buildRegionTaskMessage`가 라우터 결과에 따라 **카테고리별 도구 가이드 블록**을 동적으로 덧붙인다. 예: `door-transfer` → `create_transfer_pair` 사용법 1~2줄, `quest-trigger` → `create_quest`/`declare_story_flag`/`place_examine_hotspots`, `battle-trap` → `place_battle_blocker`/`place_trap`/`set_encounter_table`, `npc-shop` → `set_shop_stock`/`set_npc_schedule`, `mood` → `set_lighting_volume`/`set_scene_mood`, `transform` → `mirror_region`/`clear_region`/`duplicate_event`. 기존 기본 가이드 6줄은 항상 유지. 매치 없으면 현행 메시지와 동일.
- 가이드 말미에 공통 지시 추가: "지원하지 않는 부분은 시도하지 말고, 무엇을 못 했는지 마지막 요약에 한 줄로 명시하라." → 요약이 그대로 팝오버에 노출.
- **단위 테스트**: 코퍼스 50개 명령 전체를 입력으로, 명령별 기대 카테고리(코퍼스 needs에서 도출한 고정 기대값 테이블)와 가이드 주입 여부를 전수 검증.

### 3-B. 갭 도구 3종

코퍼스 "불가/저신뢰" 상위를 전용 도구로 메운다. 모두 기존 도구 레지스트리(`src/editor/tools/`) 패턴을 따른다.

1. **`place_chest`** (`eventTools` 계열 신규): 보물상자 이벤트 프리셋. args: `{ mapId, x, y, contents: { itemId?: string, gold?: number }, opened?: boolean }`. 상자 차셋 그래픽 + 페이지 2장(미개봉: 아이템/골드 지급 + 셀프스위치 ON, 개봉: 열린 그래픽·무동작). 지급 커맨드는 기존 `eventCommandFactory` 재사용.
2. **`place_savepoint`** (`eventTools` 계열 신규): 세이브 포인트 이벤트 프리셋. args: `{ mapId, x, y }`. 조사 시 세이브 화면 호출 커맨드 + 반짝임 그래픽(사용 가능한 차셋 내 선택).
3. **`mirror_region`** (`mapTools` 계열 신규): `{ mapId, region, axis: "horizontal" | "vertical" }` — 영역 타일(lower/upper/스택)과 이벤트 좌표를 결정적으로 대칭 변환. LLM 판단 불요, 순수 변환 + 단위 테스트. 비대칭 오토타일 경계는 변환 후 그대로(후처리 없음 — 한계는 도구 설명에 명시).
- 다리(bridge) 스탬프는 타일 자산 의존이 커서 **이번 범위 제외**, 후속 과제로 ledger에 기록.
- 3종 모두 도구 카탈로그 설명·의도 라우터 가이드(`quest-trigger`/`transform` 등 해당 카테고리)에 연결.

## 4. 섹션 3 — 영역 작업 발견성

- `src/editor/regionTask/suggestedCommands.ts` (신규): 코퍼스 "가능" 판정에서 선별한 **대표 12개 명령 상수** (id, label(축약), instruction(원문), category). 일반 맵에서 성립하는 범용형만 선별(특정 타일셋 의존 제외).
- `regionTaskModal` 입력창 아래 **추천 칩 3~4개** 렌더: 무작위가 아닌 로테이션(모달 열림 횟수 기반 오프셋 — `Date.now` 불요, 모듈 카운터). 클릭 시 입력창에 instruction 채움(자동 실행 아님).
- placeholder도 같은 풀에서 로테이션: "예: {instruction}".

## 5. 섹션 4 — 기본 모드 시작 화면 리치화

`aiChatPanel` 시작 화면(메시지 0개 상태)에 카드 2개 추가. 기본 모드 전용(`editor-ui-basic`), 과밀 방지를 위해 카드 2개 + 기존 힌트 줄만.

1. **"이렇게 해보세요" 카드**: 영역 선택→✨ 흐름 1줄 안내 + 예시 명령 칩 3개(suggestedCommands 재사용). 칩 클릭 시 채팅 입력창에 문구 채움 + 포커스(전송 아님).
2. **"최근 AI 작업" 카드**: `activityLog`(이미 `recordAiActivityFromRegionLog`로 저장 중)에서 최근 3건 — 명령 요약(40자)·결과(칸/이벤트 수)·상대 시간. 기록 없으면 카드 자체를 숨김(빈 카드 금지). 항목 클릭 동작은 없음(표시 전용, YAGNI).
- 채팅 시작 시(메시지 1개 이상) 카드 전부 제거 — 현행 시작 화면 규칙 승계.

## 6. 비목표 (YAGNI)

- 다리(bridge) 전용 스탬프, 반복 패턴(repeat) 스탬프 — 후속
- 슬라이더(디바이더 드래그) 비교 UI — 썸네일+원본 보기로 충분
- pending 다중 보관(영역 작업 큐) — 항상 단일, 새 작업이 기존을 버림
- 채팅(비영역) 경로의 before/after — 영역 작업 한정
- 최근 작업 카드의 클릭 내비게이션/재실행
- 50개 명령 전수 LLM 실측 — 대표 샘플만

## 7. 검증 계획

- **단위(vitest)**: 라우터 코퍼스 50개 전수, `pendingRegionApply` 상태 전이(apply/discard 1회성·자동 discard), `renderRegionSnapshot` 크롭 크기/스케일 클램프, `mirror_region` 변환(타일·스택·이벤트 좌표), `place_chest`/`place_savepoint` 이벤트 구조, suggestedCommands 로테이션, 모달 pending UI 상태.
- **E2E(Playwright)**: mock runner 주입으로 승인 게이트 전체 흐름 — 실행 → 썸네일 2장 표시 → [적용] 시 맵 반영·undo 1개 / [버리기] 시 무변경, 추천 칩 클릭 → 입력창 채움, 팝오버 닫기 → pending discard.
- **실측(컨트롤러 직접)**: 구현 완료 후 카테고리별 대표 8~12개 명령을 실제 LLM+브라우저로 실행, before/after 썸네일·원본 보기·적용/버리기·갭 도구 3종 결과 품질 확인.
- 기존 테스트 베이스라인: 브랜치 기존 실패와 신규 실패를 부모 커밋 워크트리 대조로 구분(PR #12 방식 승계).

## 8. 주요 파일

- 수정: `src/editor/regionTask/runRegionTask.ts`(게이트), `src/editor/panels/regionTaskModal.ts`(썸네일·추천 칩·pending UI), `src/editor/regionTask/regionTaskStatus.ts`(phase), `src/editor/proposalInlineApproval.ts`(라벨/핸들러 주입 확장), `src/editor/agentGhostPreview.ts`(hidden 토글), `src/editor/mapScreenshot.ts`(draw 로직 추출), `src/editor/panels/aiChatPanel.ts`(시작 화면 카드)
- 신규: `src/editor/regionTask/pendingRegionApply.ts`, `src/editor/regionTask/regionIntentRouter.ts`, `src/editor/regionTask/suggestedCommands.ts`, `src/editor/regionSnapshot.ts`, `src/editor/tools/`에 `place_chest`·`place_savepoint`·`mirror_region`
- 데이터: `docs/superpowers/research/2026-07-10-region-task-command-corpus.md` (라우터 테스트 기대값의 원천)
