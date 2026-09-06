<!-- 생성 파일 — 직접 고치지 말고 `npm run openwiki:index` 를 돌려라. -->
# OpenWiki 항해 색인

이 저장소의 위키는 **48쪽 / 1694KB / 약 482,427 토큰** 이다. 통째로 읽을 수 있는 크기가 아니므로, 필요한 절만 좌표로 잘라 읽어라.

```
read("openwiki/editor-database.md", offset=<절 시작줄>, limit=120)
grep -n "찾는말" openwiki/*.md          # 어느 페이지 몇 줄인지부터 찾는다
```

## 통째 읽기가 잘리는 페이지 (도구 상한 50KB)

이 페이지를 `read` 로 한 번에 열면 **조용히 잘린 채** 전달된다. 아래 절 목록의 줄 번호로 잘라 읽어라.
「가장 큰 절」이 상한 아래면 절 단위 읽기로 페이지 전부에 닿을 수 있다.

| 페이지 | 통짜 크기 | 가장 큰 절 | 줄 | 토큰 추정 |
|---|---|---|---|---|
| `openwiki/editor-ai-panel.md` | 268KB | 95KB ⚠상한 초과 — 절을 더 쪼개라 | 521 | ~77,917 |
| `openwiki/editor-ai-tools.md` | 99KB | 69KB ⚠상한 초과 — 절을 더 쪼개라 | 419 | ~28,366 |
| `openwiki/editor-database.md` | 234KB | 54KB ⚠상한 초과 — 절을 더 쪼개라 | 1138 | ~67,421 |
| `openwiki/editor-event-authoring.md` | 119KB | 74KB ⚠상한 초과 — 절을 더 쪼개라 | 564 | ~34,648 |
| `openwiki/editor-pre-edit-routing.md` | 72KB | 55KB ⚠상한 초과 — 절을 더 쪼개라 | 210 | ~20,571 |
| `openwiki/runtime-battle.md` | 119KB | 31KB | 362 | ~34,124 |
| `openwiki/runtime-project-schema.md` | 67KB | 42KB | 300 | ~18,306 |
| `openwiki/runtime-sessions.md` | 60KB | 45KB | 168 | ~16,122 |
| `openwiki/testing.md` | 122KB | 45KB | 892 | ~34,118 |

## 한국어 산문이 깨진 페이지

EUC-KR→UTF-8 모지바케가 남은 줄이다. **그 줄의 한국어는 믿지 말고** 같은 줄의 파일 경로·식별자만 쓰고, 의미는 해당 소스 파일에서 직접 확인하라. 복원은 불가능하다(원본 바이트가 소실).

| 페이지 | 깨진 줄 수 | 예시 줄 번호 |
|---|---|---|
| `openwiki/editor-ai-panel.md` | 25 | 248, 249, 250, 251, 252, 253, 265, 274 |
| `openwiki/editor-ai-tools.md` | 6 | 271, 272, 276, 278, 280, 342 |
| `openwiki/editor-database.md` | 7 | 349, 353, 354, 355, 364, 389, 392 |
| `openwiki/editor-event-authoring.md` | 16 | 151, 152, 155, 160, 161, 162, 163, 164 |
| `openwiki/editor-event-command-fixes.md` | 11 | 11, 12, 14, 15, 16, 17, 18, 19 |
| `openwiki/editor-event-commands.md` | 6 | 26, 39, 40, 42, 45, 46 |
| `openwiki/editor-observability.md` | 1 | 120 |
| `openwiki/editor-pre-edit-routing.md` | 5 | 42, 51, 57, 59, 72 |
| `openwiki/state-system.md` | 2 | 3, 84 |

## 없는 파일을 가리키는 참조

문서가 이름을 부르는데 저장소에 없는 파일이다. 대부분은 **의도적으로 삭제된 모듈** 을 기록으로 남긴 것이지만(그 경우 문단이 삭제 사실을 말한다), 살아 있는 안내처럼 읽히면 에이전트가 없는 파일을 찾아 헤맨다. 문서를 고칠 때 이 목록이 줄어드는지 보라.

| 페이지 | 건수 | 참조 |
|---|---|---|
| `openwiki/agent-worktrees.md` | 2 | `result.md`, `task.json` |
| `openwiki/ai-workflow.md` | 4 | `index.json`, `latest.json`, `src/ai/plannerSkip.ts`, `test/volumeContractSession.test.ts` |
| `openwiki/architecture.md` | 1 | `project.json` |
| `openwiki/bgm-catalog.md` | 1 | `catalog.raw.json` |
| `openwiki/community-site.md` | 1 | `project.json` |
| `openwiki/editor-ai-panel.md` | 34 | `.omo/evidence/assistant-glass-fold/measure.json`, `.omo/evidence/autonomous-ai-rpg/task-8-autonomous-ai-rpg.md`, `15-assistant-readable.css`, `17-assistant-modern-shell.css`, `after/measure.json`, `aiCommandBar.ts`, `aiGlassPanelWidth.test.ts`, `aiSkillDrawer.ts`, `aiVolatileController.ts`, `assistant-skills.css`, `chat-dock-switch.spec.ts`, `chatDock.ts`, `intentClarify.ts`, `newmain-after-measure.json`, `output/evidence/assistant-clean-glass/phase-2/implementation.md`, `output/evidence/assistant-ui-modern/newmain-before-measure.json`, `project.json`, `regionIntentRouter.ts`, `scripts/qa/assistant-side-seam-hittest.mjs`, `src/ai/intentClarify.ts`, `src/ai/plannerSkip.ts`, `src/ai/skills.ts`, `src/editor/chatDock.ts`, `test/aiGlassFold.test.ts`, `test/aiGlassPanelWidth.test.ts`, `test/chatDock.test.ts`, `test/e2e/_assistant-glass-shots.spec.ts`, `test/e2e/_glass-dock-report.spec.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/plannerSkip.test.ts`, `test/regionIntentExposure.test.ts`, `test/turnGuideSharedRules.test.ts`, `test/volumeContractSession.test.ts`, `test/workspaceBarAssistantDock.test.ts` |
| `openwiki/editor-ai-tools.md` | 4 | `aiCommandBar.ts`, `aiProposalModal.ts`, `test/intentClarify.test.ts`, `test/volumeContractSession.test.ts` |
| `openwiki/editor-database.md` | 18 | `enemy-art-NNN.png`, `form-hierarchy-modern.css`, `output/evidence/battle-animation-ux/p1-implementation.md`, `output/evidence/battle-animation-ux/p2-implementation.md`, `output/evidence/battle-rules-ux/st_01a07318-manual-qa.md`, `output/evidence/battle-rules-ux/verification.md`, `output/evidence/concept-expansion/supabase-proof.json`, `output/evidence/concept-v2/supabase-proof.json`, `output/evidence/monster-concepts/b1/fix.md`, `output/evidence/monster-concepts/p2/verification.md`, `output/evidence/monster-concepts/r1/fix.md`, `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`, `reports/generated-effect-showcase-2026-08-24.html`, `reveal-fix.md`, `scripts/generate-default-item-icons.mts`, `scripts/lib/effectSheet/paintersMonster.mjs`, `scripts/lib/effectSheet/paintersUtility.mjs`, `troops.part-1.css` |
| `openwiki/editor-event-authoring.md` | 6 | `audit-before.md`, `new-editor/REPORT.html`, `output/evidence/event-ai-assist-ux/960x900-compact.png`, `scripts/generated/toolCatalog.json`, `verify-shots/page-preview-probe/02-preview-open.png`, `verify-shots/runtime-qa/cheolsu-keyboard-fixed/SUMMARY.md` |
| `openwiki/editor-event-commands.md` | 7 | `07-identifiable-previews.css`, `choicesDialog.ts`, `command-preview.css`, `event-editor.part-2/3.css`, `messageCommandDialogs.ts`, `messageDialogControls.ts`, `textCommandDialog.ts` |
| `openwiki/editor-interior-room-harness.md` | 7 | `hearth-lit.json`, `hearth-unlit.json`, `output/evidence/concept-v2/index.html`, `output/evidence/inn-exploration-v4/index.html`, `output/evidence/inn-inspection-v5/index.html`, `output/evidence/pr618-fixtures/inn.json`, `player/SUMMARY.md` |
| `openwiki/editor-pre-edit-routing.md` | 8 | `authoringTestGate.ts`, `dbConnectionAdvancedSettings.ts`, `figma-editor/10-map-tree.css`, `rm2k3.part-1.css`, `shell/editor-responsive-expert.css`, `src/editor/tools/worldTools.ts`, `surface.json`, `worldTools.ts` |
| `openwiki/editor-validation.md` | 2 | `final-layout.json`, `viewport-matrix.json` |
| `openwiki/editor-workflows-misc.md` | 1 | `src/editor/authoringTestGate.ts` |
| `openwiki/growth-trees.md` | 1 | `verify-shots/runtime-qa/growth-tree/SUMMARY.md` |
| `openwiki/horror-authoring.md` | 1 | `motion-sheet.png` |
| `openwiki/large-village-generation.md` | 2 | `HANDOFF.json`, `src/project/defaults/largeRiverMarketVillageBuild.ts` |
| `openwiki/night-monster.md` | 1 | `verify-shots/runtime-qa/night-monster/SUMMARY.md` |
| `openwiki/runtime-battle.md` | 4 | `hero-03-battle-idle.png`, `raw.png`, `reference.png`, `starter/hires/hero-0N-battle.png` |
| `openwiki/runtime-pre-edit-routing.md` | 1 | `verify-shots/runtime-qa/emote/SUMMARY.md` |
| `openwiki/runtime-project-schema.md` | 2 | `.json`, `project.json` |
| `openwiki/runtime-sessions.md` | 1 | `output/evidence/stardew/stardew-supabase.json` |
| `openwiki/se-catalog.md` | 8 | `.mjs`, `audio-features.json`, `audition.html`, `cross-check.json`, `dist/se-staging/audition.html`, `inventory.json`, `labels.json`, `placed.json` |
| `openwiki/testing.md` | 12 | `../dialogue.css`, `browser-play-start.png`, `browser-title.png`, `event-editor.command-preview/07-identifiable-previews.css`, `output/evidence/concept-expansion/README.md`, `output/evidence/concept-v2/validation.json`, `output/evidence/horror-mystery-prototype/browser-qa.json`, `supabase-proof-first-save.json`, `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/dialogue-nameplate-clears-body.spec.ts`, `verify-shots/runtime-qa/esc-menu/SUMMARY.md`, `verify-shots/runtime-qa/status-menu-adversarial/SUMMARY.md` |
| `openwiki/town-tile-benchmark.md` | 1 | `combined-town-chipset-report.html` |
| `openwiki/village-design.md` | 1 | `output/village-direction/index.html` |
| `openwiki/world-structure-authoring.md` | 1 | `verify-shots/runtime-qa/world-structure-tools/SUMMARY.md` |

## 페이지별 절 좌표

### `openwiki/PROJECT_WIKI.md` — 10KB · 120줄 · ~2,531 토큰

- `L5` Purpose
- `L16` Required pre-edit read order
- `L56` Project identity
- `L65` Main ownership boundaries
- `L76` How an AI should use this wiki
- `L87` Supabase DB mandatory (see root `AGENTS.md`)
- `L93` Desktop UI integration truth (2026-08-11)
- `L101` Per-project wiki structure
- `L117` Staleness rule

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

### `openwiki/agent-worktrees.md` — 14KB · 218줄 · ~4,354 토큰

- `L6` 적용 범위
- `L16` 명령
- `L26` 회수 규칙 (커밋이 유일한 안전망)
  - `L38` 에이전트에게 줄 지시
  - `L75` e2e 는 `DEV_SERVER_PORT` 없이 돌리면 **남의 코드를 검증한다** (실측 2026-08-29)
- `L92` 검증 게이트
  - `L94` 통합 작업의 검증 대상 고정 (2026-09-06)
  - `L113` 왜 기준선 방식인가
  - `L124` 왜 별도 스크립트인가
- `L133` 백그라운드 워커 (qwencloud / qwen3.8-max-preview)
  - `L163` 감독자 사용법
  - `L168` 프롬프트에 반드시 넣을 것
- `L177` 감독 절차
- `L188` 알려진 함정

### `openwiki/ai-context-compaction.md` — 13KB · 159줄 · ~3,986 토큰

- `L9` 1. 3개 예산·압축 계층의 분리와 실행 순서
  - `L35` 계층별 책임 비교
- `L45` 2. 주요 상수 및 위치
- `L64` 3. 핵심 알고리즘 및 엔진 동작 (`src/ai/contextCompaction.ts`)
  - `L66` 토큰 추정 (`estimateMessageTokens`, `estimateContextTokens`)
  - `L72` 압축 트리거 판정 (`shouldCompact`, `resolveThresholdContextTokens`)
  - `L80` 절단점 탐색 (`findCompactionCutPoint`)
  - `L85` 잔존 꼬리 수리 (`repairRetainedTail`)
  - `L89` 요약 프롬프트 및 요청 구성 (`buildSummarizationRequest`)
- `L98` 4. 세션 통합 및 실패 방어 (`src/ai/assistantSession.ts`)
  - `L100` 호출 위치
  - `L103` 턴당 실패 캡 (`compactionFailedThisTurn`)
  - `L108` 실측 사용량 기록 (`recordPromptUsage`)
  - `L112` 무중단 실패 정책
- `L119` 5. 실측 데이터 (Real-HTTP Proof)
- `L135` 6. 업스트림(Senpi) 대비 설계 및 의도적 차이점
- `L154` 7. 계약 테스트 및 검증 스크립트

### `openwiki/ai-tools-deprecation-roadmap.md` — 4KB · 55줄 · ~1,066 토큰

- `L5` 현황 (2026-09-04 갱신)
- `L21` 왜 지금 당장 지우지 않는가
- `L28` 제거 단계
  - `L30` 1단계 — 호출 계측 (즉시 가능)
  - `L35` 2단계 — 실행 차단 + 안내 오류 (관측 후)
  - `L40` 3단계 — 이름 삭제 (메이저 정리)
- `L45` 개별 판단 메모

### `openwiki/ai-workflow.md` — 19KB · 108줄 · ~5,306 토큰

- `L5` Before changing files
- `L13` While changing files
- `L58` After changing files
- `L65` Tool-calling architecture (human review map)
- `L75` Headless Tool and MCP Access
- `L84` Live editor AI assistant MCP (same UI session)
- `L103` Refreshing the wiki

### `openwiki/architecture.md` — 10KB · 67줄 · ~2,449 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/autotiles.md` — 13KB · 139줄 · ~3,942 토큰

- `L3` World 지형과 공통 구조물
- `L23` 1. RM2K식 3×4 템플릿 블록 문법
- `L39` 2. 지형 앵커 카탈로그 — 4행 밴드 × 열 0/3/6/9 격자
- `L58` 3. 물 계열 — 오토타일 그룹이 아닌 별도 시스템
- `L76` 3-1. 던전 칩셋 절벽(빙암) — 벽은 두 행이다
- `L110` 4. 오토타일 등록 경로 3가지
- `L118` Integrated World snapshot (2026-09-06)
- `L132` 5. 검증

### `openwiki/battler-idle-playbook.md` — 11KB · 176줄 · ~3,490 토큰

- `L10` 런타임 코드는 건드릴 일이 거의 없다
- `L20` 순서
  - `L22` 1. 표시 상자를 먼저 실측한다 (셀 종횡비가 여기서 나온다)
  - `L34` 2. 클립을 만든다 (프롬프트에 긍정 제약까지 넣는다)
  - `L53` 3. 창을 탐색한다 (눈으로 고르지 마라)
  - `L70` 4. 패킹한다
  - `L85` 5. 카탈로그에 등록한다
  - `L90` 6. 검증한다
- `L101` 네 계약 — 넷 다 상대값이다
  - `L114` 상한은 불량 쪽에서 정한다
  - `L122` 머리 계약은 얼굴 검출기가 아니다
- `L131` 함정 목록
- `L161` 실린 자산의 실측값

### `openwiki/bgm-catalog.md` — 10KB · 156줄 · ~2,444 토큰

- `L6` Why this exists
- `L17` Facts an agent needs
- `L39` Files and ownership
- `L55` Regenerating
  - `L65` sha256 caveat
- `L73` CDN wiring
- `L95` How authors reach the tracks
- `L112` Project audio descriptions
- `L143` Traps

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

### `openwiki/editor-ai-panel.md` — 268KB · 521줄 · ~77,917 토큰 · 통째읽기 잘림 · 깨진 줄 25

- `L3` 브라우저 포커스와 도구 실행 대기 (2026-09-05)
- `L10` 계획 항목의 연속 실행 증거 (2026-09-05)
- `L16` 조회 선행·계획 완료와 실행 종료 (2026-09-05)
- `L25` 조수 카메라 이동 수명·부드러운 줌 (2026-09-05)
- `L41` 패널 셸 · 도크 · 접기 · 컴포저
- `L179` 세션 수명 · 대화 컨텍스트
- `L194` 제안 적용 · 복구 · 완성도 린트
- `L278` 고스트 미리보기 · 활동 표시 · 청사진 · 카메라
- `L340` 영역 작업 · 시공 · 실내/집 파이프라인
- `L364` 툴 노출 · 프롬프트 · 의도 판정 · NPC
- `L378` 타일셋 이해 · 검토 위저드 (T1a/T1b)
- `L404` 저장 · 내보내기 · 프로젝트 생성
- `L412` 제공자 · OAuth · 동반 서비스
- `L442` Autonomous run mode (autonomous-ai-rpg, todos 1-6)
- `L476` 분리 브랜치 마일스톤 회계 복구 (2026-09-05)
- `L480` 모험 완료와 실제 적용 횟수 (2026-09-05)
- `L485` Assistant clean conversation — Phase 1 (2026-09-06)

### `openwiki/editor-ai-tools.md` — 99KB · 419줄 · ~28,366 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L3` Audio description tools and event candidates
  - `L23` Search pages and full detail
  - `L37` Event prompt projection is not ID authority
- `L66` Completed-house transaction protection - Phase 1 (2026-09-05)
- `L140` Completed-house construction protection - Phase 2 (2026-09-06)
- `L179` 퀘스트 입력과 완주 증거 계약 (2026-09-05)
- `L189` DB 조회 페이지와 마을 전체 범위 (2026-09-05)
- `L296` Project-wide quality evaluation
- `L304` prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)
- `L340` NPC 대사는 코드가 지어내지 않는다 — 캐스트 라이터 계약 (2026-09-03)
- `L371` 「이 세계」 캐논은 문장 3채널에 강제된다 (2026-09-04)
- `L386` 마을 설계서 (2026-09-05)
- `L390` 저수준 이벤트 입력은 명령 위치를 검증한다 (2026-09-05)
- `L397` 보물상자는 노출된 수면을 거부한다 (2026-09-05)
- `L404` 모험 저작 완료와 재시도 (2026-09-05)

### `openwiki/editor-database.md` — 234KB · 1138줄 · ~67,421 토큰 · 통째읽기 잘림 · 깨진 줄 7

- `L1` 전투 명령 배치 스튜디오 (2026-09-05)
- `L18` Concept navigation integration (2026-09-06)
- `L30` System settings workspace (2026-09-06)
- `L91` Graphic 칩 사용자 교정 29건 (2026-09-05)
- `L107` Custom equipment slot authoring (2026-09-05)
- `L115` 통합 아이템·장비 카탈로그 (2026-09-05)
- `L123` 아이템·장비 저작 신뢰성 (2026-09-05)
- `L134` 전투 몬스터와 포획·성장 종족 (Phase 1)
  - `L143` 종족 검색과 관련 레코드 노출 (Phase 2)
- `L153` 몬스터 작업실 — 미리보기 · 행동 · 속성 (2026-09-05)
  - `L178` Monster action input trust (Phase 1, 2026-09-05)
  - `L187` Monster numeric caption activation (Phase 2, 2026-09-05)
  - `L194` Monster nested dialog focus (Phase 2, 2026-09-05)
- `L200` 몬스터 그룹 저작 신뢰성 (2026-09-05)
- `L215` Database Studio chrome (2026-08-24)
  - `L229` Actor data-table slice (2026-08-25)
- `L239` 세계관 그룹 — 세계 개요 · 설정집 (2026-09-06)
  - `L256` 세계관 입력 보존·설정집 저장 계약 (2026-09-05)
- `L268` '생성 규칙' 탭 — AI 마을 생성의 물·숲·길 (2026-08-30)
- `L276` P2 낚시·채집·박물관 저작 표면 (2026-08-25)
- `L281` 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)
- `L291` 생활 기술·제작 저작 표면 (2026-08-24)
- `L308` Database Editor
- `L397` Beginner-centric adversarial review (2026-08)
- `L401` DB UI modernization (2026-08)
- `L437` P2 spatial authoring (2026-08-25)
- `L445` 맵 그룹 — 개념 우선 탐색 Phase 1 (2026-09-05)
- `L467` 오토타일 설정 — 9칸/11칸/커스텀 카드 (2026-09-01)
- `L488` 공간 종류와 구조물은 다른 면이다 (2026-09-01)
- `L507` 맵 → 개념 꾸러미 (2026-09-02 시작, 2026-09-05 개념 우선 Phase 1)
- `L538` '구조물' 탭 — 두 출처 앨범 + 방 종류 문법 (2026-08-28)
- `L550` '구조물' 편집기와 파일 입출력 (2026-08-29)
- `L569` 삭제 가드는 묶음 조건(all/any/not) 안까지 본다 (2026-08-29 실측 결함 수정)
- `L589` '진영' 탭과 몬스터 소속 진영 (2026-08-29)
  - `L604` 몬스터 폼의 소속 진영 (`databaseEnemyRecordView.ts`)
  - `L612` 다 만들어 놓고 못 쓰던 이유 — `[편집]` 이 화면 밖 67px 에 있었다 (2026-08-29 실측)
  - `L624` 구조물 어휘 — 역할·레이어·테마·증분 축·칸 힌트 (2026-08-30)
  - `L675` 편집기를 맵 타일 편집기 수준으로 (2026-08-30 실측)
- `L697` Battle-animation editor autoplay (2026-09-05)
- `L704` 스킬 탭 `연출` 카드 = 살아 있는 애니메이션 스테이지 (2026-08-30)
- `L715` 데이터베이스 30탭 UI/UX 계약 (2026-08-30 실측)
  - `L730` 헤더는 설명문이 아니라 아이콘 칩 한 줄이다
  - `L808` 숫자 입력은 스테퍼를 먼저 붙이고 그다음 스피너를 지운다
  - `L822` 줄상자 바닥은 1.35 다 (1.25 는 큰 한글 제목에서 깎인다)
  - `L865` 이미지 실패는 빈 상자가 아니라 라벨 붙은 자리표시자다
- `L874` '마을' 탭 — 마을 하네스 값을 사람이 저작한다 (2026-08-30)
  - `L890` 붓을 고르면 화면이 흔들렸다 — 재부모가 스크롤·포커스를 지운다 (2026-08-30 실측)
- `L933` '마을' 탭 — 숫자칸을 그림으로 바꾼다 (2026-08-31)
  - `L949` AI로 몬스터·아이템 생성 (2026-08-30)
  - `L970` AI 어시스턴트 바 — 진행·결과가 바 안에 보인다 (2026-09-03)
  - `L1004` AI로 몬스터·아이템 생성 — 대화상자 재작성 (2026-09-03)
- `L1020` Database Studio v2 — 30탭 셸·폼 문법 통일 (2026-09-03)
- `L1097` 직업 승급 트리 · 스킬 트리 (2026-09-05)
- `L1103` 미회수 편집 후속 통합 (2026-09-05)
- `L1107` 마을 설계서 (2026-09-05)
- `L1112` 구조물 증분 메타 정정 (2026-09-05)
- `L1120` 개념 회수 UI 직접 렌더 QA (2026-09-05)
- `L1124` Battle-animation preview-first graphic controls (Phase 2, 2026-09-05)
- `L1131` 검토한 실내 기본값의 원격 반영 (2026-09-05)
- `L1135` 특정 꾸러미의 명시적 교체 (2026-09-06)

### `openwiki/editor-event-authoring.md` — 119KB · 564줄 · ~34,648 토큰 · 통째읽기 잘림 · 깨진 줄 16

- `L3` 이벤트 편집기 가독성 — 읽는 글자와 꾸미는 글자 (2026-09-03 후속)
- `L16` 이벤트 편집기 문법 고정 — P0 (2026-09-03)
- `L29` NPC 일정 구조화 편집 (2026-08-24)
- `L41` AI 가 이벤트 페이지를 이해하지 못했다 (2026-08-30 실측 · 수정)
  - `L63` 우선순위는 1페이지가 아니다 (바꾸지 않았다)
  - `L71` 랜덤 대사는 페이지가 아니다
  - `L78` 새 린트가 출하 콘텐츠에서 실제로 잡은 것 (skyStair autoEvent)
  - `L88` 조건만 걸고 켜지 않으면 그것도 죽은 페이지다 (가려짐의 거울상)
- `L105` 복잡한 NPC 는 조회 후 상태별 다중 페이지로 저작한다 (2026-09-01)
- `L135` Roguelike run authoring (2026-08-24)
- `L142` Event Authoring
- `L357` Condition / Loop / Variable command trust fixes (2026-08-07)
- `L367` Event draft trust loop (2026-07-30)
- `L375` 회상 오프닝 저작 — beat 컴파일러다 (2026-09-03)
- `L384` Guided story arc facade
- `L388` 지도·화면 효과 탭 초보자 UX (2026-08-27)
- `L393` 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)
- `L401` Companion roster in the command picker (2026-08-27)
- `L407` Presentation and system M2 command bodies
- `L414` 좌측 설정 레일 그룹 소속 (2026-08-27)
- `L432` 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)
- `L442` 「움직임과 속도」 부피 정리 (2026-08-29)
- `L477` 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)
  - `L511` 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다
  - `L522` 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)
  - `L530` 참조를 비워도 조건을 삭제하지 않는다
  - `L537` 조건 미리보기는 모르면 모른다고 말한다
  - `L546` 조건 문구에 내부 토큰을 넣지 마라
- `L561` 공포 게임 제작 기능 (2026-09-05)

### `openwiki/editor-event-command-fixes.md` — 13KB · 38줄 · ~3,273 토큰 · 깨진 줄 11

- `L25` Page 3 canonical fields and staged commits (2026-07-30)
- `L30` Show Picture preview opacity unit (2026-08-29)
- `L35` 조명 백분율 입력 복구 (2026-09-05)

### `openwiki/editor-event-commands.md` — 44KB · 117줄 · ~11,906 토큰 · 깨진 줄 6

- `L7` 상점: 진열 상품과 상품 상세 중심 편집 (2026-09-05)
- `L18` Roguelike run control (2026-08-24)
- `L58` 얼굴 상자(faceset-crop-box) 페인트 계약 (2026-08-28)
- `L89` Staged edit, history, and nested drag invariants (2026-07-30)
- `L96` Command picker, validation, and preview trust (2026-07-30)
- `L103` 회상 스틸과 AI 그림 (2026-09-03)
- `L114` Recovered native emote command (2026-09-05)

### `openwiki/editor-genre-packs.md` — 7KB · 42줄 · ~1,837 토큰

- `L5` Ownership
- `L15` Safe blank-project system-preset flow
- `L21` Vocabulary and readiness
- `L32` Validation

### `openwiki/editor-interior-room-harness.md` — 40KB · 170줄 · ~11,885 토큰

- `L5` 사용자 타일 정정: 항아리·돌계단·석조 화로
- `L16` 여관 검수표와 숙박 검증
- `L24` 여관 꾸러미 전면 재구성 (2026-09-06)
- `L43` 실내 의미·형태 검토 반영 (2026-09-05)
- `L56` 모든 AI 실내의 개념 꾸러미 계약 (2026-09-05)
- `L67` Tileset-specific map generation contract
- `L77` Interior Room Session Harness (villager-room-v1)
- `L90` Safe detached draft and approval harness
- `L98` Interior object catalog is the shape source of truth (2026-08-28)
- `L109` 소품 표면 어휘가 `PlacementZone` 으로 통일됐다 (2026-08-30, PR #316)
- `L122` 개념 시설 시공 — place_concept 경로가 파이프라인에서 다른 점 (2026-09-02)
- `L135` 도면 호환성과 외장 스탬프 후속 (2026-09-05)
- `L141` 입구 예약·멀티타일 통행 복원 (2026-09-05)
- `L149` 공포 게임 제작 기능 (2026-09-05)
- `L153` 여관 외 시설의 공간 구성 (2026-09-05)
- `L163` PR618 통합: 큰 탁자와 기존 시설 구성 (2026-09-06)

### `openwiki/editor-observability.md` — 22KB · 248줄 · ~6,705 토큰 · 깨진 줄 1

- `L21` 계측 초크포인트는 `store.markLocalMutation` 하나다
- `L51` 새 편집 기능을 추가할 때 — 라벨을 넣어라
- `L70` AI 적용 경로 — 이쪽이 주 경로다
- `L101` 되돌리기 스택과 감사 로그는 다르다
- `L122` 디버깅 레시피
  - `L156` 저장된 것 — DB 커밋에 실린 행위 (`npm run commit:log`)
- `L185` 로거
- `L199` 알려진 남은 공백 (여기 손대는 사람이 이어서 하라)
- `L232` AI 툴·액션 이유 (2026-09-02)
- `L242` 검증

### `openwiki/editor-pre-edit-routing.md` — 72KB · 210줄 · ~20,571 토큰 · 통째읽기 잘림 · 깨진 줄 5

- `L7` Pre-edit routing
  - `L9` Sidebar mode workflow (2026-09-06; supersedes older 72px/tile-flyout notes below)
- `L83` Agent cautions
- `L93` 헤더 용어 정본과 중복 감사 (2026-08-30)
  - `L124` 톱바 영역 진입점 감사표 (`renderTopbar` 실측)
  - `L156` 사이드바 ↔ 톱바 소유권 (2026-08-30 중복 정리)
  - `L185` 스튜디오 바 — 톱바 한 줄 (2026-09-03, 표준·전문가 대격변)

### `openwiki/editor-storage-chest.md` — 1KB · 15줄 · ~333 토큰

- `L5` Storage chest authoring

### `openwiki/editor-validation.md` — 27KB · 126줄 · ~7,284 토큰

- `L3` AI 타일 후검증 (2026-09-05)
- `L8` 이벤트 초안 검증 표면 (2026-08-28)
- `L13` event-unreachable lint rule (2026-08-27)
- `L17` P2 생활 시스템 무결성 (2026-08-25)
- `L22` 생활 저작 표면 집중 검증 (2026-08-24)
- `L38` AI editor-wide tool validation (2026-08-25)
- `L44` Roguelike run validation (2026-08-24)
- `L51` Validation Expectations
- `L75` Desktop UI integration matrix (2026-08-11)
- `L85` Event editor aggregate gate (2026-07-30)
- `L94` P2 spatial integrity (2026-08-25)

### `openwiki/editor-workflows-misc.md` — 45KB · 194줄 · ~12,466 토큰

- `L7` Other Editor Workflows
  - `L9` Audio descriptions and live resource ownership
  - `L60` Genre-neutral authoring launcher and journey (2026-08-24)
- `L110` 편집기 z 층 밴드와 토스트 (2026-08-30, PR #308)
- `L139` 초보 맵 사이드바 «목록 | 상세» 2단 탐색기 (2026-08-30, PR #311)
- `L161` 커스텀 셀렉트는 열릴 때 modalStack 층이 된다 (2026-08-30)
- `L175` 맵 설정 가독성·편집 연속성 (2026-09-05)
- `L185` 왼쪽 사이드바 3모드 적대적 리뷰 (2026-09-05)

### `openwiki/editor-workflows.md` — 2KB · 28줄 · ~586 토큰

- `L5` Topic pages
- `L17` Quick routing
- `L25` For AI agents

### `openwiki/growth-trees.md` — 10KB · 112줄 · ~3,027 토큰

- `L3` 소유권과 데이터
- `L29` 성장 트리 그림 (Phase 1, 2026-09-05)
- `L54` 명시적 프리셋 추가 (Phase 2, 2026-09-06)
- `L74` 런타임과 저장
- `L97` 검증

### `openwiki/horror-authoring.md` — 8KB · 97줄 · ~2,480 토큰

- `L6` 저작 표면
- `L21` 데이터와 런타임
- `L38` 가구 밀기 애니메이션 (2026-09-05 후속 체험 수정)
- `L61` 실내 제작과 검증
- `L72` 검증 경로
- `L86` 전체 게이트 후속 수정 (2026-09-05)

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

### `openwiki/large-village-generation.md` — 17KB · 401줄 · ~4,779 토큰

- `L9` 한 줄 요약
- `L24` AI tree placement and completed houses (2026-09-05)
- `L43` Phase 2 construction boundary (2026-09-06)
- `L73` 관련 파일
- `L92` 전체 그림
- `L110` 단계별 설명
  - `L112` 0단계 — 자리 잡기 (`planLargeVillageBboxes`)
  - `L142` 1단계 — 맵 생성
  - `L150` 2단계 — 물
  - `L161` 3단계 — 집 (다양화)
  - `L176` 4단계 — 구불구불 길
  - `L192` 5단계 — 광장 + 시장 하네스
  - `L203` 6단계 — 울타리 + 마당 (집과 별 개념)
  - `L226` 7단계 — 나무·마을 소품
  - `L238` 8단계 — NPC
  - `L248` 9단계 — QA (품질 게이트)
  - `L271` 10단계 — 저장
- `L282` 데이터 개념 3개만 기억하기
- `L301` 예전에 자주 깨지던 이유 (로직 이슈)
- `L314` 로그 읽는 법
- `L334` 다시 만들 때
- `L350` 고칠 때 어디를 만지나
- `L364` 아직 약한 부분 (솔직히)
- `L381` 관련 위키
- `L389` author_village 스코프 계약 (2026-09-04 적대 리뷰 반영)
- `L398` 대로 병합 검증 (2026-09-05)

### `openwiki/night-monster.md` — 9KB · 120줄 · ~2,820 토큰

- `L7` 현재 개정본 (2026-09-05)
- `L37` 초기판 정본과 제작 경로 (역사 기록)
- `L51` 초기판 게임 구성과 공략 (현재 개정본에는 적용하지 않음)
- `L69` 초기판 검증과 발견한 함정
  - `L88` 2026-09-05 실측
  - `L103` 사용자 플레이 후 체험 QA 정정 (2026-09-05)

### `openwiki/quickstart.md` — 15KB · 161줄 · ~4,232 토큰

- `L6` 0. 여기서 에이전트가 실제로 헤매는 이유 (실측 2026-08-30)
- `L17` 1. 환경 — 여기가 틀리면 이후 전부 헛수고
- `L42` 1a. Mac novice launcher / private setup (Phase 1, 2026-09-06)
- `L78` 2. 검증 — 무엇이 진짜 게이트인가
- `L98` 3. 어디를 고치나 — 기능 → 진입 파일
- `L143` 4. 위키를 읽는 법
- `L155` 5. 끝났다고 말할 수 있는 조건

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

### `openwiki/runtime-battle.md` — 119KB · 362줄 · ~34,124 토큰 · 통째읽기 잘림

- `L3` 전투 명령 custom CSS (2026-09-05)
- `L7` 빈 페이지와 실행 빈도 계약 (2026-09-05)
  - `L24` 체공 배율 채널과 착지 눌림 (2026-08-30, PR #297)
- `L42` 지원 전투 시스템은 둘뿐이다 (2026-08-28)
- `L54` Roguelike run boundary (2026-08-24)
- `L59` Battle rules & runtime
  - `L74` 전투 화면 표현 · 전환 · 타임라인 · 연출 타이밍
  - `L99` 커맨드/대상 메뉴 기하와 글자 가시성 계약
  - `L115` 스킨 CSS 캐스케이드와 저작 가능 스킨
  - `L119` Gen 1(포켓몬식) 규칙 모델
  - `L127` 플레이 모드 런타임 (이 절에 섞여 있는 비전투 항목)
  - `L146` 전투 흐름 · 몬스터 수집 · 트룹 이벤트 · 보상
- `L183` Starter hero battle sheets (2026-08-29)
- `L204` Per-actor back battlers (2026-08-29)
- `L222` Battle input and visibility P0 contract (2026-07-30)
- `L233` 배틀러 idle 애니메이션 (2026-08-30)
- `L359` 필드 아이템 상태 부여 복구 (2026-09-05)

### `openwiki/runtime-m2-flow-controls.md` — 17KB · 64줄 · ~4,431 토큰

- `L5` M2 Runtime Flow Controls
- `L35` Storage chest authoring
- `L41` Page 3 location/vehicle compatibility (2026-07-30)
- `L45` 저장된 M2 명령 실행 연결 복구 (2026-09-05)
  - `L58` 이동 중 경로 재지정 — 2026-09-05 브라우저 적대적 QA

### `openwiki/runtime-pre-edit-routing.md` — 31KB · 178줄 · ~8,954 토큰

- `L150` Recovered head emotes (2026-09-05)
- `L156` 메뉴 입력·불러오기 배율 (2026-09-05)
- `L164` 가구 밀기 애니메이션 (2026-09-05)
- `L173` Recovered head emotes (2026-09-05)

### `openwiki/runtime-project-schema.md` — 67KB · 300줄 · ~18,306 토큰 · 통째읽기 잘림

- `L3` Project audio description overrides
  - `L32` Concurrent persistence
  - `L47` Editor preservation and playable export
- `L61` New-project save/reload verification (2026-09-05)
- `L65` Project-authored equipment slots (2026-09-05)
- `L73` 전투 명령 CSS (2026-09-05)
- `L77` 기본 카탈로그 삭제 보존 (2026-09-05)
- `L81` 전투 페이지 중복 ID 복구와 슬롯 참조 (2026-09-05)
- `L94` 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)
- `L102` 세계 법칙의 명시적 부재 (2026-09-05)
- `L106` Project schema & persistence
- `L173` Variable arithmetic & loop runtime (2026-08-07)
- `L177` Canonical event-draft projection (2026-07-30)
- `L183` P2 general buildings and home decorations (2026-08-25)
- `L190` 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)
- `L208` Boot normalizers must not create dangling references (2026-08-30)
- `L234` `.oprn` 은 단일 파일 게임 컨테이너다 — 편집기와 플레이어 양쪽이 읽는다 (2026-08-30)
- `L268` 성장 트리 선택 확장 (2026-09-05)
- `L274` 마을 설계서 (2026-09-05)
- `L280` 공포 게임 제작 기능 (2026-09-05)
  - `L284` 저장된 대사 별칭과 맵 오버레이 (2026-09-05)
- `L288` NPC 표시 이름 (2026-09-05)
- `L293` 연결 실내 도면의 영속성 (2026-09-05)
- `L297` 개념 장소 형상 (2026-09-05)

### `openwiki/runtime-sessions.md` — 60KB · 168줄 · ~16,122 토큰 · 통째읽기 잘림

- `L1` Esc 메뉴 작업 프레임 (2026-09-05)
- `L31` 아이템 종류 전환과 실행 효과 (2026-09-05)
- `L42` Roguelike run kernel and field rooms (Phase 0–3, 2026-08-24)
- `L52` P1 daily-weather transition authority (2026-08-25)
- `L61` Session state & life-sim
- `L134` Editorial title screen (2026-08-26)
- `L140` playerTouch trigger contract (2026-08-20)
- `L144` Selected-event runtime sandbox (2026-07-30)
- `L150` P2 spatial runtime and saves (2026-08-25)
- `L158` 공포 게임 제작 기능 (2026-09-05)
  - `L162` 메뉴 PR 통합 검증 (2026-09-05)

### `openwiki/se-catalog.md` — 15KB · 254줄 · ~3,839 토큰

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
- `L215` Project sound descriptions
- `L239` Traps

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

### `openwiki/testing.md` — 122KB · 892줄 · ~34,118 토큰 · 통째읽기 잘림

- `L1` Audio description verification
  - `L25` Real editor surfaces
  - `L52` Exported-player playback and dependency evidence
- `L101` Mac onboarding Phase 1 contracts (2026-09-06)
- `L129` 기존 실패 비교는 진단 내용까지 확인한다 (2026-09-05)
- `L137` Esc 메뉴 동작·시각 검증 (2026-09-05)
- `L153` Completed-house Phase 2 verification (2026-09-06)
- `L184` P2 낚시·채집·도감·박물관 focused gate (2026-08-25)
- `L191` Map-owned overlays: actual AI-turn browser regression (2026-09-05)
- `L200` Editor e2e boot-overlay determinism (2026-08-31)
- `L205` 영역 다듬기 focused gate (2026-08-31)
- `L212` AI 이벤트 배치 통행성 focused gate (2026-08-30)
- `L220` 체공(점프·낙하) focused gate (2026-08-29)
  - `L229` 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`
  - `L259` 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)
- `L322` Roguelike run Phase 0–3 coverage (2026-08-24)
  - `L333` 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)
- `L342` 데이터베이스 UI/UX 계측 하네스 (2026-08-30)
  - `L366` 가상 요소 텍스트를 안 재면 `tinyFont 0` 은 "안 봤다" 는 뜻이다 (실측)
  - `L387` 0px 이미지는 "깨진 것" 과 "접힌 것" 을 갈라야 한다 (실측)
  - `L393` 타이밍에 취약한 e2e 가 빨간불이면 그 스펙이 단정하는 속성을 직접 재라 (실측 2026-08-30)
  - `L416` 소스를 grep 하는 테스트는 이름만 봐서는 회귀를 못 가른다 (실측)
- `L424` Agent validation rule
- `L528` Event-editor trust-loop validation (2026-07-30)
- `L533` 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)
- `L552` P2 spatial focused gate (2026-08-25)
- `L561` 대화창 연출 focused gate (2026-08-30)
- `L635` 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)
  - `L648` `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)
  - `L660` 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)
  - `L668` 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)
  - `L675` `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)
- `L697` 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)
  - `L699` 메뉴 적대적 플레이 회귀 (2026-09-05)
- `L819` sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)
- `L826` fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)
- `L847` bugfix-sweep 실제 표면 하네스 (2026-08-29)
- `L860` 마을 설계서 (2026-09-05)
- `L865` 공포 제작 개정 QA와 개발 서버 전송 (2026-09-05)
- `L875` 상점 진열 중심 편집 검증 (2026-09-05)
- `L883` 실제 DB로 나가는 전체 검사 요청 (2026-09-05 실측)
- `L889` 실내 조립·형상 검증 (2026-09-05)

### `openwiki/town-tile-benchmark.md` — 10KB · 153줄 · ~3,010 토큰

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

### `openwiki/village-design.md` — 6KB · 60줄 · ~2,029 토큰

- `L5` 데이터와 호환성
- `L13` 단일 시공 계약
- `L26` 편집 화면과 미리보기
- `L34` 현재 경계
- `L40` 기존 맵 재시공의 새 집 터 (2026-09-06)
- `L55` 검증

### `openwiki/world-generation-rules.md` — 8KB · 107줄 · ~2,400 토큰

- `L7` 소유 경계
- `L20` 절대 하지 말 것 — 미리보기 전용 계산식
- `L31` 낱말 규칙 (자연어, 정규식 금지)
- `L42` 수치가 통과하는 경로
- `L59` 새 규칙 항목을 추가할 때
- `L71` 필수 랜드마크 하드 게이트 (2026-09-04)
- `L87` 검증
- `L95` 마을 설계서 (2026-09-05)
- `L98` 저장·편집 검토 수정 복구 (2026-09-05)

### `openwiki/world-structure-authoring.md` — 6KB · 104줄 · ~1,832 토큰

- `L3` 정본과 진입점
- `L15` 다리
- `L38` 다층 산
- `L70` 다른 맵과 사용자 설정 보호
- `L89` 검증
