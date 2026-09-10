# 런타임 QA — loc-transition

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 9개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 5개
- 런타임 에러: 없음
- 프로젝트: ../../../../tmp/loc-transition.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | 타이틀 화면이 뜬다 | 통과 | — | — |
| field-start-outside | 새 게임 → (10,8), 광장 밖. 부팅만으로는 구역 이벤트가 돌지 않는다(기준선만 심는다). | 통과 | 02-field-start-outside.png | 시각 확인 대기 |
| step-toward-plaza | (11,8) — 아직 광장 밖이다. 한 칸 접근만으로 발동하지 않는다. | 통과 | — | — |
| enter-plaza | (12,8) 광장 경계를 밟는 걸음 → enter 이벤트의 대사가 떠야 한다 | 통과 | 04-enter-plaza.png | 시각 확인 대기 |
| walk-inside-no-refire | 광장 안에서 두 칸 더 걸어도 enter 가 다시 나지 않는다 (같은 점유 집합) | 통과 | 05-walk-inside-no-refire.png | 시각 확인 대기 |
| leave-plaza | 왼쪽으로 걸어 경계를 넘으면 leave 이벤트의 대사가 떠야 한다 | 통과 | 06-leave-plaza.png | 시각 확인 대기 |
| reenter-fires-again | 나갔다 다시 들어오면 enter 가 또 난다 (일회성이 아니다) | 통과 | — | — |
| walk-to-door | 광장을 나와 문(10,10) 앞까지 걷는다. 나가는 걸음에서 leave 가 한 번 난다. | 통과 | — | — |
| teleport-into-plaza | 문을 밟아 (14,8) 로 장소 이동 — 중간 걸음이 없어도 광장 enter 가 난다 | 통과 | 09-teleport-into-plaza.png | 시각 확인 대기 |
