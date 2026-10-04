# 사냥터·동굴 조각 사전 2/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

사냥터(`fld_*`: 굴 입구·천막·모닥불·건조대·폐허·무덤·바위·들꽃·뼈·고목·소나무·느티나무)와 동굴(`cav_*`: 화로·석순·수정·상자 단상·수레·둥지·횃불·버섯·이끼·웅덩이) 조각. 나무는 수관 `C`·줄기 `X`, 소품은 단단한 칸 `X`.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-fld_flowers_b · 들꽃 B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_flowers_b","w":1,"h":1,"class":"prop","upperTiles":[[14206]],"walk":["F"]}
```

### jb-fld_flowers_c · 들꽃 C 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_flowers_c","w":1,"h":1,"class":"prop","upperTiles":[[14204]],"walk":["F"]}
```

### jb-fld_grave_a · 봉분 A 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_grave_a","w":2,"h":2,"class":"prop","upperTiles":[[13984,13985],[13986,13987]],"walk":["XX","XX"]}
```

### jb-fld_grave_b · 봉분 B 2×2 · 2×2 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_grave_b","w":2,"h":2,"class":"prop","upperTiles":[[13988,13989],[13990,13991]],"walk":["FX","XX"]}
```

### jb-fld_log_a · 통나무 눕힘(3칸) 3×1 · 3×1 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_log_a","w":3,"h":1,"class":"prop","upperTiles":[[14209,14210,14211]],"walk":["XXX"]}
```

### jb-fld_log_b · 통나무 눕힘(2칸) 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_log_b","w":2,"h":1,"class":"prop","upperTiles":[[13971,13972]],"walk":["XX"]}
```

### jb-fld_ore_a · 광석 노두 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_ore_a","w":1,"h":1,"class":"prop","upperTiles":[[14015]],"walk":["X"]}
```

### jb-fld_ore_b · 광석 노두 B 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_ore_b","w":2,"h":1,"class":"prop","upperTiles":[[14018,14019]],"walk":["XX"]}
```

### jb-fld_rack · 건조대 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rack","w":2,"h":2,"class":"prop","upperTiles":[[13967,13968],[13969,13970]],"walk":["XX","XX"]}
```

### jb-fld_rock_l_a · 큰 바위 A 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_l_a","w":3,"h":2,"class":"prop","upperTiles":[[14192,14193,14194],[14195,14196,14197]],"walk":["XXX","XXX"]}
```

### jb-fld_rock_l_b · 큰 바위 B 3×2 · 3×2 · 분류 prop
막힘 5 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_l_b","w":3,"h":2,"class":"prop","upperTiles":[[14198,14199,14200],[14201,14202,14203]],"walk":["FXX","XXX"]}
```

### jb-fld_rock_m_a · 중간 바위 A 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_m_a","w":2,"h":1,"class":"prop","upperTiles":[[14016,14017]],"walk":["XX"]}
```

### jb-fld_rock_m_b · 중간 바위 B 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_m_b","w":2,"h":2,"class":"prop","upperTiles":[[14009,14010],[14011,14012]],"walk":["XX","XX"]}
```

### jb-fld_rock_s_a · 작은 바위 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_s_a","w":1,"h":1,"class":"prop","upperTiles":[[14013]],"walk":["X"]}
```

### jb-fld_rock_s_b · 작은 바위 B 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_s_b","w":1,"h":1,"class":"prop","upperTiles":[[13995]],"walk":["X"]}
```

### jb-fld_rock_s_c · 작은 바위 C 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_rock_s_c","w":1,"h":1,"class":"prop","upperTiles":[[14014]],"walk":["X"]}
```

### jb-fld_ruin_pagoda · 폐허 석탑 2×3 · 2×3 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_ruin_pagoda","w":2,"h":3,"class":"prop","upperTiles":[[13976,-1],[13978,13979],[13980,13981]],"walk":["F.","XX","XX"]}
```

### jb-fld_signpost · 이정표 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_signpost","w":1,"h":2,"class":"prop","upperTiles":[[13946],[13947]],"walk":["X","X"]}
```

### jb-fld_stump_a · 그루터기 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_stump_a","w":1,"h":1,"class":"prop","upperTiles":[[13973]],"walk":["X"]}
```

### jb-fld_stump_b · 그루터기 B 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_stump_b","w":1,"h":1,"class":"prop","upperTiles":[[13974]],"walk":["X"]}
```

### jb-fld_tent_a · 천막(작은) 3×2 · 3×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_tent_a","w":3,"h":2,"class":"prop","upperTiles":[[13961,13962,13963],[13964,13965,13966]],"walk":["FXF","XXX"]}
```

### jb-fld_tent_b · 천막(큰) 4×3 · 4×3 · 분류 prop
막힘 8 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-fld_tent_b","w":4,"h":3,"class":"prop","upperTiles":[[-1,13950,13951,-1],[13953,13954,13955,13956],[13957,13958,13959,13960]],"walk":[".XX.","FXXF","XXXX"]}
```
