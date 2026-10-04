# 실내 구조 조각 사전(벽·창·문·기둥·보·단·계단) 2/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

벽면 2줄 조각(`wall_*` 1×2, 끝 l·m·r·lr)·창·문틀·미닫이·기둥·보·계단·사다리·단·출구 깔개. 벽·문은 윗부분 `C`(천장 위로 걸침) 아랫부분 `X`, 문 칸·출구 깔개는 걸음.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_doorway_hoe · 실내 문틀 회벽 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_doorway_hoe","w":1,"h":2,"class":"wall","upperTiles":[[16196],[16197]],"walk":["X","X"]}
```

### jb-in_b_doorway_mok · 실내 문틀 목재벽 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_doorway_mok","w":1,"h":2,"class":"wall","upperTiles":[[16198],[16199]],"walk":["X","X"]}
```

### jb-in_b_exit_mat · 실내 출구 깔개 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_exit_mat","w":1,"h":1,"class":"prop","upperTiles":[[15899]],"walk":["F"]}
```

### jb-in_b_ladder_loft · 실내 사다리 다락 1×3 · 1×3 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ladder_loft","w":1,"h":3,"class":"prop","upperTiles":[[15882],[15883],[15884]],"walk":["X","X","F"]}
```

### jb-in_b_pillar_2 · 실내 기둥 2칸 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pillar_2","w":1,"h":2,"class":"prop","upperTiles":[[15851],[15852]],"walk":["X","X"]}
```

### jb-in_b_pillar_3 · 실내 기둥 3칸 1×3 · 1×3 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pillar_3","w":1,"h":3,"class":"prop","upperTiles":[[15853],[15854],[15855]],"walk":["X","X","X"]}
```

### jb-in_b_pillar_red_2 · 실내 기둥 붉은 2칸 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pillar_red_2","w":1,"h":2,"class":"prop","upperTiles":[[15859],[15860]],"walk":["X","X"]}
```

### jb-in_b_pillar_red_3 · 실내 기둥 붉은 3칸 1×3 · 1×3 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pillar_red_3","w":1,"h":3,"class":"prop","upperTiles":[[15861],[15862],[15863]],"walk":["X","X","X"]}
```

### jb-in_b_stair_dais_2 · 실내 계단 단 2칸 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stair_dais_2","w":2,"h":1,"class":"prop","upperTiles":[[15889,15890]],"walk":["FF"]}
```

### jb-in_b_stair_dais_3 · 실내 계단 단 3칸 3×1 · 3×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stair_dais_3","w":3,"h":1,"class":"prop","upperTiles":[[15886,15887,15888]],"walk":["FFF"]}
```

### jb-in_b_stair_dais_wood_2 · 실내 계단 단 목재 2칸 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stair_dais_wood_2","w":2,"h":1,"class":"prop","upperTiles":[[16144,16145]],"walk":["FF"]}
```

### jb-in_b_stair_dais_wood_3 · 실내 계단 단 목재 3칸 3×1 · 3×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stair_dais_wood_3","w":3,"h":1,"class":"prop","upperTiles":[[16141,16142,16143]],"walk":["FFF"]}
```

### jb-in_b_stair_down · 실내 계단 내림 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stair_down","w":1,"h":1,"class":"prop","upperTiles":[[15885]],"walk":["F"]}
```

### jb-in_b_stair_up_2 · 실내 계단 오름 2칸 2×3 · 2×3 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stair_up_2","w":2,"h":3,"class":"prop","upperTiles":[[15876,15877],[15878,15879],[15880,15881]],"walk":["XX","XX","FF"]}
```

### jb-in_b_stair_up_3 · 실내 계단 오름 3칸 3×3 · 3×3 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stair_up_3","w":3,"h":3,"class":"prop","upperTiles":[[15867,15868,15869],[15870,15871,15872],[15873,15874,15875]],"walk":["XXX","XXX","FFF"]}
```

### jb-in_b_wall_changho_l · 실내 벽 창호벽 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_changho_l","w":1,"h":2,"class":"wall","upperTiles":[[15825],[15826]],"walk":["X","X"]}
```

### jb-in_b_wall_changho_lr · 실내 벽 창호벽 양끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_changho_lr","w":1,"h":2,"class":"wall","upperTiles":[[15829],[15830]],"walk":["X","X"]}
```

### jb-in_b_wall_changho_m · 실내 벽 창호벽 가운데 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_changho_m","w":1,"h":2,"class":"wall","upperTiles":[[15823],[15824]],"walk":["X","X"]}
```

### jb-in_b_wall_changho_r · 실내 벽 창호벽 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_changho_r","w":1,"h":2,"class":"wall","upperTiles":[[15827],[15828]],"walk":["X","X"]}
```

### jb-in_b_wall_dol_l · 실내 벽 돌벽 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_dol_l","w":1,"h":2,"class":"wall","upperTiles":[[15817],[15818]],"walk":["X","X"]}
```

### jb-in_b_wall_dol_lr · 실내 벽 돌벽 양끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_dol_lr","w":1,"h":2,"class":"wall","upperTiles":[[15821],[15822]],"walk":["X","X"]}
```

### jb-in_b_wall_dol_m · 실내 벽 돌벽 가운데 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_dol_m","w":1,"h":2,"class":"wall","upperTiles":[[15815],[15816]],"walk":["X","X"]}
```
