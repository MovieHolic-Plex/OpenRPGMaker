# 작업: jp_city 일본 실내 — 목욕탕·코인세탁·파출소·의원 `interior_public` (id 머리 `pb-`)
새 파일: `scripts/content/jp-city/blocks/interior_public.py` (모양은 `interior_shell.py` 와 같게: `R = Registry('interior_public', '공공·목욕탕')`, `build()`, `selftest()`, `__main__` 에서 `run_block`).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다. 거리에 센토(銭湯)·코인런드리·파출소(交番)·내과 의원 외관이 이미 있다 — 그 실내다.

## 그릴 것 (전부 `pb-` 머리)
바닥·벽: `pb-sento-tile`(목욕탕 욕장 작은 흰·하늘 타일 바닥) · `pb-sento-wall`(욕장 타일 벽면) · `pb-mural`(욕탕 뒤 벽 그림 — 후지산 풍경 페인트 벽면, hang 2~4칸 폭, 사람·글자 없이 산·물·하늘) · `pb-linoleum`(의원·파출소 연녹/베이지 리놀륨 바닥) · `pb-office-wall`(사무 벽면 연한 크림 + 회색 걸레받이)
목욕탕: `pb-bandai`(반다이 높은 계산대 — 남탕/여탕 사이 높은 칸, floor 1×1, use counter) · `pb-locker`(나무 신발장·옷장 로커 wall 1×2 — 칸칸 작은 나무 문) · `pb-basket-shelf`(옷 바구니 선반 wall 2×1) · `pb-scale`(체중계 floor 1×1) · `pb-massage-chair`(안마 의자 floor 1×1) · `pb-milk-fridge`(병우유 냉장고 wall 1×2) · `pb-bath`(큰 욕조 — 탁자 자동 타일 `R.table` 처럼 어떤 w×h 도: 타일 테두리 + 물 면(하늘·흰 반짝임), 사람 안 그림) · `pb-wash-station`(씻는 자리 — 수도꼭지 2개+거울, wall 1×1, 이어 붙이면 한 줄) · `pb-wash-stool`(목욕 의자+대야 floor 1×1) · `pb-noren-m`·`pb-noren-f`(남탕·여탕 입구 노렌 hang — 파랑·빨강, 글자 없이)
코인세탁: `pb-washer`(드럼 세탁기 wall 1×1 — 둥근 유리문, 이어 붙여 한 줄) · `pb-dryer`(2단 건조기 wall 1×2) · `pb-fold-table`(개는 탁자 floor 2×1, surface) · `pb-bench`(대기 벤치 floor 2×1, use sit) · `pb-vending`(세제 자판기 wall 1×1) · `pb-changer`(동전 교환기 wall 1×1)
파출소: `pb-police-desk`(사무 책상 floor 2×1, surface, 서류) · `pb-office-chair-s/-n`(사무 의자) · `pb-map-board`(동네 지도판 hang — 길·블록 색, 글자 없이) · `pb-file-cabinet`(철제 캐비닛 wall 1×1/1×2) · `pb-bicycle`(경찰 자전거 floor 1×1 — 입구 밖 또는 안) 
의원: `pb-reception`(접수 카운터 floor 1×1, use counter, surface — 이어 붙임) · `pb-waiting-sofa`(대기실 긴 의자 floor 2×1/3×1, use sit, facing) · `pb-exam-bed`(진찰대 floor 1×2, 흰 시트) · `pb-curtain`(진찰실 커튼 칸막이 floor 1×1 — 연녹 천, walk 막지 않게 하려면 선택) · `pb-doctor-desk`(의사 책상+모니터 wall 2×1) · `pb-med-cabinet`(약품장 유리문 wall 1×2) · `pb-scale-height`(신장계 floor 1×1)
탁상 물건(goods): `pb-milk-bottle` · `pb-detergent` · `pb-documents` · `pb-stethoscope`

## 방 예제
- `interior_public-sento.json` 센토(약 14×11): 입구 → 신발장 로커 → 반다이 → 탈의실(바구니 선반·로커·체중계·안마의자·우유 냉장고) → 칸막이 방문 → 욕장(씻는 자리 줄 + 의자, 북쪽 큰 욕조, 그 뒤 벽 그림). 남탕 하나만 지어도 된다.
- `interior_public-laundry.json` 코인세탁(약 8×6): 한쪽 벽 세탁기 줄, 반대쪽 건조기 줄, 가운데 개는 탁자, 입구 옆 벤치·자판기.
- `interior_public-koban.json` 파출소(약 7×6): 입구 쪽 책상 + 의자, 지도판, 캐비닛, 뒤 작은 방.
- `interior_public-clinic.json` 동네 의원(약 12×9): 입구 → 접수 카운터 → 대기실 긴 의자 → 진찰실(의사 책상·진찰대·커튼·약품장) 방문.
각 json 은 `tiledata/jp-city/interior/demo/` 에.

## 산출물
`scripts/content/jp-city/blocks/interior_public.py`, `tiledata/jp-city/blocks/interior_public/*.png`, `tiledata/jp-city/interior/demo/interior_public-*.json`(+png).
