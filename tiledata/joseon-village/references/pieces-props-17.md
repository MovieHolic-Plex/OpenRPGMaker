# 나무·소품·담·다리 조각 사전 17/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_sang_2 · in sang 2 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_sang_2","w":2,"h":1,"class":"prop","upperTiles":[[15819,15820]],"walk":["XX"]}
```

### jb-in_sang_jumak · in sang jumak 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_sang_jumak","w":2,"h":1,"class":"prop","upperTiles":[[15821,15822]],"walk":["XX"]}
```

### jb-in_seoan · in seoan 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_seoan","w":1,"h":1,"class":"prop","upperTiles":[[15949]],"walk":["X"]}
```

### jb-in_seoan_2 · in seoan 2 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_seoan_2","w":2,"h":1,"class":"prop","upperTiles":[[15950,15951]],"walk":["XX"]}
```

### jb-in_seoga · in seoga 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_seoga","w":2,"h":2,"class":"prop","upperTiles":[[15893,15894],[15895,15896]],"walk":["XX","XX"]}
```

### jb-in_seonban · in seonban 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_seonban","w":2,"h":2,"class":"prop","upperTiles":[[15879,15880],[15881,15882]],"walk":["XX","XX"]}
```

### jb-in_seonban_bottles · in seonban bottles 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_seonban_bottles","w":2,"h":2,"class":"prop","upperTiles":[[15883,15884],[15885,15886]],"walk":["XX","XX"]}
```

### jb-in_sewing · in sewing 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_sewing","w":1,"h":1,"class":"prop","upperTiles":[[15962]],"walk":["X"]}
```

### jb-in_soban_a · in soban a 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_soban_a","w":1,"h":1,"class":"prop","upperTiles":[[15816]],"walk":["X"]}
```

### jb-in_soban_b · in soban b 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_soban_b","w":1,"h":1,"class":"prop","upperTiles":[[15817]],"walk":["X"]}
```

### jb-in_soban_c · in soban c 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_soban_c","w":1,"h":1,"class":"prop","upperTiles":[[15818]],"walk":["X"]}
```

### jb-in_sokuri_fruit · in sokuri fruit 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_sokuri_fruit","w":1,"h":1,"class":"prop","upperTiles":[[15961]],"walk":["X"]}
```

### jb-in_sokuri_grain · in sokuri grain 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_sokuri_grain","w":1,"h":1,"class":"prop","upperTiles":[[15960]],"walk":["X"]}
```

### jb-in_sokuri_veg · in sokuri veg 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_sokuri_veg","w":1,"h":1,"class":"prop","upperTiles":[[15959]],"walk":["X"]}
```

### jb-in_ssal_gama · in ssal gama 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_ssal_gama","w":1,"h":1,"class":"prop","upperTiles":[[15936]],"walk":["X"]}
```

### jb-in_stairs_down · in stairs down 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_stairs_down","w":1,"h":1,"class":"prop","upperTiles":[[15775]],"walk":["F"]}
```

### jb-in_stairs_stone_3 · in stairs stone 3 3×3 · 3×3 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 6칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_stairs_stone_3","w":3,"h":3,"class":"prop","upperTiles":[[15766,15767,15768],[15769,15770,15771],[15772,15773,15774]],"walk":["XXX","FFF","FFF"]}
```

### jb-in_stairs_wood_2 · in stairs wood 2 2×3 · 2×3 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_stairs_wood_2","w":2,"h":3,"class":"prop","upperTiles":[[15760,15761],[15762,15763],[15764,15765]],"walk":["XX","FF","FF"]}
```

### jb-in_stairs_wood_3 · in stairs wood 3 3×3 · 3×3 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 6칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_stairs_wood_3","w":3,"h":3,"class":"prop","upperTiles":[[15751,15752,15753],[15754,15755,15756],[15757,15758,15759]],"walk":["XXX","FFF","FFF"]}
```

### jb-in_suldok · in suldok 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_suldok","w":1,"h":1,"class":"prop","upperTiles":[[15847]],"walk":["X"]}
```

### jb-in_tool_rack · in tool rack 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_tool_rack","w":2,"h":1,"class":"prop","upperTiles":[[15910,15911]],"walk":["XX"]}
```

### jb-in_tub · in tub 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_tub","w":1,"h":1,"class":"prop","upperTiles":[[15909]],"walk":["X"]}
```
