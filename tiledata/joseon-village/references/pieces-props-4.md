# 나무·소품·담·다리 조각 사전 4/8

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **7872칸**, 16px 칸, 한 줄 **64칸** — 번호 n 의 칸은 행 n÷64, 열 n%64, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 7808 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-gungnae_wall_end_r · 국내성 성벽 end_r 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_end_r","w":1,"h":5,"class":"wall","upperTiles":[[4467],[4483],[4499],[4515],[4531]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h · 국내성 성벽 h 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h","w":1,"h":5,"class":"wall","upperTiles":[[4171],[4187],[4203],[4219],[4235]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h1 · 국내성 성벽 h1 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h1","w":1,"h":5,"class":"wall","upperTiles":[[4172],[4188],[4204],[4220],[4236]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h2 · 국내성 성벽 h2 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h2","w":1,"h":5,"class":"wall","upperTiles":[[4173],[4189],[4205],[4221],[4237]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_v · 국내성 성벽 v 2×1 · 2×1 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v","w":2,"h":1,"class":"wall","upperTiles":[[4174,4175]],"walk":["XX"]}
```

### jb-gungnae_wall_v1 · 국내성 성벽 v1 2×1 · 2×1 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v1","w":2,"h":1,"class":"wall","upperTiles":[[4386,4387]],"walk":["XX"]}
```

### jb-gungnae_wall_v1_e · 국내성 성벽 v1_e 2×1 · 2×1 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v1_e","w":2,"h":1,"class":"wall","upperTiles":[[4388,4389]],"walk":["XX"]}
```

### jb-gungnae_wall_v2 · 국내성 성벽 v2 2×1 · 2×1 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v2","w":2,"h":1,"class":"wall","upperTiles":[[4390,4391]],"walk":["XX"]}
```

### jb-gungnae_wall_v2_e · 국내성 성벽 v2_e 2×1 · 2×1 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v2_e","w":2,"h":1,"class":"wall","upperTiles":[[4392,4393]],"walk":["XX"]}
```

### jb-gungnae_wall_v_e · 국내성 성벽 v_e 2×1 · 2×1 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v_e","w":2,"h":1,"class":"wall","upperTiles":[[4384,4385]],"walk":["XX"]}
```

### jb-palace_wall_h · 궁 담 h 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_h","w":1,"h":2,"class":"wall","upperTiles":[[3562],[3578]],"walk":["X","X"]}
```

### jb-palace_wall_h1 · 궁 담 h1 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_h1","w":1,"h":2,"class":"wall","upperTiles":[[3563],[3579]],"walk":["X","X"]}
```

### jb-palace_wall_h2 · 궁 담 h2 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_h2","w":1,"h":2,"class":"wall","upperTiles":[[3564],[3580]],"walk":["X","X"]}
```

### jb-palace_wall_ne · 궁 담 ne 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_ne","w":1,"h":2,"class":"wall","upperTiles":[[3648],[3664]],"walk":["X","X"]}
```

### jb-palace_wall_nw · 궁 담 nw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_nw","w":1,"h":2,"class":"wall","upperTiles":[[3567],[3583]],"walk":["X","X"]}
```

### jb-palace_wall_se · 궁 담 se 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_se","w":1,"h":2,"class":"wall","upperTiles":[[3650],[3666]],"walk":["X","X"]}
```

### jb-palace_wall_sw · 궁 담 sw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_sw","w":1,"h":2,"class":"wall","upperTiles":[[3649],[3665]],"walk":["X","X"]}
```

### jb-palace_wall_v · 궁 담 v 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_v","w":1,"h":1,"class":"wall","upperTiles":[[3565]],"walk":["X"]}
```

### jb-palace_wall_v_e · 궁 담 v_e 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_v_e","w":1,"h":1,"class":"wall","upperTiles":[[3566]],"walk":["X"]}
```

### jb-wall_corner_ne · 토석담 corner_ne 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_ne","w":1,"h":2,"class":"wall","upperTiles":[[2261],[2277]],"walk":["X","X"]}
```

### jb-wall_corner_nw · 토석담 corner_nw 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_nw","w":1,"h":2,"class":"wall","upperTiles":[[2260],[2276]],"walk":["X","X"]}
```

### jb-wall_corner_se · 토석담 corner_se 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-wall_corner_se","w":1,"h":2,"class":"wall","upperTiles":[[2263],[2279]],"walk":["X","X"]}
```
