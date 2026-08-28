# 런타임 QA — battle

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 게이트: 통과 (비트 5개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 2개
- 런타임 에러: 없음
- 프로젝트: test/fixtures/projects/editor-authored-demo-v3.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | 타이틀 화면이 뜬다 | 통과 | — | — |
| field-start | 새 게임 → 등대 마을 시작 지점 | 통과 | — | — |
| face-training-event | 훈련 이벤트(20,14) 남쪽 칸으로 이동해 위를 본다 | 통과 | — | — |
| battle-intro | 대사를 넘겨 전투 진입 — 아군 4명 시트 + 슬라임 2마리가 한 화면에 선다 | 통과 | 04-battle-intro.png | 시각 확인 대기 |
| battle-attack | 공격 커맨드를 확정해 attack/hit 프레임이 실제로 교체되는지 본다 | 통과 | 05-battle-attack.png | 시각 확인 대기 |
