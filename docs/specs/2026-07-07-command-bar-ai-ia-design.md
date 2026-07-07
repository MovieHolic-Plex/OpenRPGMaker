# 커맨드 바 — 네이티브 AI 에이전트 앱 IA (합의)

- 작성일: 2026-07-07
- 작성자: Claude(Opus, 팀장) — 구현 codex 위임, Claude는 audit/review/gate
- 대상: `rpg-zzu-wt-6a` (branch `feat/phase-6a`), pm2 `rpg-zzu-dist` (localhost:9988)
- 목표: 우측 도크형 AI 어시스턴트를 **하단중앙 커맨드 바 + 위로 떠오르는 오버레이**로 전환해 "네이티브 AI 에이전트 앱" 느낌.

## 브레인스토밍 확정 3결정
1. **커맨드 바 + 위로 떠오르는 오버레이** (Raycast/Cursor ⌘K식). 우측 도크 폐지.
2. **계층 수명**: 채팅·툴활동 스트림은 턴 종료+짧은 idle 후 자동 페이드(휘발), **제안/승인 카드는 sticky**(승인/취소 전까지 고정).
3. **항상 보이는 슬림 바 + `⌃` 확장 메뉴**(전체 기록·새 대화·설정). 슬래시로 스킬, Ctrl+K 포커스.

## 현 구조 (탐색 확인)
- AI 패널은 이미 **body-level `position:fixed` 오버레이**(`editor.ts`가 `main`에 직접 append, 레이아웃 컬럼 아님). `body.ai-panel-docked`가 `.editor-layout`/`.topbar`에 `padding-right` inset을 줘서 맵을 밀어냄.
- 입력행 `ai-chat-input-row`(skillToggle+input+sendButton)와 위성 호스트(slashHost·contextChips·queueIndicator)는 전부 `renderAiChatPanel` 단일 클로저 안. **DOM만 다른 컨테이너로 옮겨도 클로저 참조라 send/스트리밍/슬래시 동작 유지**.
- `mainColumn` 순서: settings, log, proposalHost, chipsHost, slashHost, contextChips, queueIndicator, input-row.
- 토스트(`util/toast.ts` + `palette-player.css`)가 하단중앙 fixed의 정확한 선례: `bottom; left:50%; translateX(-50%); z-index:1000`.
- z-index 지형: 패널 31, 스튜디오 60, 빌드팝업 40, 토스트 1000.

## A. 하단중앙 커맨드 바 (상시)
- 신규 컨테이너 `.ai-command-bar` — body-level `position:fixed; left:50%; transform:translateX(-50%); bottom:<inset>`. 토스트 기하 차용. z-index ~50(모달 아래, 캔버스/툴바 위).
- 구성: `[⌃] [ / 무엇을 만들까요…  ↑ ]`. `ai-chat-input-row`(input=testid `ai-input`, send=`ai-send`)와 **slashHost·contextChips·queueIndicator**를 이 바로 이설. 클로저는 유지.
- 왼쪽 `⌃` 버튼 → 위로 펼치는 메뉴: 🕒전체 기록 · ➕새 대화(기존 새 세션) · ⚙️설정(기존 settings 폼) · 🎬스튜디오. 기존 핸들러 재사용.
- 슬래시 스킬(기존 slashHost·slashSkillMatches), Ctrl+K 포커스(기존) 유지.
- 맵 안 가리게: `body.ai-command-bar-active` → `.editor-layout`에 **하단 inset**(`padding-bottom: var(--ai-command-bar-inset)`) — 기존 `--ai-*-panel-inset` 패턴 재사용. 상태바 위 얹힘 방지.

## B. 위로 떠오르는 오버레이 (계층 수명)
- 신규 `.ai-rising-overlay` — 바 바로 위, 캔버스 위 반투명, 아래→위 성장, `max-height`, 스크롤. z-index 바로 아래.
- **2-존 격리(핵심 신규 로직):**
  - **하단 고정존(바 바로 위) = 제안/승인 카드**: `proposalHost`(testid `ai-proposal-accept` 등)를 렌더. 승인/취소 전까지 sticky. **`runPendingBuilds`(승인하고 시공) 흐름 그대로**.
  - **상단 휘발존 = 채팅·툴활동 스트림**: `log`(testid `ai-chat-log`)·툴활동을 렌더. 턴 종료 + 짧은 idle(예 ~6s) 후 자동 페이드아웃. 다음 입력/스트리밍 시 다시 등장.
- 페이드 타이머는 **휘발존만** 대상. 고정존(제안카드)은 절대 건드리지 않게 존 분리. 스트리밍 중(`ai-status` 진행)엔 페이드 보류.
- `appendBubble`/스트리밍/proposal 렌더 함수는 재사용, 타깃 컨테이너만 이 오버레이의 각 존으로.

## C. 전체 기록 = 확장 패널 (구 도크 재활용)
- `⌃`→🕒전체 기록 → 기존 `.ai-chat-panel.is-docked`(우측 도크) 렌더/CSS를 **"히스토리 뷰"로 재사용**(전체 대화·과거 제안 스크롤). 상시 숨김, 소환 시 표시. 코드 폐기 없이 역할 전환.
- 스튜디오(`is-studio`) 그대로, 확장 메뉴 진입.

## D. 이관/리스크
- 헤더·툴바(새 대화·되돌리기·로그·툴·스튜디오)를 `⌃` 메뉴 + 슬래시로 흡수. `mainColumn` 재배선.
- **동작 불변**: 슬래시·컨텍스트칩·큐·승인시공·스트리밍 전부 기존 함수 재사용, 위치만 변경.
- **testid 계약 유지**(E2E 호환): `ai-input`, `ai-send`, `ai-proposal-accept`, `ai-status`, `ai-chat-log`. 신규: `ai-command-bar`, `ai-command-menu`, `ai-rising-overlay`.
- 위험: `:empty` 숨김 규칙, dock inset↔bottom inset 전환, 페이드 타이머가 승인카드 존을 침범하지 않게 격리, 스트리밍 중 페이드 억제.
- 모델 정책: 모든 LLM `minimax/minimax-m3` 유지. 테스트가 옛 모델 기대하면 테스트를 minimax로.

## 검증
1. `npx tsc --noEmit` 0, `npx vitest run` 2287+ 유지(신규 테스트 포함). 옛 헤더/도크 단언 테스트는 신 IA로 갱신.
2. Playwright E2E: 하단중앙 바 상시 표시, 슬래시 스킬 소환, `⌃` 메뉴(기록/새대화/설정), 집짓기(결정적) 후 **제안카드 sticky** + 채팅 페이드, 승인하고 시공 동작.
3. 스크린샷으로 바+오버레이 육안 확인.
