# 작업: jp_city 일본 실내 3묶음 — 지상 역·승강장·전철 차내 `interior_station` (id 머리 `st-`)
새 파일: `scripts/content/jp-city/blocks/interior_station.py` (`R = Registry('interior_station', '역·전철')`, interior_public.py 모양 그대로).
거리에 작은 지상역 외관 `jp-bldg-station-small`(키트 `tiledata/jp-city/kit-index.json`)이 있다 — 그 역사(駅舎) 실내 + 승강장 + 전철 차내다. 같은 번들에 **지하철 콘코스 키트**가 이미 있다: `scripts/content/jp-city/blocks/transit_station.py`(개찰구·매표기·역무실 창구·벤치·자판기·분별 쓰레기통·점자 블록 — 그림 `tiledata/jp-city/blocks/transit_station/_all-x2.png`, 크롭해서 본다). **그 화풍·색을 따르고, 필요하면 그 그리기 함수를 import 해서 실내 조각 크기로 다시 감싸도 된다**(그 블록 파일은 고치지 않는다). 전철 외관 `public/assets/jp-city/vehicles/jp-subway.png` 색(노선 색 midori)도 맞춘다.
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다.

## 그릴 것 (전부 `st-`)
- 바닥·벽면: `st-concourse`(역사 바닥 — 연회색 석재 타일) · `st-platform`(승강장 바닥 — 아스팔트·콘크리트 회색) · `st-car-floor`(차내 바닥 — 회갈 고무) · `st-wall`(역사 벽면 — 흰 패널 + 노선 색 띠) · `st-car-wall`(차내 벽면 — 크림 + 창 줄: 창 너머 하늘·거리 색).
- 역사: `st-gate`(자동 개찰기 한 대 floor 1×1 — 이어 놓으면 개찰구 줄, 사이 1칸이 통로; 통로 칸은 걸음) · `st-ticket-machine`(매표기 wall 1×1, 이어 놓음) · `st-fare-map`(운임표 hang 2~3칸 — 노선도 선·점, 글자 없이) · `st-office-window`(역무실 창구 wall 2×1, use counter) · `st-kiosk`(매점 floor 2×1 — 신문·과자 색 덩이) · `st-bench`(대합실 벤치 floor 2×1, use sit) · `st-vending`(음료 자판기 wall 1×1) · `st-timetable`(발차 안내 LED 판 hang — 색 칸) · `st-tactile`(점자 블록 flat — 줄·점) · `st-fence`(개찰 옆 낮은 칸막이 floor 1×1).
- 승강장: `st-edge`(승강장 끝 — 흰 선 + 노란 점자 + 끝 돌, floor 1×1 이어 붙임, 막힘은 그 다음 줄 선로) · `st-track`(선로 — 자갈·침목·레일, **R.table 스타일 어떤 w×h, 전부 막힘**: 승강장 북쪽 띠) · `st-roof-pillar`(승강장 지붕 기둥 floor 1×1, 위로 솟음) · `st-platform-bench`(floor 2×1) · `st-sign-pole`(역명 기둥 간판 floor 1×1 — 글자 없이 흰 판 + 노선 색 띠) · `st-boarding-mark`(승차 위치 표시 flat).
- 차내: `st-long-seat`(롱시트 — 벽 붙은 긴 좌석, 북쪽 벽 앞 wall 3×1 (앉는 쪽 남) / 남쪽 줄 좌석은 등이 아래로 보이는 floor 3×1) · `st-car-door`(차내 출입문 — 북쪽 벽면 hang 또는 wall 2칸) · `st-pole`(손잡이 기둥 floor 1×1, walk 막지 않게 하려면 선택) · `st-strap`(손잡이 끈 줄 — 천장 매단 hang 또는 flat 위 그림자 없이) · `st-priority-seat`(우선석 — 좌석 색만 다르게) · `st-car-end`(차량 끝 연결 문 wall 1×1).
- 탁상(goods): `st-newspaper` · `st-ic-card` · `st-ekiben`.

## 맵(예제) — 역사 → 승강장 → 차내 (links)
- `station`(약 16×11, 거리와 잇는 주 맵): 남쪽 출입구 틈 2~3칸 → 매표기 줄 + 운임표(벽) → 개찰구 줄(가운데 통로 2개 이상) → 개찰 안쪽(북쪽) 짧은 통로 → 승강장으로 나가는 문/트인 곳(북쪽 벽 문 → links) · 역무실 창구(개찰 옆) · 매점·자판기·대합실 벤치. 콘코스는 트인 곳이 있으니 `open` 으로 밝히되 작게.
- `station-platform`(inner, 약 18×8): 남쪽 = 역사에서 들어오는 문(도착 칸), 승강장 바닥 + 지붕 기둥 + 벤치 + 역명 기둥 + 승차 위치 표시 + 북쪽 끝 `st-edge` 줄, 그 북쪽 `st-track` 띠(2줄). 승차 위치 표시 칸에 차내로 가는 links.
- `train-car`(inner, 약 20×7): 북쪽 벽면에 창·문, 북쪽 롱시트 줄, 가운데 통로 2줄(기둥·손잡이), 남쪽 롱시트 줄(등이 아래), 양 끝 연결 문. 문 앞 칸에서 승강장으로 돌아가는 links.
- 층 이동처럼 서로 잇는다: station 북쪽 문 앞 ↔ platform 남쪽 도착 칸, platform 승차 칸 ↔ train-car 문 앞.
- 장소 표 `places3-station.json`: 한 장소 `{"file":"station","maps":["station","station-platform","train-car"],"kind":"station","kindKo":"역","building":"jp_station","roomKinds":{"concourse":…,"ticketgate":…,"stationoffice":…,"platform":…,"traincar":…}, …}`.

## 분류 (categories.py 네 칸) — 예: `station` 역사·개찰, `platform` 승강장, `train` 전철 차내.
