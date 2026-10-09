# 나무·소품·담·다리 조각 사전 9/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

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

### jb-cav_brazier · cav brazier 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_brazier","w":1,"h":2,"class":"prop","upperTiles":[[15520],[15521]],"walk":["X","X"]}
```

### jb-cav_cart · cav cart 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_cart","w":2,"h":1,"class":"prop","upperTiles":[[15536,15537]],"walk":["XX"]}
```

### jb-cav_chest · cav chest 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_chest","w":1,"h":1,"class":"prop","upperTiles":[[15543]],"walk":["X"]}
```

### jb-cav_chest_dais · cav chest dais 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_chest_dais","w":3,"h":2,"class":"prop","upperTiles":[[15528,15529,15530],[15531,15532,15533]],"walk":["XXX","FFF"]}
```

### jb-cav_crystal · cav crystal 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_crystal","w":1,"h":1,"class":"prop","upperTiles":[[15542]],"walk":["X"]}
```

### jb-cav_crystal_b · cav crystal b 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_crystal_b","w":2,"h":1,"class":"prop","upperTiles":[[15526,15527]],"walk":["XX"]}
```

### jb-cav_crystal_c · cav crystal c 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_crystal_c","w":1,"h":2,"class":"prop","upperTiles":[[15534],[15535]],"walk":["X","X"]}
```

### jb-cav_moss · cav moss 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_moss","w":1,"h":1,"class":"prop","upperTiles":[[15559]],"walk":["F"]}
```

### jb-cav_mushroom_a · cav mushroom a 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_mushroom_a","w":1,"h":1,"class":"prop","upperTiles":[[15551]],"walk":["X"]}
```

### jb-cav_mushroom_b · cav mushroom b 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_mushroom_b","w":1,"h":1,"class":"prop","upperTiles":[[15552]],"walk":["X"]}
```

### jb-cav_nest · cav nest 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_nest","w":2,"h":1,"class":"prop","upperTiles":[[15538,15539]],"walk":["FF"]}
```

### jb-cav_puddle · cav puddle 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_puddle","w":1,"h":1,"class":"prop","upperTiles":[[15560]],"walk":["F"]}
```

### jb-cav_rock_a · cav rock a 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rock_a","w":1,"h":1,"class":"prop","upperTiles":[[15556]],"walk":["X"]}
```

### jb-cav_rock_b · cav rock b 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rock_b","w":2,"h":1,"class":"prop","upperTiles":[[15557,15558]],"walk":["XX"]}
```

### jb-cav_rock_c · cav rock c 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rock_c","w":1,"h":1,"class":"prop","upperTiles":[[15553]],"walk":["X"]}
```

### jb-cav_rubble · cav rubble 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rubble","w":2,"h":1,"class":"prop","upperTiles":[[15554,15555]],"walk":["XX"]}
```

### jb-cav_stalagmite · cav stalagmite 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite","w":1,"h":2,"class":"prop","upperTiles":[[15548],[15549]],"walk":["F","X"]}
```

### jb-cav_stalagmite_b · cav stalagmite b 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite_b","w":1,"h":2,"class":"prop","upperTiles":[[15540],[15541]],"walk":["X","X"]}
```

### jb-cav_stalagmite_c · cav stalagmite c 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite_c","w":1,"h":1,"class":"prop","upperTiles":[[15550]],"walk":["X"]}
```
