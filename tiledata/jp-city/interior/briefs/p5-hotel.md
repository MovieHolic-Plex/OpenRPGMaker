# 작업: 5묶음 — 비즈니스 호텔·료칸(숙박) `interior_hotel` (id 머리 `ht-`)
새 파일 `scripts/content/jp-city/blocks/interior_hotel.py` (`R = Registry('interior_hotel', '숙박')`). RPG 의 「여관」 — 쉬는 곳이다. 화실 가구(다다미·후스마·좌탁·이불 — `interior_washitsu` 등)는 기존 id 를 가져다 쓴다.
## 그릴 것 (`ht-`)
- 바닥·벽면: `ht-lobby-floor`(호텔 로비 석재·카펫) · `ht-corridor-carpet`(호텔 복도 무늬 카펫) · `ht-room-carpet`(객실 카펫) · `ht-hotel-wall`(호텔 벽면 — 베이지 벽지 + 걸레받이) · `ht-ryokan-wood`(료칸 복도 반들반들한 나무) · `ht-ryokan-wall`(료칸 벽면 — 흙벽 + 나무 기둥) · `ht-onsen-stone`(온천 돌 바닥) · `ht-onsen-wall`(온천 나무 판 벽면).
- 비즈니스 호텔: `ht-front`(프런트 카운터 floor 1×1 이어 붙임, use counter, surface — 종·카드 키) · `ht-lobby-sofa`(로비 소파) · `ht-elevator`(엘리베이터 — 기존 `of-elevator`·`mc-elevator` 가 맞으면 그것) · `ht-room-door`(객실 문 — 번호판은 색 점) · `ht-single-bed`(싱글 침대 1×2 흰 시트·헤드보드 조명) · `ht-desk-tv`(좁은 책상 + TV wall 2×1) · `ht-unit-bath-door`(유닛 배스 문) · `ht-luggage-rack`(짐 받침) · `ht-vending`(자판기 코너 — 기존 것이 맞으면) · `ht-ice-machine`(제빙기).
- 료칸: `ht-genkan-step`(료칸 현관 큰 단 — 신발 벗는 곳, flat) · `ht-slipper-rack`(슬리퍼 선반) · `ht-ryokan-front`(나무 접수대) · `ht-noren-onsen-m`·`ht-noren-onsen-f`(남탕·여탕 노렌 — 파랑·빨강, 글자 없이) · `ht-guest-futon`(객실에 깐 이불 2장 — flat 1×2, 기존 `futon` 과 다르게 고급) · `ht-tea-set-table`(객실 좌탁 + 차 세트) · `ht-engawa-chairs`(広縁 창가 의자 둘 + 작은 탁자) · `ht-rotenburo`(노천탕 — R.table 어떤 w×h: 돌 테두리 + 김 나는 물) · `ht-wash-station`(씻는 자리 — 기존 `pb-wash-station` 이 맞으면 그것) · `ht-bamboo-fence`(대나무 울타리 floor 1×1 이어 붙임) · `ht-stone-lantern`(석등 floor 1×1) · `ht-massage-chair`(안마 의자 — 기존 `pb-massage-chair` 가능).
- 탁상: `ht-card-key` · `ht-bell` · `ht-tea-cup` · `ht-yukata`(접힌 유카타).
## 장소 (places5-hotel.json, 둘)
- 「비즈니스 호텔」 `business-hotel-1f`(로비: 자동문 → 프런트(손님 쪽 2줄)·소파·자판기·엘리베이터 둘) + `business-hotel-floor`(inner: 엘리베이터 홀 → 복도 → 싱글 객실 3~4개(좁다: 침대·책상 TV·유닛 배스 문), 제빙기). building `jp_business_hotel`.
- 「료칸」 `ryokan`(약 20×15): 현관 큰 단·슬리퍼 선반 → 나무 접수대·로비 → 복도 → 다다미 객실 2개(이불·좌탁·広縁 의자, 후스마) → 남탕·여탕 노렌 → 탈의실 → 노천탕(돌 바닥·대나무 울타리·석등, 트인 곳은 open). building `jp_ryokan`.
## 분류: `hotel` 비즈니스 호텔, `ryokan` 료칸·온천.
