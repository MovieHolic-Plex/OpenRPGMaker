# 작업: 5묶음 — 패밀리 레스토랑·규동 체인 `interior_famires` (id 머리 `fr-`)
새 파일 `scripts/content/jp-city/blocks/interior_famires.py` (`R = Registry('interior_famires', '패밀리 레스토랑')`). 음식점 가구 `fd-`(카운터·의자·주방) 화풍을 따른다.
## 그릴 것 (`fr-`)
- 바닥·벽면: `fr-floor`(패밀리 레스토랑 따뜻한 나무·타일 바닥) · `fr-wall`(크림 벽면 + 나무 허리판 + 그림 액자 자리) · `fr-kitchen-floor` · `fr-gyudon-floor`(규동집 바닥).
- 패밀리 레스토랑: `fr-booth-n`·`fr-booth-s`(박스석 — 높은 등받이 벤치, 탁자를 사이에 두고 마주 봄, floor 2×1, use sit) · `fr-booth-table`(박스석 탁자 R.table 2×1·2×2) · `fr-booth-divider`(박스석 사이 칸막이 + 화분 위) · `fr-drink-bar`(드링크 바 — 디스펜서 줄·컵·얼음, wall 3×1) · `fr-soup-bar`(수프 바 floor 1×1) · `fr-register`(입구 옆 계산대 — 대기 의자·사탕 통) · `fr-waiting-bench`(대기 의자) · `fr-call-button`(탁상 — 호출 버튼) · `fr-kids-chair`(아이 의자) · `fr-pass-window`(주방 내주는 창 wall 2×1) · `fr-dessert-case`(디저트 냉장 진열 floor 1×1).
- 규동 체인: `fr-u-counter`(ㄷ자 카운터 — R.table 한 줄 또는 조각 이어 붙임) · `fr-counter-stool`(카운터 의자) · `fr-ticket-machine`(식권기 — 기존 `fd-ticket-machine` 이 맞으면 그것) · `fr-tea-pot`(탁상) · `fr-gyudon`(탁상 — 덮밥 그릇) · `fr-condiment`(탁상 — 생강·시치미 통).
## 장소 (places5-famires.json, 둘)
- 「패밀리 레스토랑」 `famires`(약 18×13): 입구 → 계산대·대기 의자(손님 쪽 2줄) → 창가 박스석 줄(남쪽·북쪽, 칸막이) + 가운데 4인 탁자 → 드링크 바·수프 바 → 주방(칸막이+내주는 창, 직원 문). building `jp_famires`.
- 「규동집」 `gyudon`(약 11×9): 입구 → 식권기 → ㄷ자 카운터(의자가 카운터를 봄, 카운터 안쪽 직원 1칸 narrow) → 주방. building `jp_gyudon`.
## 분류: `famires` 패밀리 레스토랑, `gyudon` 규동집.
