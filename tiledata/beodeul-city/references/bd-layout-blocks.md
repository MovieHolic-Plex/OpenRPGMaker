# 예시 배치 · 블록 조립 도시 (`blocks`)

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

의도: 블록 조립: 길 격자(남북 대로 4칸 x=44..47·동서 대로 4칸 y=32..35, 거리 2칸, 골목 1칸 y=8·59·83, 부두 길 3칸 y=92..94, 그 아래 항구 물)를 먼저 깔고, 격자 칸마다 블록 키트 하나(주택가·상가·시장·정원 저택·성당 앞·성 밖 목조·항구 창고)를 찍었다. 맨 윗줄은 8칸 블록 둘을 1칸 골목 위아래로 겹쳤다. 동쪽 공원 블록은 대각선 거리(3칸 조각을 한 줄씩 비껴 칠함)와 나무·꽃밭·벤치. 대로 가장자리 줄에 가로등·가로수. 성·포룸 같은 구역 키트는 쓰지 않은 순수 블록 예시다 — 실제 도시는 구역 키트 몇 개 + 블록으로 나머지를 채운다.

그림 `layout-blocks` (엔진 렌더 100×100, 820px 로 줄임). 이 배치는 `scripts/content/author-beodeul-layouts.mts --only blocks` 가
편집기 도구를 아래 순서로 불러 만든다(같은 순서로 부르면 같은 맵이 나온다 — 전체 아래층·윗층 배열은 이 순서의 결과다).

## 잰 값
| 항목 | 값 |
|---|---|
| 원본과 같은 칸 | 33/10000 (0.33%) |
| 구역 키트 | bd-castle·, bd-estate·, bd-forum·, bd-cathedral·, bd-windmill·, bd-harbour·, bd-harbour-west·, bd-river-bridge· |
| 문 | 120곳 — 육지 도달 120, 포장 길망 도달 120 |
| 막다른 포장 칸 / 막다른 넓은 거리 | 1 / 0 |
| 물에 닿아 끝나는 거리 / 막힌 문 앞 / 같은 조각 셋 일렬 | 0 / 0 / 1 |
| 빈 바닥(물건 없는 걷는 비포장 땅) | 맵 전체 10.8% · 20×15 화면 35개 중 40% 넘는 화면 0개 (가장 빈 화면 22%) |
| 도구 호출 | 144번(잔디 무늬 조각 0번 포함) |

## 도구 순서 (잔디 무늬 0번은 뺐다)
```text
create_map {"id": "blocks", "name": "블록 조립 도시", "width": 100, "height": 100, "tilesetId": "beodeul_city"}
fill_region 버들항 풀밭 (0,0) 100×100
fill_region 버들항 길 포석 (0,0) 2×85
fill_region 버들항 길 포석 (22,0) 2×85
fill_region 버들항 길 포석 (44,0) 4×85
fill_region 버들항 길 포석 (68,0) 2×85
fill_region 버들항 길 포석 (84,0) 2×85
fill_region 버들항 길 포석 (0,17) 100×2
fill_region 버들항 길 포석 (0,32) 100×4
fill_region 버들항 길 포석 (0,49) 100×2
fill_region 버들항 길 포석 (0,59) 100×1
fill_region 버들항 길 포석 (0,73) 100×2
fill_region 버들항 길 포석 (0,83) 100×2
fill_region 버들항 길 포석 (22,8) 78×1
stamp_object bd-harbour-lake @(0,85)
stamp_object bd-block-church-20x17 @(2,0)
stamp_object bd-block-res-20x8 @(24,0)
stamp_object bd-block-shop-20x8-b @(24,9)
stamp_object bd-block-res-20x8-c @(48,0)
stamp_object bd-block-shop-20x8 @(48,9)
stamp_object bd-block-res-14x8 @(70,0)
stamp_object bd-block-market-14x8 @(70,9)
stamp_object bd-block-res-14x8-b @(86,0)
stamp_object bd-block-shop-14x8 @(86,9)
stamp_object bd-block-res-20x13 @(2,19)
stamp_object bd-block-market-20x13 @(24,19)
stamp_object bd-block-shop-20x13 @(48,19)
stamp_object bd-block-res-14x13 @(70,19)
stamp_object bd-block-shop-14x13 @(86,19)
stamp_object bd-block-manor-20x13-b @(2,36)
stamp_object bd-block-res-20x13-b @(24,36)
stamp_object bd-block-shop-20x13-b @(48,36)
stamp_object bd-block-market-14x13 @(70,36)
stamp_object bd-block-manor-14x13 @(86,36)
stamp_object bd-block-res-20x8-b @(2,51)
stamp_object bd-block-shop-20x8 @(24,51)
stamp_object bd-block-res-20x8 @(48,51)
stamp_object bd-block-shop-14x8-b @(70,51)
stamp_object bd-block-res-14x8-c @(86,51)
stamp_object bd-block-out-20x13 @(2,60)
stamp_object bd-block-manor-20x13-c @(24,60)
stamp_object bd-block-res-20x13 @(48,60)
stamp_object bd-block-res-14x13-b @(70,60)
stamp_object bd-block-out-20x8 @(2,75)
stamp_object bd-block-port-20x8-b @(24,75)
stamp_object bd-block-port-20x8 @(48,75)
stamp_object bd-block-market-14x8-b @(70,75)
stamp_object bd-block-out-14x8 @(86,75)
fill_region 버들항 길 포석 (1,25) 1×1
fill_region 버들항 길 포석 (22,25) 1×1
fill_region 버들항 길 포석 (47,25) 1×1
fill_region 버들항 길 포석 (68,25) 1×1
fill_region 버들항 길 포석 (69,25) 1×1
fill_region 버들항 길 포석 (84,25) 1×1
fill_region 버들항 길 포석 (85,25) 1×1
fill_region 버들항 길 포석 (23,42) 1×1
fill_region 버들항 길 포석 (44,42) 1×1
fill_region 버들항 길 포석 (47,42) 1×1
fill_region 버들항 길 포석 (68,42) 1×1
fill_region 버들항 길 포석 (1,66) 1×1
fill_region 버들항 길 포석 (22,66) 1×1
fill_region 버들항 길 포석 (47,66) 1×1
fill_region 버들항 길 포석 (68,66) 1×1
fill_region 버들항 길 포석 (69,66) 1×1
fill_region 버들항 길 포석 (84,66) 1×1
fill_region 버들항 길 포석 (86,60) 3×1
fill_region 버들항 길 포석 (87,61) 3×1
fill_region 버들항 길 포석 (88,62) 3×1
fill_region 버들항 길 포석 (89,63) 3×1
fill_region 버들항 길 포석 (90,64) 3×1
fill_region 버들항 길 포석 (91,65) 3×1
fill_region 버들항 길 포석 (92,66) 3×1
fill_region 버들항 길 포석 (92,67) 3×1
fill_region 버들항 길 포석 (93,68) 3×1
fill_region 버들항 길 포석 (94,69) 3×1
fill_region 버들항 길 포석 (95,70) 3×1
fill_region 버들항 길 포석 (96,71) 3×1
fill_region 버들항 길 포석 (97,72) 3×1
stamp_object bd-tree-cc0fcb @(86,71)
stamp_object bd-tree-a80c85 @(94,63)
stamp_object bd-tree-03a8f7 @(87,67)
stamp_object bd-tree-47e17a @(90,67)
stamp_object bd-tree-e9d9b3 @(91,60)
stamp_object bd-tree-47e17a @(95,61)
stamp_object bd-tree-e9d9b3 @(87,63)
stamp_object bd-tree-cc0fcb @(97,62)
stamp_object bd-tree-47e17a @(92,69)
stamp_object bd-tree-03a8f7 @(89,70)
stamp_object bd-tree-e9d9b3 @(94,71)
stamp_object bd-tree-47e17a @(97,64)
stamp_object bd-prop-bench_wood @(97,69)
stamp_object bd-prop-bench_wood @(92,71)
stamp_object bd-tree-eef4bc @(94,60)
stamp_object bd-prop-planter_round @(97,60)
stamp_object bd-prop-planter_round @(95,67)
stamp_object bd-prop-planter_round @(87,70)
stamp_object bd-prop-planter_round @(99,69)
stamp_object bd-tree-eef4bc @(98,66)
stamp_object bd-prop-flowerbed @(87,66)
stamp_object bd-prop-planter_round @(92,63)
stamp_object bd-prop-flowerbed @(92,62)
stamp_object bd-prop-planter_round @(98,61)
stamp_object bd-tree-eef4bc @(86,65)
stamp_object bd-prop-planter_round @(99,68)
stamp_object bd-block-port-14x8 @(86,85)
fill_region 버들항 길 포석 (83,85) 3×10
fill_region 버들항 길 포석 (86,93) 14×2
stamp_object bd-tree-28ad5e @(84,97)
stamp_object bd-tree-eef4bc @(85,95)
stamp_object bd-tree-28ad5e @(83,96)
stamp_object bd-tree-a80c85 @(86,96)
stamp_object bd-tree-cc0fcb @(94,98)
stamp_object bd-tree-03a8f7 @(93,95)
stamp_object bd-tree-03a8f7 @(90,96)
stamp_object bd-tree-03a8f7 @(96,96)
stamp_object bd-prop-planter_round @(99,97)
stamp_object bd-prop-flowerbed @(96,99)
stamp_object bd-prop-planter_round @(99,95)
stamp_object bd-prop-flowerbed @(96,95)
stamp_object bd-prop-flowerbed @(91,99)
stamp_object bd-prop-planter_round @(91,95)
stamp_object bd-prop-flowerbed @(86,95)
stamp_object bd-prop-flowerbed @(86,99)
stamp_object bd-prop-planter_round @(88,95)
stamp_object bd-prop-lamp_crook @(4,33)
stamp_object bd-tree-eef4bc @(9,33)
stamp_object bd-prop-lamp_crook @(14,33)
stamp_object bd-tree-eef4bc @(19,33)
stamp_object bd-prop-lamp_crook @(29,33)
stamp_object bd-tree-eef4bc @(34,33)
stamp_object bd-prop-lamp_crook @(39,33)
stamp_object bd-tree-eef4bc @(49,33)
stamp_object bd-prop-lamp_crook @(54,33)
stamp_object bd-tree-eef4bc @(59,33)
stamp_object bd-prop-lamp_crook @(64,33)
stamp_object bd-tree-eef4bc @(74,33)
stamp_object bd-prop-lamp_crook @(79,33)
stamp_object bd-tree-eef4bc @(89,33)
stamp_object bd-prop-lamp_crook @(94,33)
stamp_object bd-prop-lamp_crook @(47,10)
stamp_object bd-tree-28ad5e @(47,38)
stamp_object bd-prop-lamp_crook @(47,54)
stamp_object bd-tree-28ad5e @(47,62)
stamp_object bd-prop-lamp_crook @(47,78)
```
