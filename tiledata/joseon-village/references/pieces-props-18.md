# 나무·소품·담·다리 조각 사전 18/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_workbench · in workbench 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_workbench","w":2,"h":1,"class":"prop","upperTiles":[[15912,15913]],"walk":["XX"]}
```

### jb-in_yak_table · in yak table 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_yak_table","w":2,"h":1,"class":"prop","upperTiles":[[15957,15958]],"walk":["XX"]}
```

### jb-in_yakhwa · in yakhwa 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_yakhwa","w":1,"h":1,"class":"prop","upperTiles":[[15898]],"walk":["X"]}
```

### jb-in_yakjang · in yakjang 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_yakjang","w":2,"h":2,"class":"prop","upperTiles":[[15887,15888],[15889,15890]],"walk":["XX","XX"]}
```

### jb-in_yakjang_1 · in yakjang 1 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_yakjang_1","w":1,"h":2,"class":"prop","upperTiles":[[15891],[15892]],"walk":["X","X"]}
```

### jb-in_yakyeon · in yakyeon 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_yakyeon","w":1,"h":1,"class":"prop","upperTiles":[[15897]],"walk":["X"]}
```

### jb-jangdokdae · 장독대 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-jangdokdae","w":3,"h":2,"class":"prop","upperTiles":[[2988,2989,2990],[3004,3005,3006]],"walk":["XXX","XXX"]}
```

### jb-jangseung_f · 여장승 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-jangseung_f","w":1,"h":2,"class":"prop","upperTiles":[[2396],[2412]],"walk":["X","X"]}
```

### jb-jangseung_m · 남장승 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-jangseung_m","w":1,"h":2,"class":"prop","upperTiles":[[2395],[2411]],"walk":["X","X"]}
```

### jb-jars · 항아리 2×2 · 2×2 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-jars","w":2,"h":2,"class":"prop","upperTiles":[[2389,2390],[2405,2406]],"walk":["XF","XX"]}
```

### jb-jukbyeok · 죽벽 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-jukbyeok","w":1,"h":1,"class":"prop","upperTiles":[[3045]],"walk":["X"]}
```

### jb-lantern · 석등 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-lantern","w":1,"h":2,"class":"prop","upperTiles":[[2398],[2414]],"walk":["X","X"]}
```

### jb-laundry · 빨래터 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-laundry","w":2,"h":2,"class":"prop","upperTiles":[[2216,2217],[2232,2233]],"walk":["XX","XX"]}
```

### jb-market_stall · 시장 가게 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall","w":3,"h":3,"class":"prop","upperTiles":[[2144,2145,2146],[2160,2161,2162],[2176,2177,2178]],"walk":["XXX","XXX","XXX"]}
```

### jb-market_stall_cloth · market stall cloth 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall_cloth","w":3,"h":3,"class":"prop","upperTiles":[[2150,2151,2152],[2166,2167,2168],[2182,2183,2184]],"walk":["XXX","XXX","XXX"]}
```

### jb-market_stall_pots · market stall pots 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall_pots","w":3,"h":3,"class":"prop","upperTiles":[[2153,2154,2155],[2169,2170,2171],[2185,2186,2187]],"walk":["XXX","XXX","XXX"]}
```

### jb-market_stall_thatch · market stall thatch 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall_thatch","w":3,"h":3,"class":"prop","upperTiles":[[2147,2148,2149],[2163,2164,2165],[2179,2180,2181]],"walk":["XXX","XXX","XXX"]}
```

### jb-mat_peppers · 고추 멍석 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-mat_peppers","w":2,"h":1,"class":"prop","upperTiles":[[2393,2394]],"walk":["FF"]}
```

### jb-millstone · 맷돌 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-millstone","w":2,"h":1,"class":"prop","upperTiles":[[2983,2984]],"walk":["XX"]}
```

### jb-nugak · 누각 8×8 · 8×8 · 분류 prop
막힘 50 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-nugak","w":8,"h":8,"class":"prop","upperTiles":[[-1,2209,2210,2211,2212,2213,2214,-1],[-1,2225,2226,2227,2228,2229,2230,-1],[-1,2241,2242,2243,2244,2245,2246,-1],[-1,2257,2258,2259,2260,2261,2262,-1],[-1,2273,2274,2275,2276,2277,2278,-1],[2288,2289,2290,2291,2292,2293,2294,2295],[2304,2305,2306,2307,2308,2309,2310,2311],[2320,2321,2322,2323,2324,2325,2326,2327]],"walk":[".XXXXXX.",".XXXXXX.",".XXXXXX.",".XXXXXX.",".XXXXXX.","XXXXXXXX","XXXFFXXX","XXXFFXXX"]}
```

### jb-pal_bangseok_blue · pal bangseok blue 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_blue","w":1,"h":1,"class":"prop","upperTiles":[[16380]],"walk":["F"]}
```

### jb-pal_bangseok_red · pal bangseok red 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_red","w":1,"h":1,"class":"prop","upperTiles":[[16379]],"walk":["F"]}
```
