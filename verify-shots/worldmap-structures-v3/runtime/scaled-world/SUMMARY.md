# 런타임 QA — worldmap-structure-scaled-world

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 6개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 3개
- 런타임 에러: 없음
- 프로젝트: verify-shots/worldmap-structures-v3/scaled-world/runtime-project.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | 타이틀 | 통과 | — | — |
| field | 정본에서 내보낸 실제 맵 시작 | 통과 | 02-field.png | 시각 확인 대기 |
| atlas | M → 실제 세계 지도 | 통과 | 03-atlas.png | 시각 확인 대기 |
| paused-map | 지도가 열린 동안 방향키로 맵이 움직이지 않는다 | 통과 | — | — |
| close | Esc 닫기 | 통과 | — | — |
| physical-door | 실제 출입구를 밟아 연결 맵으로 이동 | 통과 | 06-physical-door.png | 시각 확인 대기 |
