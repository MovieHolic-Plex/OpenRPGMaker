# 런타임 QA — smoke

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 게이트: 통과 (비트 4개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 4개
- 런타임 에러: 없음
- 프로젝트: test/fixtures/projects/editor-authored-demo-v3.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | 타이틀 화면이 뜬다 | 통과 | 01-title.png | 시각 확인 대기 |
| field-start | 새 게임 → 등대 마을 시작 지점, 플레이어 스프라이트가 실제로 그려진다 | 통과 | 02-field-start.png | 시각 확인 대기 |
| teleport-forest | 맵 전환 — 달우물 숲 | 통과 | 03-teleport-forest.png | 시각 확인 대기 |
| teleport-shrine | 맵 전환 — 하늘등 신전 | 통과 | 04-teleport-shrine.png | 시각 확인 대기 |
