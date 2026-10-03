# 나무·소품·담·다리 조각 사전 3/10

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **13632칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-bush_s_a · 덤불 s_a 2×1 · 2×1 · 분류 tuft
막힘 2 · 걸음★ 0 · 걸음 0칸. 풀 위 장식. 칸이 막힌다.
```json
{"kit":"kit:joseon_baram/jb-bush_s_a","w":2,"h":1,"class":"tuft","upperTiles":[[966,967]],"walk":["XX"]}
```

### jb-bush_s_b · 덤불 s_b 2×1 · 2×1 · 분류 tuft
막힘 2 · 걸음★ 0 · 걸음 0칸. 풀 위 장식. 칸이 막힌다.
```json
{"kit":"kit:joseon_baram/jb-bush_s_b","w":2,"h":1,"class":"tuft","upperTiles":[[968,969]],"walk":["XX"]}
```

### jb-bush_s_c · 덤불 s_c 2×1 · 2×1 · 분류 tuft
막힘 2 · 걸음★ 0 · 걸음 0칸. 풀 위 장식. 칸이 막힌다.
```json
{"kit":"kit:joseon_baram/jb-bush_s_c","w":2,"h":1,"class":"tuft","upperTiles":[[1056,1057]],"walk":["XX"]}
```

### jb-bush_s_d · 덤불 s_d 2×1 · 2×1 · 분류 tuft
막힘 2 · 걸음★ 0 · 걸음 0칸. 풀 위 장식. 칸이 막힌다.
```json
{"kit":"kit:joseon_baram/jb-bush_s_d","w":2,"h":1,"class":"tuft","upperTiles":[[1058,1059]],"walk":["XX"]}
```

### jb-fort_wall_end_l · 성벽 end_l 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_end_l","w":1,"h":5,"class":"wall","upperTiles":[[1933],[1949],[1965],[1981],[1997]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_end_r · 성벽 end_r 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_end_r","w":1,"h":5,"class":"wall","upperTiles":[[1934],[1950],[1966],[1982],[1998]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_h · 성벽 h 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_h","w":1,"h":5,"class":"wall","upperTiles":[[1930],[1946],[1962],[1978],[1994]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_h1 · 성벽 h1 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_h1","w":1,"h":5,"class":"wall","upperTiles":[[1931],[1947],[1963],[1979],[1995]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_h2 · 성벽 h2 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_h2","w":1,"h":5,"class":"wall","upperTiles":[[1932],[1948],[1964],[1980],[1996]],"walk":["X","X","X","X","X"]}
```

### jb-fort_wall_sluice · 성벽 sluice 4×5 · 4×5 · 분류 wall
막힘 14 · 걸음★ 0 · 걸음 2칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-fort_wall_sluice","w":4,"h":5,"class":"wall","upperTiles":[[2064,2065,2066,2067],[2080,2081,2082,2083],[2096,2097,2098,2099],[2112,-1,-1,2115],[2128,-1,-1,2131]],"walk":["XXXX","XXXX","XFFX","X..X","X..X"]}
```

### jb-gn_mud_c_ne · 국내성 mud_c_ne 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_ne","w":1,"h":1,"class":"wall","upperTiles":[[8062]],"walk":["X"]}
```

### jb-gn_mud_c_nw · 국내성 mud_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[8061]],"walk":["X"]}
```

### jb-gn_mud_c_se · 국내성 mud_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_se","w":1,"h":1,"class":"wall","upperTiles":[[8144]],"walk":["X"]}
```

### jb-gn_mud_c_sw · 국내성 mud_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[8063]],"walk":["X"]}
```

### jb-gn_mud_h0 · 국내성 mud_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_h0","w":1,"h":1,"class":"wall","upperTiles":[[8056]],"walk":["X"]}
```

### jb-gn_mud_h1 · 국내성 mud_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_h1","w":1,"h":1,"class":"wall","upperTiles":[[8057]],"walk":["X"]}
```

### jb-gn_mud_h2 · 국내성 mud_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_h2","w":1,"h":1,"class":"wall","upperTiles":[[8058]],"walk":["X"]}
```

### jb-gn_mud_v · 국내성 mud_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_v","w":1,"h":1,"class":"wall","upperTiles":[[8059]],"walk":["X"]}
```

### jb-gn_mud_v1 · 국내성 mud_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mud_v1","w":1,"h":1,"class":"wall","upperTiles":[[8060]],"walk":["X"]}
```

### jb-gn_mudg_c_ne · 국내성 mudg_c_ne 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_ne","w":1,"h":1,"class":"wall","upperTiles":[[8151]],"walk":["X"]}
```

### jb-gn_mudg_c_nw · 국내성 mudg_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[8150]],"walk":["X"]}
```

### jb-gn_mudg_c_se · 국내성 mudg_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_se","w":1,"h":1,"class":"wall","upperTiles":[[8153]],"walk":["X"]}
```
