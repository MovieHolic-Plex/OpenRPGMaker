# 나무·소품·담·다리 조각 사전 8/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **7872칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 7808 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-stepping_stones · 징검돌 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stepping_stones","w":2,"h":1,"class":"prop","upperTiles":[[2857,2858]],"walk":["FF"]}
```

### jb-stone_bank · 돌 축대 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stone_bank","w":1,"h":2,"class":"prop","upperTiles":[[2148],[2164]],"walk":["X","X"]}
```

### jb-stone_pagoda · 석탑 2×3 · 2×3 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stone_pagoda","w":2,"h":3,"class":"prop","upperTiles":[[1876,1877],[1892,1893],[1908,1909]],"walk":["XX","XX","XX"]}
```

### jb-stove_pot · 가마솥 부뚜막 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-stove_pot","w":2,"h":2,"class":"prop","upperTiles":[[2880,2881],[2896,2897]],"walk":["XX","XX"]}
```

### jb-toldam · 돌담 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-toldam","w":1,"h":1,"class":"prop","upperTiles":[[1157]],"walk":["X"]}
```

### jb-waterwheel · 물레방아 3×4 · 3×4 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-waterwheel","w":3,"h":4,"class":"prop","upperTiles":[[2784,2785,2786],[2800,2801,2802],[2816,2817,2818],[2832,2833,2834]],"walk":["FFF","XXX","XXX","XXX"]}
```

### jb-well · 우물 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-well","w":2,"h":2,"class":"prop","upperTiles":[[2154,2155],[2170,2171]],"walk":["XX","XX"]}
```

### jb-wondumak · 원두막 3×4 · 3×4 · 분류 prop
막힘 12 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-wondumak","w":3,"h":4,"class":"prop","upperTiles":[[1964,1965,1966],[1980,1981,1982],[1996,1997,1998],[2012,2013,2014]],"walk":["XXX","XXX","XXX","XXX"]}
```

### jb-yeonja_mill · 연자방아 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-yeonja_mill","w":2,"h":2,"class":"prop","upperTiles":[[1069,1070],[1085,1086]],"walk":["XX","XX"]}
```
