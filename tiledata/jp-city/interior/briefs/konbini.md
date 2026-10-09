# 작업: jp_city 일본 실내 — 편의점·슈퍼 `interior_konbini` (id 머리 `cv-`)
새 파일: `scripts/content/jp-city/blocks/interior_konbini.py` (모양은 `interior_shell.py` 와 같게: `R = Registry('interior_konbini', '편의점·슈퍼')`, `build()`, `selftest()`, `__main__` 에서 `run_block`).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다. 바깥 모습(거리의 편의점·슈퍼 건물)은 `scripts/content/jp-city/blocks/` 의 jp-bldg 쪽에 이미 있다 — 그 실내다.

## 그릴 것 (전부 `cv-` 머리, 종류·크기는 §12 로 계산)
바닥·벽: `cv-vinyl`(흰·연회색 비닐 타일 바닥, 조용하게) · `cv-panel`(흰 벽면 + 아래 회색 걸레받이) · `cv-backroom`(뒷방 회색 콘크리트 바닥)
진열: `cv-gondola`(가운데 섬 진열대 — 양면, floor 2×1 가로, 위에서 보이는 칸칸 상품 색 덩이, 위로 솟음) · `cv-gondola-v`(세로 1×2) · `cv-gondola-end`(끝 판매대 1×1) · `cv-cooler`(벽 붙은 유리문 음료 냉장고 wall 1×2 — 유리문 안 병·캔 색 줄, 문 손잡이, 반복 놓아 한 줄이 이어지게) · `cv-open-case`(도시락·삼각김밥 개방형 냉장 진열대 wall 2×1, 칸 안 색 덩이) · `cv-magazine`(창가 잡지 선반 wall 2×1, 낮음) · `cv-freezer`(아이스크림 평냉동고 floor 2×1, 유리 뚜껑 안 색 덩이)
계산대: `cv-register`(계산대 칸 — 금전등록기·계산 화면이 위에 있는 카운터 floor 1×1, use counter, surface) · `cv-counter`(계산대 이어지는 카운터 칸 floor 1×1, surface) · `cv-hotcase`(핫스낵 유리 케이스, 카운터 위에 올라가는 탁상 물건이 아니라 floor 1×1 카운터 칸) · `cv-coffee`(셀프 커피 기계 1×1 카운터 칸) · `cv-back-shelf`(계산대 뒤 담배·상품 벽 선반 wall 2×1)
기타: `cv-atm`(ATM wall 1×1) · `cv-copier`(복사기 floor 1×1) · `cv-baskets`(장바구니 쌓은 것 floor 1×1) · `cv-autodoor`(유리 자동문 입구 문턱 flat 2×1 — 바닥 레일·매트) · `cv-trash`(분리수거함 3구 floor 1×1)
슈퍼용: `cv-checkout`(슈퍼 계산대 레인 — 벨트+금전등록기 floor 1×2 세로) · `cv-produce`(채소·과일 경사 진열대 floor 2×1) · `cv-cart`(카트 floor 1×1) · `cv-meat-case`(정육·생선 개방형 냉장 wall 2×1)
탁상 물건(goods 16×16): `cv-onigiri` · `cv-bento` · `cv-drink` · `cv-snack` (계산대·탁자 위)

## 방 예제
- `tiledata/jp-city/interior/demo/interior_konbini-konbini.json`: 편의점(약 12×9 실내). 남쪽 아래 줄에 자동문 입구 + 창가 잡지 선반, 북쪽 벽 음료 냉장고 한 줄, 동쪽/서쪽 벽 개방형 냉장 진열대, 가운데 섬 진열대 2~3줄(통로 1칸 이상), 입구 가까이 계산대(register·counter·hotcase·coffee 가 한 줄로 이어짐) + 그 뒤 담배 선반, 뒤쪽에 작은 뒷방(칸막이 + 방문 틈). 직원은 카운터 안쪽으로 들어간다.
- `tiledata/jp-city/interior/demo/interior_konbini-super.json`: 동네 슈퍼(약 14×10): 입구 옆 계산대 레인 2개 + 카트·바구니, 채소 경사 진열대, 벽 냉장 진열, 가운데 섬 진열대.

## 산출물
`scripts/content/jp-city/blocks/interior_konbini.py`, `tiledata/jp-city/blocks/interior_konbini/*.png`, `tiledata/jp-city/interior/demo/interior_konbini-*.json`(+png).
