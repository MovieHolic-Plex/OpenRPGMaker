# 나무·소품·담·다리 조각 사전 3/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **7872칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 7808 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-gn_mudg_c_nw · 국내성 mudg_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[7462]],"walk":["X"]}
```

### jb-gn_mudg_c_se · 국내성 mudg_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_se","w":1,"h":1,"class":"wall","upperTiles":[[7465]],"walk":["X"]}
```

### jb-gn_mudg_c_sw · 국내성 mudg_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[7464]],"walk":["X"]}
```

### jb-gn_mudg_h0 · 국내성 mudg_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h0","w":1,"h":1,"class":"wall","upperTiles":[[7457]],"walk":["X"]}
```

### jb-gn_mudg_h1 · 국내성 mudg_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h1","w":1,"h":1,"class":"wall","upperTiles":[[7458]],"walk":["X"]}
```

### jb-gn_mudg_h2 · 국내성 mudg_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h2","w":1,"h":1,"class":"wall","upperTiles":[[7459]],"walk":["X"]}
```

### jb-gn_mudg_v · 국내성 mudg_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_v","w":1,"h":1,"class":"wall","upperTiles":[[7460]],"walk":["X"]}
```

### jb-gn_mudg_v1 · 국내성 mudg_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_v1","w":1,"h":1,"class":"wall","upperTiles":[[7461]],"walk":["X"]}
```

### jb-gn_stone_c_ne · 국내성 stone_c_ne 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_ne","w":1,"h":1,"class":"wall","upperTiles":[[7472]],"walk":["X"]}
```

### jb-gn_stone_c_nw · 국내성 stone_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[7471]],"walk":["X"]}
```

### jb-gn_stone_c_se · 국내성 stone_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_se","w":1,"h":1,"class":"wall","upperTiles":[[7474]],"walk":["X"]}
```

### jb-gn_stone_c_sw · 국내성 stone_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[7473]],"walk":["X"]}
```

### jb-gn_stone_h0 · 국내성 stone_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h0","w":1,"h":1,"class":"wall","upperTiles":[[7466]],"walk":["X"]}
```

### jb-gn_stone_h1 · 국내성 stone_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h1","w":1,"h":1,"class":"wall","upperTiles":[[7467]],"walk":["X"]}
```

### jb-gn_stone_h2 · 국내성 stone_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h2","w":1,"h":1,"class":"wall","upperTiles":[[7468]],"walk":["X"]}
```

### jb-gn_stone_v · 국내성 stone_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_v","w":1,"h":1,"class":"wall","upperTiles":[[7469]],"walk":["X"]}
```

### jb-gn_stone_v1 · 국내성 stone_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_v1","w":1,"h":1,"class":"wall","upperTiles":[[7470]],"walk":["X"]}
```

### jb-gungnae_wall_corner_ne · 국내성 성벽 corner_ne 2×5 · 2×5 · 분류 wall
막힘 10 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_ne","w":2,"h":5,"class":"wall","upperTiles":[[4396,4397],[4412,4413],[4428,4429],[4444,4445],[4460,4461]],"walk":["XX","XX","XX","XX","XX"]}
```

### jb-gungnae_wall_corner_nw · 국내성 성벽 corner_nw 2×5 · 2×5 · 분류 wall
막힘 10 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_nw","w":2,"h":5,"class":"wall","upperTiles":[[4394,4395],[4410,4411],[4426,4427],[4442,4443],[4458,4459]],"walk":["XX","XX","XX","XX","XX"]}
```

### jb-gungnae_wall_corner_se · 국내성 성벽 corner_se 2×5 · 2×5 · 분류 wall
막힘 10 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_se","w":2,"h":5,"class":"wall","upperTiles":[[4464,4465],[4480,4481],[4496,4497],[4512,4513],[4528,4529]],"walk":["XX","XX","XX","XX","XX"]}
```

### jb-gungnae_wall_corner_sw · 국내성 성벽 corner_sw 2×5 · 2×5 · 분류 wall
막힘 10 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_sw","w":2,"h":5,"class":"wall","upperTiles":[[4398,4399],[4414,4415],[4430,4431],[4446,4447],[4462,4463]],"walk":["XX","XX","XX","XX","XX"]}
```

### jb-gungnae_wall_end_l · 국내성 성벽 end_l 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_end_l","w":1,"h":5,"class":"wall","upperTiles":[[4466],[4482],[4498],[4514],[4530]],"walk":["X","X","X","X","X"]}
```
