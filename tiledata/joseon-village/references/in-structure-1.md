# 실내 구조 조각 사전(벽·창·문·기둥·보·단·계단) 1/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

벽면 2줄 조각(`wall_*` 1×2, 끝 l·m·r·lr)·창·문틀·미닫이·기둥·보·계단·사다리·단·출구 깔개. 벽·문은 윗부분 `C`(천장 위로 걸침) 아랫부분 `X`, 문 칸·출구 깔개는 걸음.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_beam_l · 실내 보 왼끝 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_beam_l","w":1,"h":1,"class":"prop","upperTiles":[[15857]],"walk":["C"]}
```

### jb-in_b_beam_m · 실내 보 가운데 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_beam_m","w":1,"h":1,"class":"prop","upperTiles":[[15856]],"walk":["C"]}
```

### jb-in_b_beam_r · 실내 보 오른끝 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_beam_r","w":1,"h":1,"class":"prop","upperTiles":[[15858]],"walk":["C"]}
```

### jb-in_b_beam_red_l · 실내 보 붉은 왼끝 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_beam_red_l","w":1,"h":1,"class":"prop","upperTiles":[[15865]],"walk":["C"]}
```

### jb-in_b_beam_red_m · 실내 보 붉은 가운데 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_beam_red_m","w":1,"h":1,"class":"prop","upperTiles":[[15864]],"walk":["C"]}
```

### jb-in_b_beam_red_r · 실내 보 붉은 오른끝 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_beam_red_r","w":1,"h":1,"class":"prop","upperTiles":[[15866]],"walk":["C"]}
```

### jb-in_b_dais_stone_l · 실내 단 돌 왼끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_stone_l","w":1,"h":1,"class":"prop","upperTiles":[[15894]],"walk":["X"]}
```

### jb-in_b_dais_stone_lr · 실내 단 돌 양끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_stone_lr","w":1,"h":1,"class":"prop","upperTiles":[[15898]],"walk":["X"]}
```

### jb-in_b_dais_stone_m · 실내 단 돌 가운데 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_stone_m","w":1,"h":1,"class":"prop","upperTiles":[[15892]],"walk":["X"]}
```

### jb-in_b_dais_stone_r · 실내 단 돌 오른끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_stone_r","w":1,"h":1,"class":"prop","upperTiles":[[15896]],"walk":["X"]}
```

### jb-in_b_dais_wood_l · 실내 단 목재 왼끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_wood_l","w":1,"h":1,"class":"prop","upperTiles":[[15893]],"walk":["X"]}
```

### jb-in_b_dais_wood_lr · 실내 단 목재 양끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_wood_lr","w":1,"h":1,"class":"prop","upperTiles":[[15897]],"walk":["X"]}
```

### jb-in_b_dais_wood_m · 실내 단 목재 가운데 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_wood_m","w":1,"h":1,"class":"prop","upperTiles":[[15891]],"walk":["X"]}
```

### jb-in_b_dais_wood_r · 실내 단 목재 오른끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dais_wood_r","w":1,"h":1,"class":"prop","upperTiles":[[15895]],"walk":["X"]}
```

### jb-in_b_door_open · 실내 문 열린 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_door_open","w":1,"h":2,"class":"wall","upperTiles":[[15849],[15850]],"walk":["X","X"]}
```

### jb-in_b_door_plank · 실내 문 널 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_door_plank","w":1,"h":2,"class":"wall","upperTiles":[[15847],[15848]],"walk":["X","X"]}
```

### jb-in_b_door_slide_l · 실내 문 미닫이 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_door_slide_l","w":1,"h":2,"class":"wall","upperTiles":[[15839],[15840]],"walk":["X","X"]}
```

### jb-in_b_door_slide_open_l · 실내 문 미닫이 열린 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_door_slide_open_l","w":1,"h":2,"class":"wall","upperTiles":[[15841],[15842]],"walk":["X","X"]}
```

### jb-in_b_door_slide_open_r · 실내 문 미닫이 열린 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_door_slide_open_r","w":1,"h":2,"class":"wall","upperTiles":[[15845],[15846]],"walk":["X","X"]}
```

### jb-in_b_door_slide_r · 실내 문 미닫이 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_door_slide_r","w":1,"h":2,"class":"wall","upperTiles":[[15843],[15844]],"walk":["X","X"]}
```

### jb-in_b_doorway_dol · 실내 문틀 돌벽 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_doorway_dol","w":1,"h":2,"class":"wall","upperTiles":[[16202],[16203]],"walk":["X","X"]}
```

### jb-in_b_doorway_heuk · 실내 문틀 흙벽 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_doorway_heuk","w":1,"h":2,"class":"wall","upperTiles":[[16200],[16201]],"walk":["X","X"]}
```
