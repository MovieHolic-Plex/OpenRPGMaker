# 런타임 QA — worldmap-autotile-visual

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 실패 (비트 7개 중 3개 실패)
- 열어야 할 샷: 3개 / 전체 샷 6개
- 런타임 에러: 없음
- 프로젝트: qa-runs/worldmap-autotile-visual-20261005/shipping-runtime.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | 정본을 내보낸 플레이어의 타이틀 | 통과 | — | — |
| coast | 해안·오목 만·1칸 지협 | 통과 | 02-coast.png | 시각 확인 대기 |
| bridge-bank | 가로 다리 왼쪽 강둑 | 통과 | 03-bridge-bank.png | 시각 확인 대기 |
| bridge-deck | 실제 입력으로 다리 위에 진입 | 실패 | 04-bridge-deck.png | 게이트 실패 — 즉시 확인 |
| bridge-water-blocked | 다리에서 위쪽 물 칸으로 빠지지 않는다 | 실패 | 05-bridge-water-blocked.png | 게이트 실패 — 즉시 확인 |
| bridge-exit | 다리 반대편으로 건넌다 | 실패 | 06-bridge-exit.png | 게이트 실패 — 즉시 확인 |
| forest | 숲·산의 구멍과 서로 다른 바닥 | 통과 | 07-forest.png | 시각 확인 대기 |

## 실패 상세

### bridge-deck
- op waitForPosition 실패: page.waitForFunction: Timeout 4000ms exceeded.
- x: 기대 5, 실제 4

### bridge-water-blocked
- x: 기대 5, 실제 4

### bridge-exit
- op waitForPosition 실패: page.waitForFunction: Timeout 4000ms exceeded.
- x: 기대 6, 실제 4
