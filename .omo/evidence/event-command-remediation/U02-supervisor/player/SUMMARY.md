# 런타임 QA — event-command-remediation-u02

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 9개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 6개
- 런타임 에러: 없음
- 프로젝트: ../../../../../../tmp/u02-player-MFalZ7/runtime-project.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| boot | — | 통과 | — | — |
| g1-f5 | Real Z executes saved other<=50; reward25 and other40 are untouched | 통과 | 02-g1-f5.png | 시각 확인 대기 |
| choices-ready | — | 통과 | — | — |
| g1-f14 | Real Escape follows saved choice1 to B, not C | 통과 | 04-g1-f14.png | 시각 확인 대기 |
| number-ready | — | 통과 | — | — |
| g1-f15 | Literal keys4,2,Enter write42 only to answer | 통과 | 06-g1-f15.png | 시각 확인 대기 |
| g1-f13 | Authored set17 -> saved start-without-seconds -> stop retains17, not60; other timer stays9 | 통과 | 07-g1-f13.png | 시각 확인 대기 |
| g1-f4 | Edited loop text renders its saved speaker/emotion. Only QA termination commands are appended after the untouched original children. | 통과 | 08-g1-f4.png | 시각 확인 대기 |
| g1-f4-auto-advance | No key: autoAdvance completes text, nested break exits only inner loop, QA marker and outer break execute | 통과 | 09-g1-f4-auto-advance.png | 시각 확인 대기 |
