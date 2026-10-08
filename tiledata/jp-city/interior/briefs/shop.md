# 작업: jp_city 일본 실내 — 상점가 가게 `interior_shop` (id 머리 `sh-`)
새 파일: `scripts/content/jp-city/blocks/interior_shop.py` (모양은 `interior_shell.py` 와 같게: `R = Registry('interior_shop', '상점')`, `build()`, `selftest()`, `__main__` 에서 `run_block`).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다. 거리에 빵집·서점·약국·꽃집·채소가게·생선가게·이발소 외관이 이미 있다 — 그 실내다. 일본 상점가(商店街)의 작은 가게: 앞이 길로 활짝 열리고 상품이 입구까지 나와 있다.

## 그릴 것 (전부 `sh-` 머리)
바닥·벽: `sh-concrete`(상점 앞 콘크리트·인조석 바닥) · `sh-wood`(밝은 나무 바닥) · `sh-white`(흰 벽면 + 나무 걸레받이)
공통: `sh-counter`(가게 계산대 카운터 floor 1×1, surface, use counter — 이어 붙이면 한 줄) · `sh-register`(금전등록기 있는 카운터 칸) · `sh-shutter`(입구 걷어 올린 셔터 문턱 flat 2×1/3×1) · `sh-wall-shelf`(벽 선반 wall 1×2 — 내용물 비움, 다른 가게 공용)
빵집: `sh-bread-shelf`(빵 진열 선반 wall 2×1 — 빵 색 덩이 줄) · `sh-bread-table`(가운데 빵 진열대 floor 2×1, 쟁반 위 빵) · `sh-tray-stand`(쟁반·집게 대 floor 1×1) · `sh-oven`(뒤쪽 빵 오븐 wall 1×2)
서점: `sh-bookshelf`(서점 책장 wall 1×2 — 책등 색 줄, 판매용이라 집 책장보다 촘촘) · `sh-book-table`(평대 floor 2×1 — 위에서 보이는 표지 색 칸) · `sh-book-island`(가운데 양면 책장 floor 2×1)
약국: `sh-drug-shelf`(약 선반 wall 1×2 — 작은 상자 색 줄) · `sh-drug-island`(가운데 양면 선반 floor 2×1) · `sh-consult`(상담 카운터 — 유리 진열 겸 1×1)
꽃집: `sh-flower-buckets`(꽃 양동이 단 floor 2×1 — 계단식 3단, 꽃 색 덩이) · `sh-flower-cooler`(꽃 냉장고 wall 1×2 유리문) · `sh-plant-pot`(큰 화분 floor 1×1) · `sh-wrap-table`(포장 작업대 floor 2×1, surface)
채소·생선: `sh-veg-stand`(경사 채소 진열대 — 바구니에 채소 색 덩이 floor 2×1, 입구까지 나옴) · `sh-fruit-box`(과일 상자 floor 1×1) · `sh-fish-ice`(얼음 위 생선 진열대 floor 2×1 — 흰 얼음+생선 은색) · `sh-scale`(저울 — goods)
이발소: `sh-barber-chair`(이발 의자 floor 1×1, use sit, facing N — 거울을 본다) · `sh-barber-mirror`(벽 거울+선반 wall 1×1, 이어 붙임) · `sh-shampoo`(샴푸 세면대 wall 1×1) · `sh-waiting-bench`(대기 벤치 floor 2×1) · `sh-barber-pole`(돌아가는 기둥 — hang 또는 입구 floor 1×1)
탁상 물건(goods): `sh-bread` · `sh-bouquet` · `sh-medicine` · `sh-scale` · `sh-scissors` · `sh-price-dots`(색 점 가격표 — 글자 없이)

## 방 예제 (각각, 작다 — 약 7×6 실내, 뒤에 작은 뒷방 또는 작업 공간)
`interior_shop-bakery.json` · `interior_shop-bookstore.json` · `interior_shop-pharmacy.json` · `interior_shop-florist.json` · `interior_shop-yaoya.json`(채소가게, 입구 쪽으로 진열이 나옴) · `interior_shop-barber.json`(거울 앞 의자 2~3, 대기 벤치, 샴푸대). 각 json 은 `tiledata/jp-city/interior/demo/` 에. 계산대는 입구 가까이, 직원은 카운터 안쪽 ↔ 뒷방.

## 산출물
`scripts/content/jp-city/blocks/interior_shop.py`, `tiledata/jp-city/blocks/interior_shop/*.png`, `tiledata/jp-city/interior/demo/interior_shop-*.json`(+png).
