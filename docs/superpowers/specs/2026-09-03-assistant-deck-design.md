# AI 조수 「데크」 설계 (2026-09-03)

정본 제안서: `docs/2026-09-03-ai-assistant-modern-ui-proposal.html` (실측 21장 · 목업 14장 · 결정 D1~D6).
감독은 2026-09-03 "그래 그렇게 하고 커밋 PR 까지 해" 로 **제안 A 「데크」와 결정 D1~D6 의 추천안 전부**를 승인했다.
이 문서는 구현 계획(`docs/superpowers/plans/2026-09-03-assistant-deck.md`)이 인용하는 요약이다.

## 결정 (승인됨)

| # | 결정 | 구현 |
|---|---|---|
| D1 | 38px 상태 레일을 둔다(유휴 포함 항상). 상태 점·이름·맵·상태 문장·진행 헤어라인 + 아이콘 5(맥락 % · 새 대화 · 이전 대화 · 성향 · 더보기 · 접기) | `aiDeckRail.ts` |
| D2 | 사용자 발화는 오른쪽 인디고 말풍선, 조수는 왼쪽 산문 | `18-assistant-deck.css` 의 `.ai-command-row[data-role]` |
| D3 | 완료된 작업 그룹은 자동 접힘(요약 = 라벨 → 라벨), 진행 중은 펼침 | `aiConversationLog.ts` |
| D4 | 모델 이름 칩은 표준·전문가 모드에서 컴포저 행 오른쪽에 노출 | `aiComposer.ts` `modelChip` |
| D5 | 추천은 맵 진단 힌트 + 실행 문장 행 3개. 단어 칩 6개 폐기 | `aiChatPanel.ts` `refreshNextSteps` |
| D6 | 「대기 화면」 3분기는 ☰ 메뉴에서 설정 모달로 이동 | `aiSettingsModal.ts` + e2e 갱신 |

## 표면 계약

- DOM: `aside.ai-chat-panel` > `div.ai-deck[data-testid=ai-deck]` > (`div.ai-deck-rail`, `div.ai-chat-body`, `div.ai-command-bar`). 팝오버는 데크 자식(absolute), 닫히면 `hidden`. 투명 전면 레이어 금지.
- 데크 폭: 유휴 480(`--ai-float-compact-width`) / 열림 760(`--ai-float-bar-width`, 1280 폭에서 640). 대화 영역 `max-height: min(660px, 62vh)`, 넘치면 안에서 스크롤.
- 상태 5 = `idle | run | attention | done | error` → `panel.dataset.aiState`, 레일 점 색 + 문장. 진행 중 상단 2px 헤어라인.
- 접힘 알약 = 같은 5상태(`.ai-collapsed-restore[data-ai-state]`) + 확인 필요 개수 배지.
- 색은 tokens.css 만: 인디고 `--accent`, 확인 필요 `--warning`, 완료 `--success`, 오류 `--danger`. 새 hex 0. `!important` 0.
- 유리 = `color-mix(in srgb, var(--bg-raised) 90%, transparent)` + `blur(20px) saturate(1.08)`. 유리 위 보조 글자는 `--text-2`.
- 보존 testid: `ai-panel ai-command-bar ai-input ai-send ai-abort ai-collapse ai-collapsed-restore ai-new-chat ai-open-conversations ai-command-menu-toggle ai-command-menu ai-context-chips ai-selection-chip ai-pending-queue ai-status ai-chat-log ai-command-row-user ai-command-row-assistant ai-tool-activity-toggle ai-tool-entry ai-change-card ai-change-shot-before ai-change-shot-after ai-change-undo ai-quick-replies ai-suggest-popover ai-next-steps ai-next-steps-hint ai-preference-toggle ai-context-meter ai-history-*`.
- 삭제 testid: `ai-log-zoom ai-log-zoom-in ai-log-zoom-out ai-log-zoom-label ai-log-chrome ai-log-resize-handle` (기록 줌·높이 축 폐기 — 글자 크기는 설정 모달·Ctrl+휠).
- 이동 testid: `ai-command-temperature-*` 는 설정 모달 「대기 화면」 절로.

## 범위 밖

우측 도크 부활, 얼굴, 데이터 층(`src/ai/*`) 변경, 툴 브라우저 정보 구조, 계획 승인 흐름 신설(기존 자율 런 체크리스트 재도장만).
