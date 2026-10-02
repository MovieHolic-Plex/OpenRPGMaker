# 나무·소품·담·다리 조각 사전 5/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **7872칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 7808 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-wall_corner_sw · 토석담 corner_sw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_sw","w":1,"h":2,"class":"wall","upperTiles":[[2262],[2278]],"walk":["X","X"]}
```

### jb-wall_h · 토석담 h 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_h","w":1,"h":2,"class":"wall","upperTiles":[[2207],[2223]],"walk":["X","X"]}
```

### jb-wall_h1 · 토석담 h1 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_h1","w":1,"h":2,"class":"wall","upperTiles":[[2256],[2272]],"walk":["X","X"]}
```

### jb-wall_h2 · 토석담 h2 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_h2","w":1,"h":2,"class":"wall","upperTiles":[[2257],[2273]],"walk":["X","X"]}
```

### jb-wall_v · 토석담 v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_v","w":1,"h":1,"class":"wall","upperTiles":[[2258]],"walk":["X"]}
```

### jb-wall_v_e · 토석담 v_e 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_v_e","w":1,"h":1,"class":"wall","upperTiles":[[2259]],"walk":["X"]}
```

### jb-bank_stairs · 물가 계단 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-bank_stairs","w":1,"h":2,"class":"prop","upperTiles":[[2028],[2044]],"walk":["F","F"]}
```

### jb-bench · 벤치 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-bench","w":2,"h":1,"class":"prop","upperTiles":[[2199,2200]],"walk":["XX"]}
```

### jb-boat · 나룻배 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-boat","w":3,"h":2,"class":"prop","upperTiles":[[2859,2860,2861],[2875,2876,2877]],"walk":["XXX","XXX"]}
```

### jb-bridge · 나무다리 5×4 · 5×4 · 분류 prop
막힘 5 · 걸음★ 0 · 걸음 10칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-bridge","w":5,"h":4,"class":"prop","upperTiles":[[2192,2193,2194,2195,2196],[2208,2209,2210,2211,2212],[2224,2225,2226,2227,2228],[-1,-1,-1,-1,-1]],"walk":["XXXXX","FFFFF","FFFFF","....."]}
```

### jb-chimney · 굴뚝 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-chimney","w":1,"h":2,"class":"prop","upperTiles":[[1154],[1170]],"walk":["X","X"]}
```

### jb-deungrong_mun · 청사초롱 문 4×4 · 4×4 · 분류 prop
막힘 8 · 걸음★ 4 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-deungrong_mun","w":4,"h":4,"class":"prop","upperTiles":[[1883,-1,-1,1886],[1899,1900,1901,1902],[1915,1916,1917,1918],[1931,1932,1933,1934]],"walk":["X..X","XCCX","XCCX","XFFX"]}
```

### jb-dilbang · 디딜방아 4×2 · 4×2 · 분류 prop
막힘 5 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-dilbang","w":4,"h":2,"class":"prop","upperTiles":[[-1,2788,2789,2790],[2803,2804,2805,2806]],"walk":[".FXF","XXXX"]}
```

### jb-dock · 선착장 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-dock","w":1,"h":2,"class":"prop","upperTiles":[[2862],[2878]],"walk":["F","F"]}
```

### jb-dolmadam · 돌기와담 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-dolmadam","w":1,"h":1,"class":"prop","upperTiles":[[2852]],"walk":["X"]}
```

### jb-fence_h · 울타리 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fence_h","w":1,"h":1,"class":"prop","upperTiles":[[2151]],"walk":["X"]}
```

### jb-firewood · 장작더미 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-firewood","w":2,"h":1,"class":"prop","upperTiles":[[2848,2849]],"walk":["XX"]}
```

### jb-flower_bed · 화단 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-flower_bed","w":2,"h":1,"class":"prop","upperTiles":[[2026,2027]],"walk":["FF"]}
```

### jb-fort_gate · 성문 10×9 · 10×9 · 분류 prop
막힘 56 · 걸음★ 14 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fort_gate","w":10,"h":9,"class":"prop","upperTiles":[[-1,-1,1730,1731,1732,1733,1734,1735,-1,-1],[-1,-1,1746,1747,1748,1749,1750,1751,-1,-1],[-1,-1,1762,1763,1764,1765,1766,1767,-1,-1],[-1,-1,1778,1779,1780,1781,1782,1783,-1,-1],[1792,1793,1794,1795,1796,1797,1798,1799,1800,1801],[1808,1809,1810,1811,1812,1813,1814,1815,1816,1817],[1824,1825,1826,1827,1828,1829,1830,1831,1832,1833],[1840,1841,1842,1843,1844,1845,1846,1847,1848,1849],[1856,1857,1858,1859,1860,1861,1862,1863,1864,1865]],"walk":["..XXCCXX..","..XXCCXX..","..XXCCXX..","..XXCCXX..","XXXXCCXXXX","XXXXCCXXXX","XXXXCCXXXX","XXXXFFXXXX","XXXXFFXXXX"],"passage":{"dx":4,"dy":7,"w":2,"h":2}}
```

### jb-geumjul_altar · 금줄 제단 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-geumjul_altar","w":3,"h":2,"class":"prop","upperTiles":[[2854,2855,2856],[2870,2871,2872]],"walk":["XXX","XXX"]}
```

### jb-gochu_mat · 고추 멍석 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-gochu_mat","w":2,"h":1,"class":"prop","upperTiles":[[2850,2851]],"walk":["FF"]}
```

### jb-gungnae_bridge_h4 · 국내성 돌다리 h4 4×5 · 4×5 · 분류 prop
막힘 8 · 걸음★ 0 · 걸음 12칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-gungnae_bridge_h4","w":4,"h":5,"class":"prop","upperTiles":[[4889,4890,4891,4892],[4905,4906,4907,4908],[4921,4922,4923,4924],[4937,4938,4939,4940],[4953,4954,4955,4956]],"walk":["XXXX","FFFF","FFFF","FFFF","XXXX"]}
```
