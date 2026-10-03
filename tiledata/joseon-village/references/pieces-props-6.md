# 나무·소품·담·다리 조각 사전 6/10

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-palace_wall_h1 · 궁 담 h1 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_h1","w":1,"h":2,"class":"wall","upperTiles":[[3915],[3931]],"walk":["X","X"]}
```

### jb-palace_wall_h2 · 궁 담 h2 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_h2","w":1,"h":2,"class":"wall","upperTiles":[[3916],[3932]],"walk":["X","X"]}
```

### jb-palace_wall_ne · 궁 담 ne 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_ne","w":1,"h":2,"class":"wall","upperTiles":[[4000],[4016]],"walk":["X","X"]}
```

### jb-palace_wall_nw · 궁 담 nw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_nw","w":1,"h":2,"class":"wall","upperTiles":[[3919],[3935]],"walk":["X","X"]}
```

### jb-palace_wall_se · 궁 담 se 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_se","w":1,"h":2,"class":"wall","upperTiles":[[4002],[4018]],"walk":["X","X"]}
```

### jb-palace_wall_sw · 궁 담 sw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_sw","w":1,"h":2,"class":"wall","upperTiles":[[4001],[4017]],"walk":["X","X"]}
```

### jb-palace_wall_v · 궁 담 v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_v","w":1,"h":1,"class":"wall","upperTiles":[[3917]],"walk":["X"]}
```

### jb-palace_wall_v_e · 궁 담 v_e 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_v_e","w":1,"h":1,"class":"wall","upperTiles":[[3918]],"walk":["X"]}
```

### jb-wall_corner_ne · 토석담 corner_ne 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_ne","w":1,"h":2,"class":"wall","upperTiles":[[2453],[2469]],"walk":["X","X"]}
```

### jb-wall_corner_nw · 토석담 corner_nw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_nw","w":1,"h":2,"class":"wall","upperTiles":[[2452],[2468]],"walk":["X","X"]}
```

### jb-wall_corner_se · 토석담 corner_se 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_se","w":1,"h":2,"class":"wall","upperTiles":[[2455],[2471]],"walk":["X","X"]}
```

### jb-wall_corner_sw · 토석담 corner_sw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_sw","w":1,"h":2,"class":"wall","upperTiles":[[2454],[2470]],"walk":["X","X"]}
```

### jb-wall_h · 토석담 h 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_h","w":1,"h":2,"class":"wall","upperTiles":[[2399],[2415]],"walk":["X","X"]}
```

### jb-wall_h1 · 토석담 h1 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_h1","w":1,"h":2,"class":"wall","upperTiles":[[2448],[2464]],"walk":["X","X"]}
```

### jb-wall_h2 · 토석담 h2 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_h2","w":1,"h":2,"class":"wall","upperTiles":[[2449],[2465]],"walk":["X","X"]}
```

### jb-wall_v · 토석담 v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_v","w":1,"h":1,"class":"wall","upperTiles":[[2450]],"walk":["X"]}
```

### jb-wall_v_e · 토석담 v_e 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_v_e","w":1,"h":1,"class":"wall","upperTiles":[[2451]],"walk":["X"]}
```

### jb-bank_stairs · 물가 계단 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-bank_stairs","w":1,"h":2,"class":"prop","upperTiles":[[2220],[2236]],"walk":["F","F"]}
```

### jb-bench · 벤치 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-bench","w":2,"h":1,"class":"prop","upperTiles":[[2391,2392]],"walk":["XX"]}
```

### jb-boat · 나룻배 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-boat","w":3,"h":2,"class":"prop","upperTiles":[[3051,3052,3053],[3067,3068,3069]],"walk":["XXX","XXX"]}
```

### jb-bridge · 나무다리 5×4 · 5×4 · 분류 prop
막힘 5 · 걸음★ 0 · 걸음 10칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-bridge","w":5,"h":4,"class":"prop","upperTiles":[[2384,2385,2386,2387,2388],[2400,2401,2402,2403,2404],[2416,2417,2418,2419,2420],[-1,-1,-1,-1,-1]],"walk":["XXXXX","FFFFF","FFFFF","....."]}
```

### jb-chimney · 굴뚝 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-chimney","w":1,"h":2,"class":"prop","upperTiles":[[1355],[1371]],"walk":["X","X"]}
```
