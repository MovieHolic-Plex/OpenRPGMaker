# 작업: 4묶음 던전 — 지하상가·항만 창고 `dungeon_warehouse` (id 머리 `wh-`)
새 파일 `scripts/content/jp-city/blocks/dungeon_warehouse.py` (`R = Registry('dungeon_warehouse', '지하상가·창고')`). 가게 가구(`cv-` `sh-` `fd-`)·역(`st-`) 화풍을 따른다.
## 그릴 것 (`wh-`)
- 바닥·벽면: `wh-mall-floor`(지하상가 광택 석재 — 문 닫은 밤, 1단 어둡게) · `wh-mall-wall`(지하상가 벽면 — 가게 사이 기둥 판) · `wh-warehouse-floor`(창고 콘크리트 — 지게차 바퀴 자국·기름 얼룩) · `wh-warehouse-wall`(골함석 벽면) · `wh-office-floor`(창고 사무실).
- 지하상가: `wh-shopfront-shutter`(가게 셔터 내림 — 벽면 앞 wall 2×1, 셔터 줄; 하나는 반쯤 열린 판 `wh-shopfront-half`) · `wh-shop-window`(어두운 진열창 wall 2×1 — 마네킹 금지, 상자·옷걸이) · `wh-mall-pillar`(둥근 기둥 floor 1×1 막힘) · `wh-mall-bench`(floor 2×1) · `wh-guide-board`(안내판 floor 1×1 — 지도 선, 글자 금지) · `wh-escalator-stopped`(멈춘 에스컬레이터 — 위로 나가는 곳, wall 2×1 → links) · `wh-shutter-gate`(통로 셔터 — 잠긴 문 자리, 문 틈) · `wh-vending-dark`(불 꺼진 자판기 wall 1×1) · `wh-cart-abandoned`(버려진 손수레 floor 1×1).
- 항만 창고: `wh-container-h`(컨테이너 가로 floor 3×1 막힘, 색 셋: 빨강·파랑·녹 — 로고·글자 금지, 골 줄·잠금 막대) · `wh-container-v`(세로 1×3) · `wh-pallet`(팔레트+상자 floor 1×1) · `wh-pallet-rack`(팔레트 랙 wall 3×1 키 큼) · `wh-forklift`(지게차 floor 1×2) · `wh-crate`(나무 상자 floor 1×1) · `wh-drum`(드럼통 floor 1×1) · `wh-rolling-door`(대형 셔터 — 북쪽 벽면) · `wh-catwalk-ladder`(사다리 wall 1×1 → links) · `wh-office-cabin`(창고 안 사무 칸막이 창 wall 2×1) · `wh-chain-hoist`(체인 호이스트 hang) · `wh-rope-coil`(밧줄 floor 1×1) · `wh-light-off`·`wh-light-hang`(매단 등 hang).
- 보물·단서: `wh-item-crate-open`(열린 상자) · `wh-item-safe`(금고 floor 1×1) · `wh-item-manifest`(서류판 hang) · `wh-item-bag`(가방).
## 장소 (places4-warehouse.json, 둘)
- 「밤의 지하상가」 `undermall-1`(주 맵 약 26×14: 맨 아래 틈 = 지상 계단 출입구 → 셔터 내린 가게가 늘어선 십자 통로·광장 기둥·멈춘 에스컬레이터·통로 셔터 잠김) + `undermall-2`(inner: 더 깊은 연결 통로·반쯤 열린 가게 안(보물)·기계실·보스 자리 광장). building `jp_undermall`.
- 「항만 창고」 `harbor-warehouse-1`(주 맵 약 24×16: 맨 아래 틈 = 옆문 → 컨테이너 미로·팔레트 랙 통로·지게차·사무 칸(열쇠)·잠긴 대형 셔터) + `harbor-warehouse-2`(inner: 사다리로 오르는 중이층 캣워크 사무실·밀수품 상자 방(보스 자리)). building `jp_harbor_warehouse`.
## 분류: `undermall` 지하상가, `warehouse` 항만 창고.
