# 런타임 QA — quest-play-proof

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 22개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 14개
- 런타임 에러: 없음
- 프로젝트: output/evidence/quest-library/play-proof.json
- 시드: 1 / 뷰포트: 960×720

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| field | — | 통과 | — | — |
| delivery-accept | 실제 수락으로 배달품을 받는다 | 통과 | — | — |
| delivery-hand-over | 걸어서 NPC에게 실제 물품을 전달·소비 | 통과 | 03-delivery-hand-over.png | 시각 확인 대기 |
| delivery-report | 돌아와 보고하여 100G | 통과 | 04-delivery-report.png | 시각 확인 대기 |
| delivery-repeat-report | — | 통과 | 05-delivery-repeat-report.png | 시각 확인 대기 |
| travel-to-escort | — | 통과 | — | — |
| escort-accept | — | 통과 | — | — |
| escort-join | 실제 NPC가 뒤따르는 동행자가 된다 | 통과 | 08-escort-join.png | 시각 확인 대기 |
| escort-arrival | 직접 목적지까지 이동하여 동행 완료 | 통과 | 09-escort-arrival.png | 시각 확인 대기 |
| escort-report | — | 통과 | 10-escort-report.png | 시각 확인 대기 |
| travel-to-puzzle | — | 통과 | — | — |
| puzzle-accept | — | 통과 | — | — |
| puzzle-clue-dialogue | 실제 단서 조사 | 통과 | 13-puzzle-clue-dialogue.png | 시각 확인 대기 |
| puzzle-clue | 실제 단서 조사 | 통과 | — | — |
| puzzle-wrong-answer | 오답은 비용·완료를 남기지 않고 재도전 가능 | 통과 | 15-puzzle-wrong-answer.png | 시각 확인 대기 |
| puzzle-correct-answer-dialogue | 정답 선택과 마지막 목표 완료 | 통과 | 16-puzzle-correct-answer-dialogue.png | 시각 확인 대기 |
| puzzle-correct-answer | 정답 선택과 마지막 목표 완료 | 통과 | — | — |
| puzzle-report | 세 의뢰를 물리 이동·상호작용으로 완료: 총 300G | 통과 | 18-puzzle-report.png | 시각 확인 대기 |
| reward-total | 실제 게임 메뉴에 표시된 누적 보상 300G | 통과 | 19-reward-total.png | 시각 확인 대기 |
| delivery-quest-log | 게임 의뢰 목록의 배달 완료 상태 | 통과 | 20-delivery-quest-log.png | 시각 확인 대기 |
| escort-quest-log | 목록을 실제 키로 내려 동행 완료 상태 확인 | 통과 | 21-escort-quest-log.png | 시각 확인 대기 |
| puzzle-quest-log | 목록을 실제 키로 내려 수수께끼의 두 단계 완료 상태 확인 | 통과 | 22-puzzle-quest-log.png | 시각 확인 대기 |

## 증거 제출 시각 검토 대상

- 즉시 확인: `04-delivery-report.png` — 실제 배달 완료 대사.
- 즉시 확인: `09-escort-arrival.png` — 동행 목적지 도착과 NPC.
- 즉시 확인: `15-puzzle-wrong-answer.png` — 오답 뒤 재도전 대사.
- 즉시 확인: `18-puzzle-report.png` — 마지막 완료 대사.
- 즉시 확인: `19-reward-total.png` — 실제 메뉴의 돈 300G.
- 즉시 확인: `22-puzzle-quest-log.png` — 실제 목록의 완료 (2/2).
