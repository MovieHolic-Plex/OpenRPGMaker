# 작업: 5묶음 — 쇼핑몰·영화관 `interior_mall` (id 머리 `ml-`)
새 파일 `scripts/content/jp-city/blocks/interior_mall.py` (`R = Registry('interior_mall', '쇼핑몰·영화관')`). 편의점·가게 가구(`cv-` `sh-`) 화풍을 따른다(지하상가 `wh-` 는 밤·버려진 판 — 여기는 밝고 영업 중).
## 그릴 것 (`ml-`)
- 바닥·벽면: `ml-floor`(몰 광택 타일 — 밝게, 큰 줄눈) · `ml-shop-floor`(가게 안 나무 바닥) · `ml-wall`(몰 벽면 흰 패널) · `ml-cinema-carpet`(영화관 붉은·짙은 무늬 카펫) · `ml-cinema-wall`(극장 벽면 — 짙은 천 + 계단식 조명).
- 쇼핑몰: `ml-shopfront`(가게 앞 — 유리 진열창·입구 틀, wall 3×1, 색 다른 판 셋: 옷·잡화·전자) · `ml-clothes-rack`(옷걸이 행거 floor 2×1 — 색 옷 줄) · `ml-shelf-goods`(잡화 선반 wall 2×1) · `ml-display-table`(진열 탁자 floor 2×1, surface) · `ml-mannequin`(**금지 — 그리지 말 것**, 대신 `ml-torso-stand` 옷 걸린 토르소 받침 — 머리·팔 없는 원통) · `ml-escalator-up`·`ml-escalator-down`(에스컬레이터 — 북쪽 벽에 붙어 위로 오름, wall 2×2 → links, 계단 규칙) · `ml-bench`(몰 벤치 + 화분) · `ml-info-board`(안내판 — 글자 없이 색 칸) · `ml-fountain`(가운데 분수 — R.table 어떤 w×h) · `ml-food-stall`(푸드코트 가게 — 카운터 + 뒤 메뉴판 색 칸, wall 2×1) · `ml-food-table`(푸드코트 탁자 R.table) · `ml-tray-return`(식기 반납대).
- 영화관: `ml-ticket-counter`(매표 카운터 floor 1×1 이어 붙임, use counter) · `ml-concession`(매점 — 팝콘 기계·음료, wall 2×1 + 카운터) · `ml-poster`(영화 포스터 hang — 사람·글자 없이 풍경·도형 그림) · `ml-screen`(스크린 — 북쪽 벽면 넓게 hang 6칸 이상, 빛 번짐) · `ml-seat-row`(극장 좌석 줄 — 붉은 의자 floor 1×1 이어 붙임, 뒤로 갈수록 한 단씩 — 단은 flat 띠 `ml-step`) · `ml-aisle-light`(통로 발밑 등 flat) · `ml-ticket-gate`(검표 받침).
- 탁상: `ml-popcorn` · `ml-drink-cup` · `ml-shopping-bag` · `ml-tray`.
## 장소 (places5-mall.json, 둘)
- 「쇼핑몰」 `mall-1f`(약 24×16: 자동문 → 몰 통로(2칸 이상)와 분수 광장 → 가게 셋(옷·잡화·전자 — 가게마다 입구 틈과 안 진열) → 에스컬레이터) + `mall-2f`(inner: 에스컬레이터 도착 → 푸드코트(가게 넷·탁자·반납대) → 영화관 입구(통로가 영화관 맵으로 links)) . building `jp_mall`.
- 「영화관」 `cinema`(inner, 약 16×14: 매표·매점·포스터 로비 → 검표 → 상영관(스크린·좌석 줄 5~6줄·가운데·양옆 통로·발밑 등) ) — 몰 2층에서 이어진다(같은 장소의 maps 에 넣는다: `["mall-1f","mall-2f","cinema"]`).
## 분류: `mall` 쇼핑몰, `cinema` 영화관.
