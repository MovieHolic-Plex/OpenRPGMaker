# 나무·소품·담·다리 조각 사전 19/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-pal_buk_big · pal buk big 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_buk_big","w":2,"h":2,"class":"prop","upperTiles":[[16386,16387],[16388,16389]],"walk":["XX","XX"]}
```

### jb-pal_byeongpung_ilwol · pal byeongpung ilwol 6×3 · 6×3 · 분류 prop
막힘 18 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_byeongpung_ilwol","w":6,"h":3,"class":"prop","upperTiles":[[16353,16354,16355,16356,16357,16358],[16359,16360,16361,16362,16363,16364],[16365,16366,16367,16368,16369,16370]],"walk":["XXXXXX","XXXXXX","XXXXXX"]}
```

### jb-pal_ceil_beam_l · pal ceil beam l 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_ceil_beam_l","w":1,"h":1,"class":"prop","upperTiles":[[16322]],"walk":["C"]}
```

### jb-pal_ceil_beam_m · pal ceil beam m 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_ceil_beam_m","w":1,"h":1,"class":"prop","upperTiles":[[16321]],"walk":["C"]}
```

### jb-pal_ceil_beam_r · pal ceil beam r 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_ceil_beam_r","w":1,"h":1,"class":"prop","upperTiles":[[16323]],"walk":["C"]}
```

### jb-pal_chaekgap · pal chaekgap 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_chaekgap","w":1,"h":1,"class":"prop","upperTiles":[[16420]],"walk":["X"]}
```

### jb-pal_changgeori · pal changgeori 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_changgeori","w":2,"h":2,"class":"prop","upperTiles":[[16424,16425],[16426,16427]],"walk":["XX","XX"]}
```

### jb-pal_chimsang · pal chimsang 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_chimsang","w":3,"h":2,"class":"prop","upperTiles":[[16394,16395,16396],[16397,16398,16399]],"walk":["XXX","XXX"]}
```

### jb-pal_chotdae_tall · pal chotdae tall 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_chotdae_tall","w":1,"h":2,"class":"prop","upperTiles":[[16373],[16374]],"walk":["X","X"]}
```

### jb-pal_dais_front_l · pal dais front l 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_front_l","w":1,"h":1,"class":"prop","upperTiles":[[16325]],"walk":["X"]}
```

### jb-pal_dais_front_m · pal dais front m 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_front_m","w":1,"h":1,"class":"prop","upperTiles":[[16324]],"walk":["X"]}
```

### jb-pal_dais_front_r · pal dais front r 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_front_r","w":1,"h":1,"class":"prop","upperTiles":[[16326]],"walk":["X"]}
```

### jb-pal_dais_steps_4 · pal dais steps 4 4×1 · 4×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_steps_4","w":4,"h":1,"class":"prop","upperTiles":[[16327,16328,16329,16330]],"walk":["FFFF"]}
```

### jb-pal_dais_steps_6 · pal dais steps 6 6×1 · 6×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 6칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_steps_6","w":6,"h":1,"class":"prop","upperTiles":[[16331,16332,16333,16334,16335,16336]],"walk":["FFFFFF"]}
```

### jb-pal_deung_hang · pal deung hang 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_deung_hang","w":1,"h":2,"class":"prop","upperTiles":[[16377],[16378]],"walk":["C","C"]}
```

### jb-pal_deungrong · pal deungrong 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_deungrong","w":1,"h":2,"class":"prop","upperTiles":[[16375],[16376]],"walk":["X","X"]}
```

### jb-pal_exit_door · pal exit door 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_exit_door","w":1,"h":1,"class":"prop","upperTiles":[[16337]],"walk":["F"]}
```

### jb-pal_exit_door2 · pal exit door2 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_exit_door2","w":2,"h":1,"class":"prop","upperTiles":[[16338,16339]],"walk":["FF"]}
```

### jb-pal_exit_door3 · pal exit door3 3×1 · 3×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_exit_door3","w":3,"h":1,"class":"prop","upperTiles":[[16340,16341,16342]],"walk":["FFF"]}
```

### jb-pal_exit_door4 · pal exit door4 4×1 · 4×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_exit_door4","w":4,"h":1,"class":"prop","upperTiles":[[16343,16344,16345,16346]],"walk":["FFFF"]}
```

### jb-pal_gungnyeo_jari · pal gungnyeo jari 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_gungnyeo_jari","w":1,"h":1,"class":"prop","upperTiles":[[16423]],"walk":["F"]}
```

### jb-pal_gwan_seat · pal gwan seat 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_gwan_seat","w":2,"h":1,"class":"prop","upperTiles":[[16421,16422]],"walk":["XX"]}
```
