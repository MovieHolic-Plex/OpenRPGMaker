# 런타임 QA — ct-vehicle

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 11개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 6개
- 런타임 에러: 없음
- 프로젝트: .omo/runtime-qa/ct-vehicle-pS2cr9/project.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| parked-vehicles | New game: the guardian follows the hero; the boat and airship are parked sprites on the field | 통과 | 01-parked-vehicles.png | 시각 확인 대기 |
| walker-blocked-by-lake | On foot, the lake edge at (7,4) blocks the hero standing at (8,4) | 통과 | — | — |
| board-boat | Facing the parked boat and pressing action boards it: vehicle texture, followers hidden | 통과 | 03-board-boat.png | 시각 확인 대기 |
| boat-crosses-lake | Holding left sails the boat across the water tiles to the west shore (2,4) | 통과 | — | — |
| boat-blocked-by-land | The boat cannot leave the water: holding left at (2,4) stays put | 통과 | — | — |
| get-off-boat | Action gets off onto the walkable shore (1,4); the boat stays parked at (2,4) and the follower returns | 통과 | 06-get-off-boat.png | 시각 확인 대기 |
| water-blocks-walker-again | After getting off, a water tile the boat crossed blocks the walker again | 통과 | — | — |
| board-airship | Facing the airship at (11,10) and pressing action boards it | 통과 | 08-board-airship.png | 시각 확인 대기 |
| airship-refuses-landing | (11,10) stone terrain has airshipLand off: action does not land | 통과 | — | — |
| airship-flies-over-wall | The airship crosses the impassable wall column x=13 one tap at a time and stops on the pad (16,10) | 통과 | 10-airship-flies-over-wall.png | 시각 확인 대기 |
| airship-lands | (16,10) plain grass (no terrain record) allows landing: action lands, the airship stays parked and the follower returns | 통과 | 11-airship-lands.png | 시각 확인 대기 |
