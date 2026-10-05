# 런타임 QA — assistant-capability-npc-golem

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 6개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 6개
- 런타임 에러: 없음
- 프로젝트: qa-runs/harnesses/assistant-capability/charset-label-audit-20261005-r2/npc-golem/player.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | — | 통과 | 01-title.png | 시각 확인 대기 |
| start | — | 통과 | 02-start.png | 시각 확인 대기 |
| first-line | — | 통과 | 03-first-line.png | 시각 확인 대기 |
| close | — | 통과 | 04-close.png | 시각 확인 대기 |
| repeat | — | 통과 | 05-repeat.png | 시각 확인 대기 |
| repeat-close | — | 통과 | 06-repeat-close.png | 시각 확인 대기 |

## 수행 하네스 필수 시각 QA

비트 통과와 별도로 실제 화면을 읽어 판정한다.

- 즉시 확인: 02-start.png — 요청한 대사·선택·금액·취소 결과 또는 대상 보존
- 즉시 확인: 03-first-line.png — 요청한 대사·선택·금액·취소 결과 또는 대상 보존
- 즉시 확인: 05-repeat.png — 요청한 대사·선택·금액·취소 결과 또는 대상 보존
