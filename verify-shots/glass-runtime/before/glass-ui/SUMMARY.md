# 런타임 QA — glass-ui

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 게이트: 통과 (비트 4개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 2개
- 런타임 에러: 없음
- 프로젝트: test/fixtures/projects/glass-ui-qa-v3.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| field-start | Start a new game beside town-npc at (1,1) | 통과 | — | — |
| shop-open | Talk to town-npc, open the goods list, and photograph the shop window | 통과 | 02-shop-open.png | 시각 확인 대기 |
| shop-close | Cancel out of the shop so the next event command can run | 통과 | — | — |
| name-entry-open | Wait for and photograph the hero name-entry window | 통과 | 04-name-entry-open.png | 시각 확인 대기 |
