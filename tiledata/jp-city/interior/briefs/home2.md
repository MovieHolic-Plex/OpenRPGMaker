# 작업: jp_city 일본 실내 — 집 보강(베란다·맨션·목조 아파트·단층집) `interior_home2` (id 머리 `h2-`)
새 파일: `scripts/content/jp-city/blocks/interior_home2.py` (모양은 `interior_shell.py` 와 같게: `R = Registry('interior_home2', '집 보강')`, `build()`, `selftest()`, `__main__` 에서 `run_block`).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다. 1묶음(현관·LDK·화실·욕실·침실)은 이미 있다 — `src/assets/jpInteriorSpec.json` 의 가구 97종을 먼저 훑어 같은 것을 다시 그리지 말고, **방 예제에서 기존 가구를 많이 쓴다**. 이 블록은 빠진 것만 그린다.

## 그릴 것 (전부 `h2-` 머리)
베란다(맨션·단독 2층 공통 — 실내 맵 남쪽 끝 바깥 띠): `h2-veranda-floor`(베란다 회색 콘크리트·방수 바닥) · `h2-railing`(베란다 난간 — 남쪽 끝 줄에 놓는 floor 1×1, 이어 붙여 한 줄, 너머로 막힘. 맨션은 콘크리트+유리판, 단독은 금속 살) · `h2-railing-metal` · `h2-laundry-pole`(빨래 장대에 빨래 — floor 2×1 또는 3×1, 수건·셔츠 색, 사람 없이) · `h2-ac-outdoor`(에어컨 실외기 floor 1×1) · `h2-planter`(화분 줄 floor 1×1) · `h2-sandals`(베란다 샌들 flat 1×1) · `h2-sash-door`(방 ↔ 베란다 큰 유리 미닫이 문 — 칸막이 틈에 놓는 flat 2×1 레일 문턱)
맨션 2LDK: `h2-genkan-door-steel`(맨션 철문 현관 문턱 flat 1×1 — 기존 `genkan-door` 와 다른 회색 철문) · `h2-shoe-closet`(맨션 키 큰 신발장 wall 1×2) · `h2-system-kitchen-island`(대면식 키친 — 기존 `kcounter` 로 되면 그리지 말고 예제만) · `h2-bed-side`(침대 옆 수납 wall 1×1)
목조 아파트(木造アパート, 쇼와풍 6조 한 칸): `h2-old-sink`(작은 옛 싱크+1구 가스레인지 wall 2×1, 스테인리스) · `h2-old-fridge`(작은 2도어 냉장고 wall 1×1) · `h2-cardboard`(골판지 상자 쌓음 floor 1×1) · `h2-hanger-rail`(벽 행거 wall 1×1 — 옷) · `h2-futon-dry`(창가 이불 말림 hang)
단층집(平屋 — 옛집): `h2-engawa`(엔가와 툇마루 바닥 — 나무 판 긴 줄, 바깥 정원 쪽 남쪽 끝 띠 floor 바닥으로 `R.floor`) · `h2-garden-step`(엔가와 아래 디딤돌 flat 1×1) · `h2-shoji-door`(장지문 칸막이 열린 문턱 flat 1×1/2×1) · `h2-irori`(이로리 화로 floor 1×1 — 바닥 속 재·숯·쇠주전자, 불빛) · `h2-hibachi`(화로 floor 1×1) · `h2-old-tansu`(옛 계단 서랍장 wall 2×1)
탁상 물건(goods): `h2-teapot-iron`(쇠주전자) · `h2-potted-herb` · `h2-instant-noodle` · `h2-ashtray-old`

## 방 예제 (기존 가구를 섞어서)
- `interior_home2-mansion-2ldk.json` 맨션 2LDK(약 14×11): 철문 현관 + 신발장 → 복도(화장실·욕실 방문) → LDK(대면식 키친·식탁·소파·TV) + 방 2개(침실·아이방) → 남쪽 끝 베란다 띠(유리 미닫이 문 · 빨래 장대 · 실외기 · 난간 한 줄).
- `interior_home2-mokuchin.json` 목조 아파트 한 칸(약 7×7): 작은 현관 · 옛 싱크 · 작은 냉장고 · 다다미 6조 · 고타쓰 · 행거 · 골판지 · 창가 이불.
- `interior_home2-hiraya.json` 단층 옛집(약 14×10): 현관 → 다다미방 2~3칸(장지문) + 이로리 방 + 부엌 → 남쪽 엔가와 띠 + 디딤돌.
각 json 은 `tiledata/jp-city/interior/demo/` 에. 베란다는 「바깥」이지만 실내 맵 안의 띠로 짓는다(평면 안쪽, 남쪽 끝 줄 = 난간).

## 산출물
`scripts/content/jp-city/blocks/interior_home2.py`, `tiledata/jp-city/blocks/interior_home2/*.png`, `tiledata/jp-city/interior/demo/interior_home2-*.json`(+png).
