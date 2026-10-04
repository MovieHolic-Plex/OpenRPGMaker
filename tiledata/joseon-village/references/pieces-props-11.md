# 나무·소품·담·다리 조각 사전 11/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-fld_flowers_a · fld flowers a 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_flowers_a","w":1,"h":1,"class":"prop","upperTiles":[[14062]],"walk":["F"]}
```

### jb-fld_flowers_b · fld flowers b 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_flowers_b","w":1,"h":1,"class":"prop","upperTiles":[[14064]],"walk":["F"]}
```

### jb-fld_flowers_c · fld flowers c 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_flowers_c","w":1,"h":1,"class":"prop","upperTiles":[[14063]],"walk":["F"]}
```

### jb-fld_grave_a · fld grave a 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_grave_a","w":2,"h":2,"class":"prop","upperTiles":[[13842,13843],[13844,13845]],"walk":["XX","XX"]}
```

### jb-fld_grave_b · fld grave b 2×2 · 2×2 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_grave_b","w":2,"h":2,"class":"prop","upperTiles":[[13846,13847],[13848,13849]],"walk":["FX","XX"]}
```

### jb-fld_log_a · fld log a 3×1 · 3×1 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_log_a","w":3,"h":1,"class":"prop","upperTiles":[[14066,14067,14068]],"walk":["XXX"]}
```

### jb-fld_log_b · fld log b 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_log_b","w":2,"h":1,"class":"prop","upperTiles":[[13829,13830]],"walk":["XX"]}
```

### jb-fld_ore_a · fld ore a 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_ore_a","w":1,"h":1,"class":"prop","upperTiles":[[13873]],"walk":["X"]}
```

### jb-fld_ore_b · fld ore b 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_ore_b","w":2,"h":1,"class":"prop","upperTiles":[[13876,13877]],"walk":["XX"]}
```

### jb-fld_rack · fld rack 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rack","w":2,"h":2,"class":"prop","upperTiles":[[13825,13826],[13827,13828]],"walk":["XX","XX"]}
```

### jb-fld_rock_l_a · fld rock l a 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_l_a","w":3,"h":2,"class":"prop","upperTiles":[[14030,14031,14032],[14033,14034,14035]],"walk":["XXX","XXX"]}
```

### jb-fld_rock_l_b · fld rock l b 3×2 · 3×2 · 분류 prop
막힘 5 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_l_b","w":3,"h":2,"class":"prop","upperTiles":[[14056,14057,14058],[14059,14060,14061]],"walk":["FXX","XXX"]}
```

### jb-fld_rock_m_a · fld rock m a 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_m_a","w":2,"h":1,"class":"prop","upperTiles":[[13874,13875]],"walk":["XX"]}
```

### jb-fld_rock_m_b · fld rock m b 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_m_b","w":2,"h":2,"class":"prop","upperTiles":[[13867,13868],[13869,13870]],"walk":["XX","XX"]}
```

### jb-fld_rock_s_a · fld rock s a 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_s_a","w":1,"h":1,"class":"prop","upperTiles":[[13871]],"walk":["X"]}
```

### jb-fld_rock_s_b · fld rock s b 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_s_b","w":1,"h":1,"class":"prop","upperTiles":[[13853]],"walk":["X"]}
```

### jb-fld_rock_s_c · fld rock s c 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_s_c","w":1,"h":1,"class":"prop","upperTiles":[[13872]],"walk":["X"]}
```

### jb-fld_ruin_pagoda · fld ruin pagoda 2×3 · 2×3 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_ruin_pagoda","w":2,"h":3,"class":"prop","upperTiles":[[13834,-1],[13836,13837],[13838,13839]],"walk":["F.","XX","XX"]}
```

### jb-fld_signpost · fld signpost 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_signpost","w":1,"h":2,"class":"prop","upperTiles":[[13804],[13805]],"walk":["X","X"]}
```

### jb-fld_stump_a · fld stump a 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_stump_a","w":1,"h":1,"class":"prop","upperTiles":[[13831]],"walk":["X"]}
```

### jb-fld_stump_b · fld stump b 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_stump_b","w":1,"h":1,"class":"prop","upperTiles":[[13832]],"walk":["X"]}
```

### jb-fld_tent_a · fld tent a 3×2 · 3×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_tent_a","w":3,"h":2,"class":"prop","upperTiles":[[13819,13820,13821],[13822,13823,13824]],"walk":["FXF","XXX"]}
```
