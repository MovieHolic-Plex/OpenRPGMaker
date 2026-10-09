# 작업: jp_city 일본 실내 3묶음 — 체육관·유치원 `interior_gym` (id 머리 `gy-`)
새 파일: `scripts/content/jp-city/blocks/interior_gym.py` (`R = Registry('interior_gym', '체육관·유치원')`, interior_public.py 모양 그대로).
거리에 학교 체육관 외관 `jp-bldg-school-gym` 과 유치원 외관 `jp-bldg-kindergarten`(키트 `tiledata/jp-city/kit-index.json`)이 이미 있다 — 그 실내다. **도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다.

## 그릴 것 (전부 `gy-`)
- 체육관 바닥·벽면: `gy-court`(체육관 마루 — 밝은 나무, 광택) · `gy-line`(코트 선 flat — 흰·노랑·빨강 선 조각: 가로·세로·모서리, 이어서 농구·배구 코트를 그린다) · `gy-wall`(체육관 벽면: 아래 나무 판 + 위 흰 벽, 높은 창 줄) · `gy-store-floor`(창고 콘크리트).
- 체육관: `gy-hoop`(농구 골대 — 벽걸이 백보드 hang 또는 바닥 받침 floor 2×1) · `gy-stage`(무대 — 앞면 나무, 위 막 — R.table 스타일 어떤 w×h 또는 큰 floor 조각; 무대 위로 오르는 작은 계단 `gy-stage-steps`) · `gy-curtain`(무대 막 hang 짙은 자주) · `gy-wall-bars`(늑목 wall 1×2) · `gy-mat`(체육 매트 flat 또는 쌓은 매트 floor 2×1) · `gy-vault-box`(뜀틀 floor 1×1) · `gy-ball-cart`(공 바구니 floor 1×1) · `gy-net-post`(배구 지주+네트 — 세로 줄 floor 1×1 이어 붙임) · `gy-score-board`(점수판 floor 1×1, 숫자 대신 색 칸) · `gy-pipe-chair`(접이 의자 쌓은 수레 floor 1×1) · `gy-clock-cage`(망 씌운 벽시계 hang).
- 유치원 바닥·벽면: `gy-kinder-floor`(놀이방 연노랑 나무·쿠션 바닥) · `gy-kinder-wall`(파스텔 벽면, 아래 하늘색 허리).
- 유치원: `gy-cubby`(아이 사물함 wall 3×1 — 칸마다 색 표시, 가방 고리) · `gy-kid-table`(낮은 탁자 R.table 스타일) · `gy-kid-chair-n/-s/-e/-w`(작은 의자) · `gy-upright-piano`(업라이트 피아노 wall 2×1) · `gy-picture-books`(그림책 낮은 선반 wall 2×1) · `gy-toy-box`(장난감 상자 floor 1×1) · `gy-blocks-mat`(놀이 매트 flat) · `gy-nap-futon`(낮잠 이불 flat 1×1) · `gy-kids-sink`(낮은 세면대 줄 wall 2×1) · `gy-shoe-cubby`(작은 신발장 floor 2×1) · `gy-drawing-board`(그림 게시판 hang — 색 종이 네모, 사람 그림 금지).
- 탁상(goods): `gy-crayons` · `gy-whistle` · `gy-stopwatch` · `gy-origami`.

## 맵(예제)
- `gym`(약 22×16, 거리와 잇는 주 맵): 남쪽 출입구 틈 2~3칸(신발 벗는 자리 `gy-shoe-cubby` 옆) → 코트(선으로 농구 코트 하나, 양 끝 골대) — 코트는 트인 바닥이니 `open` 으로 밝힌다 → 북쪽 무대(막·작은 계단) → 한쪽 벽 늑목·점수판 → 체육 창고(칸막이 + 문: 매트·뜀틀·공 바구니·의자 수레·네트 지주, 작게). 코트 둘레 동선 2칸.
- `kindergarten`(약 16×12, 거리와 잇는 주 맵): 출입구 틈 2칸 → 신발장 → 놀이방(낮은 탁자 2개 + 작은 의자가 탁자를 봄, 업라이트 피아노, 그림책 선반, 장난감 상자, 놀이 매트) → 사물함 벽 → 낮잠 방 또는 원장실·교무 작은 방(칸막이 + 문) → 아이 세면대·화장실(기존 `toilet`). 아이 키 높이라 가구가 낮다.
- 장소 표 `places3-gym.json`: 두 장소 — `{"file":"gym","kind":"gym","kindKo":"체육관","building":"jp_school_gym",…}`, `{"file":"kindergarten","kind":"kindergarten","kindKo":"유치원","building":"jp_kindergarten",…}` (roomKinds 로 방 종류: gymfloor·gymstore·stage·playroom·napping·kinderoffice 등).

## 분류 (categories.py 네 칸) — 예: `gym` 체육관, `kindergarten` 유치원.
