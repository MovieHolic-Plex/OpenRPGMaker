# 나무·소품·담·다리 조각 사전 6/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-gungnae_wall_v3 · 국내성 성벽 v3 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v3","w":3,"h":1,"class":"wall","upperTiles":[[4771,4772,4773]],"walk":["XXX"]}
```

### jb-gungnae_wall_v3_e · 국내성 성벽 v3_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v3_e","w":3,"h":1,"class":"wall","upperTiles":[[4774,4775,4776]],"walk":["XXX"]}
```

### jb-gungnae_wall_v4 · 국내성 성벽 v4 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v4","w":3,"h":1,"class":"wall","upperTiles":[[4777,4778,4779]],"walk":["XXX"]}
```

### jb-gungnae_wall_v4_e · 국내성 성벽 v4_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v4_e","w":3,"h":1,"class":"wall","upperTiles":[[4780,4781,4782]],"walk":["XXX"]}
```

### jb-gungnae_wall_v5 · 국내성 성벽 v5 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v5","w":3,"h":1,"class":"wall","upperTiles":[[4784,4785,4786]],"walk":["XXX"]}
```

### jb-gungnae_wall_v5_e · 국내성 성벽 v5_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v5_e","w":3,"h":1,"class":"wall","upperTiles":[[4787,4788,4789]],"walk":["XXX"]}
```

### jb-gungnae_wall_v_e · 국내성 성벽 v_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v_e","w":3,"h":1,"class":"wall","upperTiles":[[4692,4693,4694]],"walk":["XXX"]}
```

### jb-in_wall_chang_door · in wall chang door 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_chang_door","w":1,"h":2,"class":"wall","upperTiles":[[15734],[15735]],"walk":["X","X"]}
```

### jb-in_wall_chang_l · in wall chang l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_chang_l","w":1,"h":2,"class":"wall","upperTiles":[[15720],[15721]],"walk":["X","X"]}
```

### jb-in_wall_chang_lr · in wall chang lr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_chang_lr","w":1,"h":2,"class":"wall","upperTiles":[[15724],[15725]],"walk":["X","X"]}
```

### jb-in_wall_chang_m · in wall chang m 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_chang_m","w":1,"h":2,"class":"wall","upperTiles":[[15718],[15719]],"walk":["X","X"]}
```

### jb-in_wall_chang_r · in wall chang r 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_chang_r","w":1,"h":2,"class":"wall","upperTiles":[[15722],[15723]],"walk":["X","X"]}
```

### jb-in_wall_dol_l · in wall dol l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_dol_l","w":1,"h":2,"class":"wall","upperTiles":[[15712],[15713]],"walk":["X","X"]}
```

### jb-in_wall_dol_lr · in wall dol lr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_dol_lr","w":1,"h":2,"class":"wall","upperTiles":[[15716],[15717]],"walk":["X","X"]}
```

### jb-in_wall_dol_m · in wall dol m 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_dol_m","w":1,"h":2,"class":"wall","upperTiles":[[15710],[15711]],"walk":["X","X"]}
```

### jb-in_wall_dol_r · in wall dol r 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_dol_r","w":1,"h":2,"class":"wall","upperTiles":[[15714],[15715]],"walk":["X","X"]}
```

### jb-in_wall_heuk_l · in wall heuk l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_heuk_l","w":1,"h":2,"class":"wall","upperTiles":[[15696],[15697]],"walk":["X","X"]}
```

### jb-in_wall_heuk_lr · in wall heuk lr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_heuk_lr","w":1,"h":2,"class":"wall","upperTiles":[[15700],[15701]],"walk":["X","X"]}
```

### jb-in_wall_heuk_m · in wall heuk m 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_heuk_m","w":1,"h":2,"class":"wall","upperTiles":[[15694],[15695]],"walk":["X","X"]}
```

### jb-in_wall_heuk_r · in wall heuk r 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_heuk_r","w":1,"h":2,"class":"wall","upperTiles":[[15698],[15699]],"walk":["X","X"]}
```

### jb-in_wall_heuk_win · in wall heuk win 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_heuk_win","w":1,"h":2,"class":"wall","upperTiles":[[15730],[15731]],"walk":["X","X"]}
```

### jb-in_wall_hoe_door · in wall hoe door 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_hoe_door","w":1,"h":2,"class":"wall","upperTiles":[[15732],[15733]],"walk":["X","X"]}
```
