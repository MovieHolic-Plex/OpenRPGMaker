# 런타임 QA — live-first-game-release

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 7개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 7개
- 런타임 에러: 없음
- 프로젝트: output/qa/first-core/game-web/project.json
- 시드: 1 / 뷰포트: 1280×900

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | 다운로드한 ZIP의 실제 player.html 및 project.json 부팅 | 통과 | 01-title.png | 시각 확인 대기 |
| opening | 저장된 오프닝 | 통과 | 02-opening.png | 시각 확인 대기 |
| field | 실제 시작 맵과 디코딩된 플레이어 그림 | 통과 | 03-field.png | 시각 확인 대기 |
| clock | 정상 이동으로 회중시계 조사 | 통과 | 04-clock.png | 시각 확인 대기 |
| response | 실제 선택과 각기 다른 결과 대사 | 통과 | 05-response.png | 시각 확인 대기 |
| route | 대사 종료 → 동쪽 문 → 기억의 길 | 통과 | 06-route.png | 시각 확인 대기 |
| ending | 전환 완료 뒤 정상 이동·조사로 첫 구간 종료 | 통과 | 07-ending.png | 시각 확인 대기 |
