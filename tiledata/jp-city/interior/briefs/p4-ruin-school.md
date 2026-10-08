# 작업: 4묶음 던전 — 폐교 `dungeon_school` (id 머리 `as-`)
새 파일 `scripts/content/jp-city/blocks/dungeon_school.py` (`R = Registry('dungeon_school', '폐교')`). 학교 본관 블록 `scripts/content/jp-city/blocks/interior_school.py`(sc-, 3묶음 정본 — 그림 `tiledata/jp-city/blocks/interior_school/_all-x3.png` 크롭)를 **import 해서 같은 가구의 망가진 판**을 그린다(그리기 함수를 불러 그린 뒤 먼지·금·기울기·녹을 덧칠 — 그 파일은 고치지 않는다). 예제 `examples/school-1f.json` 등은 정상 학교 — 폐교는 **다른 평면**이어야 한다(검사기 SAME 경고).
## 그릴 것 (`as-`) — 수십 년 버려진 시골 목조·콘크리트 학교(먼지·덩굴·빗물, 사람·낙서 글자 금지)
- 바닥·벽면: `as-wood-rotten`(썩고 들뜬 교실 마루, 구멍 몇 칸은 막힘 조각으로) · `as-corridor-dirty`(얼룩 복도) · `as-wall-peel`(칠 벗겨진 학교 벽면, 나무 허리판 갈라짐) · `as-wall-vine`(덩굴 낀 벽면).
- 망가진 가구: `as-desk-toppled`(넘어진 학생 책상 floor 1×1 막힘) · `as-desk-dusty-n`(먼지 쌓인 책상+의자, 학생 책상 그대로 자리) · `as-blackboard-cracked`(금 간 칠판 hang 4칸 — 지워진 분필 자국, 글자 금지) · `as-podium-broken` · `as-locker-open`(문 열린 사물함 wall) · `as-piano-broken`(건반 빠진 피아노 2×2) · `as-bookshelf-fallen`(넘어진 서가 2×1 막힘) · `as-window-broken`(깨진 창 hang — 바깥 덩굴·어두운 하늘) · `as-floor-hole`(마루 구멍 1×1 막힘 — 아래 어둠) · `as-vines`(덩굴 flat/hang) · `as-leaves`(낙엽 flat) · `as-puddle`(빗물 웅덩이 flat) · `as-debris`(잔해 더미 1×1 막힘) · `as-stairs-up-broken`·`as-stairwell-down`(낡은 계단 — `sc-stairs-up` 규칙) · `as-door-locked`(쇠사슬 문 — 잠긴 문 자리) · `as-shoe-locker-rot`(썩은 신발장).
- 보물·단서: `as-item-diary`(일기장 상자 — 글자 없이) · `as-item-key-hook`(열쇠 고리판 hang) · `as-item-toolbox` · `as-item-photo-box`(사진 상자 — 사람 그림 없이 상자만).
## 장소 (places4-ruin-school.json, 하나·맵 둘~셋)
- 「폐교」 `ruin-school-1f`(주 맵 약 24×16 — 정상 학교와 다른 ㄱ자·L자 평면: 무너진 현관 → 복도 → 교실 2(하나는 마루 구멍으로 반쯤 막힘)·교무실(열쇠 고리판)·과학실 잠긴 문·계단) + `ruin-school-2f`(inner: 무너진 복도로 돌아가는 고리, 음악실(보스 자리, 부서진 피아노)·도서실(넘어진 서가 미로)) [+ 원하면 `ruin-school-gym`(inner) 체육관]. building `jp_school_ruin`.
## 분류: `ruin-school` 폐교.
