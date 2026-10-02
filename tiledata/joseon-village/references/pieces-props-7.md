# 나무·소품·담·다리 조각 사전 7/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **9472칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 9389 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-lantern · 석등 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-lantern","w":1,"h":2,"class":"prop","upperTiles":[[2206],[2222]],"walk":["X","X"]}
```

### jb-laundry · 빨래터 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-laundry","w":2,"h":2,"class":"prop","upperTiles":[[2024,2025],[2040,2041]],"walk":["XX","XX"]}
```

### jb-market_stall · 시장 가게 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall","w":3,"h":3,"class":"prop","upperTiles":[[1952,1953,1954],[1968,1969,1970],[1984,1985,1986]],"walk":["XXX","XXX","XXX"]}
```

### jb-market_stall_cloth · market stall cloth 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall_cloth","w":3,"h":3,"class":"prop","upperTiles":[[1958,1959,1960],[1974,1975,1976],[1990,1991,1992]],"walk":["XXX","XXX","XXX"]}
```

### jb-market_stall_pots · market stall pots 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall_pots","w":3,"h":3,"class":"prop","upperTiles":[[1961,1962,1963],[1977,1978,1979],[1993,1994,1995]],"walk":["XXX","XXX","XXX"]}
```

### jb-market_stall_thatch · market stall thatch 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-market_stall_thatch","w":3,"h":3,"class":"prop","upperTiles":[[1955,1956,1957],[1971,1972,1973],[1987,1988,1989]],"walk":["XXX","XXX","XXX"]}
```

### jb-mat_peppers · 고추 멍석 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-mat_peppers","w":2,"h":1,"class":"prop","upperTiles":[[2201,2202]],"walk":["FF"]}
```

### jb-millstone · 맷돌 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-millstone","w":2,"h":1,"class":"prop","upperTiles":[[2791,2792]],"walk":["XX"]}
```

### jb-nugak · 누각 8×8 · 8×8 · 분류 prop
막힘 50 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-nugak","w":8,"h":8,"class":"prop","upperTiles":[[-1,2017,2018,2019,2020,2021,2022,-1],[-1,2033,2034,2035,2036,2037,2038,-1],[-1,2049,2050,2051,2052,2053,2054,-1],[-1,2065,2066,2067,2068,2069,2070,-1],[-1,2081,2082,2083,2084,2085,2086,-1],[2096,2097,2098,2099,2100,2101,2102,2103],[2112,2113,2114,2115,2116,2117,2118,2119],[2128,2129,2130,2131,2132,2133,2134,2135]],"walk":[".XXXXXX.",".XXXXXX.",".XXXXXX.",".XXXXXX.",".XXXXXX.","XXXXXXXX","XXXFFXXX","XXXFFXXX"]}
```

### jb-palace_censer · 궁궐 censer 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_censer","w":1,"h":2,"class":"prop","upperTiles":[[4048],[4064]],"walk":["X","X"]}
```

### jb-palace_deumeu · 궁궐 deumeu 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_deumeu","w":1,"h":2,"class":"prop","upperTiles":[[3967],[3983]],"walk":["X","X"]}
```

### jb-palace_eodo · 궁궐 eodo 4×1 · 4×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_eodo","w":4,"h":1,"class":"prop","upperTiles":[[3817,3818,3819,3820]],"walk":["FFFF"]}
```

### jb-palace_eodo_end · 궁궐 eodo_end 4×1 · 4×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_eodo_end","w":4,"h":1,"class":"prop","upperTiles":[[3904,3905,3906,3907]],"walk":["FFFF"]}
```

### jb-palace_gate_side_3 · 궁문 side_3 3×8 · 3×8 · 분류 prop
막힘 10 · 걸음★ 0 · 걸음 10칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_gate_side_3","w":3,"h":8,"class":"prop","upperTiles":[[5013,5014,5015],[5029,5030,5031],[5045,5046,5047],[5061,5062,5063],[-1,5078,5079],[-1,5094,5095],[-1,5110,5111],[-1,5126,5127]],"walk":["FXF","XXX","XXX","XXX",".FF",".FF",".FF",".FF"]}
```

### jb-palace_haetae · 궁궐 haetae 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_haetae","w":2,"h":2,"class":"prop","upperTiles":[[3965,3966],[3981,3982]],"walk":["XX","XX"]}
```

### jb-palace_lantern · 궁궐 lantern 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_lantern","w":1,"h":2,"class":"prop","upperTiles":[[3964],[3980]],"walk":["X","X"]}
```

### jb-palace_pond_4 · 궁궐 pond_4 4×3 · 4×3 · 분류 prop
막힘 12 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_pond_4","w":4,"h":3,"class":"prop","upperTiles":[[3908,3909,3910,3911],[3924,3925,3926,3927],[3940,3941,3942,3943]],"walk":["XXXX","XXXX","XXXX"]}
```

### jb-palace_pond_6 · 궁궐 pond_6 6×3 · 6×3 · 분류 prop
막힘 18 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_pond_6","w":6,"h":3,"class":"prop","upperTiles":[[3912,3913,3914,3915,3916,3917],[3928,3929,3930,3931,3932,3933],[3944,3945,3946,3947,3948,3949]],"walk":["XXXXXX","XXXXXX","XXXXXX"]}
```

### jb-pyeongsang · 평상 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pyeongsang","w":3,"h":2,"class":"prop","upperTiles":[[2793,2794,2795],[2809,2810,2811]],"walk":["XXX","XXX"]}
```

### jb-reeds · 갈대 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-reeds","w":1,"h":2,"class":"prop","upperTiles":[[2149],[2165]],"walk":["C","C"]}
```

### jb-rocks · 바위 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-rocks","w":1,"h":1,"class":"prop","upperTiles":[[2150]],"walk":["X"]}
```

### jb-sarip · 사립문 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-sarip","w":2,"h":1,"class":"prop","upperTiles":[[1155,1156]],"walk":["FF"]}
```
