# 나무·소품·담·다리 조각 사전 3/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **9408칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 9347 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-gn_mudg_c_nw · 국내성 mudg_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[7862]],"walk":["X"]}
```

### jb-gn_mudg_c_se · 국내성 mudg_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_se","w":1,"h":1,"class":"wall","upperTiles":[[7865]],"walk":["X"]}
```

### jb-gn_mudg_c_sw · 국내성 mudg_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[7864]],"walk":["X"]}
```

### jb-gn_mudg_h0 · 국내성 mudg_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h0","w":1,"h":1,"class":"wall","upperTiles":[[7857]],"walk":["X"]}
```

### jb-gn_mudg_h1 · 국내성 mudg_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h1","w":1,"h":1,"class":"wall","upperTiles":[[7858]],"walk":["X"]}
```

### jb-gn_mudg_h2 · 국내성 mudg_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_h2","w":1,"h":1,"class":"wall","upperTiles":[[7859]],"walk":["X"]}
```

### jb-gn_mudg_v · 국내성 mudg_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_v","w":1,"h":1,"class":"wall","upperTiles":[[7860]],"walk":["X"]}
```

### jb-gn_mudg_v1 · 국내성 mudg_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_mudg_v1","w":1,"h":1,"class":"wall","upperTiles":[[7861]],"walk":["X"]}
```

### jb-gn_stone_c_ne · 국내성 stone_c_ne 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_ne","w":1,"h":1,"class":"wall","upperTiles":[[7872]],"walk":["X"]}
```

### jb-gn_stone_c_nw · 국내성 stone_c_nw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_nw","w":1,"h":1,"class":"wall","upperTiles":[[7871]],"walk":["X"]}
```

### jb-gn_stone_c_se · 국내성 stone_c_se 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_se","w":1,"h":1,"class":"wall","upperTiles":[[7874]],"walk":["X"]}
```

### jb-gn_stone_c_sw · 국내성 stone_c_sw 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_c_sw","w":1,"h":1,"class":"wall","upperTiles":[[7873]],"walk":["X"]}
```

### jb-gn_stone_h0 · 국내성 stone_h0 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h0","w":1,"h":1,"class":"wall","upperTiles":[[7866]],"walk":["X"]}
```

### jb-gn_stone_h1 · 국내성 stone_h1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h1","w":1,"h":1,"class":"wall","upperTiles":[[7867]],"walk":["X"]}
```

### jb-gn_stone_h2 · 국내성 stone_h2 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_h2","w":1,"h":1,"class":"wall","upperTiles":[[7868]],"walk":["X"]}
```

### jb-gn_stone_v · 국내성 stone_v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_v","w":1,"h":1,"class":"wall","upperTiles":[[7869]],"walk":["X"]}
```

### jb-gn_stone_v1 · 국내성 stone_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_v1","w":1,"h":1,"class":"wall","upperTiles":[[7870]],"walk":["X"]}
```

### jb-gungnae_wall_corner_ne · 국내성 성벽 corner_ne 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_ne","w":3,"h":5,"class":"wall","upperTiles":[[4582,4583,4584],[4598,4599,4600],[4614,4615,4616],[4630,4631,4632],[4646,4647,4648]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_nw · 국내성 성벽 corner_nw 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_nw","w":3,"h":5,"class":"wall","upperTiles":[[4579,4580,4581],[4595,4596,4597],[4611,4612,4613],[4627,4628,4629],[4643,4644,4645]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_se · 국내성 성벽 corner_se 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_se","w":3,"h":5,"class":"wall","upperTiles":[[4588,4589,4590],[4604,4605,4606],[4620,4621,4622],[4636,4637,4638],[4652,4653,4654]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_sw · 국내성 성벽 corner_sw 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_sw","w":3,"h":5,"class":"wall","upperTiles":[[4585,4586,4587],[4601,4602,4603],[4617,4618,4619],[4633,4634,4635],[4649,4650,4651]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_end_l · 국내성 성벽 end_l 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_end_l","w":1,"h":5,"class":"wall","upperTiles":[[4591],[4607],[4623],[4639],[4655]],"walk":["X","X","X","X","X"]}
```
