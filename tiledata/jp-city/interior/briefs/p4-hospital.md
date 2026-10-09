# 작업: 4묶음 던전 — 폐병원 `dungeon_hospital` (id 머리 `hp-`)
새 파일 `scripts/content/jp-city/blocks/dungeon_hospital.py` (`R = Registry('dungeon_hospital', '폐병원')`). 의원 가구 `pb-`(접수·대기 의자·진찰대·약품장)와 학교 `sc-`(보건실 침대·커튼)를 참고·재사용한다.
## 그릴 것 (`hp-`) — 버려진 지 오래된 종합병원(먼지·금·벗겨진 칠·넘어진 집기, 피·사람·시체 금지)
- 바닥·벽면: `hp-floor-dirty`(얼룩진 리놀륨, 금·들뜬 타일) · `hp-floor-tile-dirty`(수술실·영안실 타일) · `hp-wall-peel`(칠이 벗겨진 병원 벽면 — 아래 손잡이 레일) · `hp-wall-tile`(타일 벽면, 금).
- 병동: `hp-bed-rusty`(녹슨 병원 침대 1×2, 찢긴 매트) · `hp-bed-overturned`(넘어진 침대 2×1 막힘) · `hp-curtain-torn`(찢긴 칸막이 커튼 rail) · `hp-iv-stand`(링거 걸이 floor 1×1) · `hp-wheelchair`(휠체어 floor 1×1) · `hp-stretcher`(이동 침대 2×1) · `hp-nurse-station`(간호사 스테이션 카운터 floor 1×1 이어 붙임, surface) · `hp-chart-rack`(차트 선반 wall 2×1) · `hp-med-cart`(약 카트 floor 1×1).
- 수술실·검사: `hp-op-table`(수술대 floor 1×2) · `hp-op-light`(무영등 hang — 천장 매단 둥근 등) · `hp-monitor-cart`(모니터 카트 floor 1×1) · `hp-xray-box`(엑스레이 판독 상자 hang — 빛 판, 뼈 그림 금지·흐린 회색 판만).
- 지하 영안실·기계: `hp-morgue-drawers`(냉장 서랍 벽 wall 3×1 — 손잡이·번호판 색 점) · `hp-boiler`(보일러 floor 2×2) · `hp-elevator-dead`(멈춘 엘리베이터 — 반쯤 열린 문 wall 2×1).
- 잔해: `hp-debris`(잔해 더미 floor 1×1 막힘) · `hp-papers`(흩어진 서류 flat) · `hp-glass`(유리 조각 flat) · `hp-ceiling-fallen`(떨어진 천장판 floor 2×1 막힘) · `hp-puddle`(물웅덩이 flat) · `hp-door-broken`(부서진 문 — 문 틈) · `hp-door-locked`(체인 감긴 문 — 잠긴 문 자리, 문 틈) · `hp-light-flicker`(깨진 형광등 hang).
- 보물·단서: `hp-item-medkit` · `hp-item-keybox`(열쇠함 hang) · `hp-item-records`(진료 기록 상자) · `hp-item-locker`.
## 장소 (places4-hospital.json, 하나·맵 셋)
- 「폐병원」 `abandoned-hospital-1f`(주 맵 약 24×16: 맨 아래 틈 = 부서진 정문 → 대기 로비(넘어진 의자·접수)·외래 진찰실·약제실(잠긴 문)·계단·멈춘 엘리베이터) + `abandoned-hospital-2f`(inner: 병동 복도 + 병실 3~4·간호사 스테이션·수술실(잠긴 문, 보스 자리)) + `abandoned-hospital-b1`(inner: 영안실·보일러실·창고, 열쇠 자리). 계단 x 를 층마다 맞춘다. building `jp_hospital_ruin`.
## 분류: `ruin-hospital` 폐병원 병동·수술실, `ruin-debris` 잔해·흔적(다른 던전도 쓰는 공용 잔해면 여기에).
