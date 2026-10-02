# 나무·소품·담·다리 조각 사전 2/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **9408칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 9347 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-bush_l_b · 덤불 l_b 3×2 · 3×2 · 분류 bush
막힘 3 · 걸음★ 3 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_l_b","w":3,"h":2,"class":"bush","upperTiles":[[800,801,802],[816,817,818]],"walk":["CCC","XXX"]}
```

### jb-small_p · 어린 나무 p 2×3 · 2×3 · 분류 sapling
막힘 2 · 걸음★ 4 · 걸음 0칸. 풀 위. 줄기 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-small_p","w":2,"h":3,"class":"sapling","upperTiles":[[2146,2147],[2162,2163],[2178,2179]],"walk":["CC","CC","XX"]}
```

### jb-small_z_a · 어린 나무 z_a 2×3 · 2×3 · 분류 sapling
막힘 2 · 걸음★ 4 · 걸음 0칸. 풀 위. 줄기 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-small_z_a","w":2,"h":3,"class":"sapling","upperTiles":[[2029,2030],[2045,2046],[2061,2062]],"walk":["CC","CC","XX"]}
```

### jb-small_z_b · 어린 나무 z_b 2×3 · 2×3 · 분류 sapling
막힘 2 · 걸음★ 4 · 걸음 0칸. 풀 위. 줄기 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-small_z_b","w":2,"h":3,"class":"sapling","upperTiles":[[2144,2145],[2160,2161],[2176,2177]],"walk":["CC","CC","XX"]}
```

### jb-bush_s_a · 덤불 s_a 2×1 · 2×1 · 분류 tuft
막힘 2 · 걸음★ 0 · 걸음 0칸. 풀 위 장식. 칸이 막힌다.
```json
{"kit":"kit:joseon_baram/jb-bush_s_a","w":2,"h":1,"class":"tuft","upperTiles":[[803,804]],"walk":["XX"]}
```

### jb-bush_s_b · 덤불 s_b 2×1 · 2×1 · 분류 tuft
막힘 2 · 걸음★ 0 · 걸음 0칸. 풀 위 장식. 칸이 막힌다.
```json
{"kit":"kit:joseon_baram/jb-bush_s_b","w":2,"h":1,"class":"tuft","upperTiles":[[805,806]],"walk":["XX"]}
```

### jb-fort_wall_end_l · 성벽 end_l 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_end_l","w":1,"h":5,"class":"wall","upperTiles":[[1741],[1757],[1773],[1789],[1805]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_end_r · 성벽 end_r 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_end_r","w":1,"h":5,"class":"wall","upperTiles":[[1742],[1758],[1774],[1790],[1806]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_h · 성벽 h 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_h","w":1,"h":5,"class":"wall","upperTiles":[[1738],[1754],[1770],[1786],[1802]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_h1 · 성벽 h1 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_h1","w":1,"h":5,"class":"wall","upperTiles":[[1739],[1755],[1771],[1787],[1803]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_h2 · 성벽 h2 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_h2","w":1,"h":5,"class":"wall","upperTiles":[[1740],[1756],[1772],[1788],[1804]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_sluice · 성벽 sluice 4×5 · 4×5 · 분류 wall
막힘 14 · 걸음★ 0 · 걸음 2칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_sluice","w":4,"h":5,"class":"wall","upperTiles":[[1872,1873,1874,1875],[1888,1889,1890,1891],[1904,1905,1906,1907],[1920,-1,-1,1923],[1936,-1,-1,1939]],"walk":["XXXX","XXXX","XFFX","X..X","X..X"]}
```

### jb-gn_mud_c_ne · 국내성 mud_c_ne 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_ne","w":1,"h":1,"class":"wall","upperTiles":[[7774]],"walk":["X"]}
```

### jb-gn_mud_c_nw · 국내성 mud_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[7773]],"walk":["X"]}
```

### jb-gn_mud_c_se · 국내성 mud_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_se","w":1,"h":1,"class":"wall","upperTiles":[[7856]],"walk":["X"]}
```

### jb-gn_mud_c_sw · 국내성 mud_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[7775]],"walk":["X"]}
```

### jb-gn_mud_h0 · 국내성 mud_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_h0","w":1,"h":1,"class":"wall","upperTiles":[[7768]],"walk":["X"]}
```

### jb-gn_mud_h1 · 국내성 mud_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_h1","w":1,"h":1,"class":"wall","upperTiles":[[7769]],"walk":["X"]}
```

### jb-gn_mud_h2 · 국내성 mud_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_h2","w":1,"h":1,"class":"wall","upperTiles":[[7770]],"walk":["X"]}
```

### jb-gn_mud_v · 국내성 mud_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_v","w":1,"h":1,"class":"wall","upperTiles":[[7771]],"walk":["X"]}
```

### jb-gn_mud_v1 · 국내성 mud_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_v1","w":1,"h":1,"class":"wall","upperTiles":[[7772]],"walk":["X"]}
```

### jb-gn_mudg_c_ne · 국내성 mudg_c_ne 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_ne","w":1,"h":1,"class":"wall","upperTiles":[[7863]],"walk":["X"]}
```
