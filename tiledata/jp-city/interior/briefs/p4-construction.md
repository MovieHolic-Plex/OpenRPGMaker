# 작업: 4묶음 던전 — 공사 중 건물·지하 주차장 `dungeon_construction` (id 머리 `cs-`)
새 파일 `scripts/content/jp-city/blocks/dungeon_construction.py` (`R = Registry('dungeon_construction', '공사장·주차장')`).
## 그릴 것 (`cs-`)
- 바닥·벽면: `cs-slab`(맨 콘크리트 바닥 — 먹줄·물자국) · `cs-wall-bare`(맨 콘크리트 벽면 — 거푸집 구멍 점, 철근 끝) · `cs-plywood-wall`(가설 합판 벽면) · `cs-parking-floor`(주차장 바닥 — 회색 에폭시, 어둡게) · `cs-parking-wall`(주차장 벽면 — 흰·노랑 띠, 기둥 번호는 색 칸만).
- 공사장: `cs-scaffold`(비계 — 철관·발판 floor 1×1 이어 붙임 막힘, 위로 솟음) · `cs-rebar`(철근 묶음 floor 2×1 막힘) · `cs-cement-bags`(시멘트 포대 더미 floor 1×1) · `cs-steel-beam`(H빔 floor 3×1 막힘) · `cs-cable-drum`(케이블 드럼 floor 1×1) · `cs-cone`(라바콘 floor 1×1) · `cs-barrier`(공사 바리케이드 노랑·검정 floor 1×1 이어 붙임) · `cs-work-light`(작업등 스탠드 floor 1×1) · `cs-shaft-hole`(엘리베이터 갱도 구멍 2×2 막힘 — 난간+아래 어둠) · `cs-ladder-up`(가설 사다리 wall 1×1 → links) · `cs-generator`(발전기 floor 2×1) · `cs-site-office`(현장 사무실 컨테이너 칸 — 문·창, wall 3×2) · `cs-tarp`(방수포 덮은 자재 floor 2×1) · `cs-stairs-up-bare`·`cs-stairwell-down`(난간 없는 콘크리트 계단).
- 지하 주차장: `cs-pillar`(주차장 기둥 floor 1×1 막힘 — 모서리 보호대 노랑·검정) · `cs-parking-line`(주차 칸 선 flat — 가로·세로·모서리) · `cs-car-a`·`cs-car-b`(주차된 승용차 — 3/4 위에서, floor 2×3 막힘, 색 둘 — 브랜드·번호판 글자 금지) · `cs-wheel-stop`(바퀴 멈춤턱 flat) · `cs-ramp-arrow`(경사로 화살표 flat — 글자 없이) · `cs-fire-hose`(소화전 상자 wall 1×1) · `cs-pay-machine`(정산기 wall 1×1) · `cs-shutter`(셔터 — 잠긴 문 자리) · `cs-light-off`(꺼진 등 hang) · `cs-exit-light`(비상구 초록 등 hang — 사람 픽토그램 금지, 초록 사각 + 화살표만).
- 보물·단서: `cs-item-toolbox` · `cs-item-helmet-shelf`(안전모 선반) · `cs-item-blueprint`(설계도 통) · `cs-item-car-trunk`(열린 트렁크 — 차 옆 1×1).
## 장소 (places4-construction.json, 둘)
- 「공사 중 빌딩」 `construction-1f`(주 맵 약 22×16: 맨 아래 틈 = 가설 출입문 → 자재 야적·비계 미로·현장 사무실·갱도 구멍 둘레 길·잠긴 자재 창고) + `construction-2f`(inner: 벽 없는 기둥 층 — 비계·떨어지기 쉬운 가장자리 바리케이드·보스 자리). building `jp_construction`.
- 「지하 주차장」 `parking-b1`(주 맵 약 24×16: 맨 아래 틈 = 계단 출입구 → 주차 칸 줄(차 몇 대·빈 칸)·기둥 숲·정산기·셔터 잠긴 기계실) + `parking-b2`(inner, 경사로로 이어짐: 더 어둡고 차 적음, 막다른 구석 보물). building `jp_parking`. 차는 몇 대만 — 주차장 빈 칸이 넓으면 기둥·선으로 짜임을 준다.
## 분류: `construction` 공사장, `parking` 지하 주차장.
