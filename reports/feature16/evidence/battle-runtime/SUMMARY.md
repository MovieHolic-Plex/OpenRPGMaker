# 런타임 QA — feature16-battle-ui

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 11개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 8개
- 런타임 에러: 없음
- 프로젝트: verify-shots/runtime-qa/_fixtures/feature16-battle-ui.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | — | 통과 | — | — |
| field | — | 통과 | — | — |
| formation | Real player menu: party → formation; active/reserve positions. | 통과 | 03-formation.png | 시각 확인 대기 |
| back-row | — | 통과 | 04-back-row.png | 시각 확인 대기 |
| active-selection | Move reserve scout to first position using the visible formation list. | 통과 | 05-active-selection.png | 시각 확인 대기 |
| field-again | — | 통과 | — | — |
| real-battle | Actual action event launches battle; no report data injected. | 통과 | 07-real-battle.png | 시각 확인 대기 |
| battle-complete | — | 통과 | 08-battle-complete.png | 시각 확인 대기 |
| report-list | — | 통과 | 09-report-list.png | 시각 확인 대기 |
| report-detail | — | 통과 | 10-report-detail.png | 시각 확인 대기 |
| report-back | — | 통과 | 11-report-back.png | 시각 확인 대기 |
