# 나무·소품·담·다리 조각 사전 10/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-cav_stalagmite_wide · cav stalagmite wide 2×2 · 2×2 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite_wide","w":2,"h":2,"class":"prop","upperTiles":[[15522,15523],[15524,15525]],"walk":["FX","XX"]}
```

### jb-cav_torch_a · cav torch a 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_torch_a","w":1,"h":2,"class":"prop","upperTiles":[[15544],[15545]],"walk":["X","X"]}
```

### jb-cav_torch_b · cav torch b 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_torch_b","w":1,"h":2,"class":"prop","upperTiles":[[15546],[15547]],"walk":["X","X"]}
```

### jb-chimney · 굴뚝 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-chimney","w":1,"h":2,"class":"prop","upperTiles":[[1355],[1371]],"walk":["X","X"]}
```

### jb-deungrong_mun · 청사초롱 문 4×4 · 4×4 · 분류 prop
막힘 8 · 걸음★ 4 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-deungrong_mun","w":4,"h":4,"class":"prop","upperTiles":[[2075,-1,-1,2078],[2091,2092,2093,2094],[2107,2108,2109,2110],[2123,2124,2125,2126]],"walk":["X..X","XCCX","XCCX","XFFX"]}
```

### jb-dilbang · 디딜방아 4×2 · 4×2 · 분류 prop
막힘 5 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-dilbang","w":4,"h":2,"class":"prop","upperTiles":[[-1,2980,2981,2982],[2995,2996,2997,2998]],"walk":[".FXF","XXXX"]}
```

### jb-dock · 선착장 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-dock","w":1,"h":2,"class":"prop","upperTiles":[[3054],[3070]],"walk":["F","F"]}
```

### jb-dolmadam · 돌기와담 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-dolmadam","w":1,"h":1,"class":"prop","upperTiles":[[3044]],"walk":["X"]}
```

### jb-fence_h · 울타리 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fence_h","w":1,"h":1,"class":"prop","upperTiles":[[2343]],"walk":["X"]}
```

### jb-firewood · 장작더미 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-firewood","w":2,"h":1,"class":"prop","upperTiles":[[3040,3041]],"walk":["XX"]}
```

### jb-fld_bones_a · fld bones a 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_bones_a","w":1,"h":1,"class":"prop","upperTiles":[[13833]],"walk":["F"]}
```

### jb-fld_bones_b · fld bones b 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_bones_b","w":1,"h":1,"class":"prop","upperTiles":[[13866]],"walk":["F"]}
```

### jb-fld_boulder_mass · fld boulder mass 4×3 · 4×3 · 분류 prop
막힘 12 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_boulder_mass","w":4,"h":3,"class":"prop","upperTiles":[[14018,14019,14020,14021],[14022,14023,14024,14025],[14026,14027,14028,14029]],"walk":["XXXX","XXXX","XXXX"]}
```

### jb-fld_burrow · fld burrow 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_burrow","w":2,"h":1,"class":"prop","upperTiles":[[13851,13852]],"walk":["FF"]}
```

### jb-fld_cairn · fld cairn 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_cairn","w":1,"h":1,"class":"prop","upperTiles":[[13850]],"walk":["X"]}
```

### jb-fld_campfire · fld campfire 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_campfire","w":1,"h":1,"class":"prop","upperTiles":[[13806]],"walk":["X"]}
```

### jb-fld_cave_a · fld cave a 5×3 · 5×3 · 분류 prop
막힘 14 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_cave_a","w":5,"h":3,"class":"prop","upperTiles":[[13768,13769,13770,13771,13772],[13773,13774,13775,13776,13777],[13778,13779,13780,13781,13782]],"walk":["XXXXX","XXXXX","XXFXX"]}
```

### jb-fld_cave_b · fld cave b 4×3 · 4×3 · 분류 prop
막힘 10 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_cave_b","w":4,"h":3,"class":"prop","upperTiles":[[13783,13784,13785,13786],[13787,13788,13789,13790],[13791,13792,13793,13794]],"walk":["XXXX","XXXX","XFFX"]}
```

### jb-fld_cave_c · fld cave c 3×3 · 3×3 · 분류 prop
막힘 8 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_cave_c","w":3,"h":3,"class":"prop","upperTiles":[[13795,13796,13797],[13798,13799,13800],[13801,13802,13803]],"walk":["XXX","XXX","XFX"]}
```

### jb-fld_dead_a · fld dead a 3×4 · 3×4 · 분류 prop
막힘 1 · 걸음★ 7 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_dead_a","w":3,"h":4,"class":"prop","upperTiles":[[13854,13855,13856],[13857,13858,13859],[-1,13861,-1],[13863,13864,13865]],"walk":["CCC","CCC",".C.","FXF"]}
```

### jb-fld_dead_b · fld dead b 3×4 · 3×4 · 분류 prop
막힘 1 · 걸음★ 7 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_dead_b","w":3,"h":4,"class":"prop","upperTiles":[[14069,14070,14071],[14072,14073,14074],[-1,14076,-1],[14078,14079,14080]],"walk":["CCC","CCC",".C.","FXF"]}
```

### jb-fld_fern · fld fern 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_fern","w":1,"h":1,"class":"prop","upperTiles":[[14065]],"walk":["F"]}
```
