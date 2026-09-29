# 예시 배치 · 굽이 운하 도시 (`bends`)

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

의도: 굽이 운하 도시(라운드 4): 다섯 요소를 먼저 좌표로 정했다 — 경계 = 운하 중심선 표 (y,x) (0,36)(8,36)(18,44)(34,44)(46,32)(60,32)(68,38)(84,38) 를 행마다 폭 4 로 칠한 굽이 셋의 운하와 남쪽 호수 항구, 길 = 양 둑의 2칸 둑길 + 동쪽 대로(x=72..75 → y=47 에서 6칸 서쪽으로 어긋나 x=66..69) + 성문 거리·저택 거리·성당 거리(두 줄 남쪽으로 어긋남), 구역 = 서쪽 성 둑·북동 언덕(저택·성당)·동쪽 시장 구역·남쪽 항구, 결절점 = 포룸·우물 광장·항구 광장·시장 블록, 랜드마크 = 성(북서)·저택·성당(북동)·포룸(가운데 남쪽)·풍차(서쪽). 그다음 블록을 띠(band)마다 깔았다: 띠 위아래가 모두 거리이고 블록 사이 2칸 거리가 두 거리를 잇는다, 띠 끝과 둑길 사이 비스듬한 틈은 행마다 포석으로 메웠다. 동쪽 띠는 서쪽보다 두 줄 아래로 밀어 가로길이 한 줄로 이어지지 않는다. 블록 id 는 찍기 전에 예약했다(같은 id 2번 이하, 24칸 안 반복 없음).

그림 `layout-bends` (엔진 렌더 100×100, 820px 로 줄임). 이 배치는 `scripts/content/author-beodeul-layouts.mts --only bends` 가
편집기 도구를 아래 순서로 불러 만든다(같은 순서로 부르면 같은 맵이 나온다 — 전체 아래층·윗층 배열은 이 순서의 결과다).

## 잰 값
| 항목 | 값 |
|---|---|
| 원본과 같은 칸 | 73/10000 (0.73%) |
| 구역 키트 | bd-castle✓, bd-estate✓, bd-forum✓, bd-cathedral✓, bd-windmill✓, bd-harbour·, bd-harbour-west·, bd-river-bridge· |
| 문 | 46곳 — 육지 도달 46, 포장 길망 도달 46 |
| 막다른 포장 칸 / 막다른 넓은 거리 | 6 / 5 |
| 물에 닿아 끝나는 거리 / 막힌 문 앞 / 같은 조각 셋 일렬 | 1 / 0 / 0 |
| 빈 바닥(물건 없는 걷는 비포장 땅) | 맵 전체 22.4% · 20×15 화면 35개 중 40% 넘는 화면 3개 (가장 빈 화면 60%) |
| 도구 호출 | 524번(잔디 무늬 조각 60번 포함) |

## 도구 순서 (잔디 무늬 60번은 뺐다)
```text
create_map {"id": "bends", "name": "굽이 운하 도시", "width": 100, "height": 100, "tilesetId": "beodeul_city"}
fill_region 버들항 풀밭 (0,0) 100×100
stamp_object bd-harbour-lake @(0,84)
fill_region 물 행마다 y=0..83 폭 4 · x=36(y0~8) → x=44(y18~34) → x=32(y46~60) → x=38(y68~83) (한 줄씩 사이는 1칸씩 비껴, 84번)
fill_region 버들항 길 포석 행마다 y=0..83 폭 2 · x=34(y0~8) → x=42(y18~34) → x=30(y46~60) → x=36(y68~83) (한 줄씩 사이는 1칸씩 비껴, 84번)
fill_region 버들항 길 포석 행마다 y=0..83 폭 2 · x=40(y0~8) → x=48(y18~34) → x=36(y46~60) → x=42(y68~83) (한 줄씩 사이는 1칸씩 비껴, 84번)
stamp_object bd-castle @(1,0)
stamp_object bd-estate @(55,0)
stamp_object bd-cathedral @(80,2)
stamp_object bd-windmill @(0,60)
fill_region 버들항 길 포석 (0,33) 42×1
fill_region 버들항 길 포석 (0,34) 42×1
fill_region 버들항 길 포석 (50,22) 26×1
fill_region 버들항 길 포석 (50,23) 26×1
fill_region 버들항 길 포석 (72,24) 28×2
fill_region 버들항 길 포석 (72,22) 4×28
fill_region 버들항 길 포석 (66,47) 10×2
fill_region 버들항 길 포석 (66,47) 4×37
fill_region 버들항 길 포석 (12,58) 2×26
stamp_object bd-bridge-arch @(44,21)
stamp_object bd-bridge-arch @(32,47)
stamp_object bd-bridge-arch @(38,72)
fill_region 버들항 길 포석 (14,35) 2×13
fill_region 버들항 길 포석 행마다 y=35..45 폭 1~11 · x=30(y35~45) (한 줄씩 사이는 1칸씩 비껴, 11번)
fill_region 버들항 길 포석 (0,48) 30×1
fill_region 버들항 길 포석 (0,49) 30×1
stamp_object bd-block-res-14x13-b @(0,35)
fill_region 버들항 길 포석 (14,41) 1×1
stamp_object bd-block-manor-14x13 @(16,35)
fill_region 버들항 길 포석 (15,41) 1×1
fill_region 버들항 길 포석 (30,41) 1×1
fill_region 버들항 길 포석 (14,50) 2×8
fill_region 버들항 길 포석 (0,58) 30×1
fill_region 버들항 길 포석 (0,59) 30×1
stamp_object bd-block-res-14x8 @(0,50)
stamp_object bd-block-market-14x8 @(16,50)
fill_region 버들항 길 포석 행마다 y=60..74 폭 2~22 · x=28(y60~72) (한 줄씩 사이는 1칸씩 비껴, 15번)
stamp_object bd-block-res-14x13 @(14,60)
fill_region 버들항 길 포석 (13,66) 1×1
fill_region 버들항 길 포석 (28,66) 1×1
fill_region 버들항 길 포석 (24,75) 2×8
fill_region 버들항 길 포석 (14,83) 22×1
fill_region 버들항 길 포석 (14,84) 22×1
stamp_object bd-block-res-10x8-b @(14,75)
stamp_object bd-block-res-10x8 @(26,75)
fill_region 버들항 길 포석 (49,35) 1×1
fill_region 버들항 길 포석 (48,36) 2×1
fill_region 버들항 길 포석 행마다 y=24..38 폭 2~26 · x=70(y24~36) (한 줄씩 사이는 1칸씩 비껴, 15번)
stamp_object bd-block-manor-20x13-c @(50,24)
fill_region 버들항 길 포석 (49,30) 1×1
fill_region 버들항 길 포석 (70,30) 1×1
fill_region 버들항 길 포석 행마다 y=39..45 폭 1~7 · 비스듬히 (한 줄씩 사이는 1칸씩 비껴, 7번)
fill_region 버들항 길 포석 (56,38) 2×8
fill_region 버들항 길 포석 (38,46) 34×1
fill_region 버들항 길 포석 (38,47) 34×1
stamp_object bd-block-market-10x8 @(46,38)
stamp_object bd-block-res-14x8-c @(58,38)
fill_region 버들항 길 포석 행마다 y=48..60 폭 2 · x=38(y48~60) (한 줄씩 사이는 1칸씩 비껴, 13번)
fill_region 버들항 길 포석 행마다 y=48..62 폭 6~27 · x=60(y48~60) (한 줄씩 사이는 1칸씩 비껴, 15번)
stamp_object bd-block-manor-20x13-b @(40,48)
fill_region 버들항 길 포석 (39,54) 1×1
fill_region 버들항 길 포석 (60,54) 1×1
stamp_object bd-forum @(44,64)
fill_region 버들항 길 포석 (44,78) 22×1
fill_region 버들항 길 포석 (44,79) 22×1
fill_region 버들항 길 포석 행마다 y=26..38 폭 4 · x=96(y26~38) (한 줄씩 사이는 1칸씩 비껴, 13번)
fill_region 버들항 길 포석 (76,39) 24×2
stamp_object bd-block-manor-20x13 @(76,26)
fill_region 버들항 길 포석 (75,32) 1×1
fill_region 버들항 길 포석 (96,32) 1×1
fill_region 버들항 길 포석 행마다 y=41..53 폭 4 · x=96(y41~53) (한 줄씩 사이는 1칸씩 비껴, 13번)
fill_region 버들항 길 포석 (76,54) 24×2
stamp_object bd-block-res-20x13 @(76,41)
fill_region 버들항 길 포석 (75,47) 1×1
fill_region 버들항 길 포석 (96,47) 1×1
fill_region 버들항 길 포석 (84,56) 2×8
fill_region 버들항 길 포석 (70,64) 30×2
stamp_object bd-block-res-14x8-b @(70,56)
stamp_object bd-block-out-14x8 @(86,56)
fill_region 버들항 길 포석 (84,67) 2×13
fill_region 버들항 길 포석 (70,80) 30×2
stamp_object bd-block-shop-14x13 @(70,67)
fill_region 버들항 길 포석 (69,73) 1×1
fill_region 버들항 길 포석 (84,73) 1×1
stamp_object bd-block-manor-14x13 @(86,67)
fill_region 버들항 길 포석 (85,73) 1×1
fill_region 버들항 길 포석 (70,82) 13×2
stamp_object bd-harbour-square @(86,82)
stamp_object bd-out-well-plaza @(42,1)
stamp_object 나무 32그루 (빈 잔디, 길에서 1칸 띄움)
```
