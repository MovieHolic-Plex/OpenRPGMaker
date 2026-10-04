# 나무·소품·담·다리 조각 사전 16/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_ibuljang · in ibuljang 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_ibuljang","w":2,"h":2,"class":"prop","upperTiles":[[15808,15809],[15810,15811]],"walk":["XX","XX"]}
```

### jb-in_ingots · in ingots 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_ingots","w":1,"h":1,"class":"prop","upperTiles":[[15914]],"walk":["X"]}
```

### jb-in_jangjak · in jangjak 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_jangjak","w":1,"h":1,"class":"prop","upperTiles":[[15937]],"walk":["X"]}
```

### jb-in_jipjari_1 · in jipjari 1 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_jipjari_1","w":1,"h":1,"class":"prop","upperTiles":[[15869]],"walk":["F"]}
```

### jb-in_jipjari_2 · in jipjari 2 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_jipjari_2","w":2,"h":1,"class":"prop","upperTiles":[[15867,15868]],"walk":["FF"]}
```

### jb-in_jokja_a · in jokja a 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_jokja_a","w":1,"h":2,"class":"prop","upperTiles":[[15872],[15873]],"walk":["X","X"]}
```

### jb-in_jokja_b · in jokja b 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_jokja_b","w":1,"h":2,"class":"prop","upperTiles":[[15874],[15875]],"walk":["X","X"]}
```

### jb-in_jumak_counter · in jumak counter 3×1 · 3×1 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_jumak_counter","w":3,"h":1,"class":"prop","upperTiles":[[15915,15916,15917]],"walk":["XXX"]}
```

### jb-in_ladder_loft · in ladder loft 1×3 · 1×3 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_ladder_loft","w":1,"h":3,"class":"prop","upperTiles":[[15972],[15973],[15974]],"walk":["X","X","F"]}
```

### jb-in_mat_dot_2x2 · in mat dot 2x2 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_mat_dot_2x2","w":2,"h":2,"class":"prop","upperTiles":[[15968,15969],[15970,15971]],"walk":["FF","FF"]}
```

### jb-in_mat_hopi · in mat hopi 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_mat_hopi","w":2,"h":2,"class":"prop","upperTiles":[[15952,15953],[15954,15955]],"walk":["FF","FF"]}
```

### jb-in_morus · in morus 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_morus","w":1,"h":1,"class":"prop","upperTiles":[[15903]],"walk":["X"]}
```

### jb-in_mul_dongi · in mul dongi 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_mul_dongi","w":1,"h":1,"class":"prop","upperTiles":[[15938]],"walk":["X"]}
```

### jb-in_mulle · in mulle 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_mulle","w":1,"h":1,"class":"prop","upperTiles":[[15830]],"walk":["X"]}
```

### jb-in_mungap · in mungap 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_mungap","w":2,"h":1,"class":"prop","upperTiles":[[15814,15815]],"walk":["XX"]}
```

### jb-in_nong · in nong 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_nong","w":2,"h":2,"class":"prop","upperTiles":[[15804,15805],[15806,15807]],"walk":["XX","XX"]}
```

### jb-in_pillar · in pillar 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_pillar","w":1,"h":2,"class":"prop","upperTiles":[[15738],[15739]],"walk":["C","X"]}
```

### jb-in_pillar_3 · in pillar 3 1×3 · 1×3 · 분류 prop
막힘 1 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_pillar_3","w":1,"h":3,"class":"prop","upperTiles":[[15740],[15741],[15742]],"walk":["C","C","X"]}
```

### jb-in_pulmu · in pulmu 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_pulmu","w":2,"h":1,"class":"prop","upperTiles":[[15901,15902]],"walk":["XX"]}
```

### jb-in_pyeongsang_3 · in pyeongsang 3 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_pyeongsang_3","w":3,"h":2,"class":"prop","upperTiles":[[15850,15851,15852],[15853,15854,15855]],"walk":["XXX","XXX"]}
```

### jb-in_runner_m · in runner m 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_runner_m","w":1,"h":1,"class":"prop","upperTiles":[[15870]],"walk":["F"]}
```

### jb-in_runner_n · in runner n 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_runner_n","w":1,"h":1,"class":"prop","upperTiles":[[15871]],"walk":["F"]}
```
