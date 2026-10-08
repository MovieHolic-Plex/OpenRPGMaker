# 작업: 4묶음 던전 — 지하철 보선 터널·하수도 `dungeon_underground` (id 머리 `ug-`)
새 파일 `scripts/content/jp-city/blocks/dungeon_underground.py` (`R = Registry('dungeon_underground', '지하 던전')`). 지하철 화풍은 `blocks/transit_station.py`·`interior_station.py`(역 `st-`)를 따른다.
## 그릴 것 (`ug-`)
- 바닥·벽면: `ug-tunnel-floor`(터널 콘크리트 + 자갈, 어둡게) · `ug-tunnel-wall`(터널 벽 — 둥근 세그먼트 판·케이블 선반 줄) · `ug-sewer-floor`(점검로 젖은 콘크리트) · `ug-sewer-wall`(하수도 벽 — 이끼 낀 벽돌·콘크리트, 물때 줄) · `ug-room-floor`(기계실·대피실 바닥).
- 지하철 터널: `ug-track`(선로 — 자갈·침목·레일, R.table 어떤 w×h 전부 막힘) · `ug-walkway-rail`(보선 통로 난간 floor 1×1 이어 붙임) · `ug-signal`(신호기 floor 1×1, 빨강·초록 등) · `ug-cable-rack`(케이블 선반 wall 2×1) · `ug-emergency-phone`(비상 전화함 hang) · `ug-refuge-niche`(대피 홈 — 벽에 파인 칸 wall 1×1) · `ug-maint-cart`(보선 수레 floor 2×1) · `ug-fan`(환기팬 wall 2×2) · `ug-ladder-up`(벽 사다리 — 위로 나가는 곳, wall 1×1, 발칸 걸음 → links).
- 하수도: `ug-channel`(하수 물길 — R.table 어떤 w×h 막힘: 어두운 물·흐름 줄·거품) · `ug-grate`(쇠창살 flat — 물길 위 건너는 다리 칸, 걸음) · `ug-pipe-h`·`ug-pipe-v`(큰 관 wall/floor 1×1 이어 붙임) · `ug-valve`(밸브 hang) · `ug-manhole-ladder`(맨홀로 오르는 사다리 wall 1×1 → links) · `ug-sluice`(수문 wall 2×2) · `ug-puddle`(물웅덩이 flat) · `ug-trash-pile`(쓰레기 더미 floor 1×1 막힘) · `ug-rat-hole`(쥐구멍 벽 아래 hang — 동물 그리지 말 것, 구멍만).
- 기계실·대피실: `ug-panel`(배전반 wall 1×2) · `ug-pump`(배수 펌프 floor 2×1) · `ug-locker`(작업자 사물함 wall 1×2) · `ug-door-steel`(철문 — 문 틈에 놓는 문, 잠긴 문 자리) · `ug-light-off`(꺼진 형광등 hang) · `ug-light-emergency`(비상등 hang 초록).
- 보물·단서: `ug-item-toolbox` · `ug-item-firstaid` · `ug-item-lantern` (1×1, use search).
## 장소 (places4-underground.json, 둘)
- 「지하철 보선 터널」 `subway-tunnel-1`(주 맵 약 24×14: 맨 아래 틈 = 역 직원 통로 철문 → 보선 통로가 선로 옆을 따라 동서로, 대피 홈·신호기·케이블 선반, 기계실 잠긴 문) + `subway-tunnel-2`(inner 약 24×14: 선로가 갈라지는 곳·환기 기계실·보스 자리 넓은 곳, 사다리로 1 과 이음). building `jp_subway_access`.
- 「하수도」 `sewer-1`(주 맵 약 22×14: 맨 아래 틈 = 점검 계단 입구 → 물길 양쪽 점검로, 쇠창살 다리로 건넘, 수문·밸브, 막다른 곳 보물) + `sewer-2`(inner: 큰 합류 수조·펌프실 잠긴 문·맨홀 사다리 탈출구). building `jp_sewer_access`.
## 분류: `tunnel` 지하철 보선 터널, `sewer` 하수도.
