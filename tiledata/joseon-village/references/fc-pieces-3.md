# 사냥터·동굴 조각 사전 3/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

사냥터(`fld_*`: 굴 입구·천막·모닥불·건조대·폐허·무덤·바위·들꽃·뼈·고목·소나무·느티나무)와 동굴(`cav_*`: 화로·석순·수정·상자 단상·수레·둥지·횃불·버섯·이끼·웅덩이) 조각. 나무는 수관 `C`·줄기 `X`, 소품은 단단한 칸 `X`.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-fld_tombstone · 묘비 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_tombstone","w":1,"h":2,"class":"prop","upperTiles":[[13982],[13983]],"walk":["X","X"]}
```

### jb-cav_brazier · 화로 기둥 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_brazier","w":1,"h":2,"class":"prop","upperTiles":[[15645],[15646]],"walk":["X","X"]}
```

### jb-cav_cart · 광산 수레 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_cart","w":2,"h":1,"class":"prop","upperTiles":[[15661,15662]],"walk":["XX"]}
```

### jb-cav_chest_dais · 보물 상자 단상 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_chest_dais","w":3,"h":2,"class":"prop","upperTiles":[[15653,15654,15655],[15656,15657,15658]],"walk":["XXX","FFF"]}
```

### jb-cav_crystal · 수정 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_crystal","w":1,"h":1,"class":"prop","upperTiles":[[15667]],"walk":["X"]}
```

### jb-cav_crystal_b · 수정 무리 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_crystal_b","w":2,"h":1,"class":"prop","upperTiles":[[15651,15652]],"walk":["XX"]}
```

### jb-cav_crystal_c · 큰 수정 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_crystal_c","w":1,"h":2,"class":"prop","upperTiles":[[15659],[15660]],"walk":["X","X"]}
```

### jb-cav_moss · 이끼 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_moss","w":1,"h":1,"class":"prop","upperTiles":[[15683]],"walk":["F"]}
```

### jb-cav_mushroom_a · 동굴 버섯 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_mushroom_a","w":1,"h":1,"class":"prop","upperTiles":[[15675]],"walk":["X"]}
```

### jb-cav_mushroom_b · 동굴 버섯 B 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_mushroom_b","w":1,"h":1,"class":"prop","upperTiles":[[15676]],"walk":["X"]}
```

### jb-cav_nest · 뼈 둥지 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_nest","w":2,"h":1,"class":"prop","upperTiles":[[15663,15664]],"walk":["FF"]}
```

### jb-cav_puddle · 물웅덩이 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_puddle","w":1,"h":1,"class":"prop","upperTiles":[[15684]],"walk":["F"]}
```

### jb-cav_rock_a · 바위 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rock_a","w":1,"h":1,"class":"prop","upperTiles":[[15680]],"walk":["X"]}
```

### jb-cav_rock_b · 바위 B 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rock_b","w":2,"h":1,"class":"prop","upperTiles":[[15681,15682]],"walk":["XX"]}
```

### jb-cav_rock_c · 바위 C 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rock_c","w":1,"h":1,"class":"prop","upperTiles":[[15677]],"walk":["X"]}
```

### jb-cav_rubble · 잔해 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_rubble","w":2,"h":1,"class":"prop","upperTiles":[[15678,15679]],"walk":["XX"]}
```

### jb-cav_stalagmite · 석순 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite","w":1,"h":2,"class":"prop","upperTiles":[[15672],[15673]],"walk":["F","X"]}
```

### jb-cav_stalagmite_b · 석순 B 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite_b","w":1,"h":2,"class":"prop","upperTiles":[[15665],[15666]],"walk":["X","X"]}
```

### jb-cav_stalagmite_c · 작은 석순 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite_c","w":1,"h":1,"class":"prop","upperTiles":[[15674]],"walk":["X"]}
```

### jb-cav_stalagmite_wide · 넓은 석순 군락 2×2 · 2×2 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_stalagmite_wide","w":2,"h":2,"class":"prop","upperTiles":[[15647,15648],[15649,15650]],"walk":["FX","XX"]}
```

### jb-cav_torch_a · 벽 횃불 A 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_torch_a","w":1,"h":2,"class":"prop","upperTiles":[[15668],[15669]],"walk":["X","X"]}
```

### jb-cav_torch_b · 벽 횃불 B 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-cav_torch_b","w":1,"h":2,"class":"prop","upperTiles":[[15670],[15671]],"walk":["X","X"]}
```
