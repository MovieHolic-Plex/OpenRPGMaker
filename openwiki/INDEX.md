<!-- 생성 파일 — 직접 고치지 말고 `npm run openwiki:index` 를 돌려라. -->
# OpenWiki 항해 색인

이 저장소의 위키는 **63쪽 / 2452KB / 약 686,306 토큰** 이다. 통째로 읽을 수 있는 크기가 아니므로, 필요한 절만 좌표로 잘라 읽어라.

```
read("openwiki/editor-database.md", offset=<절 시작줄>, limit=120)
grep -n "찾는말" openwiki/*.md          # 어느 페이지 몇 줄인지부터 찾는다
```

## 통째 읽기가 잘리는 페이지 (도구 상한 50KB)

이 페이지를 `read` 로 한 번에 열면 **조용히 잘린 채** 전달된다. 아래 절 목록의 줄 번호로 잘라 읽어라.
「가장 큰 절」이 상한 아래면 절 단위 읽기로 페이지 전부에 닿을 수 있다.

| 페이지 | 통짜 크기 | 가장 큰 절 | 줄 | 토큰 추정 |
|---|---|---|---|---|
| `openwiki/editor-ai-panel.md` | 378KB | 97KB ⚠상한 초과 — 절을 더 쪼개라 | 1883 | ~106,875 |
| `openwiki/editor-ai-tools.md` | 187KB | 82KB ⚠상한 초과 — 절을 더 쪼개라 | 1439 | ~52,343 |
| `openwiki/editor-database.md` | 267KB | 56KB ⚠상한 초과 — 절을 더 쪼개라 | 1419 | ~76,893 |
| `openwiki/editor-event-authoring.md` | 134KB | 76KB ⚠상한 초과 — 절을 더 쪼개라 | 740 | ~38,707 |
| `openwiki/editor-event-commands.md` | 57KB | 32KB | 202 | ~15,410 |
| `openwiki/editor-pre-edit-routing.md` | 105KB | 58KB ⚠상한 초과 — 절을 더 쪼개라 | 590 | ~30,240 |
| `openwiki/editor-workflows-misc.md` | 65KB | 29KB | 456 | ~17,604 |
| `openwiki/runtime-battle.md` | 134KB | 31KB | 540 | ~38,257 |
| `openwiki/runtime-project-schema.md` | 134KB | 65KB ⚠상한 초과 — 절을 더 쪼개라 | 859 | ~36,217 |
| `openwiki/runtime-sessions.md` | 89KB | 46KB | 318 | ~23,590 |
| `openwiki/testing.md` | 188KB | 48KB | 1725 | ~51,521 |

## 한국어 산문이 깨진 페이지

EUC-KR→UTF-8 모지바케가 남은 줄이다. **그 줄의 한국어는 믿지 말고** 같은 줄의 파일 경로·식별자만 쓰고, 의미는 해당 소스 파일에서 직접 확인하라. 복원은 불가능하다(원본 바이트가 소실).

| 페이지 | 깨진 줄 수 | 예시 줄 번호 |
|---|---|---|
| `openwiki/editor-ai-panel.md` | 25 | 1529, 1530, 1531, 1532, 1533, 1534, 1546, 1556 |
| `openwiki/editor-ai-tools.md` | 6 | 1086, 1087, 1091, 1093, 1095, 1282 |
| `openwiki/editor-database.md` | 7 | 556, 560, 561, 562, 571, 597, 600 |
| `openwiki/editor-event-authoring.md` | 16 | 310, 311, 314, 319, 320, 321, 322, 323 |
| `openwiki/editor-event-command-fixes.md` | 11 | 11, 12, 14, 15, 16, 17, 18, 19 |
| `openwiki/editor-event-commands.md` | 6 | 109, 122, 123, 125, 128, 129 |
| `openwiki/editor-observability.md` | 1 | 310 |
| `openwiki/editor-pre-edit-routing.md` | 5 | 411, 420, 427, 429, 452 |
| `openwiki/state-system.md` | 2 | 3, 84 |

## 없는 파일을 가리키는 참조

문서가 이름을 부르는데 저장소에 없는 파일이다. 대부분은 **의도적으로 삭제된 모듈** 을 기록으로 남긴 것이지만(그 경우 문단이 삭제 사실을 말한다), 살아 있는 안내처럼 읽히면 에이전트가 없는 파일을 찾아 헤맨다. 문서를 고칠 때 이 목록이 줄어드는지 보라.

| 페이지 | 건수 | 참조 |
|---|---|---|
| `openwiki/ai-workflow.md` | 3 | `src/ai/plannerSkip.ts`, `test/tilesetAiClient.test.ts`, `test/volumeContractSession.test.ts` |
| `openwiki/bgm-catalog.md` | 4 | `artifacts/bgm-release/bgm-release-v1.json`, `catalog.raw.json`, `output/evidence/agy-interface-smoke-transcript.json`, `output/evidence/audio-ai-final/ingestion-report.json` |
| `openwiki/editor-ai-panel.md` | 36 | `.omo/evidence/assistant-glass-fold/measure.json`, `.omo/evidence/autonomous-ai-rpg/task-8-autonomous-ai-rpg.md`, `06-page-modern-forms.css`, `15-assistant-readable.css`, `17-assistant-modern-shell.css`, `after/measure.json`, `aiCommandBar.ts`, `aiGlassPanelWidth.test.ts`, `aiSkillDrawer.ts`, `aiVolatileController.ts`, `assistant-skills.css`, `chat-dock-switch.spec.ts`, `chatDock.ts`, `intentClarify.ts`, `newmain-after-measure.json`, `output/evidence/acceptance-live/README.md`, `output/evidence/assistant-clean-glass/phase-2/implementation.md`, `output/evidence/assistant-ui-modern/newmain-before-measure.json`, `regionIntentRouter.ts`, `scripts/qa/assistant-side-seam-hittest.mjs`, `src/ai/intentClarify.ts`, `src/ai/plannerSkip.ts`, `src/ai/skills.ts`, `src/editor/chatDock.ts`, `test/aiGlassFold.test.ts`, `test/aiGlassPanelWidth.test.ts`, `test/chatDock.test.ts`, `test/e2e/_assistant-glass-shots.spec.ts`, `test/e2e/_glass-dock-report.spec.ts`, `test/e2e/chat-dock-switch.spec.ts`, `test/plannerSkip.test.ts`, `test/regionIntentExposure.test.ts`, `test/tilesetAiClient.test.ts`, `test/turnGuideSharedRules.test.ts`, `test/volumeContractSession.test.ts`, `test/workspaceBarAssistantDock.test.ts` |
| `openwiki/editor-ai-tools.md` | 5 | `aiCommandBar.ts`, `aiProposalModal.ts`, `tabs-b-assistant-panel.css`, `test/intentClarify.test.ts`, `test/volumeContractSession.test.ts` |
| `openwiki/editor-database.md` | 22 | `builtinHouseStructureKits.ts`, `desktop-record-shell.css`, `enemy-art-NNN.png`, `form-hierarchy-modern.css`, `houseKitTools.ts`, `output/evidence/battle-animation-ux/p1-implementation.md`, `output/evidence/battle-animation-ux/p2-implementation.md`, `output/evidence/battle-rules-ux/st_01a07318-manual-qa.md`, `output/evidence/battle-rules-ux/verification.md`, `output/evidence/concept-expansion/supabase-proof.json`, `output/evidence/concept-v2/supabase-proof.json`, `output/evidence/monster-concepts/b1/fix.md`, `output/evidence/monster-concepts/p2/verification.md`, `output/evidence/monster-concepts/r1/fix.md`, `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`, `output/spatial-ux-verify.mjs`, `reports/generated-effect-showcase-2026-08-24.html`, `reveal-fix.md`, `scripts/generate-default-item-icons.mts`, `scripts/lib/effectSheet/paintersMonster.mjs`, `scripts/lib/effectSheet/paintersUtility.mjs`, `troops.part-1.css` |
| `openwiki/editor-event-authoring.md` | 13 | `03-legend-toolbar.css`, `05-force-modern-actor-page3.css`, `audit-before.md`, `event-editor-ai.css`, `event-editor.balanced.css`, `event-editor.part-3/08-inline-validation-badges.css`, `new-editor/REPORT.html`, `output/evidence/event-ai-assist-ux/960x900-compact.png`, `scripts/generated/toolCatalog.json`, `src/styles/editor/event-editor.balanced.css`, `src/styles/editor/event-editor.modernize.css`, `verify-shots/page-preview-probe/02-preview-open.png`, `verify-shots/runtime-qa/cheolsu-keyboard-fixed/SUMMARY.md` |
| `openwiki/editor-event-command-fixes.md` | 14 | `.omo/evidence/event-command-remediation/U04/api-ownership.md`, `event-editor-rich-forms.css`, `scripts/qa/runtime/event-command-remediation-u02.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u04.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u05.scenario.mjs`, `scripts/qa/runtime/event-command-remediation-u06.scenario.mjs`, `test/e2e/event-command-remediation-U02.spec.ts`, `test/e2e/event-command-remediation-U04.spec.ts`, `test/e2e/event-command-remediation-U05.spec.ts`, `test/e2e/event-command-remediation-U06.spec.ts`, `test/eventCommandRemediation/U02.test.ts`, `test/eventCommandRemediation/U04.test.ts`, `test/eventCommandRemediation/U05.test.ts`, `test/eventCommandRemediation/U06.test.ts` |
| `openwiki/editor-event-commands.md` | 13 | `02-changeface-play-mock-larger.css`, `07-identifiable-previews.css`, `choicesDialog.ts`, `event-editor.command-preview.css`, `event-editor.command-preview/01-event-editor-modern-import.css`, `event-editor.commerce.css`, `event-editor.part-1.css`, `event-editor.part-2/3.css`, `event-editor.shop.css`, `messageCommandDialogs.ts`, `messageDialogControls.ts`, `src/styles/editor/event-editor.part-2.css`, `textCommandDialog.ts` |
| `openwiki/editor-genre-packs.md` | 1 | `src/editor/panels/newProjectDialog.ts` |
| `openwiki/editor-interior-room-harness.md` | 7 | `hearth-lit.json`, `hearth-unlit.json`, `output/evidence/concept-v2/index.html`, `output/evidence/inn-exploration-v4/index.html`, `output/evidence/inn-inspection-v5/index.html`, `output/evidence/pr618-fixtures/inn.json`, `player/SUMMARY.md` |
| `openwiki/editor-pre-edit-routing.md` | 10 | `authoringTestGate.ts`, `dbConnectionAdvancedSettings.ts`, `event-editor.part-4.css`, `figma-editor.css`, `figma-editor/10-map-tree.css`, `rm2k3.part-1.css`, `shell/editor-responsive-expert.css`, `src/editor/tools/worldTools.ts`, `src/styles/editor/event-editor.balanced.css`, `worldTools.ts` |
| `openwiki/editor-validation.md` | 2 | `final-layout.json`, `viewport-matrix.json` |
| `openwiki/editor-workflows-misc.md` | 7 | `.qa.json`, `default.json`, `game.html`, `release.json`, `runtime.json`, `src/editor/authoringTestGate.ts`, `src/styles/editor/event-editor-help.css` |
| `openwiki/growth-trees.md` | 3 | `.omo/evidence/growth-integrated/browser-presets/report.json`, `applied-bundle.json`, `verify-shots/runtime-qa/growth-tree/SUMMARY.md` |
| `openwiki/horror-authoring.md` | 1 | `motion-sheet.png` |
| `openwiki/large-village-generation.md` | 2 | `HANDOFF.json`, `src/project/defaults/largeRiverMarketVillageBuild.ts` |
| `openwiki/night-monster.md` | 1 | `verify-shots/runtime-qa/night-monster/SUMMARY.md` |
| `openwiki/runtime-action-combat.md` | 1 | `export-player/player.html` |
| `openwiki/runtime-battle.md` | 7 | `battle.css`, `hero-03-battle-idle.png`, `output/evidence/event-command-completion/battle/VERIFICATION.md`, `raw.png`, `reference.png`, `src/styles/runtime/battle.css`, `starter/hires/hero-0N-battle.png` |
| `openwiki/runtime-m2-flow-controls.md` | 1 | `verify-shots/runtime-qa/coordinate-move/SUMMARY.md` |
| `openwiki/runtime-pre-edit-routing.md` | 1 | `verify-shots/runtime-qa/emote/SUMMARY.md` |
| `openwiki/runtime-project-schema.md` | 3 | `.json`, `.png`, `output/evidence/event-command-completion/legacy-persistence/ledger.json` |
| `openwiki/runtime-sessions.md` | 1 | `output/evidence/stardew/stardew-supabase.json` |
| `openwiki/se-catalog.md` | 7 | `.mjs`, `audio-features.json`, `audition.html`, `cross-check.json`, `dist/se-staging/audition.html`, `labels.json`, `placed.json` |
| `openwiki/spatial-geography-compiler.md` | 1 | `.omo/ulw-execute/tile-to-world/execution-policy.md` |
| `openwiki/spatial-geography-ui.md` | 1 | `regionReferenceView.ts` |
| `openwiki/testing.md` | 18 | `../dialogue.css`, `.omo/gates-vitest-report.json`, `browser-play-start.png`, `browser-title.png`, `event-editor.command-preview/07-identifiable-previews.css`, `output/evidence/acceptance-live/README.md`, `output/evidence/concept-expansion/README.md`, `output/evidence/concept-v2/validation.json`, `output/evidence/functional-acceptance/public-smoke.json`, `output/evidence/horror-mystery-prototype/browser-qa.json`, `supabase-proof-first-save.json`, `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/dialogue-nameplate-clears-body.spec.ts`, `test/tilesetAiClient.test.ts`, `verify-shots/runtime-qa/action-rpg/SUMMARY.md`, `verify-shots/runtime-qa/coordinate-move/SUMMARY.md`, `verify-shots/runtime-qa/esc-menu/SUMMARY.md`, `verify-shots/runtime-qa/status-menu-adversarial/SUMMARY.md` |
| `openwiki/town-tile-benchmark.md` | 1 | `combined-town-chipset-report.html` |
| `openwiki/ui-discovery-pilot.md` | 3 | `direct/RESULTS.json`, `output/evidence/ui-discovery-v2/report.html`, `trace.json` |
| `openwiki/village-design.md` | 1 | `output/village-direction/index.html` |
| `openwiki/world-structure-authoring.md` | 1 | `verify-shots/runtime-qa/world-structure-tools/SUMMARY.md` |

## 페이지별 절 좌표

### `openwiki/PROJECT_WIKI.md` — 10KB · 120줄 · ~2,535 토큰

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

### `openwiki/agent-worktrees.md` — 14KB · 201줄 · ~4,216 토큰

- `L6` 적용 범위
- `L16` 명령
- `L26` `git stash` 를 쓰지 마라 (실측 2026-09-10, 남의 작업을 꺼내 버렸다)
- `L53` 회수 규칙 (커밋이 유일한 안전망)
  - `L65` 에이전트에게 줄 지시
  - `L102` e2e 는 `DEV_SERVER_PORT` 없이 돌리면 **남의 코드를 검증한다** (실측 2026-08-29)
- `L119` 검증 게이트
  - `L121` 통합 작업의 검증 대상 고정 (2026-09-06)
  - `L140` 왜 기준선 방식인가
  - `L151` 왜 별도 스크립트인가
- `L160` 감독 절차
- `L171` 알려진 함정

### `openwiki/ai-context-compaction.md` — 16KB · 190줄 · ~4,783 토큰

- `L7` 대화 복원과 실행 체크포인트의 경계 (2026-09-09)
- `L40` 1. 3개 예산·압축 계층의 분리와 실행 순서
  - `L66` 계층별 책임 비교
- `L76` 2. 주요 상수 및 위치
- `L95` 3. 핵심 알고리즘 및 엔진 동작 (`src/ai/contextCompaction.ts`)
  - `L97` 토큰 추정 (`estimateMessageTokens`, `estimateContextTokens`)
  - `L103` 압축 트리거 판정 (`shouldCompact`, `resolveThresholdContextTokens`)
  - `L111` 절단점 탐색 (`findCompactionCutPoint`)
  - `L116` 잔존 꼬리 수리 (`repairRetainedTail`)
  - `L120` 요약 프롬프트 및 요청 구성 (`buildSummarizationRequest`)
- `L129` 4. 세션 통합 및 실패 방어 (`src/ai/assistantSession.ts`)
  - `L131` 호출 위치
  - `L134` 턴당 실패 캡 (`compactionFailedThisTurn`)
  - `L139` 실측 사용량 기록 (`recordPromptUsage`)
  - `L143` 무중단 실패 정책
- `L150` 5. 실측 데이터 (Real-HTTP Proof)
- `L166` 6. 업스트림(Senpi) 대비 설계 및 의도적 차이점
- `L185` 7. 계약 테스트 및 검증 스크립트

### `openwiki/ai-tools-deprecation-roadmap.md` — 4KB · 63줄 · ~1,350 토큰

- `L5` 현황 (2026-09-04 갱신)
- `L21` 왜 지금 당장 지우지 않는가
- `L28` 제거 단계
  - `L30` 1단계 — 호출 계측 (즉시 가능)
  - `L35` 2단계 — 실행 차단 + 안내 오류 (관측 후)
  - `L40` 3단계 — 이름 삭제 (메이저 정리)
- `L45` 개별 판단 메모

### `openwiki/ai-workflow.md` — 32KB · 255줄 · ~8,612 토큰

- `L5` Before changing files
- `L13` While changing files
  - `L149` Request-bound NPC prerequisite proof (CR-NPC-PREREQ-01, 2026-09-07)
- `L205` After changing files
- `L212` Tool-calling architecture (human review map)
- `L222` Headless Tool and MCP Access
- `L231` Live editor AI assistant MCP (same UI session)
- `L250` Refreshing the wiki

### `openwiki/architecture.md` — 10KB · 67줄 · ~2,449 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/autotiles.md` — 17KB · 156줄 · ~4,914 토큰

- `L3` World 지형과 공통 구조물
- `L23` 1. RM2K식 3×4 템플릿 블록 문법
- `L39` 2. 지형 앵커 카탈로그 — 4행 밴드 × 열 0/3/6/9 격자
- `L58` 3. 물 계열 — 오토타일 그룹이 아닌 별도 시스템
- `L76` 3-1. 던전 칩셋 절벽(빙암) — 벽은 두 행이다
- `L110` 4. 오토타일 등록 경로 3가지
- `L118` Integrated World snapshot (2026-09-06)
- `L132` Terrain placement regression contracts (2026-09-08)
- `L149` 5. 검증

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

### `openwiki/bgm-catalog.md` — 23KB · 336줄 · ~5,789 토큰

- `L6` Why this exists
- `L17` Facts an agent needs
- `L34` Files and ownership
- `L55` Release pack installation (2026-09-07)
- `L87` In-editor installation and live inventory (2026-09-09)
- `L123` Producing and publishing the pinned pack
- `L150` Regenerating
  - `L160` sha256 caveat
- `L168` CDN wiring
- `L198` How authors reach the tracks
- `L230` Project audio descriptions
  - `L262` Shared AI analysis drafts (2026-09-08)
- `L303` Traps

### `openwiki/castle-map.md` — 4KB · 69줄 · ~1,003 토큰

- `L5` Goal
- `L9` Modules (Combined Town)
- `L21` Observed layout recipe (`map_castle_keep` 48×40)
- `L38` Do / don’t
- `L46` Build tool
- `L54` Code owners
- `L64` Validation

### `openwiki/community-site.md` — 21KB · 178줄 · ~5,403 토큰

- `L5` Data
- `L12` Interop contract (do not break)
- `L19` Immutable publication and playback (2026-09-06)
  - `L33` Frozen dependency authority (P2, 2026-09-07)
  - `L74` Release QA and migration commands
- `L143` Feature map (v2, 2026-07-21)
- `L151` Historical in-browser play (v3, 2026-07-21; superseded)
- `L167` Ops notes
- `L171` Gotchas learned

### `openwiki/delayed-tooltip.md` — 4KB · 67줄 · ~1,278 토큰

- `L11` 동작 계약
- `L28` 문구 규칙
- `L36` 1차 롤아웃 대상
- `L46` 설치 지점
- `L52` 테스트

### `openwiki/editor-ai-panel.md` — 378KB · 1883줄 · ~106,875 토큰 · 통째읽기 잘림 · 깨진 줄 25

- `L3` 조수 채팅은 Pi 하나다 — 세션 경로를 걷어냈다 (2026-09-11)
- `L45` Retained map planning items and explicit reuse (2026-09-10, OPRN-019)
- `L86` Run outcome line: four independent axes (2026-09-09)
- `L117` P3 run retirement and stale drafts (2026-09-07)
- `L197` Map-scoped conversation archive (2026-09-08)
  - `L257` Editor history surface
- `L299` Independent result review and repair (2026-09-06)
- `L402` Combined P2 and independent-review ownership (2026-09-07)
- `L436` P2 run outcomes and user scope actions (2026-09-06)
  - `L492` Canonical requirements and genuine user actions
- `L564` User-confirmed interaction approach correction (CR-P7-1, 2026-09-08)
- `L601` Live large-world QA: plan repair and final audit (2026-09-07)
- `L690` Assistant control audit fixes (2026-09-07)
- `L701` World structure activity labels (2026-09-06)
- `L710` Multi-map construction specifications (2026-09-06)
- `L777` Plan authoring has no small-plan quota (2026-09-06)
- `L796` Acceptance sticky note (2026-09-07)
  - `L846` Session-owned acceptance contract
- `L1184` 자동 프로젝트 위키 (2026-09-07)
- `L1216` Independent image generation settings (2026-09-07)
- `L1217` Independent image generation settings (2026-09-08)
- `L1255` 브라우저 포커스와 도구 실행 대기 (2026-09-05)
- `L1262` Map-targeted work outcomes (2026-09-06)
- `L1277` 계획 항목의 연속 실행 증거 (2026-09-05)
- `L1283` 계획 규모와 선언 자세 (2026-09-09)
- `L1293` 조회 선행·계획 완료와 실행 종료 (2026-09-05)
- `L1302` 조수 카메라 이동 수명·부드러운 줌 (2026-09-05)
- `L1318` 패널 셸 · 도크 · 접기 · 컴포저
- `L1458` 세션 수명 · 대화 컨텍스트
- `L1475` 제안 적용 · 복구 · 완성도 린트
- `L1560` 고스트 미리보기 · 활동 표시 · 청사진 · 카메라
- `L1622` 영역 작업 · 시공 · 실내/집 파이프라인
- `L1646` 툴 노출 · 프롬프트 · 의도 판정 · NPC
- `L1660` 타일셋 이해 · 검토 위저드 (T1a/T1b)
- `L1686` 저장 · 내보내기 · 프로젝트 생성
- `L1694` 제공자 · OAuth · 동반 서비스
- `L1724` Autonomous run mode (autonomous-ai-rpg, todos 1-6)
- `L1767` 분리 브랜치 마일스톤 회계 복구 (2026-09-05)
- `L1800` 배치 의존성과 완료 멱등성 (2026-09-06)
- `L1808` 모험 완료와 실제 적용 횟수 (2026-09-05)
- `L1813` Assistant clean conversation — Phase 1 (2026-09-06)
- `L1850` Assistant deck width resize (2026-09-07)
  - `L1862` Legacy AI contract verification (2026-09-08)

### `openwiki/editor-ai-tools.md` — 187KB · 1439줄 · ~52,343 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L3` 도면 문법에 wing(세로 복도) 추가 — 실루엣 변주와 물건 대체군 (2026-09-11)
  - `L28` 후속: 석조 화로는 복도 끝 알코브에 (2026-09-11)
  - `L45` 팔레트 확장 — 안 쓰던 칩셋 그림 16종을 물건으로 (2026-09-11)
- `L65` 실내는 찍어내지 않는다 — place_concept 은 설계를 요구하고, author_house 는 interiorPlan 을 받는다 (2026-09-11)
- `L97` 초안은 씨앗이고 저작본만 도면 정본이다 — 절차 도면 되살리기 + 실내 다양성 리포트 (2026-09-12)
- `L124` 맵 생성 테두리 옵션은 모델에게 주지 않는다 (2026-09-11)
- `L144` 맵 전체 청소 `clear_map` — 파괴적 한 콜 + 사용자 허가 모달 (2026-09-11)
- `L196` 명명 로케이션 툴 7종 (OPRN-OUT-020 + LOC-ADOPT, 2026-09-10)
- `L235` Exact project values and sourced declarations (2026-09-08)
- `L263` Measured zero-prop rejection diagnostics (2026-09-07)
- `L360` Logical walkthrough versus real player traversal (2026-09-07)
- `L368` Tile-query selector and filter boundaries (2026-09-07)
- `L377` Action enemy profile edits (2026-09-07)
- `L395` Explicit field-spawn mutations (2026-09-07)
- `L421` Monster resource discovery and AI appearance evidence (2026-09-07)
- `L498` House-site tree clearance before ownership (2026-09-07)
- `L509` Flower-yard material in house lots (2026-09-07)
- `L522` Pre-write original grounding (2026-09-06)
- `L597` Full native tool exposure (2026-09-06)
- `L624` Review approval lifetime (R3, 2026-09-06)
- `L642` Audio description tools and event candidates
  - `L662` Search pages and full detail
  - `L676` Event prompt projection is not ID authority
- `L710` P3 captured proposal base (2026-09-07)
- `L782` Project wiki application ownership (2026-09-07)
- `L795` Character appearance image candidates v1 (2026-09-06)
- `L853` Completed-house transaction protection - Phase 1 (2026-09-05)
- `L927` Completed-house construction protection - Phase 2 (2026-09-06)
- `L966` 퀘스트 입력과 완주 증거 계약 (2026-09-05)
- `L976` DB 조회 페이지와 마을 전체 범위 (2026-09-05)
- `L1112` P2 requirement and exact-verdict inputs (2026-09-06)
- `L1187` Project-wide quality evaluation
- `L1201` prune_unused 의 참조 수집은 variableId 를 가진 명령 전부를 세야 한다 (2026-08-29 실측 결함 수정)
- `L1237` Action controls guide (2026-09-07)
- `L1280` NPC 대사는 코드가 지어내지 않는다 — 캐스트 라이터 계약 (2026-09-03)
- `L1311` 「이 세계」 캐논은 문장 3채널에 강제된다 (2026-09-04)
- `L1326` 마을 설계서 (2026-09-05)
- `L1330` 저수준 이벤트 입력은 명령 위치를 검증한다 (2026-09-05)
- `L1365` 보물상자는 노출된 수면을 거부한다 (2026-09-05)
- `L1372` 모험 저작 완료와 재시도 (2026-09-05)
- `L1402` 실제 이미지 입력 보존 (2026-09-07)
- `L1416` Physical tile passage exposure (2026-09-08)

### `openwiki/editor-database.md` — 267KB · 1419줄 · ~76,893 토큰 · 통째읽기 잘림 · 깨진 줄 7

- `L1` Placed-place child proposal adapter (2026-09-08)
- `L6` Monster resource metadata worksheet (2026-09-07)
- `L12` Shared database CSS ownership (2026-09-06)
- `L53` 전투 몬스터 표시 크기 (2026-09-06)
- `L60` 전투 명령 배치 스튜디오 (2026-09-05)
- `L77` 캐릭터·얼굴 메타데이터 (2026-09-06)
- `L84` Character appearance catalog v1 (2026-09-06)
- `L126` Concept navigation integration (2026-09-06)
- `L140` Opening and game-over authoring (2026-09-06)
- `L190` Cinematic media preparation boundary (2026-09-06)
- `L209` System settings workspace (2026-09-06)
- `L270` Graphic 칩 사용자 교정 29건 (2026-09-05)
- `L286` Custom equipment slot authoring (2026-09-05)
- `L294` 통합 아이템·장비 카탈로그 (2026-09-05)
- `L302` 아이템·장비 저작 신뢰성 (2026-09-05)
- `L313` 전투 몬스터와 포획·성장 종족 (Phase 1)
  - `L323` 종족 검색과 관련 레코드 노출 (Phase 2)
- `L333` 몬스터 작업실 — 미리보기 · 행동 · 속성 (2026-09-05)
  - `L358` Monster action input trust (Phase 1, 2026-09-05)
  - `L367` Monster numeric caption activation (Phase 2, 2026-09-05)
  - `L374` Monster nested dialog focus (Phase 2, 2026-09-05)
- `L380` 몬스터 그룹 저작 신뢰성 (2026-09-05)
- `L395` Database Studio chrome (2026-08-24)
  - `L409` Actor data-table slice (2026-08-25)
- `L419` 프로젝트 위키 출처와 수동 편집 (2026-09-07)
- `L431` 세계관 그룹 — 세계 개요 · 설정집 (2026-09-06)
  - `L448` 세계관 입력 보존·설정집 저장 계약 (2026-09-05)
- `L460` '생성 규칙' 탭 — AI 마을 생성의 물·숲·길 (2026-08-30)
- `L468` P2 낚시·채집·박물관 저작 표면 (2026-08-25)
- `L473` 생활 저작 경계와 자동 화자 (task14, 2026-09-06)
- `L482` 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)
- `L495` 생활 기술·제작 저작 표면 (2026-08-24)
- `L514` Database Editor
- `L605` Beginner-centric adversarial review (2026-08)
- `L609` DB UI modernization (2026-08)
- `L645` P2 spatial authoring (2026-08-25)
- `L657` 맵 그룹 — 개념 우선 탐색 Phase 1 (2026-09-05)
- `L679` 맵 그룹 — 공간 저작 셸 UX 계약 (2026-09-12)
- `L718` 오토타일 설정 — 9칸/11칸/커스텀 카드 (2026-09-01)
- `L739` 공간 종류와 구조물은 다른 면이다 (2026-09-01)
- `L758` 맵 → 개념 꾸러미 (2026-09-02 시작, 2026-09-05 개념 우선 Phase 1)
- `L789` '구조물' 탭 — 두 출처 앨범 + 방 종류 문법 (2026-08-28)
- `L802` '구조물' 편집기와 파일 입출력 (2026-08-29)
- `L821` 삭제 가드는 묶음 조건(all/any/not) 안까지 본다 (2026-08-29 실측 결함 수정)
- `L841` '진영' 탭과 몬스터 소속 진영 (2026-08-29)
  - `L856` 몬스터 폼의 소속 진영 (`databaseEnemyRecordView.ts`)
  - `L864` 다 만들어 놓고 못 쓰던 이유 — `[편집]` 이 화면 밖 67px 에 있었다 (2026-08-29 실측)
  - `L876` 구조물 어휘 — 역할·레이어·테마·증분 축·칸 힌트 (2026-08-30)
  - `L927` 편집기를 맵 타일 편집기 수준으로 (2026-08-30 실측)
- `L949` Battle-animation editor autoplay (2026-09-05)
- `L956` 스킬 탭 `연출` 카드 = 살아 있는 애니메이션 스테이지 (2026-08-30)
- `L967` 데이터베이스 30탭 UI/UX 계약 (2026-08-30 실측)
  - `L982` 헤더는 설명문이 아니라 아이콘 칩 한 줄이다
  - `L1060` 숫자 입력은 스테퍼를 먼저 붙이고 그다음 스피너를 지운다
  - `L1074` 줄상자 바닥은 1.35 다 (1.25 는 큰 한글 제목에서 깎인다)
  - `L1117` 이미지 실패는 빈 상자가 아니라 라벨 붙은 자리표시자다
- `L1126` '마을' 탭 — 마을 하네스 값을 사람이 저작한다 (2026-08-30)
  - `L1150` 붓을 고르면 화면이 흔들렸다 — 재부모가 스크롤·포커스를 지운다 (2026-08-30 실측)
- `L1193` 날개마다 층수를 정한다 — 계단식 2층 (2026-09-11)
  - `L1206` 지붕 가장자리 판정은 "다른 지붕면인가"다 (2026-09-11 실측 결함)
- `L1214` '마을' 탭 — 숫자칸을 그림으로 바꾼다 (2026-08-31)
  - `L1230` AI로 몬스터·아이템 생성 (2026-08-30)
  - `L1251` AI 어시스턴트 바 — 진행·결과가 바 안에 보인다 (2026-09-03)
  - `L1285` AI로 몬스터·아이템 생성 — 대화상자 재작성 (2026-09-03)
- `L1301` Database Studio v2 — 30탭 셸·폼 문법 통일 (2026-09-03)
- `L1378` 직업 승급 트리 · 스킬 트리 (2026-09-05)
- `L1384` 미회수 편집 후속 통합 (2026-09-05)
- `L1388` 마을 설계서 (2026-09-05)
- `L1393` 구조물 증분 메타 정정 (2026-09-05)
- `L1401` 개념 회수 UI 직접 렌더 QA (2026-09-05)
- `L1405` Battle-animation preview-first graphic controls (Phase 2, 2026-09-05)
- `L1412` 검토한 실내 기본값의 원격 반영 (2026-09-05)
- `L1416` 특정 꾸러미의 명시적 교체 (2026-09-06)

### `openwiki/editor-event-authoring.md` — 134KB · 740줄 · ~38,707 토큰 · 통째읽기 잘림 · 깨진 줄 16

- `L3` 구역(로케이션) 조건분기 (OPRN-OUT-020, 2026-09-10)
- `L25` 구역 드나듦 트리거 (2026-09-10)
- `L52` Native battle confirmation admission (2026-09-08)
- `L71` Character graphic no-match recovery (OUT-007, 2026-09-08)
- `L94` Page preview state follows the current script (2026-09-08)
- `L115` Event editor window controls (2026-09-06)
- `L162` 이벤트 편집기 가독성 — 읽는 글자와 꾸미는 글자 (2026-09-03 후속)
- `L175` 이벤트 편집기 문법 고정 — P0 (2026-09-03)
- `L188` NPC 일정 구조화 편집 (2026-08-24)
- `L200` AI 가 이벤트 페이지를 이해하지 못했다 (2026-08-30 실측 · 수정)
  - `L222` 우선순위는 1페이지가 아니다 (바꾸지 않았다)
  - `L230` 랜덤 대사는 페이지가 아니다
  - `L237` 새 린트가 출하 콘텐츠에서 실제로 잡은 것 (skyStair autoEvent)
  - `L247` 조건만 걸고 켜지 않으면 그것도 죽은 페이지다 (가려짐의 거울상)
- `L264` 복잡한 NPC 는 조회 후 상태별 다중 페이지로 저작한다 (2026-09-01)
- `L294` Roguelike run authoring (2026-08-24)
- `L301` Event Authoring
- `L523` Condition / Loop / Variable command trust fixes (2026-08-07)
- `L533` Event draft trust loop (2026-07-30)
- `L541` 회상 오프닝 저작 — beat 컴파일러다 (2026-09-03)
- `L550` Guided story arc facade
- `L554` 지도·화면 효과 탭 초보자 UX (2026-08-27)
- `L559` 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)
- `L567` Companion roster in the command picker (2026-08-27)
- `L573` Presentation and system M2 command bodies
- `L580` 좌측 설정 레일 그룹 소속 (2026-08-27)
- `L598` 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)
- `L608` 「움직임과 속도」 부피 정리 (2026-08-29)
- `L643` 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)
  - `L677` 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다
  - `L688` 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)
  - `L696` 참조를 비워도 조건을 삭제하지 않는다
  - `L703` 조건 미리보기는 모르면 모른다고 말한다
  - `L712` 조건 문구에 내부 토큰을 넣지 마라
- `L727` 공포 게임 제작 기능 (2026-09-05)
  - `L732` NPC 발견·추격 저작 (2026-09-06)

### `openwiki/editor-event-command-fixes.md` — 24KB · 98줄 · ~6,208 토큰 · 깨진 줄 11

- `L25` Sound and system audio handoffs (U14)
- `L34` Named text record insertion (2026-09-06, G1-F18)
- `L44` Nested command drafts and branch identity (2026-09-06, U02)
- `L53` Page 3 canonical fields and staged commits (2026-07-30)
- `L58` Show Picture preview opacity unit (2026-08-29)
- `L63` 조명 백분율 입력 복구 (2026-09-05)
- `L67` Native media flags and picture completion (2026-09-06, U04)
- `L76` Actor targets and operand drafts (2026-09-06, U05)
- `L84` Follower removal and graphic intent (2026-09-06, U06)
- `L91` Stable resource selections and field labels (2026-09-06, U07)

### `openwiki/editor-event-commands.md` — 57KB · 202줄 · ~15,410 토큰 · 통째읽기 잘림 · 깨진 줄 6

- `L7` Move-route target repair (PR716, 2026-09-09)
- `L26` 좌표로 이동 — 고정/변수 좌표와 실패 정책 (OPRN-OUT-013, 2026-09-10)
- `L70` 장소 이동의 목적지 원복과 설정 보존 (2026-09-06)
- `L76` 확률로 결과 뽑기 / 가중 분기 (2026-09-06)
- `L89` 상점: 진열 상품과 상품 상세 중심 편집 (2026-09-05)
- `L101` Roguelike run control (2026-08-24)
- `L141` 얼굴 상자(faceset-crop-box) 페인트 계약 (2026-08-28)
- `L172` Staged edit, history, and nested drag invariants (2026-07-30)
- `L179` Command picker, validation, and preview trust (2026-07-30)
- `L188` 회상 스틸과 AI 그림 (2026-09-03)
- `L199` Recovered native emote command (2026-09-05)

### `openwiki/editor-genre-packs.md` — 11KB · 101줄 · ~2,939 토큰

- `L5` Ownership
- `L16` Safe blank-project system-preset flow
- `L35` Vocabulary and readiness
- `L46` Dialog layering and receipt fixtures (2026-09-08)
- `L59` Validation
- `L61` Two new-project surfaces, one choice model (2026-09-11)

### `openwiki/editor-interior-room-harness.md` — 49KB · 255줄 · ~14,266 토큰

- `L5` Interior authoring/load consistency (2026-09-07)
- `L46` Closed expandable long tables (2026-09-07)
- `L87` 사용자 타일 정정: 항아리·돌계단·석조 화로
- `L98` 여관 검수표와 숙박 검증
- `L106` 여관 꾸러미 전면 재구성 (2026-09-06)
- `L125` 실내 의미·형태 검토 반영 (2026-09-05)
- `L138` 모든 AI 실내의 개념 꾸러미 계약 (2026-09-05)
- `L149` Tileset-specific map generation contract
- `L161` Interior Room Session Harness (villager-room-v1)
- `L174` Safe detached draft and approval harness
- `L182` Interior object catalog is the shape source of truth (2026-08-28)
- `L193` 소품 표면 어휘가 `PlacementZone` 으로 통일됐다 (2026-08-30, PR #316)
- `L206` 개념 시설 시공 — place_concept 경로가 파이프라인에서 다른 점 (2026-09-02)
- `L220` 도면 호환성과 외장 스탬프 후속 (2026-09-05)
- `L226` 입구 예약·멀티타일 통행 복원 (2026-09-05)
- `L234` 공포 게임 제작 기능 (2026-09-05)
- `L238` 여관 외 시설의 공간 구성 (2026-09-05)
- `L248` PR618 통합: 큰 탁자와 기존 시설 구성 (2026-09-06)

### `openwiki/editor-observability.md` — 38KB · 471줄 · ~10,680 토큰 · 깨진 줄 1

- `L21` Opt-in local diagnostics (issue 693 OUT-009 / OUT-010)
- `L74` 계측 초크포인트는 `store.markLocalMutation` 하나다
- `L109` 새 편집 기능을 추가할 때 — 라벨을 넣어라
- `L128` AI 적용 경로 — 이쪽이 주 경로다
- `L159` P3 owner-bound publication (2026-09-07)
- `L228` P2 outcome publication (2026-09-06)
- `L291` 되돌리기 스택과 감사 로그는 다르다
- `L312` Toolbar history confirmation lifetime (PR716, 2026-09-09)
- `L331` 디버깅 레시피
  - `L373` 저장된 것 — DB 커밋에 실린 행위 (`npm run commit:log`)
- `L408` 로거
- `L422` 알려진 남은 공백 (여기 손대는 사람이 이어서 하라)
- `L455` AI 툴·액션 이유 (2026-09-02)
- `L465` 검증

### `openwiki/editor-pre-edit-routing.md` — 105KB · 590줄 · ~30,240 토큰 · 통째읽기 잘림 · 깨진 줄 5

- `L7` Exterior door backing
- `L17` Tile brush reliability (2026-09-06)
- `L55` Combo Brush (2026-09-10, OPRN-OUT-022)
  - `L60` 용어 (코드와 UI 가 같은 말을 쓴다)
  - `L72` 소유 경계
  - `L84` 근거 규칙 — 번호 인접으로 추론하지 않는다
  - `L95` 검토 책임
  - `L107` 경계와 진단
  - `L117` 회귀 이음줌
- `L129` Pre-edit routing
  - `L131` 명명 로케이션 레이어 (2026-09-10)
  - `L213` 로케이션 역할과 겹침 클릭 (2026-09-12)
  - `L251` 설계 영역 이관 도구 (LOC-ADOPT, 2026-09-10)
  - `L253` 로케이션 앵커 — 좌표 대신 이름으로 가리키기 (2026-09-12)
  - `L306` Standard / Expert focus modes (2026-09-07; supersedes sidebar density notes below)
  - `L365` Automatic usage guides disabled (2026-09-06)
  - `L375` Sidebar mode workflow (2026-09-06; supersedes older 72px/tile-flyout notes below)
- `L463` Agent cautions
- `L473` 헤더 용어 정본과 중복 감사 (2026-08-30)
  - `L504` 톱바 영역 진입점 감사표 (`renderTopbar` 실측)
  - `L536` 사이드바 ↔ 톱바 소유권 (2026-08-30 중복 정리)
  - `L565` 스튜디오 바 — 톱바 한 줄 (2026-09-03, 표준·전문가 대격변)

### `openwiki/editor-storage-chest.md` — 1KB · 15줄 · ~333 토큰

- `L5` Storage chest authoring

### `openwiki/editor-validation.md` — 45KB · 342줄 · ~12,142 토큰

- `L3` Event validation location and UNSENT handoff (issue 693, 2026-09-08)
- `L40` AI blocked-event relocation recovery (2026-09-06)
- `L134` AI 타일 후검증 (2026-09-05)
- `L139` 이벤트 초안 검증 표면 (2026-08-28)
- `L144` event-unreachable lint rule (2026-08-27)
- `L151` P2 생활 시스템 무결성 (2026-08-25)
- `L156` 생활 저작 표면 집중 검증 (2026-08-24)
- `L172` AI editor-wide tool validation (2026-08-25)
- `L178` Roguelike run validation (2026-08-24)
- `L185` Validation Expectations
- `L209` Desktop UI integration matrix (2026-08-11)
- `L219` Event editor aggregate gate (2026-07-30)
- `L228` P2 spatial integrity (2026-08-25)
- `L235` 손붓이 hard 클러스터에 막혔을 때의 복구 경로 (2026-09-10, OPRN-OUT-017)
  - `L281` `bAlt`/`aAlt` 패리티 — 별도 리뷰 결과: **실제 결함이었고 고쳤다** (2026-09-10)

### `openwiki/editor-workflows-misc.md` — 65KB · 456줄 · ~17,604 토큰 · 통째읽기 잘림

- `L7` Other Editor Workflows
  - `L9` New-project name and player title (2026-09-07)
  - `L19` 걸을 때 적 만나기 — rectangle authoring (2026-09-06)
  - `L85` Game export delivery (2026-09-06)
  - `L196` Audio descriptions and live resource ownership
  - `L279` Genre-neutral authoring launcher and journey (2026-08-24)
- `L329` 편집기 z 층 밴드와 토스트 (2026-08-30, PR #308)
- `L358` 초보 맵 사이드바 «목록 | 상세» 2단 탐색기 (2026-08-30, PR #311)
- `L380` 커스텀 셀렉트는 열릴 때 modalStack 층이 된다 (2026-08-30)
- `L394` 맵 설정 가독성·편집 연속성 (2026-09-05)
- `L404` 왼쪽 사이드바 3모드 적대적 리뷰 (2026-09-05)
- `L415` Authoring viewport navigation (issue 693, 2026-09-08)

### `openwiki/editor-workflows.md` — 2KB · 28줄 · ~586 토큰

- `L5` Topic pages
- `L17` Quick routing
- `L25` For AI agents

### `openwiki/growth-trees.md` — 23KB · 256줄 · ~7,027 토큰

- `L3` 소유권과 데이터
- `L31` 성장 트리 그림 (Phase 1, 2026-09-05)
- `L56` 명시적 프리셋 추가 (Phase 2, 2026-09-06)
- `L82` 런타임과 저장
- `L105` 통합 성장 런타임 (2026-09-06)
  - `L149` Runtime review corrections (2026-09-06)
  - `L166` 통합 API
- `L190` 연결 프리셋과 그래프 (2026-09-06)
- `L224` 검증

### `openwiki/horror-authoring.md` — 17KB · 183줄 · ~5,424 토큰

- `L6` 저작 표면
- `L21` 데이터와 런타임
- `L38` 연결 방 추격 연속성 (2026-09-06)
- `L64` NPC 발견 이벤트와 공통 전투 소유권 (2026-09-06)
- `L124` 가구 밀기 애니메이션 (2026-09-05 후속 체험 수정)
- `L147` 실내 제작과 검증
- `L158` 검증 경로
- `L172` 전체 게이트 후속 수정 (2026-09-05)

### `openwiki/interior-tile-benchmark.md` — 9KB · 158줄 · ~2,814 토큰

- `L11` Floor contract correction (2026-09-08)
- `L20` 왜 interior 를 정답지로 쓰는가
- `L36` 재현성 설계 — 3층
- `L53` 채점 방안 6종
- `L77` 헤드라인 지표 — wallAny vs houseShellWall
- `L89` 태스크 12종
- `L96` 정답 카테고리 파생 (`groundTruth.ts`)
  - `L106` 함정 두 개 (실측으로 발견, 재발 방지용 기록)
- `L124` 실행
- `L144` 안티-게이밍 규칙
- `L154` 이 페이지를 갱신해야 하는 변경

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

### `openwiki/location-layer-affordance-audit.md` — 13KB · 130줄 · ~3,930 토큰

- `L10` 결론
- `L17` 분류 — «구역이 존재하는 화면» 은 로케이션 레이어다 (2026-09-11 확인)
- `L32` 실측 (2026-09-11, A 적용 **전** 기준선)
- `L45` 막혀 있는 채널 (설계 결정이므로 우회하지 마라)
- `L52` 검증 공백 (실측)
- `L71` 후보 수정 (A 만 적용, B/C/D 미적용)
- `L84` A 구현 (2026-09-11)
- `L105` 남은 일 (B/D)
- `L119` 검증 좌표

### `openwiki/monster-resource-editor.md` — 3KB · 60줄 · ~860 토큰

- `L3` Entry and ownership
- `L19` State and mutation contract
- `L49` Verification

### `openwiki/night-monster.md` — 9KB · 120줄 · ~2,820 토큰

- `L7` 현재 개정본 (2026-09-05)
- `L37` 초기판 정본과 제작 경로 (역사 기록)
- `L51` 초기판 게임 구성과 공략 (현재 개정본에는 적용하지 않음)
- `L69` 초기판 검증과 발견한 함정
  - `L88` 2026-09-05 실측
  - `L103` 사용자 플레이 후 체험 QA 정정 (2026-09-05)

### `openwiki/placed-place-edits.md` — 5KB · 79줄 · ~1,282 토큰

- `L3` Scope and ownership
- `L13` Mutation contract
- `L47` Actual read models and lifecycle data
- `L64` Verification

### `openwiki/project-wiki.md` — 9KB · 160줄 · ~2,422 토큰

- `L6` Data and evidence
- `L19` Ownership and retrieval
- `L46` Editor lifecycle
- `L107` Combat acceptance slice
- `L119` Verification

### `openwiki/quickstart.md` — 16KB · 179줄 · ~4,778 토큰

- `L6` 0. 여기서 에이전트가 실제로 헤매는 이유 (실측 2026-08-30)
- `L17` 1. 환경 — 여기가 틀리면 이후 전부 헛수고
- `L45` 1a. Mac novice launcher / private setup (Phase 1, 2026-09-06)
- `L81` 1b. 전체 BGM은 Release 팩으로 설치
- `L96` 2. 검증 — 무엇이 진짜 게이트인가
- `L116` 3. 어디를 고치나 — 기능 → 진입 파일
- `L161` 4. 위키를 읽는 법
- `L173` 5. 끝났다고 말할 수 있는 조건

### `openwiki/runtime-action-combat.md` — 26KB · 300줄 · ~6,633 토큰

- `L12` Activation contract
- `L33` Architecture and pure rule modules
  - `L53` Rule module responsibilities
- `L82` Scene integration layer
- `L99` Schema definitions and clamps
  - `L103` `SystemActionCombat` (`project.system.actionCombat`)
  - `L115` `EnemyActionProfile` (`EnemyRecord.actionProfile`)
  - `L129` `ActionWeaponProfile` (`EquipmentRecord.actionWeapon`)
  - `L134` `ActionSkillProfile` (`SkillRecord.actionSkill`)
- `L141` HUD presentation
- `L147` Design decision: Tile-grid movement vs pixel movement
- `L157` Factions and NPC-vs-NPC combat
  - `L161` Data flow
  - `L165` Runtime stance overlay and its save rule
  - `L171` Pure rule module
  - `L179` Scene behaviour
  - `L191` Bounding the simulation
- `L195` Out of scope / deliberately unsupported
- `L201` Verification and test coverage
  - `L203` Runtime-owned AI action proof (2026-09-07)
  - `L269` Pure rule unit tests
  - `L296` E2E browser specifications

### `openwiki/runtime-and-data.md` — 3KB · 27줄 · ~733 토큰

- `L5` Topic pages
- `L15` Quick routing
- `L24` For AI agents

### `openwiki/runtime-battle.md` — 134KB · 540줄 · ~38,257 토큰 · 통째읽기 잘림

- `L3` Native event battle admission (2026-09-08)
- `L49` Supported action authoring (2026-09-07)
- `L61` 적별 전투 표시 크기 (2026-09-06)
- `L71` Capture-only victory (2026-09-08)
- `L82` Event friendship and live level changes (2026-09-06)
- `L101` Sequential battle event completion (2026-09-08)
- `L136` Battle-event continuation and cancellation (2026-09-06)
- `L179` 전투 명령 custom CSS (2026-09-05)
- `L183` 빈 페이지와 실행 빈도 계약 (2026-09-05)
  - `L200` 체공 배율 채널과 착지 눌림 (2026-08-30, PR #297)
- `L218` 지원 전투 시스템은 둘뿐이다 (2026-08-28)
- `L231` Roguelike run boundary (2026-08-24)
- `L236` Battle rules & runtime
  - `L251` 전투 화면 표현 · 전환 · 타임라인 · 연출 타이밍
  - `L276` 커맨드/대상 메뉴 기하와 글자 가시성 계약
  - `L292` 스킨 CSS 캐스케이드와 저작 가능 스킨
  - `L296` Gen 1(포켓몬식) 규칙 모델
  - `L304` 플레이 모드 런타임 (이 절에 섞여 있는 비전투 항목)
  - `L323` 전투 흐름 · 몬스터 수집 · 트룹 이벤트 · 보상
- `L361` Starter hero battle sheets (2026-08-29)
- `L382` Per-actor back battlers (2026-08-29)
- `L400` Battle input and visibility P0 contract (2026-07-30)
- `L411` 배틀러 idle 애니메이션 (2026-08-30)
- `L537` 필드 아이템 상태 부여 복구 (2026-09-05)

### `openwiki/runtime-m2-flow-controls.md` — 25KB · 137줄 · ~6,758 토큰

- `L5` Map-effect repair boundary (2026-09-06)
- `L12` Sound Layer audio controls (2026-09-06)
- `L19` M2 Runtime Flow Controls
- `L49` Storage chest authoring
- `L55` Page 3 location/vehicle compatibility (2026-07-30)
- `L59` 저장된 M2 명령 실행 연결 복구 (2026-09-05)
- `L72` 좌표 목적지 이동의 실패 계약 (OPRN-OUT-013, 2026-09-10)
  - `L131` 이동 중 경로 재지정 — 2026-09-05 브라우저 적대적 QA

### `openwiki/runtime-pre-edit-routing.md` — 36KB · 214줄 · ~10,326 토큰

- `L175` ESC skill thumbnails (2026-09-06)
- `L186` Recovered head emotes (2026-09-05)
- `L192` 메뉴 입력·불러오기 배율 (2026-09-05)
- `L200` 가구 밀기 애니메이션 (2026-09-05)
- `L209` Recovered head emotes (2026-09-05)

### `openwiki/runtime-project-schema.md` — 134KB · 859줄 · ~36,217 토큰 · 통째읽기 잘림

- `L3` Truthful migrated-load state (2026-09-07)
- `L36` Explicit publication identity and Save6 (2026-09-06)
- `L94` Spatial canonical routing (task6 backend increment, 2026-09-07)
- `L136` P1 accepted-save receipts and read-only proof (2026-09-06)
- `L186` Opening and game-over cinematic settings (2026-09-06)
- `L203` 적 전투 이미지 크기 (2026-09-06)
- `L207` Project monster metadata overrides (foundation, 2026-09-07)
- `L249` Project audio description overrides
  - `L278` Concurrent persistence
  - `L303` Editor preservation and playable export
- `L317` Character/face authoring metadata (2026-09-06)
- `L324` Character appearance sets v1 (2026-09-06)
- `L361` New-project save/reload verification (2026-09-05)
- `L369` Task15 nonvisual economy command contract (2026-09-08)
- `L380` Independent game Save5 boundary (2026-09-06)
- `L386` Life ownership in Save5 (2026-09-06)
- `L402` Placement safety core (task12, 2026-09-06)
- `L414` Project-authored equipment slots (2026-09-05)
- `L422` 전투 명령 CSS (2026-09-05)
- `L426` 기본 카탈로그 삭제 보존 (2026-09-05)
- `L430` 전투 페이지 중복 ID 복구와 슬롯 참조 (2026-09-05)
- `L443` 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)
- `L451` 세계 법칙의 명시적 부재 (2026-09-05)
- `L455` Showcase media save-copy durability (issue #693, 2026-09-08)
- `L495` Project schema & persistence
- `L724` Variable arithmetic & loop runtime (2026-08-07)
- `L728` Canonical event-draft projection (2026-07-30)
- `L734` P2 general buildings and home decorations (2026-08-25)
- `L741` 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)
- `L759` Boot normalizers must not create dangling references (2026-08-30)
- `L785` `.oprn` 은 단일 파일 게임 컨테이너다 — 편집기와 플레이어 양쪽이 읽는다 (2026-08-30)
- `L819` 성장 트리 선택 확장 (2026-09-05)
- `L825` 마을 설계서 (2026-09-05)
- `L831` 공포 게임 제작 기능 (2026-09-05)
  - `L835` 저장된 대사 별칭과 맵 오버레이 (2026-09-05)
- `L839` NPC 표시 이름 (2026-09-05)
- `L852` 연결 실내 도면의 영속성 (2026-09-05)
- `L856` 개념 장소 형상 (2026-09-05)

### `openwiki/runtime-sessions.md` — 89KB · 318줄 · ~23,590 토큰 · 통째읽기 잘림

- `L1` Opening and game-over cinematics (2026-09-06)
- `L67` Recovery ledger and scheduled failure ownership (2026-09-09)
- `L75` Task10 field input and exact forage dates (2026-09-06)
- `L89` QA-only life observation (2026-09-06)
  - `L95` Audio QA capability and shell lifetime (2026-09-06)
- `L101` Save5 session boundary (2026-09-06)
- `L109` Life recovery primitives and maker evidence (2026-09-06)
- `L121` Lossless life snapshot reconciliation (2026-09-06)
- `L135` Esc 메뉴 작업 프레임 (2026-09-05)
- `L165` 아이템 종류 전환과 실행 효과 (2026-09-05)
- `L176` Roguelike run kernel and field rooms (Phase 0–3, 2026-08-24)
- `L186` P1 daily-weather transition authority (2026-08-25)
- `L195` Event audio state (U14)
- `L203` Session state & life-sim
- `L278` Editorial title screen (2026-08-26)
- `L284` playerTouch trigger contract (2026-08-20)
- `L288` Selected-event runtime sandbox (2026-07-30)
- `L294` P2 spatial runtime and saves (2026-08-25)
- `L308` 공포 게임 제작 기능 (2026-09-05)
  - `L312` 메뉴 PR 통합 검증 (2026-09-05)

### `openwiki/se-catalog.md` — 15KB · 257줄 · ~3,910 토큰

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
- `L242` Traps

### `openwiki/spatial-ai-tools.md` — 11KB · 142줄 · ~2,692 토큰

- `L3` Ownership
- `L34` Preview versus publication
- `L69` Legacy adapters and context
- `L110` Evidence and integration boundary
- `L127` Completed region references (2026-09-13)

### `openwiki/spatial-authoring-controller.md` — 18KB · 294줄 · ~4,590 토큰

- `L6` Status and ownership
- `L18` Panel contract
- `L81` Compiled geography member motion (2026-09-09)
- `L111` Selective standalone-object graphic replacement
- `L140` Editable preview continuation
- `L162` Atomicity and stale checks
- `L179` Exact connection cleanup
- `L248` Verification and remaining integration

### `openwiki/spatial-geography-compiler.md` — 8KB · 145줄 · ~2,166 토큰

- `L8` Public path
- `L31` Terrain and structures
- `L61` Settlement regions (2026-09-12)
- `L83` Ownership and regeneration
- `L106` Contract fixtures and proof

### `openwiki/spatial-geography-ui.md` — 9KB · 166줄 · ~2,294 토큰

- `L7` Public modules
- `L26` Settlement regions (2026-09-12)
- `L61` Catalog read-only rendering (2026-09-12)
- `L83` Authoring rules
- `L123` Fixtures
- `L129` Proof
- `L138` Completed map references (2026-09-13)

### `openwiki/spatial-manual-build.md` — 11KB · 177줄 · ~2,738 토큰

- `L11` Public entry points
- `L28` Inputs and display obligations
- `L56` Preview and Apply
- `L105` Compile owner for placed adapters
- `L128` Source Build UI controls
- `L158` Verification

### `openwiki/spatial-overview-associations.md` — 6KB · 107줄 · ~1,557 토큰

- `L6` Persisted identities
- `L33` Validation and compiler boundaries
- `L58` Lifecycle and compatibility
- `L89` Reproduction

### `openwiki/spatial-place-compiler.md` — 2KB · 28줄 · ~405 토큰

절 제목 없음 (평면 목록 페이지).

### `openwiki/spatial-placed-space-edits.md` — 5KB · 75줄 · ~1,209 토큰

- `L7` Controller API
- `L41` Frozen authority and atomicity
- `L61` UI integration boundary

### `openwiki/spatial-space-member-ui.md` — 1KB · 31줄 · ~360 토큰

- `L8` Binding
- `L26` Geometry

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

### `openwiki/testing.md` — 188KB · 1725줄 · ~51,521 토큰 · 통째읽기 잘림

- `L1` 전체 스위트가 워커 힙에서 죽던 문제 (2026-09-11)
- `L35` P5 delivery gates and the P4 regressions they caught (2026-09-09)
  - `L37` Open: checkpoint writes still slow the authoring loop
- `L89` P4 checkpoint storage and boot admission (2026-09-09)
- `L143` P3 request-bound fixture alignment (2026-09-08)
- `L168` Issue 693 verification contracts (2026-09-08)
- `L192` Request-coverage gate follow-up (2026-09-08)
- `L235` Native event battle reliability QA (2026-09-08)
- `L271` Real large-world player QA (2026-09-07)
- `L280` CSS budget: file count is informational
- `L292` Selection and composer surface contracts (2026-09-06)
- `L311` P3/current-main composition fixtures (2026-09-08)
  - `L338` Cooperative Node scheduling in long session fixtures (2026-09-08)
- `L354` AI turn observation contracts (2026-09-06)
  - `L375` P2 R1 retained-draft Ask (2026-09-07)
  - `L413` P2 R3 wiki delivery (2026-09-07)
- `L442` P3 ownership and stale-base verification (2026-09-07)
  - `L517` Autosave status fixture ownership (2026-09-08)
  - `L531` Project history transport isolation
- `L563` Canonical project storage versus AI history (2026-09-06)
- `L577` Action RPG authoring and runtime proof (2026-09-07)
- `L598` Database CSS ownership contracts (2026-09-06)
- `L619` Audio description verification
  - `L643` Real editor surfaces
  - `L670` Exported-player playback and dependency evidence
- `L719` Mac onboarding Phase 1 contracts (2026-09-06)
- `L747` Task10 field-input verification and limits (2026-09-06)
- `L763` Life QA observation and action receipts (2026-09-06)
  - `L771` Task5 validation correction (2026-09-06)
  - `L779` Task5 Q1 audio boundary correction (2026-09-06)
- `L787` 기존 실패 비교는 진단 내용까지 확인한다 (2026-09-05)
- `L804` Esc 메뉴 동작·시각 검증 (2026-09-05)
- `L820` Completed-house Phase 2 verification (2026-09-06)
- `L851` P2 낚시·채집·도감·박물관 focused gate (2026-08-25)
- `L858` Map-owned overlays: actual AI-turn browser regression (2026-09-05)
- `L867` Editor e2e boot-overlay determinism (2026-08-31)
- `L872` 영역 다듬기 focused gate (2026-08-31)
- `L879` AI 이벤트 배치 통행성 focused gate (2026-08-30)
- `L887` 체공(점프·낙하) focused gate (2026-08-29)
  - `L896` 좌표 목적지 이동 QA — `node scripts/qa-coordinate-move.mjs` (OPRN-OUT-013, 2026-09-10)
  - `L913` 좌표 이동 저작 폼 QA — `node scripts/capture-coordinate-move-form.mjs`
  - `L922` 체공 런타임 QA — `npm run qa:runtime -- --scenario hop`
  - `L952` 워크트리에 `node_modules` 가 없을 때 (2026-08-29 실측)
- `L1015` Roguelike run Phase 0–3 coverage (2026-08-24)
  - `L1026` 조건 게이트를 부하 중에 재지 마라 (실측 2026-08-29)
- `L1035` 데이터베이스 UI/UX 계측 하네스 (2026-08-30)
  - `L1059` 가상 요소 텍스트를 안 재면 `tinyFont 0` 은 "안 봤다" 는 뜻이다 (실측)
  - `L1080` 0px 이미지는 "깨진 것" 과 "접힌 것" 을 갈라야 한다 (실측)
  - `L1086` 타이밍에 취약한 e2e 가 빨간불이면 그 스펙이 단정하는 속성을 직접 재라 (실측 2026-08-30)
  - `L1109` 소스를 grep 하는 테스트는 이름만 봐서는 회귀를 못 가른다 (실측)
- `L1117` Agent validation rule
- `L1227` Event-editor trust-loop validation (2026-07-30)
- `L1232` 얼굴 바꾸기(changeFace) 폼 시각 계약 (2026-08-28 실측)
- `L1251` Tile-to-world persistence concurrency (task20)
- `L1257` P2 spatial focused gate (2026-08-25)
- `L1266` 대화창 연출 focused gate (2026-08-30)
- `L1341` 워크트리 e2e 는 dev 서버가 조용히 안 뜬다 (2026-08-27 실측)
  - `L1354` `locator.click()` 은 잘림 버그를 구조적으로 못 잡는다 (2026-08-29 실측)
  - `L1366` 스크롤이 생겼다고 다 닿는 건 아니다 — 가운데 정렬 넘침 (2026-08-30 실측)
  - `L1374` 미정의 커스텀 프로퍼티는 콘솔에 아무 말도 남기지 않는다 (2026-08-30 실측)
  - `L1381` `ERR_NETWORK_CHANGED` 는 HMR 말고 호스트 인터페이스 때문에도 터진다 (2026-08-28 실측)
- `L1403` 런타임(게임) 전용 비전 QA 하네스 (2026-08-28)
  - `L1405` 메뉴 적대적 플레이 회귀 (2026-09-05)
- `L1542` sceneTestRunner 의 자율 이동 관측 공백 (2026-08-27)
- `L1549` fakeDom 은 프로덕션이 쓰는 브라우저 전역을 빠짐없이 준다 (2026-08-29)
  - `L1570` Shared fake DOM enhancement contracts (2026-09-08)
- `L1602` bugfix-sweep 실제 표면 하네스 (2026-08-29)
- `L1615` 마을 설계서 (2026-09-05)
- `L1620` 공포 제작 개정 QA와 개발 서버 전송 (2026-09-05)
- `L1630` 상점 진열 중심 편집 검증 (2026-09-05)
- `L1638` 실제 DB로 나가는 전체 검사 요청 (2026-09-05 실측)
- `L1644` Request-bound functional acceptance verification (2026-09-07)
- `L1712` 조수 보상 저작과 출하 플레이어 검증 (2026-09-06)
- `L1722` 실내 조립·형상 검증 (2026-09-05)

### `openwiki/tile-layer-policy.md` — 12KB · 165줄 · ~3,731 토큰

- `L11` 다섯 부류
- `L24` 받침(backing) 메타
- `L34` 커스텀 칩셋 준비 — 검토 신호, 자동 변형 금지
- `L44` 나무 밑동 290~293 을 상위로 옮기면 안 되는 이유
- `L52` OPRN-OUT-017 과의 관계 (원인 공유는 미증명)
- `L63` 테스트
- `L73` 브라우저 증거 (2026-09-10)
- `L93` 커스텀 칩셋 픽셀 자동 감지 — 출하된 계약
  - `L116` 임계값 — 실제 시트를 재서 얻은 수치다 (2026-09-10)
  - `L131` 브라우저 실측 (Modern Exteriors 아틀라스 480칸)
- `L139` 아직 결정이 필요한 것 (제품 소유자)
- `L144` 캔버스 렌더러도 받침 계약을 진다 (2026-09-12 실측 결함)

### `openwiki/town-tile-benchmark.md` — 10KB · 153줄 · ~3,024 토큰

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

### `openwiki/ui-discovery-pilot.md` — 6KB · 108줄 · ~1,430 토큰

- `L7` Contract
- `L27` Run
- `L54` Score and decide
- `L69` Image capability trap
- `L81` 2026-09-08 pilot result

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
