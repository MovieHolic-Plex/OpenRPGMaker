# 런타임 QA — interior-catalog

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 실패 (비트 25개 중 12개 실패)
- 열어야 할 샷: 12개 / 전체 샷 23개
- 런타임 에러: 없음
- 프로젝트: output/evidence/interior-catalog-review/reloaded-project.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | — | 통과 | — | — |
| start | — | 통과 | — | — |
| inn-3f-yard | — | 통과 | 03-inn-3f-yard.png | 시각 확인 대기 |
| inn-3f-enter | — | 통과 | 04-inn-3f-enter.png | 시각 확인 대기 |
| inn-3f-bedroom-1 | — | 통과 | 05-inn-3f-bedroom-1.png | 시각 확인 대기 |
| inn-3f-up-1 | — | 통과 | 06-inn-3f-up-1.png | 시각 확인 대기 |
| inn-3f-bedroom-2 | — | 통과 | 07-inn-3f-bedroom-2.png | 시각 확인 대기 |
| inn-3f-up-2 | — | 통과 | 08-inn-3f-up-2.png | 시각 확인 대기 |
| inn-3f-bedroom-3 | — | 통과 | 09-inn-3f-bedroom-3.png | 시각 확인 대기 |
| inn-3f-down-3 | — | 통과 | 10-inn-3f-down-3.png | 시각 확인 대기 |
| inn-3f-down-2 | — | 통과 | 11-inn-3f-down-2.png | 시각 확인 대기 |
| inn-3f-down-1 | — | 통과 | 12-inn-3f-down-1.png | 시각 확인 대기 |
| workshop-4f-yard | — | 통과 | 13-workshop-4f-yard.png | 시각 확인 대기 |
| workshop-4f-enter | — | 실패 | 14-workshop-4f-enter.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-bedroom-1 | — | 실패 | 15-workshop-4f-bedroom-1.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-up-1 | — | 실패 | 16-workshop-4f-up-1.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-bedroom-2 | — | 실패 | 17-workshop-4f-bedroom-2.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-up-2 | — | 실패 | 18-workshop-4f-up-2.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-bedroom-3 | — | 실패 | 19-workshop-4f-bedroom-3.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-up-3 | — | 실패 | 20-workshop-4f-up-3.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-bedroom-4 | — | 실패 | 21-workshop-4f-bedroom-4.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-down-4 | — | 실패 | 22-workshop-4f-down-4.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-down-3 | — | 실패 | 23-workshop-4f-down-3.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-down-2 | — | 실패 | 24-workshop-4f-down-2.png | 게이트 실패 — 즉시 확인 |
| workshop-4f-down-1 | — | 실패 | 25-workshop-4f-down-1.png | 게이트 실패 — 즉시 확인 |

## 실패 상세

### workshop-4f-enter
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-1:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 5, 실제 13
- y: 기대 9, 실제 25

### workshop-4f-bedroom-1
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-1:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 8, 실제 16
- y: 기대 6, 실제 25

### workshop-4f-up-1
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-2:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 5, 실제 13
- y: 기대 9, 실제 25

### workshop-4f-bedroom-2
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-2:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 8, 실제 16
- y: 기대 6, 실제 25

### workshop-4f-up-2
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-3:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 5, 실제 13
- y: 기대 9, 실제 25

### workshop-4f-bedroom-3
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-3:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 8, 실제 16
- y: 기대 6, 실제 25

### workshop-4f-up-3
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-4:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 5, 실제 13
- y: 기대 9, 실제 25

### workshop-4f-bedroom-4
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-4:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 8, 실제 16
- y: 기대 6, 실제 25

### workshop-4f-down-4
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-3:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 5, 실제 13
- y: 기대 4, 실제 27

### workshop-4f-down-3
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-2:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 5, 실제 13
- y: 기대 4, 실제 27

### workshop-4f-down-2
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- mapId: 기대 spatial:child:25:house-example:workshop-4f7:floor-1:0, 실제 spatial-place:25:house-example:workshop-4f:0:29:easyrpg_chipset_combined_town
- x: 기대 5, 실제 13
- y: 기대 4, 실제 27

### workshop-4f-down-1
- op waitForPosition 실패: page.waitForFunction: Timeout 30000ms exceeded.
- y: 기대 25, 실제 27
