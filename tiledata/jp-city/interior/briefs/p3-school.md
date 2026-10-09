# 작업: jp_city 일본 실내 3묶음 — 학교 본관 `interior_school` (id 머리 `sc-`)
새 파일: `scripts/content/jp-city/blocks/interior_school.py` (`R = Registry('interior_school', '학교')`, `build()`, `selftest()`, `__main__` 에서 `run_block` — interior_public.py 모양 그대로).
거리에 학교 본관 외관 `jp-bldg-school`(키트 `tiledata/jp-city/kit-index.json`)이 이미 있다 — 그 실내다. 일본 공립 중학교·고등학교(교실 바닥은 나무, 복도는 비닐 시트, 신발장 현관 昇降口).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다.

## 그릴 것 (전부 `sc-`)
- 바닥·벽면: `sc-classroom-wood`(교실 나무 마루, 좁은 판자) · `sc-corridor`(복도 연녹·회색 비닐 시트) · `sc-genkan-tile`(현관 昇降口 회색 타일·스노코 자리) · `sc-roof-conc`(옥상 콘크리트·방수 녹색) · `sc-wall`(교실·복도 벽면: 위 흰 회반죽 + 아래 나무 허리판) · `sc-wall-tile`(화장실·이과실 타일 벽면).
- 현관: `sc-shoe-locker`(신발장 — 칸칸 작은 칸, floor 2×1 또는 wall 1×2, 줄로 이어 놓음) · `sc-sunoko`(나무 발판 flat).
- 교실: `sc-blackboard`(칠판 hang 4칸 폭 — 짙은 녹색 판 + 분필 받침, 글자 없이 분필 선 몇 개) · `sc-teacher-desk`(교탁 floor 1×1, surface) · `sc-podium`(교단 flat 단) · `sc-desk-n`(학생 책상+의자 한 벌 1×1, 의자가 남쪽 — 학생이 북쪽 칠판을 본다) · `sc-back-locker`(교실 뒤 사물함 wall 3×1 낮은 칸칸, 위 가방) · `sc-notice-board`(게시판 hang 2칸 — 색 종이 네모) · `sc-cleaning-locker`(청소 도구함 wall 1×2) · `sc-classroom-door`(교실 미닫이 문 — 기존 문 조각으로 되면 그것을 쓴다) · `sc-tv-stand`(교실 앞 구석 TV 받침 floor 1×1).
- 교무실: `sc-staff-desk`(교사 책상 — 서로 마주 보는 섬, floor 1×1 이어 붙임 또는 R.table 스타일, 서류·모니터) · `sc-staff-chair-n/-s` · `sc-whiteboard`(일정 화이트보드 hang) · `sc-key-box`(열쇠함 hang) · `sc-copy-machine`(복사기 floor 1×1) · `sc-tea-shelf`(차 선반 wall).
- 보건실: `sc-nurse-bed`(보건실 침대 1×2 흰 시트 + 커튼 레일) · `sc-curtain`(침대 사이 연녹 커튼 칸막이) · `sc-med-shelf`(약품장 wall 1×2) · `sc-scale`(체중계) · `sc-sink`(세면대 wall 1×1).
- 음악실: `sc-piano`(그랜드 피아노 floor 2×2) · `sc-music-stand`(보면대 floor 1×1) · `sc-music-chair-n`(의자) · `sc-instrument-shelf`(악기 선반 wall 2×1 — 북·실로폰 덩이) · `sc-soundwall`(유공 흡음 벽면 R.wall).
- 도서실: `sc-bookshelf`(벽 서가 wall 2×1 키 큼) · `sc-book-island`(양면 낮은 서가 floor 2×1) · `sc-reading-table`(열람 탁자 — R.table 스타일 어떤 w×h) · `sc-lib-counter`(대출 카운터 floor 1×1, use counter, surface).
- 이과실: `sc-lab-bench`(실험대 — 검은 상판 + 개수대, floor 2×1 또는 R.table) · `sc-lab-stool`(둥근 의자) · `sc-specimen-case`(표본장 유리문 wall 1×2 — 병·광물, **인체 모형·해골 금지**) · `sc-fume-hood`(드래프트 wall 1×2).
- 계단: `sc-stairs-up`(콘크리트 계단 wall 1×1 또는 2칸 폭 — `stairs-up-wood` 와 같은 규칙: 북쪽 벽 앞, 벽 속으로 오름, 미끄럼 방지 줄) · `sc-stairwell-down`(내려가는 계단통 2×2 — `stairwell-down-wood` 모양, 철 난간).
- 옥상: `sc-roof-fence`(높은 철망 펜스 — 옥상 둘레, floor 1×1 이어 붙임, 위로 솟음) · `sc-water-tank`(고가 수조 floor 2×2) · `sc-roof-door`(옥상으로 나오는 塔屋 철문 — 북쪽 벽면 문) · `sc-ac-outdoor`(실외기 — 기존 `h2-ac-outdoor` 가 있으면 그것).
- 탁상(goods): `sc-textbook` · `sc-chalk-box` · `sc-globe` · `sc-flask` · `sc-attendance-book`.
- 화장실은 기존 `toilet`·`toilet-handwash` 를 쓰고, 학교 소변기 `sc-urinal`(wall 1×1) 하나만 더한다.

## 맵(예제) — 계단 x 를 층마다 맞춘다
- `school-1f`(약 26×14, 거리와 잇는 주 맵): 맨 아래 출입구 틈 3~4칸 → 昇降口(신발장 줄 + 스노코) → 동서로 긴 복도(2줄) → 북쪽에 교무실(교사 책상 섬 2개, 화이트보드)·보건실(침대 2·커튼·약품장)·교장실은 빼도 된다 → 복도 북쪽 벽에 올라가는 계단. 화장실 하나(남·여 중 하나).
- `school-2f`(inner, 같은 너비): 남쪽 복도 2줄 + 북쪽 교실 2개(각 약 8×7: 칠판·교탁·교단·학생 책상 5열×3~4행 — 책상 줄 사이 1칸 통로, 앞뒤 미닫이 문 2개, 뒤 사물함·게시판·청소함). 계단통(1층에서 올라옴) + 3층 계단.
- `school-3f`(inner): 특별교실 — 음악실(피아노·보면대·의자·악기 선반, 흡음 벽면)·도서실(서가·양면 서가·열람 탁자·대출 카운터)·이과실(실험대·둥근 의자·표본장·드래프트). 계단통 + 옥상 계단.
- `school-roof`(inner): 옥상 — 塔屋 문(계단통에서 나옴) · 콘크리트 바닥 · 둘레 펜스 · 수조 · 실외기 · 벤치 하나. 트인 바닥은 `open` 으로 밝힌다(작게, 약 14×10).
- 장소 표 `places3-school.json`: 한 장소 `{"file":"school-1f","maps":["school-1f","school-2f","school-3f","school-roof"],"kind":"school","kindKo":"학교","building":"jp_school", "roomKinds":{"shoegenkan":…,"corridor":…,"staffroom":…,"infirmary":…,"classroom":…,"musicroom":…,"library":…,"sciencelab":…,"rooftop":…,"schooltoilet":…}, …}`.

## 분류 (categories.py 네 칸) — 예: `school-entry` 학교 현관, `classroom` 교실, `staffroom` 교무실·보건실, `special-room` 특별교실(음악·도서·이과), `school-stairs` 학교 계단·옥상.
