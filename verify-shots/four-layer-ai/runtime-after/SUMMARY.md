# 런타임 QA — four-layer-trunk

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 7개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 5개
- 런타임 에러: 없음
- 프로젝트: verify-shots/four-layer-ai/run1.repaired.project.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | — | 통과 | — | — |
| boot | — | 통과 | — | — |
| control-grass | 대조: 열린 잔디 (21,12)→위로 한 칸 | 통과 | 03-control-grass.png | 시각 확인 대기 |
| conifer-before | 침엽수 밑동(21,9) 아래 (21,10) | 통과 | 04-conifer-before.png | 시각 확인 대기 |
| conifer-up | 위로 — 밑동 칸에 들어가면 버그 | 통과 | 05-conifer-up.png | 시각 확인 대기 |
| edge-before | 숲 가장자리 밑동 줄 아래 (10,7) | 통과 | 06-edge-before.png | 시각 확인 대기 |
| edge-up | 위로 길게 — (10,5)(10,4) 밑동 줄에 들어가면 버그 | 통과 | 07-edge-up.png | 시각 확인 대기 |
