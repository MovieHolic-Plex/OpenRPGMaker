# 작업: jp_city 일본 실내 — 음식점 `interior_food` (id 머리 `fd-`)
새 파일: `scripts/content/jp-city/blocks/interior_food.py` (모양은 `interior_shell.py` 와 같게: `R = Registry('interior_food', '음식점')`, `build()`, `selftest()`, `__main__` 에서 `run_block`).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다. 거리에 이미 라멘집·소바집·이자카야·스시집·정식집·킷사텐 외관이 있다 — 그 실내다.

## 그릴 것 (전부 `fd-` 머리)
바닥·벽: `fd-tile-red`(라멘집 붉은 갈색 타일 바닥) · `fd-wood-dark`(이자카야 짙은 나무 바닥) · `fd-kitchen-tile`(주방 회색 타일) · `fd-plaster`(흰 회벽 + 나무 허리판 벽면) · `fd-wood-wall`(짙은 나무 판벽)
카운터(탁자 자동 타일 `R.table`, one_row=True): `fd-counter`(L자로 이어지는 나무 카운터 — 손님 쪽 앞날 + 주방 쪽 단, 어떤 길이든) · 식탁 자동 타일 `fd-table`(가게 2·4인 탁자)
가구: `fd-stool`(카운터 둥근 의자 floor 1×1, use sit) · `fd-chair-s/-n/-e/-w`(가게 나무 의자 4방향) · `fd-ticket-machine`(식권 발매기 wall 1×1 — 색 버튼 칸, 글자 없이) · `fd-stockpot`(라멘 육수 큰 솥 2개 올린 화구 wall 1×1 — 김) · `fd-noodle-boiler`(면 삶는 칸 wall 1×1) · `fd-fryer`(튀김기) · `fd-prep`(주방 스테인리스 조리대 wall 1×1, surface) · `fd-sink`(주방 개수대 wall 1×1) · `fd-fridge`(업소용 스테인리스 냉장고 wall 1×2) · `fd-noren`(주방 입구 노렌 — hang, 칸막이 틈 위) · `fd-lantern`(붉은 초롱 hang) · `fd-zashiki`(이자카야 다다미 좌석 단 — floor 칸, 마루보다 한 단 높은 다다미 + 앞 나무 테, walk 가능하게 2×1/어떤 크기든 반복) · `fd-sake-shelf`(술병 선반 wall 2×1) · `fd-beer-crates`(맥주 상자 쌓음 floor 1×1) · `fd-neta-case`(스시 카운터 위 유리 생선 진열 케이스 — 카운터 칸으로 1×1, 위에 올라감) · `fd-water-jug`(물병·컵 서버 1×1 카운터 칸) · `fd-register`(가게 계산대 작은 카운터 1×1) · `fd-menu-board`(메뉴판 hang — 글자 대신 색 띠와 작은 음식 그림 칸)
탁상 물건(goods): `fd-ramen-bowl` · `fd-sushi-geta` · `fd-beer-mug` · `fd-tokkuri`(술병+잔) · `fd-condiments`(양념통 셋) · `fd-teishoku`(쟁반 정식)

## 방 예제 (각각 다른 가게)
- `interior_food-ramen.json` 라멘집(약 9×7): 북쪽 벽 주방 줄(stockpot·noodle-boiler·prep·sink·fridge), 그 앞 L자 카운터 + 스툴 6, 입구 옆 식권기·물 서버, 주방은 카운터 안쪽에서 들어간다.
- `interior_food-izakaya.json` 이자카야(약 12×9): 카운터 + 스툴, 한쪽 다다미 좌석 단 위 좌탁(`zataku`)+방석(`zabuton`), 테이블석, 술병 선반, 초롱, 노렌 너머 주방.
- `interior_food-sushi.json` 초밥집(약 9×7): 카운터 위 유리 생선 케이스, 카운터 뒤 판, 의자, 작은 테이블석.
- `interior_food-kissaten.json` 킷사텐(약 8×7): 짙은 나무 바닥, 탁자 2인·4인 + 의자, 카운터 + 계산대, 화분.
각 json 은 `tiledata/jp-city/interior/demo/` 에.

## 산출물
`scripts/content/jp-city/blocks/interior_food.py`, `tiledata/jp-city/blocks/interior_food/*.png`, `tiledata/jp-city/interior/demo/interior_food-*.json`(+png).
