# 나무·소품·담·다리 조각 사전 3/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **9344칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 9215 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-gn_mudg_c_nw · 국내성 mudg_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[7766]],"walk":["X"]}
```

### jb-gn_mudg_c_se · 국내성 mudg_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_se","w":1,"h":1,"class":"wall","upperTiles":[[7769]],"walk":["X"]}
```

### jb-gn_mudg_c_sw · 국내성 mudg_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[7768]],"walk":["X"]}
```

### jb-gn_mudg_h0 · 국내성 mudg_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h0","w":1,"h":1,"class":"wall","upperTiles":[[7761]],"walk":["X"]}
```

### jb-gn_mudg_h1 · 국내성 mudg_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h1","w":1,"h":1,"class":"wall","upperTiles":[[7762]],"walk":["X"]}
```

### jb-gn_mudg_h2 · 국내성 mudg_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h2","w":1,"h":1,"class":"wall","upperTiles":[[7763]],"walk":["X"]}
```

### jb-gn_mudg_v · 국내성 mudg_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_v","w":1,"h":1,"class":"wall","upperTiles":[[7764]],"walk":["X"]}
```

### jb-gn_mudg_v1 · 국내성 mudg_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_v1","w":1,"h":1,"class":"wall","upperTiles":[[7765]],"walk":["X"]}
```

### jb-gn_stone_c_ne · 국내성 stone_c_ne 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_ne","w":1,"h":1,"class":"wall","upperTiles":[[7776]],"walk":["X"]}
```

### jb-gn_stone_c_nw · 국내성 stone_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[7775]],"walk":["X"]}
```

### jb-gn_stone_c_se · 국내성 stone_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_se","w":1,"h":1,"class":"wall","upperTiles":[[7778]],"walk":["X"]}
```

### jb-gn_stone_c_sw · 국내성 stone_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[7777]],"walk":["X"]}
```

### jb-gn_stone_h0 · 국내성 stone_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h0","w":1,"h":1,"class":"wall","upperTiles":[[7770]],"walk":["X"]}
```

### jb-gn_stone_h1 · 국내성 stone_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h1","w":1,"h":1,"class":"wall","upperTiles":[[7771]],"walk":["X"]}
```

### jb-gn_stone_h2 · 국내성 stone_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h2","w":1,"h":1,"class":"wall","upperTiles":[[7772]],"walk":["X"]}
```

### jb-gn_stone_v · 국내성 stone_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_v","w":1,"h":1,"class":"wall","upperTiles":[[7773]],"walk":["X"]}
```

### jb-gn_stone_v1 · 국내성 stone_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_v1","w":1,"h":1,"class":"wall","upperTiles":[[7774]],"walk":["X"]}
```

### jb-gungnae_wall_corner_ne · 국내성 성벽 corner_ne 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_ne","w":3,"h":5,"class":"wall","upperTiles":[[4518,4519,4520],[4534,4535,4536],[4550,4551,4552],[4566,4567,4568],[4582,4583,4584]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_nw · 국내성 성벽 corner_nw 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_nw","w":3,"h":5,"class":"wall","upperTiles":[[4515,4516,4517],[4531,4532,4533],[4547,4548,4549],[4563,4564,4565],[4579,4580,4581]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_se · 국내성 성벽 corner_se 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_se","w":3,"h":5,"class":"wall","upperTiles":[[4524,4525,4526],[4540,4541,4542],[4556,4557,4558],[4572,4573,4574],[4588,4589,4590]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_sw · 국내성 성벽 corner_sw 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_sw","w":3,"h":5,"class":"wall","upperTiles":[[4521,4522,4523],[4537,4538,4539],[4553,4554,4555],[4569,4570,4571],[4585,4586,4587]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_end_l · 국내성 성벽 end_l 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_end_l","w":1,"h":5,"class":"wall","upperTiles":[[4527],[4543],[4559],[4575],[4591]],"walk":["X","X","X","X","X"]}
```
