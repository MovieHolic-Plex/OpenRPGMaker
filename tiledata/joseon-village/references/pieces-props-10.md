# 나무·소품·담·다리 조각 사전 10/10

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **13632칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-stepping_stones · 징검돌 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stepping_stones","w":2,"h":1,"class":"prop","upperTiles":[[3049,3050]],"walk":["FF"]}
```

### jb-stone_bank · 돌 축대 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stone_bank","w":1,"h":2,"class":"prop","upperTiles":[[2340],[2356]],"walk":["X","X"]}
```

### jb-stone_pagoda · 석탑 2×3 · 2×3 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stone_pagoda","w":2,"h":3,"class":"prop","upperTiles":[[2068,2069],[2084,2085],[2100,2101]],"walk":["XX","XX","XX"]}
```

### jb-stove_pot · 가마솥 부뚜막 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stove_pot","w":2,"h":2,"class":"prop","upperTiles":[[3072,3073],[3088,3089]],"walk":["XX","XX"]}
```

### jb-toldam · 돌담 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-toldam","w":1,"h":1,"class":"prop","upperTiles":[[1358]],"walk":["X"]}
```

### jb-waterwheel · 물레방아 3×4 · 3×4 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-waterwheel","w":3,"h":4,"class":"prop","upperTiles":[[2976,2977,2978],[2992,2993,2994],[3008,3009,3010],[3024,3025,3026]],"walk":["FFF","XXX","XXX","XXX"]}
```

### jb-well · 우물 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-well","w":2,"h":2,"class":"prop","upperTiles":[[2346,2347],[2362,2363]],"walk":["XX","XX"]}
```

### jb-wondumak · 원두막 3×4 · 3×4 · 분류 prop
막힘 12 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-wondumak","w":3,"h":4,"class":"prop","upperTiles":[[2156,2157,2158],[2172,2173,2174],[2188,2189,2190],[2204,2205,2206]],"walk":["XXX","XXX","XXX","XXX"]}
```

### jb-yeonja_mill · 연자방아 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-yeonja_mill","w":2,"h":2,"class":"prop","upperTiles":[[1351,1352],[1367,1368]],"walk":["XX","XX"]}
```
