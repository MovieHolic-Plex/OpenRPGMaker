<!-- 생성 파일 — 직접 고치지 말고 `npm run openwiki:index` 를 돌려라. -->
# OpenWiki 항해 색인

이 저장소의 위키는 **41쪽 / 999KB / 약 275,803 토큰** 이다. 통째로 읽을 수 있는 크기가 아니므로, 필요한 절만 좌표로 잘라 읽어라.

```
read("openwiki/editor-database.md", offset=<절 시작줄>, limit=120)
grep -n "찾는말" openwiki/*.md          # 어느 페이지 몇 줄인지부터 찾는다
```

## 통째 읽기가 잘리는 페이지 (도구 상한 50KB)

이 페이지를 `read` 로 한 번에 열면 **조용히 잘린 채** 전달된다. 아래 절 목록의 줄 번호로 잘라 읽어라.
「가장 큰 절」이 상한 아래면 절 단위 읽기로 페이지 전부에 닿을 수 있다.

| 페이지 | 통짜 크기 | 가장 큰 절 | 줄 | 토큰 추정 |
|---|---|---|---|---|
| `openwiki/editor-ai-panel.md` | 101KB | 29KB | 230 | ~28,628 |
| `openwiki/editor-database.md` | 106KB | 48KB | 290 | ~29,384 |
| `openwiki/editor-event-authoring.md` | 71KB | 43KB | 311 | ~20,123 |
| `openwiki/editor-pre-edit-routing.md` | 54KB | 44KB | 134 | ~15,159 |
| `openwiki/runtime-battle.md` | 71KB | 16KB | 182 | ~19,610 |
| `openwiki/runtime-sessions.md` | 54KB | 44KB | 118 | ~14,165 |
| `openwiki/testing.md` | 89KB | 44KB | 540 | ~24,874 |

## 한국어 산문이 깨진 페이지

EUC-KR→UTF-8 모지바케가 남은 줄이다. **그 줄의 한국어는 믿지 말고** 같은 줄의 파일 경로·식별자만 쓰고, 의미는 해당 소스 파일에서 직접 확인하라. 복원은 불가능하다(원본 바이트가 소실).

| 페이지 | 깨진 줄 수 | 예시 줄 번호 |
|---|---|---|
| `openwiki/editor-ai-panel.md` | 14 | 67, 79, 125, 127, 129, 131, 133, 139 |
| `openwiki/editor-ai-tools.md` | 5 | 53, 54, 57, 59, 61 |
| `openwiki/editor-database.md` | 7 | 92, 96, 97, 98, 106, 130, 133 |
| `openwiki/editor-event-authoring.md` | 16 | 35, 36, 39, 44, 45, 46, 47, 48 |
| `openwiki/editor-event-command-fixes.md` | 11 | 11, 12, 14, 15, 16, 17, 18, 19 |
| `openwiki/editor-event-commands.md` | 6 | 15, 28, 29, 31, 34, 35 |
| `openwiki/editor-observability.md` | 1 | 120 |
| `openwiki/editor-pre-edit-routing.md` | 6 | 23, 31, 36, 38, 47, 51 |
| `openwiki/state-system.md` | 2 | 3, 84 |

## 없는 파일을 가리키는 참조

문서가 이름을 부르는데 저장소에 없는 파일이다. 대부분은 **의도적으로 삭제된 모듈** 을 기록으로 남긴 것이지만(그 경우 문단이 삭제 사실을 말한다), 살아 있는 안내처럼 읽히면 에이전트가 없는 파일을 찾아 헤맨다. 문서를 고칠 때 이 목록이 줄어드는지 보라.

| 페이지 | 건수 | 참조 |
|---|---|---|
| `openwiki/agent-worktrees.md` | 3 | `result.md`, `status.json`, `task.json` |
| `openwiki/ai-workflow.md` | 2 | `index.json`, `latest.json` |
| `openwiki/architecture.md` | 1 | `project.json` |
| `openwiki/bgm-catalog.md` | 1 | `catalog.raw.json` |
| `openwiki/community-site.md` | 1 | `project.json` |
| `openwiki/editor-ai-panel.md` | 10 | `.omo/evidence/assistant-glass-fold/measure.json`, `.omo/evidence/autonomous-ai-rpg/task-8-autonomous-ai-rpg.md`, `aiCommandBar.ts`, `aiSkillDrawer.ts`, `aiVolatileController.ts`, `assistant-skills.css`, `newmain-after-measure.json`, `output/evidence/assistant-ui-modern/newmain-before-measure.json`, `project.json`, `src/ai/skills.ts` |
| `openwiki/editor-ai-tools.md` | 2 | `aiCommandBar.ts`, `aiProposalModal.ts` |
| `openwiki/editor-database.md` | 4 | `enemy-art-NNN.png`, `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`, `reports/generated-effect-showcase-2026-08-24.html`, `scripts/generate-default-item-icons.mts` |
| `openwiki/editor-event-authoring.md` | 5 | `audit-before.md`, `new-editor/REPORT.html`, `output/evidence/event-ai-assist-ux/960x900-compact.png`, `scripts/generated/toolCatalog.json`, `verify-shots/page-preview-probe/02-preview-open.png` |
| `openwiki/editor-event-commands.md` | 7 | `07-identifiable-previews.css`, `choicesDialog.ts`, `command-preview.css`, `event-editor.part-2/3.css`, `messageCommandDialogs.ts`, `messageDialogControls.ts`, `textCommandDialog.ts` |
| `openwiki/editor-pre-edit-routing.md` | 5 | `dbConnectionAdvancedSettings.ts`, `rm2k3.part-1.css`, `src/editor/authoringTestGate.ts`, `src/editor/tools/worldTools.ts`, `worldTools.ts` |
| `openwiki/editor-validation.md` | 2 | `final-layout.json`, `viewport-matrix.json` |
| `openwiki/editor-workflows-misc.md` | 1 | `src/editor/authoringTestGate.ts` |
| `openwiki/large-village-generation.md` | 2 | `HANDOFF.json`, `src/project/defaults/largeRiverMarketVillageBuild.ts` |
| `openwiki/runtime-battle.md` | 2 | `raw.png`, `reference.png` |
| `openwiki/runtime-project-schema.md` | 1 | `project.json` |
| `openwiki/runtime-sessions.md` | 1 | `output/evidence/stardew/stardew-supabase.json` |
| `openwiki/se-catalog.md` | 8 | `.mjs`, `audio-features.json`, `audition.html`, `cross-check.json`, `dist/se-staging/audition.html`, `inventory.json`, `labels.json`, `placed.json` |
| `openwiki/testing.md` | 5 | `../dialogue.css`, `browser-play-start.png`, `browser-title.png`, `event-editor.command-preview/07-identifiable-previews.css`, `output/evidence/horror-mystery-prototype/browser-qa.json` |
| `openwiki/town-tile-benchmark.md` | 1 | `combined-town-chipset-report.html` |

## 페이지별 절 좌표

### `openwiki/PROJECT_WIKI.md` — 9KB · 118줄 · ~2,480 토큰

- `L5` Purpose
- `L16` Required pre-edit read order
- `L54` Project identity
- `L63` Main ownership boundaries
- `L74` How an AI should use this wiki
- `L85` Supabase DB mandatory (see root `AGENTS.md`)
- `L91` Desktop UI integration truth (2026-08-11)
- `L99` Per-project wiki structure
- `L115` Staleness rule

### `openwiki/agent-tile-benchmark.md` — 11KB · 195줄 · ~3,365 토큰

- `L6` town 트랙과 무엇이 다른가
- `L19` 지시서는 생짜다
- `L39` 채점은 픽스처에서 독립한다
  - `L50` 채점 — 결함 밀도
  - `L79` scale
- `L85` 실행
- `L99` 실측 (2026-08-21)
  - `L130` 턴을 더 줘도 haiku 는 나아지지 않았다
  - `L142` 구성 지표는 quality 와 분리한다
  - `L143` quality 는 천장이 있다 — 상위는 구성 지표와 효율로 가른다
  - `L177` 턴 예산이 결과를 지배한다
- `L191` 비용 주의

### `openwiki/agent-worktrees.md` — 13KB · 206줄 · ~4,017 토큰

- `L6` 적용 범위
- `L16` 명령
- `L26` 회수 규칙 (커밋이 유일한 안전망)
  - `L38` 에이전트에게 줄 지시
  - `L75` e2e 는 `DEV_SERVER_PORT` 없이 돌리면 **남의 코드를 검증한다** (실측 2026-08-29)
- `L92` 검증 게이트
  - `L101` 왜 기준선 방식인가
  - `L112` 왜 별도 스크립트인가
- `L121` 백그라운드 워커 (qwencloud / qwen3.8-max-preview)
  - `L151` 감독자 사용법
  - `L156` 프롬프트에 반드시 넣을 것
- `L165` 감독 절차
- `L176` 알려진 함정

### `openwiki/ai-context-compaction.md` — 12KB · 154줄 · ~3,568 토큰

- `L9` 1. 3개 예산·압축 계층의 분리와 실행 순서
  - `L35` 계층별 책임 비교
- `L45` 2. 주요 상수 및 위치
- `L62` 3. 핵심 알고리즘 및 엔진 동작 (`src/ai/contextCompaction.ts`)
  - `L64` 토큰 추정 (`estimateMessageTokens`, `estimateContextTokens`)
  - `L70` 압축 트리거 판정 (`shouldCompact`, `resolveThresholdContextTokens`)
  - `L75` 절단점 탐색 (`findCompactionCutPoint`)
  - `L80` 잔존 꼬리 수리 (`repairRetainedTail`)
  - `L84` 요약 프롬프트 및 요청 구성 (`buildSummarizationRequest`)
- `L93` 4. 세션 통합 및 실패 방어 (`src/ai/assistantSession.ts`)
  - `L95` 호출 위치
  - `L98` 턴당 실패 캡 (`compactionFailedThisTurn`)
  - `L103` 실측 사용량 기록 (`recordPromptUsage`)
  - `L107` 무중단 실패 정책
- `L114` 5. 실측 데이터 (Real-HTTP Proof)
- `L130` 6. 업스트림(Senpi) 대비 설계 및 의도적 차이점
- `L149` 7. 계약 테스트 및 검증 스크립트

### `openwiki/ai-tools-deprecation-roadmap.md` — 3KB · 51줄 · ~953 토큰

- `L5` 현황
- `L17` 왜 지금 당장 지우지 않는가
- `L24` 제거 단계
  - `L26` 1단계 — 호출 계측 (즉시 가능)
  - `L31` 2단계 — 실행 차단 + 안내 오류 (관측 후)
  - `L36` 3단계 — 이름 삭제 (메이저 정리)
- `L41` 개별 판단 메모

### `openwiki/ai-workflow.md` — 14KB · 101줄 · ~3,801 토큰

- `L5` Before changing files
- `L13` While changing files
- `L51` After changing files
- `L58` Tool-calling architecture (human review map)
- `L68` Headless Tool and MCP Access
- `L77` Live editor AI assistant MCP (same UI session)
- `L96` Refreshing the wiki

### `openwiki/architecture.md` — 10KB · 67줄 · ~2,449 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/autotiles.md` — 11KB · 107줄 · ~3,330 토큰

- `L5` 1. RM2K식 3×4 템플릿 블록 문법
- `L21` 2. 지형 앵커 카탈로그 — 4행 밴드 × 열 0/3/6/9 격자
- `L40` 3. 물 계열 — 오토타일 그룹이 아닌 별도 시스템
- `L58` 3-1. 던전 칩셋 절벽(빙암) — 벽은 두 행이다
- `L92` 4. 오토타일 등록 경로 3가지
- `L100` 5. 검증

### `openwiki/bgm-catalog.md` — 8KB · 125줄 · ~1,951 토큰

- `L6` Why this exists
- `L17` Facts an agent needs
- `L39` Files and ownership
- `L55` Regenerating
  - `L65` sha256 caveat
- `L73` CDN wiring
- `L95` How authors reach the tracks
- `L112` Traps

### `openwiki/castle-map.md` — 4KB · 69줄 · ~1,003 토큰

- `L5` Goal
- `L9` Modules (Combined Town)
- `L21` Observed layout recipe (`map_castle_keep` 48×40)
- `L38` Do / don’t
- `L46` Build tool
- `L54` Code owners
- `L64` Validation

### `openwiki/community-site.md` — 8KB · 53줄 · ~2,028 토큰

- `L5` Data
- `L12` Interop contract (do not break)
- `L20` Feature map (v2, 2026-07-21)
- `L28` In-browser play (v3, 2026-07-21)
- `L42` Ops notes
- `L46` Gotchas learned

### `openwiki/cpen-openwiki.md` — 1KB · 30줄 · ~378 토큰

- `L7` Required config
- `L12` Compatibility notes
- `L18` Output limits
- `L24` Practical tips

### `openwiki/editor-ai-panel.md` — 101KB · 230줄 · ~28,628 토큰 · 통째읽기 잘림 · 깨진 줄 14

- `L9` 패널 셸 · 도크 · 접기 · 컴포저
- `L53` 세션 수명 · 대화 컨텍스트
- `L63` 제안 적용 · 복구 · 완성도 린트
- `L89` 고스트 미리보기 · 활동 표시 · 청사진 · 카메라
- `L115` 영역 작업 · 시공 · 실내/집 파이프라인
- `L137` 툴 노출 · 프롬프트 · 의도 판정 · NPC
- `L151` 타일셋 이해 · 검토 위저드 (T1a/T1b)
- `L177` 저장 · 내보내기 · 프로젝트 생성
- `L185` 제공자 · OAuth · 동반 서비스
- `L209` Autonomous run mode (autonomous-ai-rpg, todos 1-6)

### `openwiki/editor-ai-tools.md` — 44KB · 96줄 · ~12,082 토큰 · 깨진 줄 5

- `L74` Project-wide quality evaluation
- `L80` prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)

### `openwiki/editor-database.md` — 106KB · 290줄 · ~29,384 토큰 · 통째읽기 잘림 · 깨진 줄 7

- `L3` Database Studio chrome (2026-08-24)
  - `L15` Actor data-table slice (2026-08-25)
- `L25` P2 낚시·채집·박물관 저작 표면 (2026-08-25)
- `L30` 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)
- `L40` 생활 기술·제작 저작 표면 (2026-08-24)
- `L57` Database Editor
- `L138` Beginner-centric adversarial review (2026-08)
- `L142` DB UI modernization (2026-08)
- `L176` P2 spatial authoring (2026-08-25)
- `L184` '구조물' 탭 — 세 출처 앨범 + 방 종류 문법 (2026-08-28)
- `L197` '구조물' 편집기와 파일 입출력 (2026-08-29)
- `L215` 삭제 가드는 묶음 조건(all/any/not) 안까지 본다 (2026-08-29 실측 결함 수정)
- `L235` '진영' 탭과 몬스터 소속 진영 (2026-08-29)
  - `L249` 몬스터 폼의 소속 진영 (`databaseEnemyRecordView.ts`)
  - `L257` 다 만들어 놓고 못 쓰던 이유 — `[편집]` 이 화면 밖 67px 에 있었다 (2026-08-29 실측)
  - `L269` 편집기를 맵 타일 편집기 수준으로 (2026-08-30 실측)

### `openwiki/editor-event-authoring.md` — 71KB · 311줄 · ~20,123 토큰 · 통째읽기 잘림 · 깨진 줄 16

- `L3` NPC 일정 구조화 편집 (2026-08-24)
- `L19` Roguelike run authoring (2026-08-24)
- `L26` Event Authoring
- `L119` Condition / Loop / Variable command trust fixes (2026-08-07)
- `L129` Event draft trust loop (2026-07-30)
- `L136` Guided story arc facade
- `L140` 지도·화면 효과 탭 초보자 UX (2026-08-27)
- `L145` 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)
- `L153` Companion roster in the command picker (2026-08-27)
- `L159` Presentation and system M2 command bodies
- `L166` 좌측 설정 레일 그룹 소속 (2026-08-27)
- `L184` 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)
- `L194` 「움직임과 속도」 부피 정리 (2026-08-29)
- `L229` 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)
  - `L263` 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다
  - `L274` 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)
  - `L282` 참조를 비워도 조건을 삭제하지 않는다
  - `L289` 조건 미리보기는 모르면 모른다고 말한다
  - `L298` 조건 문구에 내부 토큰을 넣지 마라

### `openwiki/editor-event-command-fixes.md` — 12KB · 33줄 · ~3,078 토큰 · 깨진 줄 11

- `L25` Page 3 canonical fields and staged commits (2026-07-30)
- `L30` Show Picture preview opacity unit (2026-08-29)

### `openwiki/editor-event-commands.md` — 41KB · 91줄 · ~10,855 토큰 · 깨진 줄 6

- `L7` Roguelike run control (2026-08-24)
- `L47` 얼굴 상자(faceset-crop-box) 페인트 계약 (2026-08-28)
- `L78` Staged edit, history, and nested drag invariants (2026-07-30)
- `L85` Command picker, validation, and preview trust (2026-07-30)

### `openwiki/editor-genre-packs.md` — 6KB · 42줄 · ~1,567 토큰

- `L5` Ownership
- `L15` Safe blank-project system-preset flow
- `L21` Vocabulary and readiness
- `L32` Validation

### `openwiki/editor-interior-room-harness.md` — 9KB · 43줄 · ~2,336 토큰

- `L5` Tileset-specific map generation contract
- `L15` Interior Room Session Harness (villager-room-v1)
- `L28` Safe detached draft and approval harness
- `L36` Interior object catalog is the shape source of truth (2026-08-28)

### `openwiki/editor-observability.md` — 22KB · 238줄 · ~6,487 토큰 · 깨진 줄 1

- `L21` 계측 초크포인트는 `store.markLocalMutation` 하나다
- `L51` 새 편집 기능을 추가할 때 — 라벨을 넣어라
- `L70` AI 적용 경로 — 이쪽이 주 경로다
- `L101` 되돌리기 스택과 감사 로그는 다르다
- `L122` 디버깅 레시피
  - `L156` 저장된 것 — DB 커밋에 실린 행위 (`npm run commit:log`)
- `L185` 로거
- `L199` 알려진 남은 공백 (여기 손대는 사람이 이어서 하라)
- `L232` 검증

### `openwiki/editor-pre-edit-routing.md` — 54KB · 134줄 · ~15,159 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L7` Pre-edit routing
- `L62` Agent cautions
- `L72` 헤더 용어 정본과 중복 감사 (2026-08-30)
  - `L103` 톱바 영역 진입점 감사표 (`renderTopbar` 실측)

### `openwiki/editor-storage-chest.md` — 1KB · 15줄 · ~333 토큰

- `L5` Storage chest authoring

### `openwiki/editor-validation.md` — 24KB · 95줄 · ~6,358 토큰

- `L3` 이벤트 초안 검증 표면 (2026-08-28)
- `L8` event-unreachable lint rule (2026-08-27)
- `L12` P2 생활 시스템 무결성 (2026-08-25)
- `L17` 생활 저작 표면 집중 검증 (2026-08-24)
- `L33` AI editor-wide tool validation (2026-08-25)
- `L39` Roguelike run validation (2026-08-24)
- `L46` Validation Expectations
- `L70` Desktop UI integration matrix (2026-08-11)
- `L80` Event editor aggregate gate (2026-07-30)
- `L89` P2 spatial integrity (2026-08-25)

### `openwiki/editor-workflows-misc.md` — 17KB · 41줄 · ~4,341 토큰

- `L7` Other Editor Workflows
  - `L10` Genre-neutral authoring launcher and journey (2026-08-24)

### `openwiki/editor-workflows.md` — 2KB · 28줄 · ~586 토큰

- `L5` Topic pages
- `L17` Quick routing
- `L25` For AI agents

### `openwiki/interior-tile-benchmark.md` — 9KB · 149줄 · ~2,679 토큰

- `L11` 왜 interior 를 정답지로 쓰는가
- `L27` 재현성 설계 — 3층
- `L44` 채점 방안 6종
- `L68` 헤드라인 지표 — wallAny vs houseShellWall
- `L80` 태스크 12종
- `L87` 정답 카테고리 파생 (`groundTruth.ts`)
  - `L97` 함정 두 개 (실측으로 발견, 재발 방지용 기록)
- `L115` 실행
- `L135` 안티-게이밍 규칙
- `L145` 이 페이지를 갱신해야 하는 변경

### `openwiki/large-village-generation.md` — 11KB · 333줄 · ~3,241 토큰

- `L9` 한 줄 요약
- `L20` 관련 파일
- `L39` 전체 그림
- `L57` 단계별 설명
  - `L59` 0단계 — 자리 잡기 (`planLargeVillageBboxes`)
  - `L89` 1단계 — 맵 생성
  - `L97` 2단계 — 물
  - `L108` 3단계 — 집 (다양화)
  - `L123` 4단계 — 구불구불 길
  - `L139` 5단계 — 광장 + 시장 하네스
  - `L150` 6단계 — 울타리 + 마당 (집과 별 개념)
  - `L173` 7단계 — 나무·마을 소품
  - `L185` 8단계 — NPC
  - `L195` 9단계 — QA (품질 게이트)
  - `L218` 10단계 — 저장
- `L229` 데이터 개념 3개만 기억하기
- `L248` 예전에 자주 깨지던 이유 (로직 이슈)
- `L261` 로그 읽는 법
- `L281` 다시 만들 때
- `L297` 고칠 때 어디를 만지나
- `L311` 아직 약한 부분 (솔직히)
- `L328` 관련 위키

### `openwiki/quickstart.md` — 11KB · 124줄 · ~3,393 토큰

- `L6` 0. 여기서 에이전트가 실제로 헤매는 이유 (실측 2026-08-30)
- `L17` 1. 환경 — 여기가 틀리면 이후 전부 헛수고
- `L42` 2. 검증 — 무엇이 진짜 게이트인가
- `L62` 3. 어디를 고치나 — 기능 → 진입 파일
- `L106` 4. 위키를 읽는 법
- `L118` 5. 끝났다고 말할 수 있는 조건

### `openwiki/runtime-action-combat.md` — 22KB · 229줄 · ~5,617 토큰

- `L7` Activation contract
- `L28` Architecture and pure rule modules
  - `L48` Rule module responsibilities
- `L77` Scene integration layer
- `L94` Schema definitions and clamps
  - `L98` `SystemActionCombat` (`project.system.actionCombat`)
  - `L110` `EnemyActionProfile` (`EnemyRecord.actionProfile`)
  - `L124` `ActionWeaponProfile` (`EquipmentRecord.actionWeapon`)
  - `L129` `ActionSkillProfile` (`SkillRecord.actionSkill`)
- `L136` HUD presentation
- `L142` Design decision: Tile-grid movement vs pixel movement
- `L152` Factions and NPC-vs-NPC combat
  - `L156` Data flow
  - `L160` Runtime stance overlay and its save rule
  - `L166` Pure rule module
  - `L174` Scene behaviour
  - `L186` Bounding the simulation
- `L190` Out of scope / deliberately unsupported
- `L196` Verification and test coverage
  - `L198` Pure rule unit tests
  - `L225` E2E browser specifications

### `openwiki/runtime-and-data.md` — 3KB · 27줄 · ~733 토큰

- `L5` Topic pages
- `L15` Quick routing
- `L24` For AI agents

### `openwiki/runtime-battle.md` — 71KB · 182줄 · ~19,610 토큰 · 통째읽기 잘림

- `L7` 지원 전투 시스템은 둘뿐이다 (2026-08-28)
- `L18` Roguelike run boundary (2026-08-24)
- `L23` Battle rules & runtime
  - `L38` 전투 화면 표현 · 전환 · 타임라인 · 연출 타이밍
  - `L53` 커맨드/대상 메뉴 기하와 글자 가시성 계약
  - `L69` 스킨 CSS 캐스케이드와 저작 가능 스킨
  - `L73` Gen 1(포켓몬식) 규칙 모델
  - `L81` 플레이 모드 런타임 (이 절에 섞여 있는 비전투 항목)
  - `L98` 전투 흐름 · 몬스터 수집 · 트룹 이벤트 · 보상
- `L133` Starter hero battle sheets (2026-08-29)
- `L154` Per-actor back battlers (2026-08-29)
- `L172` Battle input and visibility P0 contract (2026-07-30)

### `openwiki/runtime-m2-flow-controls.md` — 12KB · 44줄 · ~3,162 토큰

- `L5` M2 Runtime Flow Controls
- `L35` Storage chest authoring
- `L41` Page 3 location/vehicle compatibility (2026-07-30)

### `openwiki/runtime-pre-edit-routing.md` — 16KB · 88줄 · ~4,690 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/runtime-project-schema.md` — 43KB · 107줄 · ~11,275 토큰

- `L5` 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)
- `L13` Project schema & persistence
- `L73` Variable arithmetic & loop runtime (2026-08-07)
- `L77` Canonical event-draft projection (2026-07-30)
- `L83` P2 general buildings and home decorations (2026-08-25)
- `L90` 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)

### `openwiki/runtime-sessions.md` — 54KB · 118줄 · ~14,165 토큰 · 통째읽기 잘림

- `L5` Roguelike run kernel and field rooms (Phase 0–3, 2026-08-24)
- `L15` P1 daily-weather transition authority (2026-08-25)
- `L24` Session state & life-sim
- `L96` Editorial title screen (2026-08-26)
- `L102` playerTouch trigger contract (2026-08-20)
- `L106` Selected-event runtime sandbox (2026-07-30)
- `L112` P2 spatial runtime and saves (2026-08-25)

### `openwiki/se-catalog.md` — 13KB · 228줄 · ~3,423 토큰

- `L6` Why this exists
- `L22` Facts an agent needs
- `L37` Files and ownership
- `L57` Regenerating
  - `L69` Why these are python, not `.mjs`
  - `L76` Kenney download URLs rotate
- `L82` Categories
- `L103` Triple cross-check: which sounds actually need human ears
  - `L130` What it measured (2026-08-23, original 456 only, both reviewers covering all 16 sheets)
  - `L154` The output
  - `L166` Traps
- `L175` The labels are provisional — and why
- `L198` How authors reach the sounds
- `L213` Traps

### `openwiki/stardew-core-elements-research.md` — 8KB · 137줄 · ~2,167 토큰

- `L7` Primary finding
- `L19` Evidence-backed pillars
  - `L21` 1. Day, energy, and overnight settlement
  - `L27` 2. Calendar, seasons, and weather
  - `L33` 3. Farming, animals, and processing economy
  - `L39` 4. Town life and relationships
  - `L45` 5. Parallel activity loops
  - `L52` 6. Long-term goals and completion surfaces
  - `L60` 7. Personal ownership
- `L65` Editor information architecture implication
- `L84` Delivery priority
  - `L86` P1: make the world feel alive
  - `L95` P2: make daily choices converge on goals
- `L106` Implementation invariants
- `L117` Sources

### `openwiki/state-system.md` — 12KB · 128줄 · ~3,188 토큰 · 깨진 줄 2

- `L5` TL;DR (use this when explaining to a user)
- `L13` Layers and ownership
- `L23` StateRecord fields (authored)
- `L51` StateOntology (engine default template)
- `L76` Default seed (new projects)
- `L80` Editor surface
- `L90` Runtime application
- `L101` Common confusion points
- `L110` Files to inspect before editing
- `L122` Related pages

### `openwiki/testing.md` — 89KB · 540줄 · ~24,874 토큰 · 통째읽기 잘림

- `L3` P2 낚시·채집·도감·박물관 focused gate (2026-08-25)
- `L10` AI 이벤트 배치 통행성 focused gate (2026-08-30)
- `L18` 체공(점프·낙하) focused gate (2026-08-29)
  - `L27` 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`
  - `L57` 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)
- `L120` Roguelike run Phase 0–3 coverage (2026-08-24)
  - `L131` 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)
- `L140` Agent validation rule
- `L241` Event-editor trust-loop validation (2026-07-30)
- `L246` 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)
- `L265` P2 spatial focused gate (2026-08-25)
- `L274` 대화창 연출 focused gate (2026-08-30)
- `L336` 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)
  - `L349` `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)
  - `L361` 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)
  - `L369` 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)
  - `L376` `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)
- `L398` 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)
- `L500` sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)
- `L507` fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)
- `L528` bugfix-sweep 실제 표면 하네스 (2026-08-29)

### `openwiki/town-tile-benchmark.md` — 10KB · 153줄 · ~2,946 토큰

- `L15` 9문항 = 9숫자
- `L34` 정답은 손으로 쓰지 않는다
- `L55` 팔레트는 주고 배치를 측정한다
- `L73` 재현성 설계 — 3층
- `L87` 정본 일치를 점수에 넣는 문항 / 넣지 않는 문항
- `L102` 채점기가 지키는 두 가지 불변식
- `L111` 실행
- `L125` 감독용 보고서
- `L140` 증거 시트
- `L147` 비용
